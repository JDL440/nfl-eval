/**
 * runs.ts — Pipeline Runs debug/status page.
 *
 * Renders a filterable, paginated table of all stage_runs across articles.
 * Columns: Time | Article | Stage | Status | Model | Duration | Tokens | Error
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import type { StageRun } from '../../types.js';
import type { AppConfig } from '../../config/index.js';

export type RunRow = StageRun & {
  article_title: string | null;
  total_tokens?: number | null;
};

export interface RunsFilters {
  status?: string;
  search?: string;
}

export interface RunsPageData {
  config: AppConfig;
  runs: RunRow[];
  filters: RunsFilters;
  totalCount: number;
  offset: number;
  limit: number;
}

// ── Duration helper ──────────────────────────────────────────────────────────

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (isNaN(start) || isNaN(end)) return '—';
  const ms = end - start;
  if (ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatTokens(total: number | null | undefined): string {
  if (total == null || total === 0) return '—';
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k`;
  return String(total);
}

// ── Status badge ─────────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  switch (status) {
    case 'completed': return '<span class="badge badge-success run-status" title="completed">✅ completed</span>';
    case 'failed':    return '<span class="badge badge-error run-status" title="failed">❌ failed</span>';
    case 'started':   return '<span class="badge badge-info run-status" title="started">🔄 started</span>';
    case 'cancelled': return '<span class="badge badge-muted run-status" title="cancelled">⏹ cancelled</span>';
    default:          return `<span class="badge run-status">${escapeHtml(status)}</span>`;
  }
}

// ── Error cell ───────────────────────────────────────────────────────────────

function errorCell(notes: string | null, status: string): string {
  if (!notes || status !== 'failed') return '<td class="run-error">—</td>';
  const preview = notes.slice(0, 100);
  const hasMore = notes.length > 100;
  if (!hasMore) {
    return `<td class="run-error"><code class="error-text">${escapeHtml(preview)}</code></td>`;
  }
  return `<td class="run-error">
    <details class="error-details">
      <summary><code class="error-text">${escapeHtml(preview)}…</code></summary>
      <pre class="error-full"><code>${escapeHtml(notes)}</code></pre>
    </details>
  </td>`;
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function renderFilterBar(filters: RunsFilters): string {
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: '✅ Completed' },
    { value: 'failed', label: '❌ Failed' },
    { value: 'started', label: '🔄 Started' },
    { value: 'cancelled', label: '⏹ Cancelled' },
  ];

  return `
    <div class="filter-bar runs-filter-bar">
      <input
        type="search"
        name="search"
        placeholder="Search articles…"
        class="filter-input"
        value="${escapeHtml(filters.search ?? '')}"
        hx-get="/htmx/runs"
        hx-trigger="input changed delay:300ms, search"
        hx-target="#runs-results"
        hx-swap="innerHTML"
        hx-include=".runs-filter-bar"
      />
      <select
        name="status"
        class="filter-select"
        hx-get="/htmx/runs"
        hx-trigger="change"
        hx-target="#runs-results"
        hx-swap="innerHTML"
        hx-include=".runs-filter-bar"
      >
        ${statusOptions.map(o => `
          <option value="${escapeHtml(o.value)}"${filters.status === o.value ? ' selected' : ''}>
            ${escapeHtml(o.label)}
          </option>
        `).join('')}
      </select>
    </div>`;
}

// ── Runs table partial ───────────────────────────────────────────────────────

export function renderRunsTable(
  runs: RunRow[],
  filters: RunsFilters,
  totalCount: number,
  offset: number,
  limit: number,
): string {
  if (runs.length === 0) {
    const hasFilters = filters.status || filters.search;
    return `<p class="empty-state">${hasFilters ? 'No runs match your filters' : 'No pipeline runs recorded yet'}</p>`;
  }

  const rows = runs.map(r => {
    const articleTitle = r.article_title ?? r.article_id;
    const modelLabel = r.requested_model ?? r.actor ?? '—';
    return `
      <tr class="run-row run-status-${escapeHtml(r.status)}">
        <td class="run-time" title="${escapeHtml(r.started_at)}">${formatDate(r.started_at)}</td>
        <td class="run-article">
          <a href="/articles/${escapeHtml(r.article_id)}" class="article-link">${escapeHtml(articleTitle)}</a>
          <span class="run-surface muted">${escapeHtml(r.surface)}</span>
        </td>
        <td class="run-stage">Stage ${r.stage}</td>
        <td class="run-status-cell">${statusBadge(r.status)}</td>
        <td class="run-model" title="${escapeHtml(modelLabel)}"><span class="model-label">${escapeHtml(modelLabel.length > 30 ? modelLabel.slice(0, 28) + '…' : modelLabel)}</span></td>
        <td class="run-duration">${formatDuration(r.started_at, r.completed_at)}</td>
        <td class="run-tokens">${formatTokens(r.total_tokens)}</td>
        ${errorCell(r.notes, r.status)}
      </tr>`;
  }).join('');

  const shown = offset + runs.length;
  const hasMore = shown < totalCount;
  const nextOffset = shown;

  const loadMore = hasMore ? `
    <div class="load-more">
      <button
        class="btn btn-secondary"
        hx-get="/htmx/runs?offset=${nextOffset}&limit=${limit}${filters.status ? `&status=${encodeURIComponent(filters.status)}` : ''}${filters.search ? `&search=${encodeURIComponent(filters.search)}` : ''}"
        hx-target="#runs-tbody"
        hx-swap="beforeend"
        hx-indicator=".load-more-spinner"
      >
        Load more <span class="muted">(showing ${shown} of ${totalCount})</span>
      </button>
      <span class="load-more-spinner htmx-indicator muted"> Loading…</span>
    </div>` : `
    <p class="runs-count muted">Showing all ${totalCount} run${totalCount === 1 ? '' : 's'}</p>`;

  return `
    <div class="runs-table-wrap">
      <table class="runs-table data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Article</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Model</th>
            <th>Duration</th>
            <th>Tokens</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody id="runs-tbody">
          ${rows}
        </tbody>
      </table>
      ${loadMore}
    </div>`;
}

// ── Full page ─────────────────────────────────────────────────────────────────

export function renderRunsPage(data: RunsPageData): string {
  const { config, runs, filters, totalCount, offset, limit } = data;

  const content = `
    <div class="page-header">
      <h1>📊 Pipeline Runs</h1>
      <p class="page-subtitle">Execution history for all article pipeline stages</p>
    </div>
    <section class="section section-filters" id="runs-filters">
      ${renderFilterBar(filters)}
    </section>
    <section class="section section-runs" id="runs-section">
      <div id="runs-results">
        ${renderRunsTable(runs, filters, totalCount, offset, limit)}
      </div>
    </section>`;

  return renderLayout('Pipeline Runs', content, config.leagueConfig.name);
}
