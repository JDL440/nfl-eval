import { describe, it, expect, beforeEach } from 'vitest';
import { Repository } from '../../src/db/repository.js';
import { encryptSecret, decryptSecret, isSecretCryptoAvailable } from '../../src/settings/crypto.js';
import { ensureBootstrapAdmin } from '../../src/settings/bootstrap.js';

describe('Settings schema and repository', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new Repository(':memory:');
  });

  // ── Users ──
  describe('users', () => {
    it('ensureBootstrapAdmin creates a new admin user', () => {
      const user = repo.ensureBootstrapAdmin('testadmin');
      expect(user.username).toBe('testadmin');
      expect(user.role).toBe('admin');
      expect(user.status).toBe('active');
      expect(user.id).toBeTruthy();
    });

    it('ensureBootstrapAdmin is idempotent', () => {
      const first = repo.ensureBootstrapAdmin('testadmin');
      const second = repo.ensureBootstrapAdmin('testadmin');
      expect(first.id).toBe(second.id);
    });

    it('getUserByUsername returns null for non-existent user', () => {
      expect(repo.getUserByUsername('nobody')).toBeNull();
    });

    it('getUserById returns the correct user', () => {
      const created = repo.ensureBootstrapAdmin('testadmin');
      const found = repo.getUserById(created.id);
      expect(found).not.toBeNull();
      expect(found!.username).toBe('testadmin');
    });

    it('getUserForSession joins session to user', () => {
      const user = repo.ensureBootstrapAdmin('testadmin');
      const expires = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      repo.createDashboardSession('sess-123', 'testadmin', expires);
      const found = repo.getUserForSession('sess-123');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
    });

    it('getUserForSession returns null for expired session', () => {
      repo.ensureBootstrapAdmin('testadmin');
      const expired = '2020-01-01 00:00:00';
      repo.createDashboardSession('sess-expired', 'testadmin', expired);
      expect(repo.getUserForSession('sess-expired')).toBeNull();
    });

    it('touchUserLogin updates last_login_at', () => {
      const user = repo.ensureBootstrapAdmin('testadmin');
      expect(user.last_login_at).toBeNull();
      repo.touchUserLogin(user.id);
      const updated = repo.getUserById(user.id);
      expect(updated!.last_login_at).not.toBeNull();
    });
  });

  // ── Workspace settings ──
  describe('workspace settings', () => {
    it('get returns null for unset key', () => {
      expect(repo.getWorkspaceSetting('llm', 'default_provider')).toBeNull();
    });

    it('set and get round-trips', () => {
      repo.setWorkspaceSetting('llm', 'default_model', '"claude-sonnet"', null);
      expect(repo.getWorkspaceSetting('llm', 'default_model')).toBe('"claude-sonnet"');
    });

    it('set overwrites existing value', () => {
      repo.setWorkspaceSetting('llm', 'key1', '"v1"', null);
      repo.setWorkspaceSetting('llm', 'key1', '"v2"', null);
      expect(repo.getWorkspaceSetting('llm', 'key1')).toBe('"v2"');
    });

    it('listWorkspaceSettings filters by namespace', () => {
      repo.setWorkspaceSetting('llm', 'k1', '"a"', null);
      repo.setWorkspaceSetting('publishing', 'k2', '"b"', null);
      const llmSettings = repo.listWorkspaceSettings('llm');
      expect(llmSettings).toHaveLength(1);
      expect(llmSettings[0].key).toBe('k1');
    });

    it('listWorkspaceSettings returns all when no namespace', () => {
      repo.setWorkspaceSetting('llm', 'k1', '"a"', null);
      repo.setWorkspaceSetting('publishing', 'k2', '"b"', null);
      expect(repo.listWorkspaceSettings()).toHaveLength(2);
    });
  });

  // ── User settings ──
  describe('user settings', () => {
    it('get returns null for unset key', () => {
      const user = repo.ensureBootstrapAdmin('admin');
      expect(repo.getUserSetting(user.id, 'ui', 'theme')).toBeNull();
    });

    it('set and get round-trips', () => {
      const user = repo.ensureBootstrapAdmin('admin');
      repo.setUserSetting(user.id, 'ui', 'theme', '"dark"');
      expect(repo.getUserSetting(user.id, 'ui', 'theme')).toBe('"dark"');
    });

    it('listUserSettings filters by namespace', () => {
      const user = repo.ensureBootstrapAdmin('admin');
      repo.setUserSetting(user.id, 'ui', 'k1', '"a"');
      repo.setUserSetting(user.id, 'llm', 'k2', '"b"');
      expect(repo.listUserSettings(user.id, 'ui')).toHaveLength(1);
    });
  });

  // ── Provider profiles ──
  describe('provider profiles', () => {
    it('creates and retrieves a profile', () => {
      const profile = repo.createProviderProfile({
        scopeType: 'workspace',
        providerId: 'copilot-cli',
        label: 'Default Copilot',
        configJson: '{"defaultModel":"claude-sonnet-4.5"}',
      });
      expect(profile.provider_id).toBe('copilot-cli');
      expect(profile.label).toBe('Default Copilot');

      const found = repo.getProviderProfile(profile.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(profile.id);
    });

    it('lists profiles by scope', () => {
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'P1' });
      repo.createProviderProfile({ scopeType: 'workspace', providerId: 'lmstudio', label: 'P2' });
      const profiles = repo.listProviderProfiles('workspace');
      expect(profiles).toHaveLength(2);
    });

    it('updates a profile', () => {
      const profile = repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'Old' });
      const updated = repo.updateProviderProfile(profile.id, { label: 'New' });
      expect(updated.label).toBe('New');
    });

    it('deletes a profile', () => {
      const profile = repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'Delete Me' });
      repo.deleteProviderProfile(profile.id);
      expect(repo.getProviderProfile(profile.id)).toBeNull();
    });

    it('setDefaultProviderProfile enforces single default per scope', () => {
      const p1 = repo.createProviderProfile({ scopeType: 'workspace', providerId: 'copilot-cli', label: 'P1', isDefault: true });
      const p2 = repo.createProviderProfile({ scopeType: 'workspace', providerId: 'lmstudio', label: 'P2' });

      // p1 should be default
      expect(repo.getProviderProfile(p1.id)!.is_default).toBe(1);
      expect(repo.getProviderProfile(p2.id)!.is_default).toBe(0);

      // Switch default to p2
      repo.setDefaultProviderProfile('workspace', null, p2.id);
      expect(repo.getProviderProfile(p1.id)!.is_default).toBe(0);
      expect(repo.getProviderProfile(p2.id)!.is_default).toBe(1);
    });
  });

  // ── Secrets ──
  describe('secrets', () => {
    it('set and get round-trips ciphertext', () => {
      repo.setEncryptedSecret('workspace', null, 'publishing', 'substack_token', 'encrypted_data');
      const result = repo.getEncryptedSecret('workspace', null, 'publishing', 'substack_token');
      expect(result).toBe('encrypted_data');
    });

    it('clear removes the secret', () => {
      repo.setEncryptedSecret('workspace', null, 'publishing', 'token', 'data');
      repo.clearEncryptedSecret('workspace', null, 'publishing', 'token');
      expect(repo.getEncryptedSecret('workspace', null, 'publishing', 'token')).toBeNull();
    });

    it('listSecretStatus does not include ciphertext', () => {
      repo.setEncryptedSecret('workspace', null, 'publishing', 'token', 'secret_data');
      const status = repo.listSecretStatus('workspace', null);
      expect(status).toHaveLength(1);
      expect(status[0].secret_key).toBe('token');
      expect((status[0] as any).ciphertext).toBeUndefined();
    });
  });

  // ── Audit ──
  describe('audit log', () => {
    it('records and retrieves audit entries', () => {
      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'workspace_setting',
        targetKey: 'llm.default_model',
        action: 'update',
        beforeJson: '"old"',
        afterJson: '"new"',
      });
      const entries = repo.listRecentSettingsAudit(10);
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('update');
      expect(entries[0].target_key).toBe('llm.default_model');
    });
  });
});

