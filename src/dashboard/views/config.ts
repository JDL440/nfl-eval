/**
 * config.ts — Tabbed admin Settings page driven by the DB-backed resolver.
 */

import { renderLayout, escapeHtml } from './layout.js';
import { formatPresetLabel, STAGE_NAMES } from '../../types.js';
import {
  buildEditorialUiState,
  formatContentProfileLabel,
  formatLegacyDepthLabel,
  getPresetDescription,
  hasEditorialOverrides,
  renderAnalyticsModeOptions,
  renderArticleFormOptions,
  renderPanelShapeOptions,
  renderPresetOptions,
  renderReaderProfileOptions,
} from './editorial-controls.js';
import {
  ANALYTICS_MODE_LABELS,
  ARTICLE_FORM_LABELS,
  EDITORIAL_PRESET_ORDER,
  EDITORIAL_PRESETS,
  PANEL_SHAPE_LABELS,
  READER_PROFILE_LABELS,
} from '../../types.js';
import { renderScheduleTimezoneScript } from './schedule-timezone.js';

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
  availableTeams: Array<{ abbr: string; label: string }>;
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
  /** Live gateway providers (same source as new-idea page). */
  llmProviders: Array<{ id: string; name: string }>;
  articleSchedules: Array<{
    id: string;
    name: string;
    enabled: number;
    team_abbr: string;
    prompt: string;
    weekday_utc: number;
    time_of_day_utc: string;
    content_profile: 'accessible' | 'deep_dive';
    depth_level: number;
    preset_id: string;
    reader_profile: string;
    article_form: string;
    panel_shape: string;
    analytics_mode: string;
    panel_constraints_json: string | null;
    provider_mode: 'default' | 'override';
    provider_id: string | null;
    max_advance_stage: number;
    last_run_at: string | null;
    next_run_at: string;
    created_at: string;
    updated_at: string;
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
  { id: 'schedules', label: 'Schedules' },
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

const PANEL_CONSTRAINTS_SCHEMA_EXAMPLE = JSON.stringify({
  min_agents: 2,
  max_agents: 4,
  required_agents: ['film'],
  excluded_agents: ['odds'],
  allow_team_agent_omission: false,
  scope_mode: 'team',
}, null, 2);

function buildAdvancedToggleScript(containerSelector: string, detailsSelector: string): string {
  return [
    `const details = this.form.querySelector('${detailsSelector}');`,
    'if (this.checked && details) details.open = true;',
    `this.form.querySelectorAll('${containerSelector} select, ${containerSelector} textarea').forEach((field) => {`,
    'field.disabled = !this.checked;',
    "if (!this.checked) field.setCustomValidity('');",
    '});',
  ].join(' ');
}

function renderPanelConstraintsField(input: {
  id: string;
  name: string;
  value: string;
  disabled: boolean;
}): string {
  const validationScript = [
    'const value = this.value.trim();',
    "if (!value) { this.setCustomValidity(''); return; }",
    'try {',
    'const parsed = JSON.parse(value);',
    "if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Panel constraints must be a JSON object.');",
    "this.setCustomValidity('');",
    '} catch (error) {',
    "const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Enter a valid JSON object.';",
    'this.setCustomValidity(message);',
    '}',
  ].join(' ');

  return `
    <div class="form-group form-group-full">
      <label for="${escapeHtml(input.id)}">Panel constraints JSON</label>
      <textarea id="${escapeHtml(input.id)}" name="${escapeHtml(input.name)}" rows="4" class="settings-json-input" aria-describedby="${escapeHtml(`${input.id}-hint`)} ${escapeHtml(`${input.id}-example`)}" oninput="${validationScript}"${input.disabled ? ' disabled' : ''}>${escapeHtml(input.value)}</textarea>
      <p id="${escapeHtml(`${input.id}-hint`)}" class="form-hint">Optional hard min/max or required/excluded agent overrides. Must be a JSON object.</p>
      <div id="${escapeHtml(`${input.id}-example`)}" class="settings-schema-example">
        <span class="settings-schema-label">Schema example</span>
        <pre class="settings-schema-code"><code>${escapeHtml(PANEL_CONSTRAINTS_SCHEMA_EXAMPLE)}</code></pre>
      </div>
    </div>`;
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
            <option value="gemini">gemini</option>
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

function renderSchedulesTab(data: ConfigPageData): string {
  const weekdayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];
  const providerOptions = data.llmProviders.length > 0
    ? data.llmProviders.map((p) => ({ id: p.id, label: p.name }))
    : data.providerProfiles
        .filter((profile) => profile.enabled)
        .map((profile) => ({
          id: profile.providerId,
          label: profile.isDefault ? `${profile.label} (${profile.providerId}, default)` : `${profile.label} (${profile.providerId})`,
        }));

  const renderMaxStageOptions = (selected: number) => ([1, 2, 3, 4, 5, 6, 7] as const).map(s => {
    const label = s === 1 ? 'Idea only (no auto-advance)' : s === 7 ? `Full pipeline (${STAGE_NAMES[s]})` : `Through ${STAGE_NAMES[s]}`;
    return `<option value="${s}"${selected === s ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');

  const scheduleCards = data.articleSchedules.length > 0
    ? data.articleSchedules.map((schedule) => {
      const editorial = buildEditorialUiState(schedule);
      const advancedChecked = hasEditorialOverrides(editorial);
      return `
        <div class="provider-profile-card">
          <div class="profile-header">
            <div>
              <strong>${escapeHtml(schedule.name)}</strong>
              <span class="badge badge-team">${escapeHtml(schedule.team_abbr)}</span>
              <span class="badge badge-depth" data-utc-weekday="${schedule.weekday_utc}" data-utc-time="${escapeHtml(schedule.time_of_day_utc)}">${escapeHtml(weekdayOptions.find(o => o.value === schedule.weekday_utc)?.label ?? '')} ${escapeHtml(String(schedule.time_of_day_utc))} UTC</span>
              <span class="badge">${escapeHtml(formatPresetLabel(schedule.preset_id))}</span>
              ${schedule.enabled === 1 ? '<span class="badge badge-verdict-approved">Enabled</span>' : '<span class="badge badge-verdict-reject">Disabled</span>'}
            </div>
            <div class="profile-actions">
              <form class="admin-inline-form" hx-post="/api/settings/article-schedules/${escapeHtml(schedule.id)}/toggle" hx-target="#schedule-result" hx-swap="innerHTML">
                <button type="submit" class="btn">${schedule.enabled === 1 ? 'Disable' : 'Enable'}</button>
              </form>
              <form class="admin-inline-form" hx-delete="/api/settings/article-schedules/${escapeHtml(schedule.id)}" hx-target="#schedule-result" hx-swap="innerHTML" hx-confirm="Delete schedule '${escapeHtml(schedule.name)}'?">
                <button type="submit" class="btn">Delete</button>
              </form>
            </div>
          </div>
          <form class="settings-form" hx-post="/api/settings/article-schedules/${escapeHtml(schedule.id)}" hx-target="#schedule-result" hx-swap="innerHTML" data-schedule-tz>
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" value="${escapeHtml(schedule.name)}" required>
            </div>
            <div class="form-group">
              <label>Prompt</label>
              <textarea name="prompt" rows="4" required>${escapeHtml(schedule.prompt)}</textarea>
            </div>
            <div class="settings-grid-2">
              <div class="form-group">
                <label>Team</label>
                <select name="teamAbbr">
                  ${data.availableTeams.map((team) => `<option value="${escapeHtml(team.abbr)}"${team.abbr === schedule.team_abbr ? ' selected' : ''}>${escapeHtml(team.label)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label data-tz-label>Weekday (UTC)</label>
                <select name="weekdayUtc" data-tz-weekday>
                  ${weekdayOptions.map((option) => `<option value="${option.value}"${option.value === schedule.weekday_utc ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label data-tz-label>Time (UTC)</label>
                <input type="time" name="timeOfDayUtc" value="${escapeHtml(schedule.time_of_day_utc)}" required data-tz-time>
              </div>
              <div class="form-group">
                <label>Editorial preset</label>
                <select name="presetId">
                  ${renderPresetOptions(editorial.preset_id)}
                </select>
                <p class="form-hint">${escapeHtml(getPresetDescription(editorial.preset_id))}</p>
              </div>
              <div class="form-group">
                <label>Provider mode</label>
                <select name="providerMode">
                  <option value="default"${schedule.provider_mode === 'default' ? ' selected' : ''}>Use runtime default</option>
                  <option value="override"${schedule.provider_mode === 'override' ? ' selected' : ''}>Override provider</option>
                </select>
              </div>
              <div class="form-group">
                <label>Provider override</label>
                <select name="providerId">
                  <option value="">None</option>
                  ${providerOptions.map((option) => `<option value="${escapeHtml(option.id)}"${option.id === schedule.provider_id ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Auto-advance</label>
                <select name="maxAdvanceStage">
                  ${renderMaxStageOptions(schedule.max_advance_stage)}
                </select>
              </div>
            </div>
            <details class="settings-advanced"${advancedChecked ? ' open' : ''} data-config-schedule-advanced-panel>
              <summary>
                <span class="settings-advanced-title">Advanced editorial overrides</span>
                <span class="settings-advanced-summary">Override the preset only when this schedule needs a different reader profile, panel shape, analytics mode, or explicit agent constraints.</span>
              </summary>
              <div class="settings-advanced-body">
                <div class="form-group">
                  <label class="settings-checkbox"><input type="checkbox"${advancedChecked ? ' checked' : ''} onchange="${buildAdvancedToggleScript('[data-config-schedule-advanced]', '[data-config-schedule-advanced-panel]')}"> <span>Override preset defaults</span></label>
                  <p class="form-hint">Legacy compatibility: ${escapeHtml(formatLegacyDepthLabel(editorial.legacy_depth_level))} · ${escapeHtml(formatContentProfileLabel(editorial.legacy_content_profile))}</p>
                </div>
                <div class="settings-grid-2" data-config-schedule-advanced>
                  <div class="form-group">
                    <label>Reader profile</label>
                    <select name="readerProfile"${advancedChecked ? '' : ' disabled'}>
                      ${renderReaderProfileOptions(editorial.reader_profile)}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Article form</label>
                    <select name="articleForm"${advancedChecked ? '' : ' disabled'}>
                      ${renderArticleFormOptions(editorial.article_form)}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Panel shape</label>
                    <select name="panelShape"${advancedChecked ? '' : ' disabled'}>
                      ${renderPanelShapeOptions(editorial.panel_shape)}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Analytics mode</label>
                    <select name="analyticsMode"${advancedChecked ? '' : ' disabled'}>
                      ${renderAnalyticsModeOptions(editorial.analytics_mode)}
                    </select>
                    <p class="form-hint">Casual-facing presets should stay explain-only unless the reason is explicit.</p>
                  </div>
                  ${renderPanelConstraintsField({
                    id: `schedule-panel-constraints-${schedule.id}`,
                    name: 'panelConstraintsJson',
                    value: editorial.panel_constraints_json ?? '',
                    disabled: !advancedChecked,
                  })}
                </div>
              </div>
            </details>
            <dl class="settings-kv">
              <div><dt>Next run</dt><dd><code data-utc-datetime="${escapeHtml(schedule.next_run_at)}">${escapeHtml(schedule.next_run_at)}</code></dd></div>
              <div><dt>Last run</dt><dd${schedule.last_run_at ? ` data-utc-datetime="${escapeHtml(schedule.last_run_at)}"` : ''}>${escapeHtml(schedule.last_run_at ?? 'Never')}</dd></div>
            </dl>
            <button type="submit" class="btn btn-primary">Save Schedule</button>
          </form>
        </div>`;
    }).join('')
    : '<p class="empty-state">No schedules configured.</p>';

  return `
    <section class="detail-section settings-panel">
      <h2>Article schedules</h2>
      ${scheduleCards}
      <div id="schedule-result" class="settings-result"></div>
    </section>
      <section class="detail-section settings-panel">
        <h2>Add Schedule</h2>
        <form class="settings-form" hx-post="/api/settings/article-schedules" hx-target="#add-schedule-result" hx-swap="innerHTML" data-schedule-tz>
        <div class="form-group">
          <label for="schedule-name">Name</label>
          <input id="schedule-name" name="name" type="text" placeholder="Seahawks Tuesday accessible" required>
        </div>
        <div class="form-group">
          <label for="schedule-prompt">Prompt</label>
          <textarea id="schedule-prompt" name="prompt" rows="4" placeholder="Find the most relevant current Seahawks storyline and build an approachable fan article." required></textarea>
        </div>
        <div class="settings-grid-2">
          <div class="form-group">
            <label for="schedule-team">Team</label>
            <select id="schedule-team" name="teamAbbr">
              ${data.availableTeams.map((team) => `<option value="${escapeHtml(team.abbr)}">${escapeHtml(team.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="schedule-weekday" data-tz-label>Weekday (UTC)</label>
            <select id="schedule-weekday" name="weekdayUtc" data-tz-weekday>
              ${weekdayOptions.map((option) => `<option value="${option.value}"${option.value === 2 ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="schedule-time" data-tz-label>Time (UTC)</label>
            <input id="schedule-time" name="timeOfDayUtc" type="time" value="14:00" required data-tz-time>
          </div>
          <div class="form-group">
            <label for="schedule-preset">Editorial preset</label>
            <select id="schedule-preset" name="presetId">
              ${renderPresetOptions('casual_explainer')}
            </select>
            <p class="form-hint">${escapeHtml(getPresetDescription('casual_explainer'))}</p>
          </div>
          <div class="form-group">
            <label for="schedule-provider-mode">Provider mode</label>
            <select id="schedule-provider-mode" name="providerMode">
              <option value="default" selected>Use runtime default</option>
              <option value="override">Override provider</option>
            </select>
          </div>
          <div class="form-group">
            <label for="schedule-provider-id">Provider override</label>
            <select id="schedule-provider-id" name="providerId">
              <option value="">None</option>
              ${providerOptions.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="schedule-max-stage">Auto-advance</label>
            <select id="schedule-max-stage" name="maxAdvanceStage">
              ${renderMaxStageOptions(7)}
            </select>
          </div>
        </div>
        <details class="settings-advanced" data-config-add-advanced-panel>
          <summary>
            <span class="settings-advanced-title">Advanced editorial overrides</span>
            <span class="settings-advanced-summary">Start with a preset, then open this section only when the slot needs custom editorial controls or explicit panel constraints.</span>
          </summary>
          <div class="settings-advanced-body">
            <div class="form-group">
              <label class="settings-checkbox"><input type="checkbox" onchange="${buildAdvancedToggleScript('[data-config-add-advanced]', '[data-config-add-advanced-panel]')}"> <span>Override preset defaults</span></label>
              <p class="form-hint">Tuesday-style slots map cleanly to Casual Explainer. Thursday-style analysis usually starts with Technical Deep Dive.</p>
            </div>
            <div class="settings-grid-2" data-config-add-advanced>
              <div class="form-group">
                <label for="schedule-reader-profile">Reader profile</label>
                <select id="schedule-reader-profile" name="readerProfile" disabled>
                  ${renderReaderProfileOptions('casual')}
                </select>
              </div>
              <div class="form-group">
                <label for="schedule-article-form">Article form</label>
                <select id="schedule-article-form" name="articleForm" disabled>
                  ${renderArticleFormOptions('brief')}
                </select>
              </div>
              <div class="form-group">
                <label for="schedule-panel-shape">Panel shape</label>
                <select id="schedule-panel-shape" name="panelShape" disabled>
                  ${renderPanelShapeOptions('news_reaction')}
                </select>
              </div>
              <div class="form-group">
                <label for="schedule-analytics-mode">Analytics mode</label>
                <select id="schedule-analytics-mode" name="analyticsMode" disabled>
                  ${renderAnalyticsModeOptions('explain_only')}
                </select>
              </div>
              ${renderPanelConstraintsField({
                id: 'schedule-panel-constraints',
                name: 'panelConstraintsJson',
                value: '',
                disabled: true,
              })}
            </div>
          </div>
        </details>
        <div class="form-group">
          <label><input type="checkbox" name="enabled" value="true" checked> Enabled</label>
        </div>
        <button type="submit" class="btn btn-primary">Create Schedule</button>
      </form>
      <div id="add-schedule-result" class="settings-result"></div>
    </section>
    ${renderScheduleTimezoneScript()}`;
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
        <input type="hidden" name="group" value="publishing">
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
        <input type="hidden" name="group" value="images">
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
  schedules: renderSchedulesTab,
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
