/**
 * publish.ts — Publish preview and result views for the editorial workstation.
 *
 * Renders:
 *   - Publish preview: richer article preview plus draft/publish actions
 *   - Publish workflow: success/failure after draft creation or publishing
 */

import { renderLayout, escapeHtml } from './layout.js';
import type { Article, PublisherPass } from '../../types.js';
import type { ProseMirrorNode, ProseMirrorDoc } from '../../services/prosemirror.js';
import type { AppConfig } from '../../config/index.js';
import type { PublishIssue } from '../../pipeline/issue-aggregator.js';
import { renderArticlePreviewFrame } from './preview.js';

// ── ProseMirror JSON → HTML renderer ─────────────────────────────────────────

function renderMarks(node: ProseMirrorNode): string {
  let text = escapeHtml(node.text ?? '');
  if (!node.marks) return text;

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'strong':
      case 'bold':
        text = `<strong>${text}</strong>`;
        break;
      case 'em':
      case 'italic':
        text = `<em>${text}</em>`;
        break;
      case 'code':
        text = `<code>${text}</code>`;
        break;
      case 'link':
        text = `<a href="${escapeHtml(String(mark.attrs?.href ?? ''))}" target="_blank">${text}</a>`;
        break;
    }
  }
  return text;
}

function renderProseMirrorNode(node: ProseMirrorNode): string {
  if (node.type === 'text') return renderMarks(node);

  const children = (node.content ?? []).map(renderProseMirrorNode).join('');

  switch (node.type) {
    case 'paragraph':
      return `<p>${children || '&nbsp;'}</p>`;
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 6);
      return `<h${level}>${children}</h${level}>`;
    }
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;
    case 'bullet_list':
      return `<ul>${children}</ul>`;
    case 'ordered_list':
      return `<ol>${children}</ol>`;
    case 'list_item':
      return `<li>${children}</li>`;
    case 'code_block':
      return `<pre><code>${children}</code></pre>`;
    case 'horizontal_rule':
      return '<hr>';
    case 'hard_break':
      return '<br>';
    case 'captionedImage': {
      const img = node.content?.find(n => n.type === 'image2');
      const caption = node.content?.find(n => n.type === 'caption');
      const src = String(img?.attrs?.src ?? '');
      const alt = String(img?.attrs?.alt ?? '');
      const captionHtml = caption?.content?.map(renderProseMirrorNode).join('') ?? '';
      if (!src) return `<figure><span class="img-placeholder">[No image source]</span>${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}</figure>`;
      return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="article-img" loading="lazy" onerror="this.style.opacity='0.3';this.alt='[Image not available]'">${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}</figure>`;
    }
    case 'image2': {
      const src = String(node.attrs?.src ?? '');
      const alt = String(node.attrs?.alt ?? '');
      if (!src) return `<span class="img-placeholder">[No image source]</span>`;
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="article-img" loading="lazy" onerror="this.style.opacity='0.3';this.alt='[Image not available]'">`;
    }
    case 'caption':
      return children;
    case 'subscribeWidget': {
      const caption = node.content?.find(n => n.type === 'ctaCaption');
      const captionHtml = caption?.content?.map(renderProseMirrorNode).join('') ?? '';
      return `<div class="subscribe-widget">${captionHtml ? `<p>${captionHtml}</p>` : ''}<button type="button">Subscribe</button></div>`;
    }
    case 'ctaCaption':
      return children;
    default:
      return children;
  }
}

export function proseMirrorToHtml(doc: ProseMirrorDoc): string {
  return (doc.content ?? []).map(renderProseMirrorNode).join('\n');
}

// ── Publisher checklist items ─────────────────────────────────────────────────

