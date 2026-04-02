/**
 * schedules.ts — Dashboard views for article schedule management.
 */

import { renderLayout, escapeHtml } from './layout.js';
import { formatPresetLabel } from '../../types.js';
import type { ArticleSchedule, ArticleScheduleRun } from '../../types.js';
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

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatScheduleTime(schedule: ArticleSchedule): string {
  const day = WEEKDAY_NAMES[schedule.weekday_utc] ?? `Day ${schedule.weekday_utc}`;
  return `${day} ${schedule.time_of_day_utc} UTC`;
}

function statusBadge(enabled: number): string {
  return enabled
    ? `<span class="badge badge-success">Enabled</span>`
    : `<span class="badge badge-muted">Disabled</span>`;
}

function runStatusBadge(status: string): string {
  const map: Record<string, string> = {
    claimed: 'badge-info',
    created_article: 'badge-info',
    completed: 'badge-success',
    failed: 'badge-error',
    skipped: 'badge-muted',
  };
  const cls = map[status] ?? 'badge-muted';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

export function renderSchedulesPage(
  schedules: ArticleSchedule[],
  teams: Array<{ abbr: string; city: string; name: string }>,
  providers: Array<{ id: string; label: string }>,
  labName: string,
  flashMessage?: string,
): string {
  const body = `
    <div class="page-header">
      <h1>Article Schedules</h1>
      <p class="subtitle">Configure recurring article generation slots with preset-first editorial controls.</p>
    </div>
    ${flashMessage ? `<div class="flash flash-success">${escapeHtml(flashMessage)}</div>` : ''}

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>New Schedule</h2>
      </div>
      <div class="card-body">
        ${renderScheduleForm(null, teams, providers)}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Existing Schedules</h2>
      </div>
      <div class="card-body">
        ${schedules.length === 0
          ? `<p class="empty-state">No schedules configured yet.</p>`
          : `<table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Schedule</th>
                  <th>Team</th>
                  <th>Profile</th>
                  <th>Last Run</th>
                  <th>Next Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${schedules.map(renderScheduleRow).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  return renderLayout('Article Schedules', body, labName);
}

function renderScheduleRow(s: ArticleSchedule): string {
  const eid = escapeHtml(s.id);
  const editorial = buildEditorialUiState(s);
  return `
    <tr id="schedule-row-${eid}">
      <td><a href="/schedules/${eid}">${escapeHtml(s.name)}</a></td>
      <td>${escapeHtml(formatScheduleTime(s))}</td>
      <td>${escapeHtml(s.team_abbr.toUpperCase())}</td>
      <td>
        <strong>${escapeHtml(formatPresetLabel(s.preset_id))}</strong>
        <div class="form-hint">${escapeHtml(formatLegacyDepthLabel(editorial.legacy_depth_level))} · ${escapeHtml(formatContentProfileLabel(editorial.legacy_content_profile))}</div>
      </td>
      <td>${s.last_run_at ? escapeHtml(s.last_run_at.slice(0, 16)) : '—'}</td>
      <td>${s.next_run_at ? escapeHtml(s.next_run_at.slice(0, 16)) : '—'}</td>
      <td>${statusBadge(s.enabled)}</td>
      <td class="actions">
        <a href="/schedules/${eid}/edit" class="btn btn-sm btn-secondary">Edit</a>
        <form method="POST" action="/schedules/${eid}/toggle" style="display:inline">
          <button class="btn btn-sm ${s.enabled ? 'btn-warning' : 'btn-success'}" type="submit">
            ${s.enabled ? 'Disable' : 'Enable'}
          </button>
        </form>
        <form method="POST" action="/schedules/${eid}/delete" style="display:inline"
          onsubmit="return confirm('Delete this schedule?')">
          <button class="btn btn-sm btn-danger" type="submit">Delete</button>
        </form>
      </td>
    </tr>`;
}

function renderScheduleForm(
  schedule: ArticleSchedule | null,
  teams: Array<{ abbr: string; city: string; name: string }>,
  providers: Array<{ id: string; label: string }>,
): string {
  const v = schedule ?? {
    name: '',
    weekday_utc: 2,  // Tuesday default
    time_of_day_utc: '09:00',
    team_abbr: teams[0]?.abbr ?? '',
    prompt: '',
    depth_level: 1,
    content_profile: 'accessible' as const,
    preset_id: 'casual_explainer' as const,
    reader_profile: 'casual' as const,
    article_form: 'brief' as const,
    panel_shape: 'news_reaction' as const,
    analytics_mode: 'explain_only' as const,
    panel_constraints_json: null,
    provider_mode: 'default' as const,
    provider_id: null,
  };
  const editorial = buildEditorialUiState(v);
  const advancedChecked = schedule ? hasEditorialOverrides(editorial) : false;

  const teamOptions = teams.map(t =>
    `<option value="${escapeHtml(t.abbr)}" ${v.team_abbr === t.abbr ? 'selected' : ''}>
      ${escapeHtml(t.abbr.toUpperCase())} — ${escapeHtml(t.city)} ${escapeHtml(t.name)}
    </option>`,
  ).join('');

  const weekdayOptions = WEEKDAY_NAMES.map((name, i) =>
    `<option value="${i}" ${v.weekday_utc === i ? 'selected' : ''}>${name}</option>`,
  ).join('');

  const providerOptions = [
    `<option value="default" ${v.provider_mode === 'default' ? 'selected' : ''}>Use runtime default</option>`,
    ...providers.map(p =>
      `<option value="${escapeHtml(p.id)}" ${v.provider_mode === 'override' && v.provider_id === p.id ? 'selected' : ''}>${escapeHtml(p.label)}</option>`,
    ),
  ].join('');

  const action = schedule ? `/schedules/${escapeHtml(schedule.id)}/edit` : '/schedules/new';
  const submitLabel = schedule ? 'Save Changes' : 'Create Schedule';

  return `
    <form method="POST" action="${action}" class="form-grid">
      <div class="form-group">
        <label for="sched-name">Name</label>
        <input id="sched-name" name="name" type="text" required
          value="${escapeHtml(v.name)}" placeholder="e.g. Tuesday Accessible" class="input" />
      </div>
      <div class="form-group">
        <label for="sched-weekday">Day of Week</label>
        <select id="sched-weekday" name="weekday_utc" class="input">${weekdayOptions}</select>
      </div>
      <div class="form-group">
        <label for="sched-time">Time (UTC)</label>
        <input id="sched-time" name="time_of_day_utc" type="time"
          value="${escapeHtml(v.time_of_day_utc)}" class="input" />
      </div>
      <div class="form-group">
        <label for="sched-team">Primary Team</label>
        <select id="sched-team" name="team_abbr" class="input">${teamOptions}</select>
      </div>
      <div class="form-group">
        <label for="sched-preset">Editorial Preset</label>
        <select id="sched-preset" name="preset_id" class="input">${renderPresetOptions(editorial.preset_id)}</select>
        <div class="form-hint">${escapeHtml(getPresetDescription(editorial.preset_id))} Legacy compatibility stays at ${escapeHtml(formatLegacyDepthLabel(editorial.legacy_depth_level))} · ${escapeHtml(formatContentProfileLabel(editorial.legacy_content_profile))}.</div>
      </div>
      <div class="form-group">
        <label for="sched-provider">Provider</label>
        <select id="sched-provider" name="provider" class="input">${providerOptions}</select>
      </div>
      <div class="form-group form-group-full">
        <label>
          <input
            type="checkbox"
            ${advancedChecked ? 'checked' : ''}
            onchange="this.form.querySelectorAll('[data-schedule-advanced] select, [data-schedule-advanced] textarea').forEach((field) => { field.disabled = !this.checked; })">
          Override preset defaults
        </label>
      </div>
      <div class="form-group" data-schedule-advanced>
        <label for="sched-reader-profile">Reader Profile</label>
        <select id="sched-reader-profile" name="reader_profile" class="input"${advancedChecked ? '' : ' disabled'}>${renderReaderProfileOptions(editorial.reader_profile)}</select>
      </div>
      <div class="form-group" data-schedule-advanced>
        <label for="sched-article-form">Article Form</label>
        <select id="sched-article-form" name="article_form" class="input"${advancedChecked ? '' : ' disabled'}>${renderArticleFormOptions(editorial.article_form)}</select>
      </div>
      <div class="form-group" data-schedule-advanced>
        <label for="sched-panel-shape">Panel Shape</label>
        <select id="sched-panel-shape" name="panel_shape" class="input"${advancedChecked ? '' : ' disabled'}>${renderPanelShapeOptions(editorial.panel_shape)}</select>
      </div>
      <div class="form-group" data-schedule-advanced>
        <label for="sched-analytics-mode">Analytics Mode</label>
        <select id="sched-analytics-mode" name="analytics_mode" class="input"${advancedChecked ? '' : ' disabled'}>${renderAnalyticsModeOptions(editorial.analytics_mode)}</select>
        <div class="form-hint">Tuesday-style slots should usually stay explain-only. Thursday-style slots can lean metrics-forward.</div>
      </div>
      <div class="form-group form-group-full">
        <label for="sched-prompt">Base Prompt</label>
        <textarea id="sched-prompt" name="prompt" rows="4" required
          class="input" placeholder="Describe the article angle for this schedule…">${escapeHtml(v.prompt)}</textarea>
      </div>
      <div class="form-group form-group-full" data-schedule-advanced>
        <label for="sched-panel-constraints">Panel Constraints JSON</label>
        <textarea id="sched-panel-constraints" name="panel_constraints_json" rows="3" class="input"${advancedChecked ? '' : ' disabled'}>${escapeHtml(editorial.panel_constraints_json ?? '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${submitLabel}</button>
        <a href="/schedules" class="btn btn-secondary">Cancel</a>
      </div>
    </form>`;
}

export function renderScheduleDetailPage(
  schedule: ArticleSchedule,
  runs: ArticleScheduleRun[],
  teams: Array<{ abbr: string; city: string; name: string }>,
  providers: Array<{ id: string; label: string }>,
  labName: string,
  flashMessage?: string,
): string {
  const body = `
    <div class="page-header">
      <h1>${escapeHtml(schedule.name)}</h1>
      <p class="subtitle">${escapeHtml(formatScheduleTime(schedule))} — ${escapeHtml(schedule.team_abbr.toUpperCase())} — ${escapeHtml(formatPresetLabel(schedule.preset_id))}</p>
    </div>
    ${flashMessage ? `<div class="flash flash-success">${escapeHtml(flashMessage)}</div>` : ''}

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header"><h2>Edit Schedule</h2></div>
      <div class="card-body">
        ${renderScheduleForm(schedule, teams, providers)}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2>Recent Runs</h2></div>
      <div class="card-body">
        ${runs.length === 0
          ? `<p class="empty-state">No runs yet.</p>`
          : `<table class="table">
              <thead>
                <tr><th>Slot</th><th>Status</th><th>Article</th><th>Error</th><th>Completed</th></tr>
              </thead>
              <tbody>
                ${runs.map(r => `
                  <tr>
                    <td>${escapeHtml(r.scheduled_for.slice(0, 16))}</td>
                    <td>${runStatusBadge(r.status)}</td>
                    <td>${r.article_id
                      ? `<a href="/articles/${escapeHtml(r.article_id)}">${escapeHtml(r.article_id)}</a>`
                      : '—'}</td>
                    <td>${r.error_text ? `<span class="text-error">${escapeHtml(r.error_text.slice(0, 80))}</span>` : '—'}</td>
                    <td>${r.completed_at ? escapeHtml(r.completed_at.slice(0, 16)) : '—'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>`;

  return renderLayout(`Schedule: ${schedule.name}`, body, labName);
}

export function renderScheduleEditPage(
  schedule: ArticleSchedule,
  teams: Array<{ abbr: string; city: string; name: string }>,
  providers: Array<{ id: string; label: string }>,
  labName: string,
  flashMessage?: string,
): string {
  const body = `
    <div class="page-header">
      <h1>Edit Schedule</h1>
    </div>
    ${flashMessage ? `<div class="flash flash-error">${escapeHtml(flashMessage)}</div>` : ''}
    <div class="card">
      <div class="card-body">
        ${renderScheduleForm(schedule, teams, providers)}
      </div>
    </div>`;
  return renderLayout(`Edit Schedule: ${schedule.name}`, body, labName);
}
