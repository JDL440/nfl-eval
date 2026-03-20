/**
 * article.ts — Article detail view for the editorial workstation.
 *
 * Shows stage timeline, artifact tabs, action panel, usage stats,
 * audit log, and metadata.
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import { STAGE_NAMES, VALID_STAGES } from '../../types.js';
import type { Article, Stage, StageTransition, StageRun, EditorReview, PublisherPass, UsageEvent } from '../../types.js';
import type { AppConfig } from '../../config/index.js';
import type { AdvanceCheck } from '../../pipeline/engine.js';
import { markdownToHtml } from '../../services/markdown.js';

/** Artifact file names produced at each pipeline stage. */
export const ARTIFACT_FILES = [
  'idea.md',
  'discussion-prompt.md',
  'panel-composition.md',
  'discussion-summary.md',
  'draft.md',
  'editor-review.md',
] as const;

export type ArtifactName = typeof ARTIFACT_FILES[number];

export interface ArticleDetailData {
  config: AppConfig;
  article: Article;
  transitions: StageTransition[];
  reviews: EditorReview[];
  publisherPass: PublisherPass | null;
  advanceCheck?: AdvanceCheck;
  usageEvents?: UsageEvent[];
  stageRuns?: StageRun[];
  flashMessage?: string;
  errorMessage?: string;
}

export function renderArticleDetail(data: ArticleDetailData): string {
  const { config, article, transitions, reviews, publisherPass, advanceCheck, usageEvents, stageRuns, flashMessage, errorMessage } = data;

  const flashBanner = flashMessage
    ? `<div class="flash-banner">${escapeHtml(flashMessage)}</div>`
    : '';
  const errorBanner = errorMessage
    ? `<div class="flash-banner flash-error">❌ ${escapeHtml(errorMessage)}</div>`
    : '';

  const content = `
    <div class="article-detail">
      ${flashBanner}
      ${errorBanner}
      <div class="detail-header">
        <a href="/" class="back-link">← Dashboard</a>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        <div class="detail-meta">
          ${article.primary_team ? `<span class="badge badge-team">${escapeHtml(article.primary_team)}</span>` : ''}
          <span class="badge badge-stage badge-stage-${article.current_stage}">
            Stage ${article.current_stage} · ${escapeHtml(STAGE_NAMES[article.current_stage] ?? 'Unknown')}
          </span>
          <span class="badge badge-status badge-status-${article.status}">${escapeHtml(article.status)}</span>
          <span class="badge badge-depth">Depth ${article.depth_level}</span>
        </div>
      </div>

      ${renderStageTimeline(article.current_stage, transitions)}

      <div class="detail-grid">
        <div class="detail-main">
          ${renderActionPanel(article, advanceCheck, stageRuns)}
          ${renderArtifactTabs(article)}
          ${reviews.length > 0 ? renderEditorReviews(reviews) : ''}
          ${publisherPass ? renderPublisherChecklist(publisherPass) : ''}
        </div>
        <div class="detail-sidebar">
          ${renderUsagePanel(usageEvents ?? [])}
          ${renderStageRunsPanel(stageRuns ?? [])}
          ${renderAuditLog(transitions)}
          ${renderArticleMetadata(article)}
        </div>
      </div>
    </div>`;

  return renderLayout(article.title, content, config.leagueConfig.name);
}

// ── Stage timeline ───────────────────────────────────────────────────────────

function renderStageTimeline(currentStage: Stage, transitions: StageTransition[] = []): string {
  // Build a map of stage → transition time for tooltip display
  const stageTransitionTime: Record<number, string> = {};
  for (const t of transitions) {
    stageTransitionTime[t.to_stage] = t.transitioned_at;
  }

  return `
    <div class="stage-timeline">
      ${VALID_STAGES.map((stage, i) => {
        const state = stage < currentStage ? 'completed'
          : stage === currentStage ? 'current'
          : 'future';
        const connector = i < VALID_STAGES.length - 1
          ? `<div class="stage-connector ${stage < currentStage ? 'completed' : ''}"></div>`
          : '';
        const timeStr = stageTransitionTime[stage] ? formatDate(stageTransitionTime[stage]) : '';
        const tooltip = `${STAGE_NAMES[stage]}${timeStr ? ` (${timeStr})` : ''}`;
        return `
          <div class="stage-step">
            <div class="stage-dot ${state}" title="${escapeHtml(tooltip)}">${stage}</div>
            ${state !== 'future' && timeStr ? `<div class="stage-time">${escapeHtml(timeStr)}</div>` : ''}
          </div>
          ${connector}`;
      }).join('')}
    </div>`;
}

