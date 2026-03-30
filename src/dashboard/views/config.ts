/**
 * config.ts — Tabbed admin Settings page driven by the DB-backed resolver.
 */

import { renderLayout, escapeHtml } from './layout.js';

// ── Legacy interfaces (kept for backward-compat / test contracts) ───────────

export interface EnvVarStatus {
  key: string;
  isSet: boolean;
  displayValue?: string;
}

export interface LLMProviderInfo {
  name: string;
  url?: string;
  model: string;
  registeredProviders: Array<{ id: string; name: string; default?: boolean }>;
}

export interface ServiceStatusInfo {
  name: string;
  state: 'ready' | 'partial' | 'disabled';
  detail: string;
}

// ── New resolver-driven page data ───────────────────────────────────────────

export interface ConfigPageData {
  labName: string;
  league: string;
  environment: string;
  activeTab?: string;
  // Overview
  defaultProvider: { label: string; providerId: string } | null;
  serviceReadiness: Record<string, { ready: boolean; detail: string }>;
  recentAudit: Array<{ action: string; targetKey: string; createdAt: string }>;
  // LLM Providers
  providerProfiles: Array<{
    id: string;
    providerId: string;
    label: string;
    isDefault: boolean;
    enabled: boolean;
    config: Record<string, unknown>;
  }>;
  // Publishing
  publishing: {
    substackPublicationUrl: string | null;
    substackStageUrl: string | null;
    notesEndpointPath: string | null;
    defaultAudience: string;
    enablePublishAll: boolean;
    enableNotes: boolean;
    enableTwitter: boolean;
    substackTokenConfigured: boolean;
    twitterCredentialsConfigured: boolean;
  };
  // Images
  images: {
    provider: string;
    defaultEnabled: boolean;
    geminiKeyConfigured: boolean;
  };
  // Access
  dashboardAuth: {
    mode: string;
    sessionCookieName: string;
    sessionTtlHours: number;
    secureCookies: boolean;
    username?: string;
  };
  // UI Preferences
  uiPreferences: {
    defaultTraceView: string;
    defaultArticleTab: string;
  };
  // Diagnostics
  diagnostics: {
    entries: Array<{
      key: string;
      effectiveValue: string | null;
      redacted: boolean;
      source: string;
      warning?: string;
    }>;
    serviceReadiness: Record<string, { ready: boolean; detail: string }>;
  };
  // Crypto
  secretCryptoAvailable: boolean;
  // Memory / maintenance
  memoryStatus: {
    storagePath: string;
    refreshAllAvailable: boolean;
  };
}

// ── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'providers', label: 'LLM Providers' },
  { id: 'publishing', label: 'Publishing' },
  { id: 'images', label: 'Images' },
  { id: 'access', label: 'Access' },
  { id: 'preferences', label: 'Personal Preferences' },
  { id: 'diagnostics', label: 'Diagnostics' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function readinessBadge(ready: boolean): string {
  return ready
    ? '<span class="badge badge-verdict-approved">Ready</span>'
    : '<span class="badge badge-verdict-reject">Not configured</span>';
}

function secretStatusHtml(configured: boolean): string {
  return configured
    ? '<span class="secret-status configured">✓ Configured</span>'
    : '<span class="secret-status not-configured">Not configured</span>';
}

function toggleChecked(value: boolean): string {
  return value ? ' checked' : '';
}

function optionSelected(current: string, value: string): string {
  return current === value ? ' selected' : '';
}

// ── Tab bar ─────────────────────────────────────────────────────────────────

function renderTabBar(active: TabId): string {
  return `<nav class="settings-tabs" aria-label="Settings sections">
    ${TABS.map((t) =>
      `<a href="/config?tab=${t.id}" class="settings-tab${t.id === active ? ' active' : ''}">${escapeHtml(t.label)}</a>`,
    ).join('\n    ')}
  </nav>`;
}

// ── Tab 1: Overview ─────────────────────────────────────────────────────────

function renderOverviewTab(data: ConfigPageData): string {
  const { defaultProvider, serviceReadiness, dashboardAuth, recentAudit } = data;

  const providerCard = defaultProvider
    ? `<div class="provider-profile-card">
        <div class="profile-header">
          <strong>${escapeHtml(defaultProvider.label)}</strong>
          <span class="badge badge-team">${escapeHtml(defaultProvider.providerId)}</span>
        </div>
        <p class="muted">Default provider profile</p>
      </div>`
    : '<p class="empty-state">No default provider profile configured.</p>';

  const readinessEntries = Object.entries(serviceReadiness);
  const readinessCards = readinessEntries.length > 0
    ? `<div class="settings-service-list">
        ${readinessEntries.map(([name, s]) => `
          <article class="settings-service-card">
            <div class="settings-service-header">
              <strong>${escapeHtml(name)}</strong>
              ${readinessBadge(s.ready)}
            </div>
            <p>${escapeHtml(s.detail)}</p>
          </article>`).join('')}
      </div>`
    : '';

  const auditRows = recentAudit.length > 0
    ? `<table class="artifact-table responsive-table">
        <thead><tr><th>Action</th><th>Key</th><th>When</th></tr></thead>
        <tbody>
          ${recentAudit.map((a) => `
            <tr>
              <td data-label="Action">${escapeHtml(a.action)}</td>
              <td data-label="Key"><code>${escapeHtml(a.targetKey)}</code></td>
              <td data-label="When">${escapeHtml(a.createdAt)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty-state">No recent settings changes.</p>';

  return `
    <section class="detail-section settings-panel">
      <h2>Default Provider</h2>
      ${providerCard}
    </section>
    <section class="detail-section settings-panel">
      <h2>Service Readiness</h2>
      ${readinessCards}
      <dl class="settings-kv">
        <div><dt>Auth mode</dt><dd><span class="badge badge-depth">${escapeHtml(dashboardAuth.mode)}</span></dd></div>
      </dl>
    </section>
    <section class="detail-section settings-panel">
      <h2>Recent Settings Changes</h2>
      ${auditRows}
    </section>`;
}

// ── Tab 2: LLM Providers ───────────────────────────────────────────────────

function renderProvidersTab(data: ConfigPageData): string {
  const { providerProfiles } = data;

  const profileCards = providerProfiles.length > 0
    ? providerProfiles.map((p) => `
      <div class="provider-profile-card">
        <div class="profile-header">
          <div>
            <strong>${escapeHtml(p.label)}</strong>
            <span class="badge badge-team">${escapeHtml(p.providerId)}</span>
            ${p.isDefault ? '<span class="badge badge-verdict-approved">Default</span>' : ''}
            ${p.enabled ? '' : '<span class="badge badge-verdict-reject">Disabled</span>'}
          </div>
          <div class="profile-actions">
            ${!p.isDefault ? `<form class="admin-inline-form" hx-post="/api/settings/provider-profiles/${escapeHtml(p.id)}/set-default" hx-target="#provider-result" hx-swap="innerHTML">
              <button type="submit" class="btn">Set Default</button>
            </form>` : ''}
            <form class="admin-inline-form" hx-post="/api/settings/provider-profiles/${escapeHtml(p.id)}/toggle" hx-target="#provider-result" hx-swap="innerHTML">
              <button type="submit" class="btn">${p.enabled ? 'Disable' : 'Enable'}</button>
            </form>
            <form class="admin-inline-form" hx-delete="/api/settings/provider-profiles/${escapeHtml(p.id)}" hx-target="#provider-result" hx-swap="innerHTML" hx-confirm="Delete profile '${escapeHtml(p.label)}'?">
              <button type="submit" class="btn">Delete</button>
            </form>
          </div>
        </div>
        <dl class="settings-kv">
          ${Object.entries(p.config).map(([k, v]) =>
            `<div><dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(String(v))}</code></dd></div>`,
          ).join('')}
        </dl>
      </div>`).join('')
    : '<p class="empty-state">No provider profiles configured.</p>';

  return `
    <section class="detail-section settings-panel">
      <h2>Provider Profiles</h2>
      ${profileCards}
      <div id="provider-result" class="settings-result"></div>
    </section>
    <section class="detail-section settings-panel">
      <h2>Add Profile</h2>
      <form class="settings-form" hx-post="/api/settings/provider-profiles" hx-target="#add-profile-result" hx-swap="innerHTML">
        <div class="form-group">
          <label for="provider-id">Provider</label>
          <select id="provider-id" name="providerId" required>
            <option value="copilot-cli">copilot-cli</option>
            <option value="copilot-api">copilot-api</option>
            <option value="lmstudio">lmstudio</option>
            <option value="mock">mock</option>
          </select>
        </div>
        <div class="form-group">
          <label for="profile-label">Label</label>
          <input type="text" id="profile-label" name="label" required placeholder="e.g. My Copilot Profile">
        </div>
        <div class="form-group">
          <label for="profile-model">Default Model</label>
          <input type="text" id="profile-model" name="defaultModel" placeholder="e.g. gpt-4o">
          <p class="form-hint">Optional. Leave blank for provider default.</p>
        </div>
        <div class="form-group">
          <label for="profile-baseurl">Base URL (LM Studio only)</label>
          <input type="url" id="profile-baseurl" name="baseUrl" placeholder="http://localhost:1234/v1">
          <p class="form-hint">Only used for the lmstudio provider.</p>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Add Profile</button>
        </div>
      </form>
      <div id="add-profile-result" class="settings-result"></div>
    </section>`;
}

// ── Tab 3: Publishing ───────────────────────────────────────────────────────

function renderPublishingTab(data: ConfigPageData): string {
  const { publishing } = data;

  return `
    <section class="detail-section settings-panel">
      <h2>Substack &amp; Distribution</h2>
      <form class="settings-form" hx-post="/api/settings/workspace" hx-target="#publishing-result" hx-swap="innerHTML">
        <input type="hidden" name="namespace" value="publishing">
        <div class="form-group">
          <label for="pub-substack-url">Substack Publication URL</label>
          <input type="url" id="pub-substack-url" name="substackPublicationUrl" value="${escapeHtml(publishing.substackPublicationUrl || '')}" placeholder="https://yourname.substack.com">
        </div>
        <div class="form-group">
          <label for="pub-stage-url">Substack Stage URL</label>
          <input type="url" id="pub-stage-url" name="substackStageUrl" value="${escapeHtml(publishing.substackStageUrl || '')}" placeholder="https://yourname.substack.com/api/v1/drafts">
        </div>
        <div class="form-group">
          <label for="pub-notes-endpoint">Notes Endpoint Path</label>
          <input type="text" id="pub-notes-endpoint" name="notesEndpointPath" value="${escapeHtml(publishing.notesEndpointPath || '')}" placeholder="/api/v1/notes">
        </div>
        <div class="form-group">
          <label for="pub-audience">Default Audience</label>
          <select id="pub-audience" name="defaultAudience">
            <option value="everyone"${optionSelected(publishing.defaultAudience, 'everyone')}>Everyone</option>
            <option value="only_paid"${optionSelected(publishing.defaultAudience, 'only_paid')}>Only paid</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="enablePublishAll" value="true"${toggleChecked(publishing.enablePublishAll)}> Enable publish-all</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="enableNotes" value="true"${toggleChecked(publishing.enableNotes)}> Enable notes</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="enableTwitter" value="true"${toggleChecked(publishing.enableTwitter)}> Enable Twitter posting</label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Publishing Settings</button>
        </div>
      </form>
      <div id="publishing-result" class="settings-result"></div>
    </section>

    <section class="detail-section settings-panel">
      <h2>Secrets</h2>
      <dl class="settings-kv">
        <div><dt>Substack Token</dt><dd>${secretStatusHtml(publishing.substackTokenConfigured)}</dd></div>
        <div><dt>Twitter Credentials</dt><dd>${secretStatusHtml(publishing.twitterCredentialsConfigured)}</dd></div>
      </dl>
      <form class="settings-form" hx-post="/api/settings/secrets" hx-target="#publishing-secrets-result" hx-swap="innerHTML">
        <div class="form-group">
          <label for="secret-substack-token">Substack Token</label>
          <input type="password" id="secret-substack-token" name="substackToken" placeholder="Paste new token to update">
          <p class="form-hint">Write-only. Leave blank to keep current value.</p>
        </div>
        <div class="form-group">
          <label for="secret-twitter-key">Twitter API Key</label>
          <input type="password" id="secret-twitter-key" name="twitterApiKey" placeholder="Paste new key to update">
        </div>
        <div class="form-group">
          <label for="secret-twitter-secret">Twitter API Secret</label>
          <input type="password" id="secret-twitter-secret" name="twitterApiSecret" placeholder="Paste new secret to update">
        </div>
        <div class="form-group">
          <label for="secret-twitter-access">Twitter Access Token</label>
          <input type="password" id="secret-twitter-access" name="twitterAccessToken" placeholder="Paste new token to update">
        </div>
        <div class="form-group">
          <label for="secret-twitter-access-secret">Twitter Access Token Secret</label>
          <input type="password" id="secret-twitter-access-secret" name="twitterAccessTokenSecret" placeholder="Paste new secret to update">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Secrets</button>
        </div>
      </form>
      <div id="publishing-secrets-result" class="settings-result"></div>
    </section>`;
}

// ── Tab 4: Images ───────────────────────────────────────────────────────────

function renderImagesTab(data: ConfigPageData): string {
  const { images } = data;

  return `
    <section class="detail-section settings-panel">
      <h2>Image Generation</h2>
      <form class="settings-form" hx-post="/api/settings/workspace" hx-target="#images-result" hx-swap="innerHTML">
        <input type="hidden" name="namespace" value="images">
        <div class="form-group">
          <label for="img-provider">Provider</label>
          <select id="img-provider" name="provider">
            <option value="gemini"${optionSelected(images.provider, 'gemini')}>Gemini</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="defaultEnabled" value="true"${toggleChecked(images.defaultEnabled)}> Enable image generation by default</label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Image Settings</button>
        </div>
      </form>
      <div id="images-result" class="settings-result"></div>
    </section>

    <section class="detail-section settings-panel">
      <h2>API Key</h2>
      <dl class="settings-kv">
        <div><dt>Gemini API Key</dt><dd>${secretStatusHtml(images.geminiKeyConfigured)}</dd></div>
      </dl>
      <form class="settings-form" hx-post="/api/settings/secrets" hx-target="#images-secrets-result" hx-swap="innerHTML">
        <div class="form-group">
          <label for="secret-gemini-key">Gemini API Key</label>
          <input type="password" id="secret-gemini-key" name="geminiApiKey" placeholder="Paste new key to update">
          <p class="form-hint">Write-only. Leave blank to keep current value.</p>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Key</button>
        </div>
      </form>
      <div id="images-secrets-result" class="settings-result"></div>
    </section>`;
}

// ── Tab 5: Access ───────────────────────────────────────────────────────────

function renderAccessTab(data: ConfigPageData): string {
  const { dashboardAuth } = data;

  return `
    <section class="detail-section settings-panel">
      <h2>Dashboard Authentication</h2>
      <form class="settings-form" hx-post="/api/settings/workspace" hx-target="#access-result" hx-swap="innerHTML">
        <input type="hidden" name="namespace" value="dashboard_auth">
        <div class="form-group">
          <label for="auth-mode">Auth Mode</label>
          <select id="auth-mode" name="mode">
            <option value="local"${optionSelected(dashboardAuth.mode, 'local')}>Local</option>
            <option value="off"${optionSelected(dashboardAuth.mode, 'off')}>Off</option>
          </select>
        </div>
        <div class="form-group">
          <label for="auth-ttl">Session TTL (hours)</label>
          <input type="number" id="auth-ttl" name="sessionTtlHours" value="${dashboardAuth.sessionTtlHours}" min="1">
        </div>
        <div class="form-group">
          <label for="auth-cookie">Session Cookie Name</label>
          <input type="text" id="auth-cookie" name="sessionCookieName" value="${escapeHtml(dashboardAuth.sessionCookieName)}">
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="secureCookies" value="true"${toggleChecked(dashboardAuth.secureCookies)}> Secure cookies (HTTPS only)</label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Access Settings</button>
        </div>
      </form>
      <div class="settings-callout">
        <strong>Note:</strong> Username and password are managed via environment variables (<code>DASHBOARD_USER</code> / <code>DASHBOARD_PASS</code>).
      </div>
      <div id="access-result" class="settings-result"></div>
    </section>`;
}

// ── Tab 6: Personal Preferences ─────────────────────────────────────────────

function renderPreferencesTab(data: ConfigPageData): string {
  const { uiPreferences } = data;

  return `
    <section class="detail-section settings-panel">
      <h2>UI Preferences</h2>
      <form class="settings-form" hx-post="/api/settings/me" hx-target="#prefs-result" hx-swap="innerHTML">
        <div class="form-group">
          <label for="pref-trace-view">Default Trace View</label>
          <select id="pref-trace-view" name="defaultTraceView">
            <option value="preview"${optionSelected(uiPreferences.defaultTraceView, 'preview')}>Preview</option>
            <option value="raw"${optionSelected(uiPreferences.defaultTraceView, 'raw')}>Raw</option>
            <option value="markdown"${optionSelected(uiPreferences.defaultTraceView, 'markdown')}>Markdown</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pref-article-tab">Default Article Tab</label>
          <select id="pref-article-tab" name="defaultArticleTab">
            <option value="overview"${optionSelected(uiPreferences.defaultArticleTab, 'overview')}>Overview</option>
            <option value="content"${optionSelected(uiPreferences.defaultArticleTab, 'content')}>Content</option>
            <option value="traces"${optionSelected(uiPreferences.defaultArticleTab, 'traces')}>Traces</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Preferences</button>
        </div>
      </form>
      <div id="prefs-result" class="settings-result"></div>
    </section>`;
}

// ── Tab 7: Diagnostics ──────────────────────────────────────────────────────

function renderDiagnosticsTab(data: ConfigPageData): string {
  const { diagnostics, memoryStatus } = data;

  const diagEntries = diagnostics.entries.length > 0
    ? `<table class="artifact-table settings-table responsive-table">
        <thead>
          <tr><th>Key</th><th>Value</th><th>Source</th><th></th></tr>
        </thead>
        <tbody>
          ${diagnostics.entries.map((e) => {
            const val = e.redacted
              ? '<span class="muted">••••••</span>'
              : (e.effectiveValue !== null ? `<code>${escapeHtml(e.effectiveValue)}</code>` : '<span class="muted">—</span>');
            const sourceBadge = `<span class="badge badge-depth">${escapeHtml(e.source)}</span>`;
            const warn = e.warning ? ` <span class="badge badge-verdict-reject" title="${escapeHtml(e.warning)}">⚠</span>` : '';
            return `
              <tr>
                <td data-label="Key"><code>${escapeHtml(e.key)}</code></td>
                <td data-label="Value">${val}</td>
                <td data-label="Source">${sourceBadge}</td>
                <td>${warn}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`
    : '<p class="empty-state">No diagnostic entries available.</p>';

  const svcEntries = Object.entries(diagnostics.serviceReadiness);
  const svcCards = svcEntries.length > 0
    ? `<div class="settings-service-list">
        ${svcEntries.map(([name, s]) => `
          <article class="settings-service-card">
            <div class="settings-service-header">
              <strong>${escapeHtml(name)}</strong>
              ${readinessBadge(s.ready)}
            </div>
            <p>${escapeHtml(s.detail)}</p>
          </article>`).join('')}
      </div>`
    : '';

  return `
    <section class="detail-section settings-panel">
      <h2>Effective Settings</h2>
      <p class="muted">Secrets are redacted. Source shows where each value originates.</p>
      ${diagEntries}
    </section>
    <section class="detail-section settings-panel">
      <h2>Service Readiness</h2>
      ${svcCards}
    </section>
    <section class="detail-section settings-panel">
      <h2>Maintenance</h2>
      <div class="settings-maintenance">
        <div>
          <h3>Knowledge refresh</h3>
          <p class="muted">Refresh legacy knowledge storage from Settings without reviving the retired Agents or Memory dashboards.</p>
        </div>
        <div>
          ${memoryStatus.refreshAllAvailable
            ? `<form class="admin-inline-form" hx-post="/api/agents/refresh-all" hx-target="#knowledge-refresh-result" hx-swap="innerHTML">
                <button type="submit" class="btn btn-primary">Refresh All Agent Knowledge</button>
              </form>`
            : '<p class="empty-state">Refresh-all is unavailable until runner + memory services are initialized.</p>'}
          <div id="knowledge-refresh-result" class="settings-maintenance-result"></div>
        </div>
      </div>
      <div class="settings-callout">
        <strong>Memory deprecation:</strong> legacy runtime memory storage still exists at <code>${escapeHtml(memoryStatus.storagePath)}</code> for migration and refresh-all maintenance only. Prompt injection is disabled, and the old Memory dashboard stays retired.
      </div>
    </section>`;
}

// ── Tab content dispatcher ──────────────────────────────────────────────────

const TAB_RENDERERS: Record<TabId, (data: ConfigPageData) => string> = {
  overview: renderOverviewTab,
  providers: renderProvidersTab,
  publishing: renderPublishingTab,
  images: renderImagesTab,
  access: renderAccessTab,
  preferences: renderPreferencesTab,
  diagnostics: renderDiagnosticsTab,
};

// ── Main export ─────────────────────────────────────────────────────────────

export function renderConfigPage(data: ConfigPageData): string {
  const { labName, league, environment } = data;
  const activeTab = (data.activeTab as TabId) || 'overview';

  const tabSections = TABS.map((t) => {
    const isActive = t.id === activeTab;
    const render = TAB_RENDERERS[t.id];
    return `<div class="settings-tab-content${isActive ? ' active' : ''}" id="tab-${t.id}">
      ${render(data)}
    </div>`;
  }).join('\n');

  const content = `
    <div class="settings-page">
      <section class="settings-hero detail-section">
        <div>
          <p class="settings-eyebrow">Workspace</p>
          <h1>Settings</h1>
          <p class="page-subtitle">Configure provider profiles, publishing, auth, and diagnostics for ${escapeHtml(labName)}.</p>
        </div>
        <div class="settings-hero-meta">
          <span class="badge badge-team">${escapeHtml(league.toUpperCase())}</span>
          <span class="badge badge-depth">${escapeHtml(environment)}</span>
          ${data.secretCryptoAvailable ? '<span class="badge badge-verdict-approved">Crypto ✓</span>' : ''}
        </div>
      </section>

      ${renderTabBar(activeTab)}
      ${tabSections}
    </div>`;

  return renderLayout('Settings', content, labName);
}