export const CHECKLIST_ITEMS: { key: keyof PublisherPass; label: string }[] = [
  { key: 'title_final', label: 'Title finalized' },
  { key: 'subtitle_final', label: 'Subtitle finalized' },
  { key: 'body_clean', label: 'Body clean' },
  { key: 'section_assigned', label: 'Section assigned' },
  { key: 'tags_set', label: 'Tags set' },
  { key: 'url_slug_set', label: 'URL slug set' },
  { key: 'cover_image_set', label: 'Cover image set' },
  { key: 'paywall_set', label: 'Paywall set' },
  { key: 'email_send', label: 'Email send configured' },
  { key: 'names_verified', label: 'Names verified' },
  { key: 'numbers_current', label: 'Numbers current' },
  { key: 'no_stale_refs', label: 'No stale references' },
  { key: 'publish_datetime', label: 'Publish date/time set' },
];

// ── Publish preview page ─────────────────────────────────────────────────────

export interface PublishPreviewData {
  config: AppConfig;
  article: Article;
  htmlBody: string;
  coverImageUrl: string | null;
  inlineImageUrls: string[];
  substackConfigured?: boolean;
  issues?: PublishIssue[];
}

export function renderPublishPreview(data: PublishPreviewData): string {
  const {
    config,
    article,
    htmlBody,
    coverImageUrl,
    inlineImageUrls,
    substackConfigured = true,
    issues = [],
  } = data;

  const content = `
    <div class="article-detail publish-page">
      <section class="detail-section publish-hero">
        <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Article Detail</a>
        <div class="publish-detail-header">
          <p class="section-kicker">Publish workflow</p>
          <h1>Publish Page: ${escapeHtml(article.title)}</h1>
          ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
          <div class="detail-meta">
            ${article.primary_team ? `<span class="badge badge-team">${escapeHtml(article.primary_team)}</span>` : ''}
            <span class="badge badge-stage badge-stage-${article.current_stage}">
              Stage ${article.current_stage}
            </span>
          </div>
          <p class="hint">Save a Substack draft for review, then publish that linked draft live when ready.</p>
        </div>
      </section>

      <div class="detail-grid mobile-detail-layout publish-layout">
        <div class="detail-main mobile-primary-column">
          <section class="detail-section">
            <div class="action-bar action-group preview-section-header">
              <h2>Published Layout Preview</h2>
              <button id="viewport-toggle" class="btn btn-secondary btn-sm" onclick="toggleViewport()">
                📱 Mobile
              </button>
            </div>
            <p class="hint">This preview uses the same Substack-style layout as the dedicated article preview page.</p>
            <div class="article-preview" id="article-preview">
              ${renderArticlePreviewFrame({ config, article, htmlBody, coverImageUrl, inlineImageUrls })}
            </div>
          </section>
        </div>

        <div class="detail-sidebar mobile-secondary-column publish-sidebar-stack">
          ${renderPublishWorkflow({ article, substackConfigured })}

          ${renderIssueTracker(issues, article.id)}

          ${renderAiReviewPanel(article.id)}

          ${renderNoteComposer(article)}
          ${renderTweetComposer(article)}

          ${renderPublishAll(article.id, substackConfigured)}
        </div>
      </div>
    </div>`;

  return renderLayout(`Publish — ${article.title}`, content, config.leagueConfig.name);
}

// ── Publish result (htmx partial) ────────────────────────────────────────────

export interface PublishResultData {
  article: Article;
  success?: boolean;
  message?: string;
  messageTone?: 'success' | 'error' | 'info';
  draftUrl?: string;
  publishedUrl?: string;
  error?: string;
  substackConfigured?: boolean;
}

