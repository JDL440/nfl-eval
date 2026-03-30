/**
 * article.ts — Article detail view for the editorial workstation.
 *
 * Shows article metadata, actions, artifacts, revisions, and usage.
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import { STAGE_NAMES } from '../../types.js';
import type { Article, Stage, EditorReview, UsageEvent } from '../../types.js';
import type { AppConfig } from '../../config/index.js';
import type { AdvanceCheck } from '../../pipeline/engine.js';
import { parseRevisionBlockerMetadata, type RevisionHistoryEntry } from '../../pipeline/conversation.js';
import { markdownToHtml } from '../../services/markdown.js';

const DEPTH_LABELS: Record<number, string> = {
  1: 'Quick Take',
  2: 'The Beat',
  3: 'Deep Dive',
  4: 'Feature',
};

/** Artifact file names produced at each pipeline stage. */
export const ARTIFACT_FILES = [
  'idea.md',
  'discussion-prompt.md',
  'panel-composition.md',
  'discussion-summary.md',
  'article-contract.md',
  'draft.md',
  'editor-review.md',
] as const;

export type ArtifactName = typeof ARTIFACT_FILES[number];

export const OPTIONAL_ARTIFACT_FILES = [
  'lead-review.md',
] as const;

export interface ArticleDetailData {
  config: AppConfig;
  article: Article;
  reviews: EditorReview[];
  revisionHistory?: RevisionHistoryEntry[];
  advanceCheck?: AdvanceCheck;
  usageEvents?: UsageEvent[];
  artifactNames?: string[];
  flashMessage?: string;
  errorMessage?: string;
}