// ── Artifact Tabs ────────────────────────────────────────────────────────────

function renderArtifactTabs(article: Article): string {
  return `
    <section class="detail-section">
      <h2>Artifacts</h2>
      <div class="artifact-tabs">
        <div class="tab-bar" role="tablist">
          ${ARTIFACT_FILES.map((name, i) => `
            <button class="tab-btn ${i === 0 ? 'active' : ''}" role="tab"
              hx-get="/htmx/articles/${escapeHtml(article.id)}/artifact/${escapeHtml(name)}"
              hx-target="#artifact-content-${escapeHtml(article.id)}"
              hx-swap="innerHTML"
              data-tab="${escapeHtml(name)}"
              onclick="this.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
              ${escapeHtml(name.replace('.md', ''))}
            </button>
          `).join('')}
        </div>
        <div class="tab-content" id="artifact-content-${escapeHtml(article.id)}"
          hx-get="/htmx/articles/${escapeHtml(article.id)}/artifact/${escapeHtml(ARTIFACT_FILES[0])}"
          hx-trigger="load"
          hx-swap="innerHTML">
          <p class="empty-state">Loading…</p>
        </div>
      </div>
      ${renderArtifactLinks(article)}
    </section>`;
}

/** External links to Substack draft/published URLs. */
function renderArtifactLinks(article: Article): string {
  if (!article.substack_draft_url && !article.substack_url) return '';

  return `
    <div class="artifact-list" style="margin-top:0.75rem">
      ${article.substack_draft_url ? `
        <div class="artifact-item">
          <span class="artifact-icon">✏️</span>
          <div class="artifact-info">
            <span class="artifact-label">Substack Draft</span>
            <a href="${escapeHtml(article.substack_draft_url)}" target="_blank" class="artifact-link">${escapeHtml(article.substack_draft_url)}</a>
          </div>
        </div>` : ''}
      ${article.substack_url ? `
        <div class="artifact-item">
          <span class="artifact-icon">🌐</span>
          <div class="artifact-info">
            <span class="artifact-label">Published URL</span>
            <a href="${escapeHtml(article.substack_url)}" target="_blank" class="artifact-link">${escapeHtml(article.substack_url)}</a>
          </div>
        </div>` : ''}
    </div>`;
}

/** Render artifact file content as an HTML fragment (htmx partial). */
export function renderArtifactContent(name: string, content: string | null): string {
  if (content == null) {
    return `<p class="empty-state">Not yet created</p>`;
  }

  // Render markdown files as rich HTML; fallback to pre for unknown types
  if (name.endsWith('.md')) {
    return `<div class="artifact-rendered">${markdownToHtml(content)}</div>`;
  }
  return `<pre class="artifact-pre">${escapeHtml(content)}</pre>`;
}

// ── Action Panel ─────────────────────────────────────────────────────────────

