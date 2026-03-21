/**
 * config.ts — Read-only system configuration page.
 */

import { renderLayout, escapeHtml } from './layout.js';

export interface EnvVarStatus {
  key: string;
  isSet: boolean;
  /** Optional displayed value (only for non-secret vars). */
  displayValue?: string;
}

export interface LLMProviderInfo {
  name: string;
  url?: string;
  model: string;
}

export interface ConfigPageData {
  labName: string;
  provider: LLMProviderInfo;
  modelRouting: Array<{ stageKey: string; model: string }>;
  charters: string[];
  skills: string[];
  envStatus: EnvVarStatus[];
  modelPolicyError?: string;
}

function renderRoutingTable(rows: Array<{ stageKey: string; model: string }>): string {
  if (rows.length === 0) {
    return '<p class="empty-state">No model routing policy loaded</p>';
  }

  return `
    <table class="artifact-table">
      <thead>
        <tr><th>Stage Key</th><th>Model</th></tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td><code>${escapeHtml(r.stageKey)}</code></td>
            <td><code>${escapeHtml(r.model)}</code></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function renderNameList(names: string[], emptyLabel: string): string {
  if (names.length === 0) {
    return `<p class="empty-state">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <ul>
      ${names.map(n => `<li><code>${escapeHtml(n)}</code></li>`).join('')}
    </ul>`;
}

function renderEnvStatusTable(envStatus: EnvVarStatus[]): string {
  return `
    <table class="artifact-table">
      <thead>
        <tr><th>Environment Variable</th><th>Status</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${envStatus.map(v => {
          const badgeClass = v.isSet ? 'badge-verdict-approved' : 'badge-verdict-reject';
          const label = v.isSet ? 'SET' : 'NOT SET';
          const valueCell = v.displayValue
            ? `<td><code>${escapeHtml(v.displayValue)}</code></td>`
            : '<td class="muted">—</td>';
          return `
            <tr>
              <td><code>${escapeHtml(v.key)}</code></td>
              <td><span class="badge ${badgeClass}">${label}</span></td>
              ${valueCell}
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

export function renderConfigPage(data: ConfigPageData): string {
  const { labName, provider, modelRouting, charters, skills, envStatus, modelPolicyError } = data;

  const providerRows = [
    `<tr><th>Active Provider</th><td>${escapeHtml(provider.name)}</td></tr>`,
    provider.url ? `<tr><th>Provider URL</th><td><code>${escapeHtml(provider.url)}</code></td></tr>` : '',
    `<tr><th>Active Model</th><td><code>${escapeHtml(provider.model)}</code></td></tr>`,
  ].filter(Boolean).join('');

  const content = `
    <div class="config-page">
      <h1>⚙️ Configuration</h1>

      <section class="detail-section">
        <h2>🧠 LLM Provider</h2>
        <table class="artifact-table">
          <tbody>
            ${providerRows}
          </tbody>
        </table>
      </section>

      <section class="detail-section" id="model-routing">
        <h2>🧭 Model Routing ${modelRouting.length ? `<span class="badge badge-depth">${modelRouting.length} entries</span>` : ''}</h2>
        ${modelPolicyError ? `<p class="empty-state">${escapeHtml(modelPolicyError)}</p>` : ''}
        ${renderRoutingTable(modelRouting)}
      </section>

      <section class="detail-section" id="agent-charters">
        <h2>📋 Agent Charters <span class="badge badge-team">${charters.length} loaded</span></h2>
        ${renderNameList(charters, 'No charters found')}
      </section>

      <section class="detail-section" id="skills">
        <h2>🧠 Skills <span class="badge badge-depth">${skills.length} loaded</span></h2>
        ${renderNameList(skills, 'No skills found')}
      </section>

      <section class="detail-section" id="env-status">
        <h2>🌱 Environment Status</h2>
        <p class="subtitle">Secret keys show SET / NOT SET only. Non-secret URLs and modes are displayed.</p>
        ${renderEnvStatusTable(envStatus)}
      </section>
    </div>`;

  return renderLayout('Config', content, labName);
}