export function renderPublishWorkflow(data: PublishResultData): string {
  const {
    article,
    success,
    message,
    messageTone,
    draftUrl,
    publishedUrl,
    error,
    substackConfigured = true,
  } = data;
  const hasDraft = !!article.substack_draft_url;
  const hadAction = success !== undefined || message !== undefined || error !== undefined || draftUrl !== undefined || publishedUrl !== undefined;
  const resolvedMessage = success === false
    ? (error ?? 'Unknown error')
    : (message
        ?? (publishedUrl
          ? 'Article published successfully.'
          : draftUrl
            ? (hasDraft ? 'Substack draft updated.' : 'Substack draft created.')
            : 'Success'));
  const needsSubstackConfig = !substackConfigured || (
    success === false
    && resolvedMessage.includes('Substack publishing is not configured')
  );
  const tone = needsSubstackConfig || success === false ? 'error' : (messageTone ?? 'success');
  const displayMessage = needsSubstackConfig
    ? 'Substack publishing is not configured.'
    : resolvedMessage;
  const alertLabel = needsSubstackConfig || success === false ? 'Action needed:' : 'Ready:';

  const alertHtml = (hadAction || needsSubstackConfig) && displayMessage
    ? `<div class="alert alert-${escapeHtml(tone)}">
          <strong>${alertLabel}</strong> ${escapeHtml(displayMessage)}
          ${publishedUrl ? ` <a href="${escapeHtml(publishedUrl)}" target="_blank">View article ↗</a>` : ''}
        </div>`
    : '';
  const configHintHtml = needsSubstackConfig
    ? `<p class="hint">Configure Substack credentials on the <a href="/config">Settings</a> page, then try again.</p>`
    : '';

  if (article.current_stage === 8 || publishedUrl) {
    return `
      <section id="publish-workflow" class="detail-section publish-workflow-section publish-workflow-complete">
        <div class="publish-workflow-header">
          <div class="publish-workflow-kicker-row">
            <p class="section-kicker">Primary path</p>
            <span class="publish-status-badge is-live">Live</span>
          </div>
          <h2>Publish Status</h2>
          ${alertHtml}
          <p class="status-info publish-workflow-summary">This article is now live on Substack.</p>
        </div>
        <div class="action-bar publish-workflow-actions">
          ${publishedUrl
            ? `<a href="${escapeHtml(publishedUrl)}" target="_blank" class="btn btn-secondary">View Live Article ↗</a>`
            : ''}
          <a href="/articles/${escapeHtml(article.id)}" class="btn btn-primary">Back to Article</a>
        </div>
      </section>`;
  }

  const draftCopy = hasDraft
    ? 'Latest draft saved to Substack. You can update it again or publish that linked draft live.'
    : 'No Substack draft is linked yet. Save a draft to Substack before publishing live.';
  const unavailableAttrs = !substackConfigured
    ? ' disabled aria-disabled="true" title="Configure Substack credentials in Settings, then try again."'
    : '';
  const draftActionAttrs = substackConfigured
    ? ` hx-post="/api/articles/${escapeHtml(article.id)}/draft"
          hx-target="#publish-workflow"
          hx-swap="outerHTML"`
    : unavailableAttrs;
  const publishActionAttrs = substackConfigured
    ? ` hx-post="/api/articles/${escapeHtml(article.id)}/publish"
          hx-target="#publish-workflow"
          hx-swap="outerHTML"
          hx-confirm="Publish this article live to Substack now?"`
    : unavailableAttrs;
  const draftButtonHtml = hasDraft
    ? `<button class="btn btn-secondary"${draftActionAttrs}>
         Update Draft on Substack
       </button>`
    : `<button class="btn btn-primary"${draftActionAttrs}>
         Save Draft to Substack
       </button>`;
  const publishButtonHtml = hasDraft
    ? `<button class="btn btn-primary btn-publish"${publishActionAttrs}>
         Publish Now
       </button>`
    : '';

  return `
    <section id="publish-workflow" class="detail-section publish-workflow-section">
      <div class="publish-workflow-header">
        <div class="publish-workflow-kicker-row">
          <p class="section-kicker">Primary path</p>
          <span class="publish-status-badge ${hasDraft ? 'is-ready' : 'is-blocked'}">${hasDraft ? 'Draft linked' : 'Draft needed'}</span>
        </div>
        <h2>Publish Status</h2>
        ${alertHtml}
        ${configHintHtml}
        <p class="status-info publish-workflow-summary">${escapeHtml(draftCopy)}</p>
      </div>
      ${article.substack_draft_url
        ? `<p class="status-info publish-workflow-link">Current draft: <a href="${escapeHtml(article.substack_draft_url)}" target="_blank">Open in Substack ↗</a></p>`
        : ''}
      <div class="action-bar action-group publish-workflow-actions">
        ${publishButtonHtml}
        ${draftButtonHtml}
      </div>
      <p class="hint publish-workflow-hint">${hasDraft
        ? '“Publish Now” updates the linked Substack draft with the latest article body, then publishes it live.'
        : 'Publishing becomes available after this article has a linked Substack draft.'}</p>
    </section>`;
}