function renderActionPanel(article: Article, advanceCheck?: AdvanceCheck, stageRuns?: StageRun[]): string {
  // Find the most recent stage_run failure for inline display
  const lastRun = stageRuns && stageRuns.length > 0 ? stageRuns[0] : undefined;
  const lastRunError = lastRun && lastRun.status !== 'completed' && lastRun.notes
    ? lastRun.notes
    : undefined;

  // Stage 8 — published
  if (article.current_stage === 8) {
    return `
      <section class="detail-section action-panel">
        <h2>Actions</h2>
        <div class="action-bar">
          <span class="badge badge-published-lg">✅ Published</span>
          ${article.substack_url
            ? `<a href="${escapeHtml(article.substack_url)}" target="_blank" class="btn btn-secondary">View on Substack ↗</a>`
            : ''}
        </div>
      </section>`;
  }

  const nextStage = Math.min(article.current_stage + 1, 8) as Stage;
  const canAdvance = advanceCheck?.allowed ?? false;
  const guardReason = advanceCheck?.reason ?? '';

  const retryButton = `
    <button class="btn btn-retry"
      hx-post="/htmx/articles/${escapeHtml(article.id)}/auto-advance"
      hx-target="#retry-result-${escapeHtml(article.id)}"
      hx-swap="innerHTML"
      hx-indicator="#retry-spinner-${escapeHtml(article.id)}">
      🔄 Retry Auto-Advance
    </button>
    <span id="retry-spinner-${escapeHtml(article.id)}" class="htmx-indicator" style="margin-left:0.5rem">⏳ Running…</span>`;

  const stageRunErrorHtml = lastRunError
    ? `<div class="stage-run-error">⚠️ Last run (Stage ${lastRun!.stage}, ${escapeHtml(lastRun!.status)}): ${escapeHtml(lastRunError)}</div>`
    : '';

  // Stage 7 — publish flow (no retry button, uses publish button instead)
  if (article.current_stage === 7) {
    const canRegress = true; // Stage 7 can always go back
    const regressOptions = Array.from({ length: article.current_stage - 1 }, (_, i) => {
      const stage = (i + 1) as Stage;
      return `<option value="${stage}">${STAGE_NAMES[stage]}</option>`;
    }).join('');

    return `
      <section class="detail-section action-panel">
        <h2>Actions</h2>
        <div class="action-bar">
          ${article.substack_draft_url
            ? `<a href="${escapeHtml(article.substack_draft_url)}" target="_blank" class="btn btn-secondary">Preview ↗</a>`
            : ''}
          <button class="btn btn-publish"
            hx-post="/htmx/articles/${escapeHtml(article.id)}/advance"
            hx-target="#advance-result-${escapeHtml(article.id)}"
            hx-swap="innerHTML"
            hx-confirm="Publish this article to Substack?"
            ${canAdvance ? '' : 'disabled'}>
            Publish to Substack
          </button>
          <details class="send-back-dropdown">
            <summary class="btn btn-danger-outline">↩ Send Back</summary>
            <form class="send-back-form"
              hx-post="/htmx/articles/${escapeHtml(article.id)}/regress"
              hx-target="#advance-result-${escapeHtml(article.id)}"
              hx-swap="innerHTML">
              <label>Send back to:</label>
              <select name="to_stage">${regressOptions}</select>
              <label>Reason:</label>
              <input type="text" name="reason" placeholder="Reason for sending back..." />
              <button type="submit" class="btn btn-danger btn-sm">Confirm Send Back</button>
            </form>
          </details>
        </div>
        ${renderGuardStatus(canAdvance, guardReason)}
        ${stageRunErrorHtml}
        <div id="advance-result-${escapeHtml(article.id)}"></div>
      </section>`;
  }

  // Other stages — advance flow + retry button
  const canRegress = article.current_stage > 1;
  const regressOptions = canRegress
    ? Array.from({ length: article.current_stage - 1 }, (_, i) => {
        const stage = (i + 1) as Stage;
        return `<option value="${stage}">${STAGE_NAMES[stage]}</option>`;
      }).join('')
    : '';

  return `
    <section class="detail-section action-panel">
      <h2>Actions</h2>
      <div class="action-bar">
        ${article.substack_draft_url
          ? `<a href="${escapeHtml(article.substack_draft_url)}" target="_blank" class="btn btn-secondary">Preview Draft ↗</a>`
          : ''}
        <button class="btn btn-primary"
          hx-post="/htmx/articles/${escapeHtml(article.id)}/advance"
          hx-target="#advance-result-${escapeHtml(article.id)}"
          hx-swap="innerHTML"
          hx-confirm="Advance to ${escapeHtml(STAGE_NAMES[nextStage])}?"
          ${canAdvance ? '' : 'disabled'}>
          Advance ▶ Stage ${nextStage}
        </button>
        ${retryButton}
        ${canRegress ? `
          <details class="send-back-dropdown">
            <summary class="btn btn-danger-outline">↩ Send Back</summary>
            <form class="send-back-form"
              hx-post="/htmx/articles/${escapeHtml(article.id)}/regress"
              hx-target="#advance-result-${escapeHtml(article.id)}"
              hx-swap="innerHTML">
              <label>Send back to:</label>
              <select name="to_stage">${regressOptions}</select>
              <label>Reason:</label>
              <input type="text" name="reason" placeholder="Reason for sending back..." />
              <button type="submit" class="btn btn-danger btn-sm">Confirm Send Back</button>
            </form>
          </details>` : ''}
      </div>
      ${renderGuardStatus(canAdvance, guardReason)}
      ${stageRunErrorHtml}
      <div id="advance-result-${escapeHtml(article.id)}"></div>
      <div id="retry-result-${escapeHtml(article.id)}" class="retry-result"></div>
    </section>`;
}

