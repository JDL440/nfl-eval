import type { Repository } from '../db/repository.js';
import type { AppConfig } from '../config/index.js';
import { decryptSecret, isSecretCryptoAvailable } from './crypto.js';
import type {
  ResolvedDashboardAuth,
  ResolvedProviderProfile,
  ResolvedProviderProfileSet,
  ProviderProfileResolution,
  ResolvedPublishingConfig,
  ResolvedTwitterConfig,
  ResolvedImageConfig,
  ResolvedUiPreferences,
  DiagnosticEntry,
  SettingsDiagnosticsSnapshot,
  SettingSource,
  ProviderProfileConfig,
} from './types.js';

export class SettingsResolver {
  constructor(
    private repo: Repository,
    private config: AppConfig,
  ) {}

  // ── Helper: get a workspace setting, parse JSON, return typed ──
  private ws(namespace: string, key: string): unknown | null {
    const raw = this.repo.getWorkspaceSetting(namespace, key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  // ── Helper: get a user setting, parse JSON ──
  private us(userId: string, namespace: string, key: string): unknown | null {
    const raw = this.repo.getUserSetting(userId, namespace, key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  // ── Helper: resolve with precedence ──
  private resolve<T>(sources: Array<{ value: T | null | undefined; source: SettingSource }>): { value: T | null; source: SettingSource } {
    for (const s of sources) {
      if (s.value !== null && s.value !== undefined) return { value: s.value, source: s.source };
    }
    return { value: null, source: 'default' };
  }

  // ── Helper: safely decrypt a secret, return null on failure ──
  private tryDecryptSecret(scopeType: string, scopeUserId: string | null, group: string, key: string): string | null {
    if (!isSecretCryptoAvailable()) return null;
    const ciphertext = this.repo.getEncryptedSecret(scopeType, scopeUserId, group, key);
    if (!ciphertext) return null;
    try {
      return decryptSecret(ciphertext);
    } catch {
      return null;
    }
  }

  // ── Dashboard Auth ──
  resolveDashboardAuth(): ResolvedDashboardAuth {
    const mode = (this.ws('dashboard_auth', 'mode') as string) ?? process.env['DASHBOARD_AUTH_MODE'] ?? 'local';
    const sessionCookieName = (this.ws('dashboard_auth', 'session_cookie_name') as string) ?? process.env['DASHBOARD_SESSION_COOKIE'] ?? 'nfl_dash_session';
    const sessionTtlHours = (this.ws('dashboard_auth', 'session_ttl_hours') as number) ?? (process.env['DASHBOARD_SESSION_TTL_HOURS'] ? parseInt(process.env['DASHBOARD_SESSION_TTL_HOURS'], 10) : 24);
    const secureCookies = (this.ws('dashboard_auth', 'secure_cookies') as boolean) ?? (process.env['DASHBOARD_SECURE_COOKIES'] === '1');
    const username = (this.ws('dashboard_auth', 'username') as string) ?? process.env['DASHBOARD_AUTH_USERNAME'] ?? undefined;

    return { mode, sessionCookieName, sessionTtlHours, secureCookies, username };
  }

  // ── Provider Profiles ──
  resolveProviderProfiles(): ResolvedProviderProfileSet {
    const rows = this.repo.listProviderProfiles('workspace');
    const profiles: ResolvedProviderProfile[] = rows.map(r => ({
      id: r.id,
      providerId: r.provider_id,
      label: r.label,
      isDefault: r.is_default === 1,
      enabled: r.enabled === 1,
      config: JSON.parse(r.config_json || '{}') as ProviderProfileConfig,
    }));
    const defaultProfile = profiles.find(p => p.isDefault && p.enabled) ?? null;
    return { profiles, defaultProfile };
  }

  resolveDefaultProviderProfile(articleLlmProvider?: string | null, userId?: string | null): ProviderProfileResolution {
    // 1. Article override
    if (articleLlmProvider) {
      const rows = this.repo.listProviderProfiles('workspace');
      const match = rows.find(r => r.provider_id === articleLlmProvider && r.enabled === 1);
      if (match) {
        return {
          profile: {
            id: match.id,
            providerId: match.provider_id,
            label: match.label,
            isDefault: match.is_default === 1,
            enabled: true,
            config: JSON.parse(match.config_json || '{}'),
          },
          source: 'article',
        };
      }
      return { profile: null, source: 'article', warning: `Article specifies provider "${articleLlmProvider}" which has no matching profile` };
    }

    // 2. User preference
    if (userId) {
      const preferredId = this.us(userId, 'llm', 'preferred_provider_profile_id') as string | null;
      if (preferredId) {
        const row = this.repo.getProviderProfile(preferredId);
        if (row && row.enabled === 1) {
          return {
            profile: {
              id: row.id,
              providerId: row.provider_id,
              label: row.label,
              isDefault: row.is_default === 1,
              enabled: true,
              config: JSON.parse(row.config_json || '{}'),
            },
            source: 'user',
          };
        }
      }
    }

    // 3. Workspace default
    const { defaultProfile } = this.resolveProviderProfiles();
    if (defaultProfile) {
      return { profile: defaultProfile, source: 'workspace' };
    }

    // 4. Env fallback
    const envProvider = process.env['LLM_PROVIDER'];
    if (envProvider) {
      return { profile: null, source: 'env', warning: `Falling back to env LLM_PROVIDER="${envProvider}"` };
    }

    return { profile: null, source: 'default', warning: 'No provider profiles or env configuration found' };
  }

  // ── Publishing Config ──
  resolvePublishingConfig(): ResolvedPublishingConfig {
    const substackPublicationUrl = (this.ws('publishing', 'substack_publication_url') as string) ?? process.env['SUBSTACK_PUBLICATION_URL'] ?? null;
    const substackStageUrl = (this.ws('publishing', 'substack_stage_url') as string) ?? process.env['SUBSTACK_STAGE_URL'] ?? null;
    const notesEndpointPath = (this.ws('publishing', 'notes_endpoint_path') as string) ?? process.env['NOTES_ENDPOINT_PATH'] ?? null;
    const defaultAudience = (this.ws('publishing', 'default_audience') as string) ?? 'everyone';
    const enablePublishAll = (this.ws('publishing', 'enable_publish_all') as boolean) ?? true;
    const enableNotes = (this.ws('publishing', 'enable_notes') as boolean) ?? true;
    const enableTwitter = (this.ws('publishing', 'enable_twitter') as boolean) ?? true;

    const substackTokenConfigured = Boolean(
      this.tryDecryptSecret('workspace', null, 'publishing', 'substack_token')
      ?? process.env['SUBSTACK_TOKEN']?.trim()
    );
    const twitterCredentialsConfigured = Boolean(
      this.tryDecryptSecret('workspace', null, 'twitter', 'api_key')
      ?? process.env['TWITTER_API_KEY']?.trim()
    );

    return {
      substackPublicationUrl, substackStageUrl, notesEndpointPath,
      defaultAudience, enablePublishAll, enableNotes, enableTwitter,
      substackTokenConfigured, twitterCredentialsConfigured,
    };
  }

  // ── Twitter Config (secret resolution for service bootstrap) ──
  resolveTwitterConfig(): ResolvedTwitterConfig {
    const apiKey = this.tryDecryptSecret('workspace', null, 'twitter', 'api_key') ?? process.env['TWITTER_API_KEY'] ?? null;
    const apiSecret = this.tryDecryptSecret('workspace', null, 'twitter', 'api_secret') ?? process.env['TWITTER_API_SECRET'] ?? null;
    const accessToken = this.tryDecryptSecret('workspace', null, 'twitter', 'access_token') ?? process.env['TWITTER_ACCESS_TOKEN'] ?? null;
    const accessTokenSecret = this.tryDecryptSecret('workspace', null, 'twitter', 'access_token_secret') ?? process.env['TWITTER_ACCESS_TOKEN_SECRET'] ?? null;

    return {
      apiKey, apiSecret, accessToken, accessTokenSecret,
      configured: Boolean(apiKey && apiSecret && accessToken && accessTokenSecret),
    };
  }

  // ── Image Config ──
  resolveImageConfig(): ResolvedImageConfig {
    const provider = (this.ws('images', 'provider') as string) ?? 'azure';
    const defaultEnabled = (this.ws('images', 'default_enabled') as boolean) ?? true;
    const geminiKeyConfigured = Boolean(
      this.tryDecryptSecret('workspace', null, 'images', 'gemini_api_key')
      ?? process.env['GEMINI_API_KEY']?.trim()
    );
    const azureKeyConfigured = Boolean(
      this.tryDecryptSecret('workspace', null, 'images', 'azure_api_key')
      ?? process.env['AZURE_IMAGE_API_KEY']?.trim()
    );
    return { provider, defaultEnabled, geminiKeyConfigured, azureKeyConfigured };
  }

  // ── UI Preferences ──
  resolveUiPreferences(userId?: string | null): ResolvedUiPreferences {
    let defaultTraceView = 'preview';
    let defaultArticleTab = 'overview';

    if (userId) {
      const userTrace = this.us(userId, 'ui', 'default_trace_view') as string | null;
      if (userTrace) defaultTraceView = userTrace;
      const userTab = this.us(userId, 'ui', 'default_article_tab') as string | null;
      if (userTab) defaultArticleTab = userTab;
    }

    if (defaultTraceView === 'preview') {
      const wsTrace = this.ws('ui', 'default_trace_view') as string | null;
      if (wsTrace) defaultTraceView = wsTrace;
    }
    if (defaultArticleTab === 'overview') {
      const wsTab = this.ws('ui', 'default_article_tab') as string | null;
      if (wsTab) defaultArticleTab = wsTab;
    }

    return { defaultTraceView, defaultArticleTab };
  }

  // ── Diagnostics ──
  buildDiagnosticsSnapshot(): SettingsDiagnosticsSnapshot {
    const entries: DiagnosticEntry[] = [];

    const add = (key: string, value: string | null, source: SettingSource, redacted = false, warning?: string) => {
      entries.push({ key, effectiveValue: redacted ? (value ? '••••••' : null) : value, redacted, source, warning });
    };

    // LLM
    const { defaultProfile } = this.resolveProviderProfiles();
    if (defaultProfile) {
      add('llm.default_provider', defaultProfile.providerId, 'workspace');
      add('llm.default_model', (defaultProfile.config as Record<string, unknown>)?.defaultModel as string ?? '(profile default)', 'workspace');
    } else {
      add('llm.default_provider', process.env['LLM_PROVIDER'] ?? null, 'env', false, 'No DB provider profiles configured');
    }

    // Publishing
    const pub = this.resolvePublishingConfig();
    add('publishing.substack_url', pub.substackPublicationUrl, pub.substackPublicationUrl ? 'workspace' : 'env');
    add('publishing.substack_token', pub.substackTokenConfigured ? 'configured' : null, pub.substackTokenConfigured ? 'workspace' : 'env', true);
    add('publishing.twitter_configured', String(pub.twitterCredentialsConfigured), pub.twitterCredentialsConfigured ? 'workspace' : 'env');

    // Images
    const img = this.resolveImageConfig();
    add('images.provider', img.provider, 'workspace');
    add('images.gemini_key', img.geminiKeyConfigured ? 'configured' : null, img.geminiKeyConfigured ? 'workspace' : 'env', true);
    add('images.azure_key', img.azureKeyConfigured ? 'configured' : null, img.azureKeyConfigured ? 'workspace' : 'env', true);

    // Auth
    const auth = this.resolveDashboardAuth();
    add('auth.mode', auth.mode, 'workspace');
    add('auth.session_ttl', String(auth.sessionTtlHours), 'workspace');

    // Crypto
    add('crypto.master_key', isSecretCryptoAvailable() ? 'configured' : 'NOT SET', isSecretCryptoAvailable() ? 'env' : 'default', true,
      isSecretCryptoAvailable() ? undefined : 'Secret editing is disabled without NFL_SETTINGS_MASTER_KEY');

    // Service readiness
    const serviceReadiness: Record<string, { ready: boolean; detail: string }> = {
      'substack': { ready: pub.substackTokenConfigured && Boolean(pub.substackPublicationUrl), detail: pub.substackTokenConfigured ? 'Configured' : 'Token missing' },
      'twitter': { ready: pub.twitterCredentialsConfigured, detail: pub.twitterCredentialsConfigured ? 'Configured' : 'Credentials missing' },
      'images': { ready: img.azureKeyConfigured || img.geminiKeyConfigured, detail: img.azureKeyConfigured ? 'Azure configured' : img.geminiKeyConfigured ? 'Gemini configured' : 'No image API key' },
    };

    return { entries, serviceReadiness };
  }
}