// ── Checklist renderer ───────────────────────────────────────────────────────

export function renderChecklist(pass: PublisherPass, articleId: string): string {
  const items = CHECKLIST_ITEMS.map(({ key, label }) => {
    const val = (pass as unknown as Record<string, unknown>)[key];
    const checked = key === 'publish_datetime' ? val != null : val === 1;
    return { key, label, checked };
  });

  const done = items.filter(i => i.checked).length;

  return `
    <section class="detail-section">
      <h2>Publisher Checklist (${done}/${items.length})</h2>
      <div id="publisher-checklist" class="checklist">
        ${items.map(i => `
          <div class="checklist-item ${i.checked ? 'checked' : ''}"
               hx-post="/htmx/articles/${escapeHtml(articleId)}/checklist/${escapeHtml(i.key)}"
               hx-target="#publisher-checklist"
               hx-swap="innerHTML">
            <span class="check-icon">${i.checked ? '✅' : '⬜'}</span>
            <span class="check-label">${escapeHtml(i.label)}</span>
          </div>
        `).join('')}
      </div>
    </section>`;
}

export function checkAllPassed(pass: PublisherPass): boolean {
  for (const { key } of CHECKLIST_ITEMS) {
    const val = (pass as unknown as Record<string, unknown>)[key];
    if (key === 'publish_datetime') {
      if (val == null) return false;
    } else {
      if (val !== 1) return false;
    }
  }
  return true;
}

// ── Note composer ─────────────────────────────────────────────────────────────

export function renderNoteComposer(article: Article): string {
  const defaultText = escapeHtml(article.subtitle ?? '');
  const articleId = escapeHtml(article.id);

  return `
    <section class="detail-section publish-support-section">
      <p class="section-kicker">Optional follow-up</p>
      <h2>📝 Substack Note</h2>
      <div id="note-composer">
        <textarea id="note-content" name="content" rows="4" class="form-textarea"
          placeholder="Write a Note to promote this article...">${defaultText}</textarea>
        <div class="composer-meta">
          <label class="composer-check">
            <input type="checkbox" id="note-attach" name="attachArticle" checked>
            Attach article card
          </label>
        </div>
      <div class="composer-actions">
        <button class="btn btn-secondary"
          hx-post="/api/articles/${articleId}/note"
          hx-target="#note-result"
            hx-swap="innerHTML"
            hx-include="#note-content, #note-attach">
            Post Note
          </button>
        </div>
        <div id="note-result"></div>
      </div>
    </section>`;
}

// ── Tweet composer ────────────────────────────────────────────────────────────

export function renderTweetComposer(article: Article): string {
  const defaultText = escapeHtml(article.title + ' 🏈');
  const articleId = escapeHtml(article.id);

  return `
    <section class="detail-section publish-support-section">
      <p class="section-kicker">Optional follow-up</p>
      <h2>🐦 Tweet</h2>
      <div id="tweet-composer">
        <textarea id="tweet-content" name="content" rows="3" class="form-textarea"
          placeholder="Compose a tweet...">${defaultText}</textarea>
        <div class="composer-meta">
          <span id="tweet-char-count" class="char-count">0/280</span>
          <label class="composer-check">
            <input type="checkbox" id="tweet-dry-run" name="dryRun">
            Dry run (don&#39;t actually post)
          </label>
        </div>
      <div class="composer-actions">
        <button class="btn btn-secondary"
          hx-post="/api/articles/${articleId}/tweet"
          hx-target="#tweet-result"
            hx-swap="innerHTML"
            hx-include="#tweet-content, #tweet-dry-run">
            Post Tweet
          </button>
        </div>
        <div id="tweet-result"></div>
      </div>
    </section>
    <script>
      document.getElementById('tweet-content').addEventListener('input', function() {
        var text = this.value;
        var urlCount = (text.match(/https?:\\/\\/\\S+/g) || []).length;
        var nonUrlLength = text.replace(/https?:\\/\\/\\S+/g, '').length;
        var effective = nonUrlLength + (urlCount * 23);
        var counter = document.getElementById('tweet-char-count');
        counter.textContent = effective + '/280';
        counter.className = 'char-count' + (effective > 280 ? ' over-limit' : effective > 250 ? ' near-limit' : '');
      });
    </script>`;
}