function renderGuardStatus(canAdvance: boolean, reason: string): string {
  if (!reason) return '';
  const cls = canAdvance ? 'guard-pass' : 'guard-fail';
  const icon = canAdvance ? '✅' : '⚠️';
  return `<div class="guard-status ${cls}">${icon} ${escapeHtml(reason)}</div>`;
}

/** Render the result of an htmx advance POST (HTML fragment). */
export function renderAdvanceResult(success: boolean, message: string): string {
  if (success) {
    return `<div class="advance-result advance-success">✅ ${escapeHtml(message)}</div>`;
  }
  return `<div class="advance-result advance-error">❌ ${escapeHtml(message)}</div>`;
}

// ── Editor reviews ───────────────────────────────────────────────────────────

function renderEditorReviews(reviews: EditorReview[]): string {
  return `
    <section class="detail-section">
      <h2>Editor Reviews</h2>
      <div class="review-list">
        ${reviews.map(r => {
          const verdictIcon = r.verdict === 'APPROVED' ? '✅' : r.verdict === 'REVISE' ? '🔄' : '❌';
          return `
          <div class="review-card review-${r.verdict.toLowerCase()}">
            <div class="review-header">
              <span class="verdict-badge verdict-${r.verdict.toLowerCase()}">
                ${verdictIcon} ${escapeHtml(r.verdict)}
              </span>
              <span class="review-number">Review #${r.review_number}</span>
              <span class="meta-date">${formatDate(r.reviewed_at)}</span>
            </div>
            <div class="review-stats">
              <span class="stat stat-error">${r.error_count} error${r.error_count !== 1 ? 's' : ''}</span>
              <span class="stat stat-suggestion">${r.suggestion_count} suggestion${r.suggestion_count !== 1 ? 's' : ''}</span>
              <span class="stat stat-note">${r.note_count} note${r.note_count !== 1 ? 's' : ''}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

// ── Publisher checklist ──────────────────────────────────────────────────────

function renderPublisherChecklist(pass: PublisherPass): string {
  const items: { label: string; checked: number }[] = [
    { label: 'Title finalized', checked: pass.title_final },
    { label: 'Subtitle finalized', checked: pass.subtitle_final },
    { label: 'Body clean', checked: pass.body_clean },
    { label: 'Section assigned', checked: pass.section_assigned },
    { label: 'Tags set', checked: pass.tags_set },
    { label: 'URL slug set', checked: pass.url_slug_set },
    { label: 'Cover image set', checked: pass.cover_image_set },
    { label: 'Paywall set', checked: pass.paywall_set },
    { label: 'Email send', checked: pass.email_send },
    { label: 'Names verified', checked: pass.names_verified },
    { label: 'Numbers current', checked: pass.numbers_current },
    { label: 'No stale refs', checked: pass.no_stale_refs },
  ];
  const done = items.filter(i => i.checked).length;

  return `
    <section class="detail-section">
      <h2>Publisher Checklist (${done}/${items.length})</h2>
      <div class="checklist">
        ${items.map(i => `
          <div class="checklist-item ${i.checked ? 'checked' : ''}">
            <span class="check-icon">${i.checked ? '✅' : '⬜'}</span>
            <span class="check-label">${escapeHtml(i.label)}</span>
          </div>
        `).join('')}
      </div>
    </section>`;
}

// ── Audit Log ────────────────────────────────────────────────────────────────

function renderAuditLog(transitions: StageTransition[]): string {
  if (transitions.length === 0) {
    return `<section class="detail-section">
      <h2>Audit Log</h2>
      <p class="empty-state">No stage transitions recorded</p>
    </section>`;
  }

  return `
    <section class="detail-section">
      <h2>Audit Log</h2>
      <div class="audit-log">
        ${transitions.map(t => `
          <div class="audit-entry">
            <div class="audit-stages">
              ${t.from_stage != null ? `<span class="badge badge-stage badge-stage-${t.from_stage}">${t.from_stage}</span>` : '<span class="badge badge-stage">—</span>'}
              <span class="audit-arrow">→</span>
              <span class="badge badge-stage badge-stage-${t.to_stage}">${t.to_stage}</span>
            </div>
            <div class="audit-meta">
              ${t.agent ? `<span class="audit-agent">${escapeHtml(t.agent)}</span>` : ''}
              <span class="audit-time">${formatDate(t.transitioned_at)}</span>
            </div>
            ${t.notes ? `<div class="audit-notes">${escapeHtml(t.notes)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>`;
}

// ── Article Metadata ─────────────────────────────────────────────────────────

function renderArticleMetadata(article: Article): string {
  return `
    <section class="detail-section">
      <h2>Article Metadata</h2>
      <dl class="info-list">
        <dt>ID</dt><dd><code>${escapeHtml(article.id)}</code></dd>
        ${article.primary_team ? `<dt>Team</dt><dd>${escapeHtml(article.primary_team)}</dd>` : ''}
        <dt>League</dt><dd>${escapeHtml(article.league)}</dd>
        <dt>Depth</dt><dd>${article.depth_level}</dd>
        <dt>Status</dt><dd>${escapeHtml(article.status)}</dd>
        <dt>Created</dt><dd>${formatDate(article.created_at)}</dd>
        ${article.target_publish_date ? `<dt>Target Publish</dt><dd>${escapeHtml(article.target_publish_date)}</dd>` : ''}
        ${article.publish_window ? `<dt>Publish Window</dt><dd>${escapeHtml(article.publish_window)}</dd>` : ''}
        <dt>Time Sensitive</dt><dd>${article.time_sensitive ? 'Yes' : 'No'}</dd>
        <dt>Updated</dt><dd>${formatDate(article.updated_at)}</dd>
        ${article.published_at ? `<dt>Published</dt><dd>${formatDate(article.published_at)}</dd>` : ''}
      </dl>
    </section>`;
}

// ── Usage Panel ──────────────────────────────────────────────────────────────

interface UsageSummary {
  totalPromptTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  totalRequests: number;
  byModel: Record<string, { tokens: number; cost: number; count: number }>;
  byStage: Record<number, { tokens: number; cost: number }>;
}

function aggregateUsage(events: UsageEvent[]): UsageSummary {
  const summary: UsageSummary = {
    totalPromptTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalRequests: events.length,
    byModel: {},
    byStage: {},
  };

  for (const e of events) {
    summary.totalPromptTokens += e.prompt_tokens ?? 0;
    summary.totalOutputTokens += e.output_tokens ?? 0;
    summary.totalCachedTokens += e.cached_tokens ?? 0;
    summary.totalCost += e.cost_usd_estimate ?? 0;

    const model = e.model_or_tool ?? 'unknown';
    if (!summary.byModel[model]) summary.byModel[model] = { tokens: 0, cost: 0, count: 0 };
    summary.byModel[model].tokens += (e.prompt_tokens ?? 0) + (e.output_tokens ?? 0);
    summary.byModel[model].cost += e.cost_usd_estimate ?? 0;
    summary.byModel[model].count += 1;

    if (e.stage != null) {
      if (!summary.byStage[e.stage]) summary.byStage[e.stage] = { tokens: 0, cost: 0 };
      summary.byStage[e.stage].tokens += (e.prompt_tokens ?? 0) + (e.output_tokens ?? 0);
      summary.byStage[e.stage].cost += e.cost_usd_estimate ?? 0;
    }
  }

  return summary;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function renderUsagePanel(events: UsageEvent[]): string {
  if (events.length === 0) {
    return `<section class="detail-section">
      <h2>Token Usage</h2>
      <p class="empty-state">No usage data recorded</p>
    </section>`;
  }

  const s = aggregateUsage(events);
  const totalTokens = s.totalPromptTokens + s.totalOutputTokens;

  const modelRows = Object.entries(s.byModel)
    .sort(([, a], [, b]) => b.tokens - a.tokens)
    .slice(0, 5)
    .map(([model, data]) => `
      <div class="usage-row">
        <span class="usage-model">${escapeHtml(model)}</span>
        <span class="usage-tokens">${formatTokens(data.tokens)}</span>
        <span class="usage-cost">$${data.cost.toFixed(4)}</span>
      </div>
    `).join('');

  const stageRows = Object.entries(s.byStage)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([stage, data]) => `
      <div class="usage-row">
        <span class="usage-stage">Stage ${stage}</span>
        <span class="usage-tokens">${formatTokens(data.tokens)}</span>
        <span class="usage-cost">$${data.cost.toFixed(4)}</span>
      </div>
    `).join('');

  return `
    <section class="detail-section">
      <h2>Token Usage</h2>
      <div class="usage-summary">
        <div class="usage-stat">
          <span class="usage-stat-value">${formatTokens(totalTokens)}</span>
          <span class="usage-stat-label">Total Tokens</span>
        </div>
        <div class="usage-stat">
          <span class="usage-stat-value">$${s.totalCost.toFixed(4)}</span>
          <span class="usage-stat-label">Est. Cost</span>
        </div>
        <div class="usage-stat">
          <span class="usage-stat-value">${s.totalRequests}</span>
          <span class="usage-stat-label">API Calls</span>
        </div>
      </div>
      ${s.totalCachedTokens > 0 ? `<div class="usage-cached">🟢 ${formatTokens(s.totalCachedTokens)} cached tokens (saved)</div>` : ''}
      ${modelRows ? `<div class="usage-breakdown"><h3>By Model</h3>${modelRows}</div>` : ''}
      ${stageRows ? `<div class="usage-breakdown"><h3>By Stage</h3>${stageRows}</div>` : ''}
    </section>`;
}

// ── Stage Runs Panel ─────────────────────────────────────────────────────────

export function renderStageRunsPanel(runs: StageRun[]): string {
  if (runs.length === 0) {
    return `<section class="detail-section">
      <h2>Stage Runs</h2>
      <p class="empty-state">No runs recorded</p>
    </section>`;
  }

  return `
    <section class="detail-section">
      <h2>Stage Runs</h2>
      <div class="stage-runs">
        ${runs.map(r => {
          const statusIcon = r.status === 'completed' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'started' ? '🔄' : '⏹';
          const duration = r.completed_at && r.started_at
            ? formatDuration(new Date(r.completed_at).getTime() - new Date(r.started_at).getTime())
            : '';
          return `
          <div class="stage-run stage-run-${r.status}">
            <div class="stage-run-header">
              <span class="stage-run-icon">${statusIcon}</span>
              <span class="badge badge-stage badge-stage-${r.stage}">Stage ${r.stage}</span>
              ${r.actor ? `<span class="stage-run-actor">${escapeHtml(r.actor)}</span>` : ''}
            </div>
            <div class="stage-run-meta">
              ${duration ? `<span class="stage-run-duration">⏱ ${duration}</span>` : ''}
              <span class="stage-run-time">${formatDate(r.started_at)}</span>
            </div>
            ${r.requested_model ? `<div class="stage-run-model">🤖 ${escapeHtml(r.requested_model)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}
