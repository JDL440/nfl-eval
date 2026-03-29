/**
 * config.ts — Admin/settings page for the current runtime.
 */

import { renderLayout, escapeHtml } from './layout.js';

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

export interface RuntimePathInfo {
  label: string;
  value: string;
}

export interface ConfigPageData {
  labName: string;
  league: string;
  environment: string;
  provider: LLMProviderInfo;
  modelRouting: Array<{ stageKey: string; model: string }>;
  charters: string[];
  skills: string[];
  envStatus: EnvVarStatus[];
  modelPolicyError?: string;
  runtimePaths: RuntimePathInfo[];
  dashboardAuth: {
    mode: string;
    sessionCookieName: string;
    sessionTtlHours: number;
    secureCookies: boolean;
    username?: string;
  };
  services: ServiceStatusInfo[];
  memoryStatus: {
    storagePath: string;
    refreshAllAvailable: boolean;
  };
}

function renderStatusChip(state: ServiceStatusInfo['state']): string {
  const label = state === 'ready' ? 'ready' : state === 'partial' ? 'partial' : 'disabled';
  return `<span class="badge settings-status settings-status-${state}">${label}</span>`;
}

function renderRoutingTable(rows: Array<{ stageKey: string; model: string }>): string {
  if (rows.length === 0) {
    return '<p class="empty-state">No model routing policy loaded.</p>';
  }

  return `
    <table class="artifact-table settings-table">
      <thead>
        <tr><th>Stage Key</th><th>Model</th></tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><code>${escapeHtml(row.stageKey)}</code></td>
            <td><code>${escapeHtml(row.model)}</code></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function renderEnvStatusTable(envStatus: EnvVarStatus[]): string {
  return `
    <table class="artifact-table settings-table">
      <thead>
        <tr><th>Environment Variable</th><th>Status</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${envStatus.map((value) => {
          const badgeClass = value.isSet ? 'badge-verdict-approved' : 'badge-verdict-reject';
          const label = value.isSet ? 'SET' : 'NOT SET';
          const displayValue = value.displayValue
            ? `<code>${escapeHtml(value.displayValue)}</code>`
            : '<span class="muted">—</span>';
          return `
            <tr>
              <td><code>${escapeHtml(value.key)}</code></td>
              <td><span class="badge ${badgeClass}">${label}</span></td>
              <td>${displayValue}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderNameList(names: string[], emptyLabel: string): string {
  if (names.length === 0) {
    return `<p class="empty-state">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <ul class="settings-list">
      ${names.map((name) => `<li><code>${escapeHtml(name)}</code></li>`).join('')}
    </ul>`;
}

export function renderConfigPage(data: ConfigPageData): string {
  const {
    labName,
    league,
    environment,
    provider,
    modelRouting,
    charters,
    skills,
    envStatus,
    modelPolicyError,
    runtimePaths,
    dashboardAuth,
    services,
    memoryStatus,
  } = data;

  const content = `
    <div class="settings-page">
      <section class="settings-hero detail-section">
        <div>
          <p class="settings-eyebrow">Admin</p>
          <h1>⚙️ Runtime Settings</h1>
          <p class="page-subtitle">Current runtime wiring for ${escapeHtml(labName)}. Use this page for provider visibility, runtime paths, auth posture, and maintenance actions.</p>
        </div>
        <div class="settings-hero-meta">
          <span class="badge badge-team">${escapeHtml(league.toUpperCase())}</span>
          <span class="badge badge-depth">${escapeHtml(environment)}</span>
        </div>
      </section>

      <div class="settings-grid">
        <section class="detail-section settings-panel">
          <h2>LLM Runtime</h2>
          <dl class="settings-kv">
            <div><dt>Active provider</dt><dd>${escapeHtml(provider.name)}</dd></div>
            <div><dt>Active model</dt><dd><code>${escapeHtml(provider.model)}</code></dd></div>
            <div><dt>Provider URL</dt><dd>${provider.url ? `<code>${escapeHtml(provider.url)}</code>` : '<span class="muted">Managed by provider defaults</span>'}</dd></div>
            <div><dt>Registered providers</dt><dd>${provider.registeredProviders.length > 0 ? provider.registeredProviders.map((item) => `<span class="badge ${item.default ? 'badge-stage badge-stage-1' : 'badge-stage'}">${escapeHtml(item.id)}</span>`).join(' ') : '<span class="muted">No providers registered</span>'}</dd></div>
          </dl>
          ${modelPolicyError ? `<div class="settings-callout settings-callout-warning">${escapeHtml(modelPolicyError)}</div>` : ''}
          ${renderRoutingTable(modelRouting)}
        </section>

        <section class="detail-section settings-panel">
          <h2>Services &amp; Maintenance</h2>
          <div class="settings-service-list">
            ${services.map((service) => `
              <article class="settings-service-card">
                <div class="settings-service-header">
                  <strong>${escapeHtml(service.name)}</strong>
                  ${renderStatusChip(service.state)}
                </div>
                <p>${escapeHtml(service.detail)}</p>
              </article>
            `).join('')}
          </div>
          <div class="settings-callout">
            <strong>Memory deprecation:</strong> legacy runtime memory storage still exists at <code>${escapeHtml(memoryStatus.storagePath)}</code> for migration and refresh-all maintenance only. Prompt injection is disabled, and the old Memory dashboard stays retired.
          </div>
          <div class="settings-maintenance">
            <div>
              <h3>Knowledge refresh</h3>
              <p class="muted">Use the existing refresh-all endpoint from Settings without reviving the retired Agents or Memory dashboards.</p>
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
        </section>

        <section class="detail-section settings-panel">
          <h2>Runtime Paths</h2>
          <dl class="settings-kv settings-kv-paths">
            ${runtimePaths.map((item) => `
              <div>
                <dt>${escapeHtml(item.label)}</dt>
                <dd><code>${escapeHtml(item.value)}</code></dd>
              </div>
            `).join('')}
          </dl>
        </section>

        <section class="detail-section settings-panel">
          <h2>Dashboard Access</h2>
          <dl class="settings-kv">
            <div><dt>Auth mode</dt><dd>${escapeHtml(dashboardAuth.mode)}</dd></div>
            <div><dt>Session cookie</dt><dd><code>${escapeHtml(dashboardAuth.sessionCookieName)}</code></dd></div>
            <div><dt>Session TTL</dt><dd>${dashboardAuth.sessionTtlHours} hours</dd></div>
            <div><dt>Secure cookies</dt><dd>${dashboardAuth.secureCookies ? 'Enabled' : 'Disabled'}</dd></div>
            <div><dt>Username</dt><dd>${dashboardAuth.username ? escapeHtml(dashboardAuth.username) : '<span class="muted">Not configured</span>'}</dd></div>
          </dl>
        </section>

        <section class="detail-section settings-panel">
          <h2>Prompt Inventory</h2>
          <p class="muted">Charter and skill files still live in the runtime data directory even though their dedicated dashboard browsers were removed.</p>
          <div class="settings-inventory-grid">
            <div>
              <h3>Charters <span class="badge badge-team">${charters.length}</span></h3>
              ${renderNameList(charters, 'No charters found.')}
            </div>
            <div>
              <h3>Skills <span class="badge badge-depth">${skills.length}</span></h3>
              ${renderNameList(skills, 'No skills found.')}
            </div>
          </div>
        </section>
      </div>

      <section class="detail-section settings-panel">
        <h2>Environment Surface</h2>
        <p class="muted">Secrets remain redacted; non-secret defaults are shown when the runtime is falling back to built-in values.</p>
        ${renderEnvStatusTable(envStatus)}
      </section>
    </div>`;

  return renderLayout('Settings', content, labName);
}