// ── Publish All section ──────────────────────────────────────────────────────

export function renderPublishAll(articleId: string, substackConfigured: boolean = true): string {
  const id = escapeHtml(articleId);
  const buttonAttrs = substackConfigured
    ? `onclick="publishAll('${id}')"`
    : 'disabled aria-disabled="true" title="Configure Substack credentials in Settings, then try again."';
  const unavailableHint = substackConfigured
    ? ''
    : '<p class="hint">Configure Substack on the <a href="/config">Settings</a> page before using Publish All.</p>';
  return `
    <section class="detail-section publish-support-section publish-all-section">
      <p class="section-kicker">Automation</p>
      <h2>🚀 Publish All</h2>
      <p class="hint">Publish the latest article live, then optionally post a Note and Tweet in sequence.</p>
      ${unavailableHint}
      <div class="publish-all-options">
        <label class="composer-check">
          <input type="checkbox" id="pa-note" checked> Post Substack Note
        </label>
        <label class="composer-check">
          <input type="checkbox" id="pa-tweet" checked> Post Tweet
        </label>
      </div>
      <button class="btn btn-publish btn-lg" id="publish-all-btn" ${buttonAttrs}>
        🚀 Publish All
      </button>
      <div id="publish-all-progress"></div>
    </section>
    <script>
      async function publishAll(articleId) {
        var btn = document.getElementById('publish-all-btn');
        var progress = document.getElementById('publish-all-progress');
        var includeNote = document.getElementById('pa-note') ? document.getElementById('pa-note').checked : false;
        var includeTweet = document.getElementById('pa-tweet') ? document.getElementById('pa-tweet').checked : false;

        btn.disabled = true;
        btn.textContent = '⏳ Publishing…';
        progress.innerHTML = '';

        function addStep(emoji, text, cls) {
          progress.innerHTML += '<div class="publish-step ' + (cls || '') + '">' + emoji + ' ' + text + '</div>';
        }

        try {
          addStep('⏳', 'Publishing to Substack…');
          var pubRes = await fetch('/api/articles/' + articleId + '/publish', { method: 'POST' });
          var pubData = await pubRes.json();
          if (!pubRes.ok) throw new Error(pubData.error || 'Publish failed');
          addStep('✅', 'Published to Substack', 'step-success');

          if (includeNote) {
            var noteContent = document.getElementById('note-content') ? document.getElementById('note-content').value : '';
            if (noteContent && noteContent.trim()) {
              addStep('⏳', 'Posting Note…');
              var noteAttach = document.getElementById('note-attach') ? document.getElementById('note-attach').checked : false;
              var noteRes = await fetch('/api/articles/' + articleId + '/note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: noteContent, attachArticle: noteAttach })
              });
              if (noteRes.ok) addStep('✅', 'Note posted', 'step-success');
              else addStep('⚠️', 'Note failed (non-critical)', 'step-warn');
            }
          }

          if (includeTweet) {
            var tweetContent = document.getElementById('tweet-content') ? document.getElementById('tweet-content').value : '';
            if (tweetContent && tweetContent.trim()) {
              addStep('⏳', 'Posting Tweet…');
              var dryRun = document.getElementById('tweet-dry-run') ? document.getElementById('tweet-dry-run').checked : false;
              var tweetRes = await fetch('/api/articles/' + articleId + '/tweet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: tweetContent, dryRun: dryRun })
              });
              if (tweetRes.ok) addStep('✅', 'Tweet posted', 'step-success');
              else addStep('⚠️', 'Tweet failed (non-critical)', 'step-warn');
            }
          }

          addStep('🎉', 'All done! Redirecting…', 'step-done');
          setTimeout(function() { window.location.href = '/articles/' + articleId; }, 2000);
        } catch (err) {
          addStep('❌', err.message, 'step-error');
          btn.disabled = false;
          btn.textContent = '🚀 Publish All';
        }
      }
    </script>`;
}

