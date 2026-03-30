import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Repository } from '../../src/db/repository.js';
import { SettingsResolver } from '../../src/settings/resolver.js';
import { encryptSecret } from '../../src/settings/crypto.js';
import type { AppConfig } from '../../src/config/index.js';

// Minimal AppConfig stub — resolver only needs a few fields
function stubConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    dataDir: '/tmp/test',
    env: 'development',
    league: 'nfl',
    leagueConfig: { name: 'Test Lab', panelName: 'Test', dataSource: 'test', positions: [], substackConfig: { labName: 'Test', subscribeCaption: '', footerPatterns: [] } },
    dbPath: ':memory:',
    articlesDir: '/tmp/test/articles',
    imagesDir: '/tmp/test/images',
    chartersDir: '/tmp/test/charters',
    skillsDir: '/tmp/test/skills',
    memoryDbPath: '/tmp/test/memory.db',
    logsDir: '/tmp/test/logs',
    cacheDir: '/tmp/test/cache',
    port: 3456,
    ...overrides,
  } as AppConfig;
}

describe('SettingsResolver', () => {
  let repo: Repository;
  let resolver: SettingsResolver;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    repo = new Repository(':memory:');
    resolver = new SettingsResolver(repo, stubConfig());
    // Save env vars we might mutate
    for (const key of ['LLM_PROVIDER', 'SUBSTACK_TOKEN', 'SUBSTACK_PUBLICATION_URL', 'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET', 'GEMINI_API_KEY', 'DASHBOARD_AUTH_MODE', 'NFL_SETTINGS_MASTER_KEY']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  // ── Dashboard Auth ──
  describe('resolveDashboardAuth', () => {
    it('returns defaults when nothing is configured', () => {
      const auth = resolver.resolveDashboardAuth();
      expect(auth.mode).toBe('local');
      expect(auth.sessionCookieName).toBe('nfl_dash_session');
      expect(auth.sessionTtlHours).toBe(24);
      expect(auth.secureCookies).toBe(false);
    });

    it('workspace settings override env defaults', () => {
      repo.setWorkspaceSetting('dashboard_auth', 'mode', '"off"', null);
      repo.setWorkspaceSetting('dashboard_auth', 'session_ttl_hours', '48', null);
      const auth = resolver.resolveDashboardAuth();
      expect(auth.mode).toBe('off');
      expect(auth.sessionTtlHours).toBe(48);
    });

    it('env vars serve as fallback', () => {
      process.env['DASHBOARD_AUTH_MODE'] = 'off';
      const auth = resolver.resolveDashboardAuth();
      expect(auth.mode).toBe('off');
    });
  });

  // ── Provider Profiles ──
  describe('resolveProviderProfiles', () => {
    it('returns empty set when no profiles exist', () => {
      const result = resolver.resolveProviderProfiles();
      expect(result.profiles).toHaveLength(0);
      expect(result.defaultProfile).toBeNull();
    });

    it('returns profiles with default identified', () => {
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'Copilot', isDefault: true });
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'lmstudio', label: 'LM Studio' });
      const result = resolver.resolveProviderProfiles();
      expect(result.profiles).toHaveLength(2);
      expect(result.defaultProfile).not.toBeNull();
      expect(result.defaultProfile!.providerId).toBe('copilot-cli');
    });
  });

  // ── Provider Resolution Precedence ──
  describe('resolveDefaultProviderProfile', () => {
    it('article override takes precedence', () => {
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'Copilot', isDefault: true });
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'lmstudio', label: 'LM Studio' });
      const result = resolver.resolveDefaultProviderProfile('copilot-cli');
      expect(result.source).toBe('article');
      expect(result.profile!.providerId).toBe('copilot-cli');
    });

    it('user preference overrides workspace default', () => {
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'Copilot', isDefault: true });
      const altProfile = repo.createProviderProfile({ scopeType: 'workspace', providerId: 'lmstudio', label: 'LM Studio' });
      const user = repo.ensureBootstrapAdmin('testadmin');
      repo.setUserSetting(user.id, 'llm', 'preferred_provider_profile_id', JSON.stringify(altProfile.id));

      const result = resolver.resolveDefaultProviderProfile(null, user.id);
      expect(result.source).toBe('user');
      expect(result.profile!.providerId).toBe('lmstudio');
    });

    it('falls back to workspace default when no article or user pref', () => {
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'Copilot', isDefault: true });
      const result = resolver.resolveDefaultProviderProfile();
      expect(result.source).toBe('workspace');
      expect(result.profile!.providerId).toBe('copilot-cli');
    });

    it('falls back to env when no profiles exist', () => {
      process.env['LLM_PROVIDER'] = 'lmstudio';
      const result = resolver.resolveDefaultProviderProfile();
      expect(result.source).toBe('env');
      expect(result.profile).toBeNull();
      expect(result.warning).toContain('LLM_PROVIDER');
    });

    it('returns default source with warning when nothing configured', () => {
      const result = resolver.resolveDefaultProviderProfile();
      expect(result.source).toBe('default');
      expect(result.warning).toBeTruthy();
    });

    it('warns when article specifies unknown provider', () => {
      const result = resolver.resolveDefaultProviderProfile('nonexistent-provider');
      expect(result.source).toBe('article');
      expect(result.warning).toContain('nonexistent-provider');
    });
  });

  // ── Publishing Config ──
  describe('resolvePublishingConfig', () => {
    it('returns defaults when nothing configured', () => {
      const pub = resolver.resolvePublishingConfig();
      expect(pub.substackPublicationUrl).toBeNull();
      expect(pub.defaultAudience).toBe('everyone');
      expect(pub.enablePublishAll).toBe(true);
      expect(pub.substackTokenConfigured).toBe(false);
    });

    it('workspace settings override env', () => {
      repo.setWorkspaceSetting('publishing', 'substack_publication_url', '"https://my.substack.com"', null);
      repo.setWorkspaceSetting('publishing', 'default_audience', '"only_paid"', null);
      const pub = resolver.resolvePublishingConfig();
      expect(pub.substackPublicationUrl).toBe('https://my.substack.com');
      expect(pub.defaultAudience).toBe('only_paid');
    });

    it('detects substack token from env fallback', () => {
      process.env['SUBSTACK_TOKEN'] = 'some-token';
      const pub = resolver.resolvePublishingConfig();
      expect(pub.substackTokenConfigured).toBe(true);
    });

    it('detects substack token from encrypted secret', () => {
      process.env['NFL_SETTINGS_MASTER_KEY'] = 'test-key-for-resolver-test';
      const encrypted = encryptSecret('my-substack-token');
      repo.setEncryptedSecret('workspace', null, 'publishing', 'substack_token', encrypted);
      const pub = resolver.resolvePublishingConfig();
      expect(pub.substackTokenConfigured).toBe(true);
    });
  });

  // ── Image Config ──
  describe('resolveImageConfig', () => {
    it('returns defaults', () => {
      const img = resolver.resolveImageConfig();
      expect(img.provider).toBe('gemini');
      expect(img.defaultEnabled).toBe(true);
      expect(img.geminiKeyConfigured).toBe(false);
    });

    it('detects gemini key from env', () => {
      process.env['GEMINI_API_KEY'] = 'some-key';
      const img = resolver.resolveImageConfig();
      expect(img.geminiKeyConfigured).toBe(true);
    });
  });

  // ── UI Preferences ──
  describe('resolveUiPreferences', () => {
    it('returns application defaults', () => {
      const ui = resolver.resolveUiPreferences();
      expect(ui.defaultTraceView).toBe('preview');
      expect(ui.defaultArticleTab).toBe('overview');
    });

    it('user settings override defaults', () => {
      const user = repo.ensureBootstrapAdmin('admin');
      repo.setUserSetting(user.id, 'ui', 'default_trace_view', '"raw"');
      const ui = resolver.resolveUiPreferences(user.id);
      expect(ui.defaultTraceView).toBe('raw');
    });

    it('workspace settings fill in when no user pref', () => {
      repo.setWorkspaceSetting('ui', 'default_trace_view', '"markdown"', null);
      const ui = resolver.resolveUiPreferences();
      expect(ui.defaultTraceView).toBe('markdown');
    });
  });

  // ── Diagnostics ──
  describe('buildDiagnosticsSnapshot', () => {
    it('includes crypto warning when master key not set', () => {
      const diag = resolver.buildDiagnosticsSnapshot();
      const cryptoEntry = diag.entries.find(e => e.key === 'crypto.master_key');
      expect(cryptoEntry).toBeDefined();
      expect(cryptoEntry!.warning).toContain('NFL_SETTINGS_MASTER_KEY');
    });

    it('includes service readiness', () => {
      const diag = resolver.buildDiagnosticsSnapshot();
      expect(diag.serviceReadiness).toHaveProperty('substack');
      expect(diag.serviceReadiness).toHaveProperty('twitter');
      expect(diag.serviceReadiness).toHaveProperty('images');
    });

    it('redacts secret values', () => {
      const diag = resolver.buildDiagnosticsSnapshot();
      const secrets = diag.entries.filter(e => e.redacted);
      expect(secrets.length).toBeGreaterThan(0);
      for (const s of secrets) {
        if (s.effectiveValue !== null) {
          expect(s.effectiveValue).not.toContain('sk_');
        }
      }
    });
  });
});