function parseTeams(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(x => String(x).trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

export function renderArticleMetaDisplay(article: Article): string {
  const teams = parseTeams(article.teams);
  const teamsBadges = teams.length > 0
    ? `<div class="meta-teams">${teams.map(t => `<span class="badge badge-team">${escapeHtml(t)}</span>`).join(' ')}</div>`
    : '';

  return `
    <div id="article-meta">
      <div class="meta-title-row">
        <h1>${escapeHtml(article.title)}</h1>
        <button
          type="button"
          class="icon-button"
          title="Edit metadata"
          hx-get="/htmx/articles/${escapeHtml(article.id)}/edit-meta"
          hx-target="#article-meta"
          hx-swap="outerHTML"
        >✏️</button>
      </div>
      ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
      ${teamsBadges}
      <div class="detail-meta">
        ${!teamsBadges && article.primary_team ? `<span class="badge badge-team">${escapeHtml(article.primary_team)}</span>` : ''}
        <span class="badge badge-stage badge-stage-${article.current_stage}">
          Stage ${article.current_stage} · ${escapeHtml(STAGE_NAMES[article.current_stage] ?? 'Unknown')}
        </span>
        <span class="badge badge-status badge-status-${article.status}">${escapeHtml(article.status)}</span>
        <span class="badge badge-depth">${DEPTH_LABELS[article.depth_level] ?? `Depth ${article.depth_level}`}</span>
      </div>
    </div>`;
}

export function renderArticleMetaEditForm(article: Article): string {
  const teams = parseTeams(article.teams).join(', ');

  const depthOptions: { value: number; label: string }[] = [
    { value: 1, label: '1: Quick Take (~800 words)' },
    { value: 2, label: '2: The Beat (~1500 words)' },
    { value: 3, label: '3: Deep Dive (~2500 words)' },
    { value: 4, label: '4: Feature (~4000 words)' },
  ];

  const depthWarning = article.current_stage > 1
    ? `<p class="meta-edit-warning">⚠️ Changing depth level after Stage 1 may desync prompts/panel sizing.</p>`
    : '';

  return `
    <form
      id="article-meta"
      class="meta-edit-card"
      hx-post="/htmx/articles/${escapeHtml(article.id)}/edit-meta"
      hx-target="#article-meta"
      hx-swap="outerHTML"
    >
      <div class="meta-edit-card-header">✏️ Edit Article Metadata</div>

      <div class="meta-edit-field">
        <label class="meta-edit-label" for="meta-title">Title</label>
        <input id="meta-title" class="input input-full" name="title" type="text" value="${escapeHtml(article.title)}" required />
        <div class="meta-edit-hint">Slug/ID is immutable: <code>${escapeHtml(article.id)}</code></div>
      </div>

      <div class="meta-edit-field">
        <label class="meta-edit-label" for="meta-subtitle">Subtitle</label>
        <textarea id="meta-subtitle" class="input input-full textarea" name="subtitle" rows="3">${escapeHtml(article.subtitle ?? '')}</textarea>
      </div>

      <div class="meta-edit-row-2col">
        <div class="meta-edit-field">
          <label class="meta-edit-label" for="meta-depth">Depth Level</label>
          ${depthWarning}
          <select id="meta-depth" class="input input-full select" name="depth_level">
            ${depthOptions.map(o => `<option value="${o.value}"${o.value === article.depth_level ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
          </select>
        </div>
        <div class="meta-edit-field">
          <label class="meta-edit-label" for="meta-teams">Teams</label>
          <input id="meta-teams" class="input input-full" name="teams" type="text" value="${escapeHtml(teams)}" placeholder="seahawks, chiefs" />
          <div class="meta-edit-hint">Comma-separated team slugs.</div>
        </div>
      </div>

      <div class="meta-edit-actions">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button
          type="button"
          class="btn btn-secondary"
          hx-get="/htmx/articles/${escapeHtml(article.id)}/meta"
          hx-target="#article-meta"
          hx-swap="outerHTML"
        >Cancel</button>
      </div>
    </form>`;
}

export function renderArticleDetail(data: ArticleDetailData): string {
  const { config, article, reviews, revisionHistory, advanceCheck, usageEvents, artifactNames, flashMessage, errorMessage } = data;

  let flashBanner = '';
  if (flashMessage) {
    flashBanner = `<div class="flash-banner">${escapeHtml(flashMessage)}</div>`;
  }
  const errorBanner = errorMessage
    ? `<div class="flash-banner flash-error">❌ ${escapeHtml(errorMessage)}</div>`
    : '';

  const eid = escapeHtml(article.id);

  const content = `
    <div class="article-detail">
      ${flashBanner}
      ${errorBanner}
      <div class="detail-header">
        <a href="/" class="back-link">← Dashboard</a>
        <div id="live-meta"
          hx-get="/htmx/articles/${eid}/live-header"
          hx-trigger="sse:stage_changed, sse:pipeline_complete"
          hx-swap="innerHTML">
          ${renderArticleMetaDisplay(article)}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          ${renderActionPanel(article, advanceCheck)}
          ${(revisionHistory?.length ?? 0) > 0 ? renderRevisionHistory(revisionHistory ?? []) : ''}
          ${article.current_stage >= 5 ? renderImageSection(article, artifactNames) : ''}
          <div id="live-artifacts"
            hx-get="/htmx/articles/${eid}/live-artifacts"
            hx-trigger="sse:stage_changed, sse:pipeline_complete"
            hx-swap="innerHTML">
            ${renderArtifactTabs(article, artifactNames)}
          </div>
          ${(revisionHistory?.length ?? 0) === 0 && reviews.length > 0 ? renderEditorReviews(reviews) : ''}
          ${renderUsagePanel(usageEvents ?? [])}
        </div>
      </div>
    </div>`;

  return renderLayout(article.title, content, config.leagueConfig.name);
}

// ── Partial renders for SSE-driven live updates ─────────────────────────────

export function renderLiveHeader(article: Article): string {
  return renderArticleMetaDisplay(article);
}

export function renderLiveArtifacts(article: Article, artifactNames?: string[]): string {
  return renderArtifactTabs(article, artifactNames);
}

// ── Artifact Tabs ────────────────────────────────────────────────────────────

function renderArtifactTabs(article: Article, artifactNames?: string[]): string {
  const tabNames = [
    ...ARTIFACT_FILES,
    ...OPTIONAL_ARTIFACT_FILES.filter(name => (artifactNames ?? []).includes(name)),
  ];
  const defaultTab = article.status === 'needs_lead_review' && tabNames.includes('lead-review.md')
    ? 'lead-review.md'
    : (tabNames[0] ?? ARTIFACT_FILES[0]);
  const thinkingFiles = new Set((artifactNames ?? []).filter(n => n.endsWith('.thinking.md')));

  return `
    <section class="detail-section">
      <h2>Artifacts</h2>
      <div class="artifact-tabs">
        <div class="tab-bar" role="tablist">
          ${tabNames.map((name) => {
            const thinkName = name.replace('.md', '.thinking.md');
            const hasThinking = thinkingFiles.has(thinkName);
            return `
              <button class="tab-btn ${name === defaultTab ? 'active' : ''}" role="tab"
                hx-get="/htmx/articles/${escapeHtml(article.id)}/artifact/${escapeHtml(name)}"
                hx-target="#artifact-content-${escapeHtml(article.id)}"
                hx-swap="innerHTML"
                data-tab="${escapeHtml(name)}"
                onclick="this.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
                ${escapeHtml(name.replace('.md', ''))}
                ${hasThinking ? '<span class="artifact-trace-badge">💭 trace</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
        <div class="tab-content" id="artifact-content-${escapeHtml(article.id)}"
          hx-get="/htmx/articles/${escapeHtml(article.id)}/artifact/${escapeHtml(defaultTab)}"
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
export function renderArtifactContent(
  name: string,
  content: string | null,
  persistedThinkingContent?: string | null,
): string {
  if (content == null) {
    return `<p class="empty-state">Not yet created</p>`;
  }

  const extracted = extractThinking(content);
  const hasPersistedThinking = !!persistedThinkingContent && !name.endsWith('.thinking.md');
  const thinking = hasPersistedThinking ? persistedThinkingContent : extracted.thinking;
  const output = extracted.output;

  const thinkingHtml = thinking
    ? `<details class="thinking-block">
        <summary>${hasPersistedThinking ? '💭 Persisted Thinking Trace' : '💭 Extracted Thinking Trace'} <span class="thinking-hint">(click to expand)</span></summary>
        <div class="thinking-content">${name.endsWith('.md') ? markdownToHtml(thinking) : `<pre>${escapeHtml(thinking)}</pre>`}</div>
      </details>`
    : '';

  // Render markdown files as rich HTML; fallback to pre for unknown types
  const outputHtml = name.endsWith('.md')
    ? `<div class="artifact-rendered">${markdownToHtml(output)}</div>`
    : `<pre class="artifact-pre">${escapeHtml(output)}</pre>`;

  return thinkingHtml + outputHtml;
}

function summarizeMarkdown(content: string, maxLength = 220): string {
  const compact = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (compact.length <= maxLength) return compact;
  return compact.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}

function renderRevisionTurn(
  label: string,
  turn: RevisionHistoryEntry['writerTurn'],
): string {
  if (!turn) {
    return `<div class="revision-turn revision-turn-missing"><strong>${escapeHtml(label)}:</strong> <span class="empty-state">No persisted ${escapeHtml(label.toLowerCase())} turn found for this iteration.</span></div>`;
  }

  return `
    <div class="revision-turn">
      <div class="revision-turn-header">
        <strong>${escapeHtml(label)}</strong>
        <span class="meta-date">${escapeHtml(formatDate(turn.created_at))}</span>
      </div>
      <p class="revision-turn-summary">${escapeHtml(summarizeMarkdown(turn.content))}</p>
      <details class="revision-turn-details">
        <summary>View full ${escapeHtml(label.toLowerCase())}</summary>
        <div class="artifact-rendered">${markdownToHtml(turn.content)}</div>
      </details>
    </div>`;
}

function renderRevisionHistory(history: RevisionHistoryEntry[]): string {
  return `
    <section class="detail-section">
      <h2>Revision History</h2>
      <div class="review-list revision-history-list">
        ${history.map(entry => {
          const { summary, keyIssues, writerTurn, editorTurn } = entry;
          const blockerMetadata = parseRevisionBlockerMetadata(summary.blocker_type, summary.blocker_ids);
          const outcomeClass = summary.outcome.toLowerCase();
          return `
            <div class="review-card review-${escapeHtml(outcomeClass)} revision-history-card">
              <div class="review-header">
                <span class="verdict-badge verdict-${escapeHtml(outcomeClass)}">🔁 Iteration ${summary.iteration}</span>
                <span class="review-number">${escapeHtml(STAGE_NAMES[summary.from_stage as Stage] ?? `Stage ${summary.from_stage}`)} → ${escapeHtml(STAGE_NAMES[summary.to_stage as Stage] ?? `Stage ${summary.to_stage}`)}</span>
                <span class="meta-date">${escapeHtml(formatDate(summary.created_at))}</span>
              </div>
              <div class="review-stats">
                <span class="stat stat-note">${escapeHtml(summary.outcome)}</span>
                <span class="stat stat-note">${escapeHtml(summary.agent_name)}</span>
              </div>
              ${summary.feedback_summary ? `<p class="revision-feedback"><strong>Summary:</strong> ${escapeHtml(summary.feedback_summary)}</p>` : ''}
              ${blockerMetadata ? `<p class="revision-feedback"><strong>Blockers:</strong> ${blockerMetadata.blockerType ? `type=${escapeHtml(blockerMetadata.blockerType)}` : 'type=unclassified'}${blockerMetadata.blockerIds.length > 0 ? ` · ids=${escapeHtml(blockerMetadata.blockerIds.join(', '))}` : ''}</p>` : ''}
              ${keyIssues.length > 0 ? `<ul class="revision-issues">${keyIssues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>` : ''}
              <div class="revision-turn-grid">
                ${renderRevisionTurn('Writer pass', writerTurn)}
                ${renderRevisionTurn('Editor pass', editorTurn)}
              </div>
            </div>`;
        }).join('')}
      </div>
    </section>`;
}

/** Extract thinking/reasoning blocks from LLM output. */
export function extractThinking(content: string): { thinking: string | null; output: string } {
  // Pattern 1: Matched pairs — <think>...</think>, <thinking>...</thinking>, <reasoning>...</reasoning>
  const pairedRegex = /<(think|thinking|reasoning)>([\s\S]*?)<\/\1>/gi;
  const thinkParts: string[] = [];
  let stripped = content.replace(pairedRegex, (_match, _tag, inner) => {
    thinkParts.push(inner.trim());
    return '';
  });

  // Pattern 2: Qwen-style — no opening tag, everything before </think> is thinking
  if (thinkParts.length === 0) {
    const closeIdx = stripped.indexOf('</think>');
    if (closeIdx >= 0) {
      thinkParts.push(stripped.slice(0, closeIdx).trim());
      stripped = stripped.slice(closeIdx + '</think>'.length);
    }
  }

  // Pattern 3: Prose prefix — starts with "Thinking Process:" or similar header
  if (thinkParts.length === 0) {
    const thinkHeaderMatch = stripped.match(/^(Thinking Process:[\s\S]*?)(?=\n#\s)/i);
    if (thinkHeaderMatch) {
      thinkParts.push(thinkHeaderMatch[1].trim());
      stripped = stripped.slice(thinkHeaderMatch[0].length);
    }
  }

  stripped = stripped.trim();

  return {
    thinking: thinkParts.length > 0 ? thinkParts.join('\n\n') : null,
    output: stripped || content,
  };
}

// ── Action Panel ─────────────────────────────────────────────────────────────

function renderActionPanel(article: Article, advanceCheck?: AdvanceCheck): string {
  // Preview button for articles with a draft (stage >= 5)
  const previewLink = article.current_stage >= 5
    ? `<a href="/articles/${escapeHtml(article.id)}/preview" class="btn btn-secondary">👁 Preview</a>`
    : '';
  const traceTimelineLink = `<a href="/articles/${escapeHtml(article.id)}/traces" class="btn btn-secondary">🧠 Trace</a>`;

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
          ${previewLink}
          ${traceTimelineLink}
        </div>
        ${renderDangerZone(article)}
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

  if (article.current_stage === 6 && article.status === 'needs_lead_review') {
    return `
      <section class="detail-section action-panel"
        hx-get="/articles/${escapeHtml(article.id)}"
        hx-trigger="sse:stage_changed, sse:pipeline_complete"
        hx-select=".action-panel"
        hx-target="this"
        hx-swap="outerHTML">
        <h2>Actions</h2>
        <div class="action-bar">
          <span class="badge badge-status badge-status-needs_lead_review">⏸ Needs Lead review</span>
          ${previewLink}
          ${traceTimelineLink}
          <details class="send-back-dropdown">
            <summary class="btn btn-danger-outline">↩ Send Back</summary>
            <form class="send-back-form"
              hx-post="/htmx/articles/${escapeHtml(article.id)}/regress"
              hx-target="#advance-result-${escapeHtml(article.id)}"
              hx-swap="innerHTML"
              hx-on::after-request="if(event.detail.successful) { this.closest('details').open = false; }"
              hx-on::after-settle="if(event.detail.successful) { setTimeout(() => window.location.reload(), 1000); }">
              <label>Send back to:</label>
              <select name="to_stage"><option value="4">${escapeHtml(STAGE_NAMES[4])}</option></select>
              <label>Reason:</label>
              <input type="text" name="reason" placeholder="Reason for sending back..." />
              <button type="submit" class="btn btn-danger btn-sm">Confirm Send Back</button>
            </form>
          </details>
        </div>
        ${renderGuardStatus(false, 'Lead review required: repeated editor blocker detected. Review lead-review.md before resuming or sending the article back.')}
        <div id="advance-result-${escapeHtml(article.id)}"></div>
        <div id="retry-result-${escapeHtml(article.id)}" class="retry-result"></div>
        ${renderDangerZone(article)}
      </section>`;
  }

  // Stage 7 — publish flow (no retry button, uses publish button instead)
  if (article.current_stage === 7) {
    const hasDraft = !!article.substack_draft_url;
    const publishStatus = hasDraft
      ? 'Substack draft saved. Open the Publish Page to review it, sync updates, or publish it live.'
      : 'No Substack draft yet. Open the Publish Page to save a draft or publish the article live.';
    const canRegress = true; // Stage 7 can always go back
    const regressOptions = Array.from({ length: article.current_stage - 1 }, (_, i) => {
      const stage = (i + 1) as Stage;
      return `<option value="${stage}">${STAGE_NAMES[stage]}</option>`;
    }).join('');

    return `
      <section class="detail-section action-panel"
        hx-get="/articles/${escapeHtml(article.id)}"
        hx-trigger="sse:stage_changed, sse:pipeline_complete"
        hx-select=".action-panel"
        hx-target="this"
        hx-swap="outerHTML">
        <h2>Actions</h2>
        <div class="action-bar">
          ${article.substack_draft_url
            ? `<a href="${escapeHtml(article.substack_draft_url)}" target="_blank" class="btn btn-secondary">Open Draft ↗</a>`
            : ''}
          <a href="/articles/${escapeHtml(article.id)}/publish" class="btn btn-primary">Open Publish Page</a>
          ${previewLink}
          ${traceTimelineLink}
          <details class="send-back-dropdown">
            <summary class="btn btn-danger-outline">↩ Send Back</summary>
            <form class="send-back-form"
              hx-post="/htmx/articles/${escapeHtml(article.id)}/regress"
              hx-target="#advance-result-${escapeHtml(article.id)}"
              hx-swap="innerHTML"
              hx-on::after-request="if(event.detail.successful) { this.closest('details').open = false; }"
              hx-on::after-settle="if(event.detail.successful) { setTimeout(() => window.location.reload(), 1000); }">
              <label>Send back to:</label>
              <select name="to_stage">${regressOptions}</select>
              <label>Reason:</label>
              <input type="text" name="reason" placeholder="Reason for sending back..." />
              <button type="submit" class="btn btn-danger btn-sm">Confirm Send Back</button>
            </form>
          </details>
        </div>
        ${renderGuardStatus(hasDraft, publishStatus)}
        <div id="advance-result-${escapeHtml(article.id)}"></div>
        ${renderDangerZone(article)}
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
    <section class="detail-section action-panel"
      hx-get="/articles/${escapeHtml(article.id)}"
      hx-trigger="sse:stage_changed, sse:pipeline_complete"
      hx-select=".action-panel"
      hx-target="this"
      hx-swap="outerHTML">
      <h2>Actions</h2>
      <div class="action-bar">
        ${article.substack_draft_url
          ? `<a href="${escapeHtml(article.substack_draft_url)}" target="_blank" class="btn btn-secondary">Preview Draft ↗</a>`
          : ''}
        ${previewLink}
        ${traceTimelineLink}
        <button class="btn btn-primary"
          hx-post="/htmx/articles/${escapeHtml(article.id)}/auto-advance"
          hx-target="#advance-result-${escapeHtml(article.id)}"
          hx-swap="innerHTML">
          Advance ▶ Stage ${nextStage}
        </button>
        ${retryButton}
        ${canRegress ? `
          <details class="send-back-dropdown">
            <summary class="btn btn-danger-outline">↩ Send Back</summary>
            <form class="send-back-form"
              hx-post="/htmx/articles/${escapeHtml(article.id)}/regress"
              hx-target="#advance-result-${escapeHtml(article.id)}"
              hx-swap="innerHTML"
              hx-on::after-request="if(event.detail.successful) { this.closest('details').open = false; }"
              hx-on::after-settle="if(event.detail.successful) { setTimeout(() => window.location.reload(), 1000); }">
              <label>Send back to:</label>
              <select name="to_stage">${regressOptions}</select>
              <label>Reason:</label>
              <input type="text" name="reason" placeholder="Reason for sending back..." />
              <button type="submit" class="btn btn-danger btn-sm">Confirm Send Back</button>
            </form>
          </details>` : ''}
      </div>
      ${renderGuardStatus(canAdvance, guardReason)}
      <div id="advance-result-${escapeHtml(article.id)}"></div>
      <div id="retry-result-${escapeHtml(article.id)}" class="retry-result"></div>
      ${renderDangerZone(article)}
    </section>`;
}

function renderGuardStatus(canAdvance: boolean, reason: string): string {
  if (!reason) return '';
  const cls = canAdvance ? 'guard-pass' : 'guard-fail';
  const icon = canAdvance ? '✅' : '⚠️';
  return `<div class="guard-status ${cls}">${icon} ${escapeHtml(reason)}</div>`;
}

function renderDangerZone(article: Article): string {
  const id = escapeHtml(article.id);
  const isArchived = article.status === 'archived';
  const isPublished = article.current_stage === 8 || article.status === 'published';

  const iconStyle = 'background:none;border:1px solid #555;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:0.75rem;color:#888;opacity:0.7;transition:all 0.15s;';

  const archiveBtn = !isArchived && !isPublished
    ? `<button title="Archive article"
        style="${iconStyle}"
        onmouseover="this.style.opacity='1';this.style.borderColor='#dc2626';this.style.color='#dc2626'"
        onmouseout="this.style.opacity='0.7';this.style.borderColor='#555';this.style.color='#888'"
        hx-post="/api/articles/${id}/archive"
        hx-confirm="Archive this article? It will be hidden from the dashboard.">📦</button>`
    : '';

  const unarchiveBtn = isArchived
    ? `<button title="Restore from archive"
        style="${iconStyle}"
        onmouseover="this.style.opacity='1';this.style.borderColor='#3b82f6';this.style.color='#3b82f6'"
        onmouseout="this.style.opacity='0.7';this.style.borderColor='#555';this.style.color='#888'"
        hx-post="/api/articles/${id}/unarchive"
        hx-confirm="Restore this article from the archive?">📤</button>`
    : '';

  const deleteBtn = `<button title="Permanently delete"
      style="${iconStyle}"
      onmouseover="this.style.opacity='1';this.style.borderColor='#dc2626';this.style.color='#dc2626'"
      onmouseout="this.style.opacity='0.7';this.style.borderColor='#555';this.style.color='#888'"
      hx-delete="/api/articles/${id}?confirm=true"
      hx-confirm="Permanently delete this article and all its data? This cannot be undone.">🗑</button>`;

  return `
    <div style="display:flex;align-items:center;gap:6px;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid #333;">
      <span style="font-size:0.65rem;color:#555;letter-spacing:0.03em;">article:</span>
      ${archiveBtn}
      ${unarchiveBtn}
      ${deleteBtn}
    </div>`;
}


// ── Image Section ────────────────────────────────────────────────────────────

function renderImageSection(article: Article, artifactNames?: string[]): string {
  const hasImages = (artifactNames ?? []).includes('images.json');

  return `
    <section class="detail-section image-section">
      <h2>Article Images</h2>
      <div class="action-bar" style="margin-bottom: 0.75rem;">
        <button class="btn btn-secondary"
          hx-post="/htmx/articles/${escapeHtml(article.id)}/generate-images"
          hx-target="#image-result-${escapeHtml(article.id)}"
          hx-swap="innerHTML"
          hx-indicator="#image-spinner-${escapeHtml(article.id)}"
          hx-confirm="Generate cover + 2 inline images?">
          🎨 Generate Images
        </button>
        <span id="image-spinner-${escapeHtml(article.id)}" class="htmx-indicator" style="margin-left:0.5rem">⏳ Generating…</span>
      </div>
      <div id="image-result-${escapeHtml(article.id)}"></div>
      <div id="image-gallery-${escapeHtml(article.id)}"
        hx-get="/htmx/articles/${escapeHtml(article.id)}/images"
        hx-trigger="load"
        hx-swap="innerHTML">
        ${hasImages ? '<p class="empty-state">Loading images…</p>' : '<p class="empty-state">No images generated yet</p>'}
      </div>
    </section>`;
}

/** Render image gallery HTML from an image manifest. */
export function renderImageGallery(manifest: { type: string; path: string; prompt: string }[]): string {
  if (!manifest || manifest.length === 0) {
    return '<p class="empty-state">No images in manifest</p>';
  }

  return `
    <div class="image-gallery">
      ${manifest.map((img, i) => {
        const label = img.type === 'cover' ? '🖼 Cover' : `📷 Inline ${i}`;
        // Convert absolute filesystem path to web-servable URL
        // Path format: .../images/{slug}/{slug}-cover.png → /images/{slug}/{filename}
        const parts = img.path.replace(/\\/g, '/').split('/');
        const filename = parts[parts.length - 1] ?? '';
        const slug = parts[parts.length - 2] ?? '';
        const imgUrl = slug && filename ? `/images/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}` : '';
        return `
          <div class="image-gallery-item">
            <div class="image-gallery-label">${label}</div>
            ${imgUrl
              ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(label)}" class="image-gallery-thumb" loading="lazy" />`
              : `<div class="image-gallery-path"><code>${escapeHtml(img.path)}</code></div>`
            }
            <details class="image-gallery-prompt">
              <summary>View prompt</summary>
              <p>${escapeHtml(img.prompt)}</p>
            </details>
          </div>`;
      }).join('')}
    </div>`;
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

// ── Usage Panel ──────────────────────────────────────────────────────────────

interface UsageSummary {
  totalPromptTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  totalRequests: number;
  byModel: Record<string, { tokens: number; cost: number; count: number }>;
  byStage: Record<number, { tokens: number; cost: number }>;
  byProvider: Record<string, { tokens: number; cost: number; count: number }>;
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
    byProvider: {},
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

    const provider = e.provider ?? 'unknown';
    if (!summary.byProvider[provider]) summary.byProvider[provider] = { tokens: 0, cost: 0, count: 0 };
    summary.byProvider[provider].tokens += (e.prompt_tokens ?? 0) + (e.output_tokens ?? 0);
    summary.byProvider[provider].cost += e.cost_usd_estimate ?? 0;
    summary.byProvider[provider].count += 1;
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

  const providerRows = Object.entries(s.byProvider)
    .sort(([, a], [, b]) => b.tokens - a.tokens)
    .map(([provider, data]) => `
      <div class="usage-row">
        <span class="usage-provider">${escapeHtml(provider)}</span>
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
      ${providerRows ? `<div class="usage-breakdown"><h3>By Provider</h3>${providerRows}</div>` : ''}
      ${stageRows ? `<div class="usage-breakdown"><h3>By Stage</h3>${stageRows}</div>` : ''}
    </section>`;
}