// ── Issue Tracker section ────────────────────────────────────────────────────

export function renderIssueTracker(issues: PublishIssue[], articleId: string): string {
  if (issues.length === 0) {
    return `
      <section class="detail-section publish-support-section">
        <p class="section-kicker">Pre-publish review</p>
        <h2>✅ No Issues Found</h2>
        <p class="hint">No advisories or validation issues were detected during article production.</p>
      </section>`;
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  const badges = [
    errors.length > 0 ? `<span class="badge badge-error">${errors.length} error${errors.length > 1 ? 's' : ''}</span>` : '',
    warnings.length > 0 ? `<span class="badge badge-warning">${warnings.length} advisory</span>` : '',
    infos.length > 0 ? `<span class="badge badge-info">${infos.length} info</span>` : '',
  ].filter(Boolean).join(' ');

  // Group issues by source
  const groups = new Map<string, PublishIssue[]>();
  for (const issue of issues) {
    const key = issue.source;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(issue);
  }

  const groupHtml = [...groups.entries()].map(([source, items]) => {
    const label = SOURCE_LABELS[source as PublishIssue['source']] ?? source;
    const open = items.some((i) => i.severity === 'error') ? ' open' : '';
    const itemsHtml = items.map((item) => {
      const icon = item.severity === 'error' ? '🔴' : item.severity === 'warning' ? '⚠️' : 'ℹ️';
      return `<div class="issue-item issue-${escapeHtml(item.severity)}">
        <span class="issue-icon">${icon}</span>
        <div class="issue-body">
          <span class="issue-category">${escapeHtml(item.category)}</span>
          <span class="issue-text">${escapeHtml(item.message)}</span>
        </div>
      </div>`;
    }).join('\n');

    return `<details class="issue-group"${open}>
      <summary>${escapeHtml(label)} (${items.length})</summary>
      ${itemsHtml}
    </details>`;
  }).join('\n');

  return `
    <section class="detail-section publish-support-section publish-issues-section">
      <p class="section-kicker">Pre-publish review</p>
      <h2>⚠️ Issues & Advisories</h2>
      <div class="issue-summary-badges">${badges}</div>
      ${groupHtml}
    </section>`;
}

const SOURCE_LABELS: Record<string, string> = {
  'writer-preflight': 'Claim Verification',
  'roster-validation': 'Roster Check',
  'fact-validation': 'Fact Check',
  'pipeline-history': 'Pipeline History',
  'editor-review': 'Editor Review',
};

// ── AI Review Panel ─────────────────────────────────────────────────────────

export function renderAiReviewPanel(articleId: string): string {
  return `
    <section class="detail-section publish-support-section ai-review-section">
      <p class="section-kicker">AI-assisted review</p>
      <h2>🤖 AI Pre-Publish Review</h2>
      <div id="ai-review-content">
        <p class="hint">Generate an AI-powered review that analyzes the article against its source artifacts and surfaces concerns for human review.</p>
        <button class="btn btn-secondary"
          hx-get="/htmx/articles/${escapeHtml(articleId)}/ai-review"
          hx-target="#ai-review-content"
          hx-swap="innerHTML"
          hx-indicator="#ai-review-spinner">
          🤖 Generate AI Review
        </button>
        <span id="ai-review-spinner" class="htmx-indicator">Analyzing…</span>
      </div>
    </section>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractDraftId(draftUrl: string): string | null {
  const match = draftUrl.match(/\/post\/(\d+)/);
  return match ? match[1] : null;
}

export { extractDraftId };