// ── Crypto tests ──
describe('Settings crypto', () => {
  it('isSecretCryptoAvailable returns false without master key', () => {
    const orig = process.env['NFL_SETTINGS_MASTER_KEY'];
    delete process.env['NFL_SETTINGS_MASTER_KEY'];
    expect(isSecretCryptoAvailable()).toBe(false);
    if (orig) process.env['NFL_SETTINGS_MASTER_KEY'] = orig;
  });

  it('encrypt/decrypt round-trips', () => {
    process.env['NFL_SETTINGS_MASTER_KEY'] = 'test-master-key-for-unit-tests';
    const plaintext = 'sk_live_abc123secret';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plaintext);
    delete process.env['NFL_SETTINGS_MASTER_KEY'];
  });

  it('decrypt fails with wrong key', () => {
    process.env['NFL_SETTINGS_MASTER_KEY'] = 'key-one';
    const encrypted = encryptSecret('secret');
    process.env['NFL_SETTINGS_MASTER_KEY'] = 'key-two';
    expect(() => decryptSecret(encrypted)).toThrow(/master key may have changed/);
    delete process.env['NFL_SETTINGS_MASTER_KEY'];
  });
});

// ── Bootstrap tests ──
describe('Bootstrap admin', () => {
  it('creates admin user with given username', () => {
    const repo = new Repository(':memory:');
    const result = ensureBootstrapAdmin(repo, 'myuser');
    expect(result.username).toBe('myuser');
    expect(result.created).toBe(true);
  });

  it('is idempotent — second call returns same user', () => {
    const repo = new Repository(':memory:');
    const first = ensureBootstrapAdmin(repo, 'admin');
    const second = ensureBootstrapAdmin(repo, 'admin');
    expect(second.id).toBe(first.id);
    expect(second.created).toBe(false);
  });

  it('defaults to admin when username is null', () => {
    const repo = new Repository(':memory:');
    const result = ensureBootstrapAdmin(repo, null);
    expect(result.username).toBe('admin');
  });
});
