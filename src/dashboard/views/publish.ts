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
}

export function renderPublishPreview(data: PublishPreviewData): string {
  const {
    config,
    article,
    htmlBody,
    coverImageUrl,
    inlineImageUrls,
    substackConfigured = true,
  } = data;

  const content = `
    <div class="article-detail publish-page">
      <div class="detail-header">
        <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Article Detail</a>
        <h1>Review &amp; Publish: ${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        <div class="detail-meta">
          ${article.primary_team ? `<span class="badge badge-team">${escapeHtml(article.primary_team)}</span>` : ''}
          <span class="badge badge-stage badge-stage-${article.current_stage}">
            Stage ${article.current_stage}
          </span>
        </div>
        <p class="hint">Save or update a Substack draft, review it in context, then publish that linked draft live when ready.</p>
      </div>

      <div class="detail-grid publish-layout">
        <div class="detail-main">
          <section class="detail-section">
            <div class="action-bar" style="justify-content:space-between; margin-bottom:0.75rem;">
              <h2 style="margin:0;">Published Layout Preview</h2>
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

        <div class="detail-sidebar">
          <section class="detail-section publish-flow-summary">
            <h2>Next Steps</h2>
            <ol class="flow-list">
              <li>Save or update the linked Substack draft.</li>
              <li>Review the draft preview or open the live Substack editor.</li>
              <li>Publish the linked draft live when everything looks right.</li>
            </ol>
          </section>
          ${renderPublishWorkflow({ article, substackConfigured })}
          ${renderPromotionTools(article, substackConfigured)}
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
    ? `<p class="hint">Set <code>SUBSTACK_PUBLICATION_URL</code> and <code>SUBSTACK_TOKEN</code> in <code>.env</code>, restart the dashboard, then try again. You can confirm the current environment on the <a href="/config">Config</a> page.</p>`
    : '';

  if (article.current_stage === 8 || publishedUrl) {
    return `
      <section id="publish-workflow" class="detail-section">
        <h2>Publish Status</h2>
        ${alertHtml}
        <p class="status-info">This article is now live on Substack.</p>
        <div class="action-bar">
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
    ? ' disabled aria-disabled="true" title="Set SUBSTACK_PUBLICATION_URL and SUBSTACK_TOKEN, restart the dashboard, then try again."'
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

  return `
    <section id="publish-workflow" class="detail-section">
      <h2>Publish Status</h2>
      ${alertHtml}
      ${configHintHtml}
      <p class="status-info">${escapeHtml(draftCopy)}</p>
      ${article.substack_draft_url
        ? `<p class="status-info">Current draft: <a href="${escapeHtml(article.substack_draft_url)}" target="_blank">Open in Substack ↗</a></p>`
        : ''}
      <div class="action-bar" style="flex-direction:column;align-items:stretch;">
        <button class="btn btn-secondary"${draftActionAttrs}>
          ${hasDraft ? 'Update Draft on Substack' : 'Save Draft to Substack'}
        </button>
        ${hasDraft
          ? `<button class="btn btn-primary btn-publish"${publishActionAttrs}>
               Publish Now
             </button>`
          : ''}
      </div>
      <p class="hint">${hasDraft
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

export function renderPromotionTools(article: Article, substackConfigured: boolean = true): string {
  return `
    <section class="detail-section">
      <h2>Optional Promotion</h2>
      <p class="hint">These tools are optional follow-ons after the required publish path above. Use them for distribution, not to clear the article for publish.</p>
    </section>
    ${renderNoteComposer(article)}
    ${renderTweetComposer(article)}
    ${renderPublishAll(article.id, substackConfigured)}`;
}

// ── Note composer ─────────────────────────────────────────────────────────────

export function renderNoteComposer(article: Article): string {
  const defaultText = escapeHtml(article.subtitle ?? '');
  const articleId = escapeHtml(article.id);

  return `
    <section class="detail-section">
      <h2>📝 Optional Substack Note</h2>
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
    <section class="detail-section">
      <h2>🐦 Optional Tweet</h2>
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
    : 'disabled aria-disabled="true" title="Set SUBSTACK_PUBLICATION_URL and SUBSTACK_TOKEN, restart the dashboard, then try again."';
  const unavailableHint = substackConfigured
    ? ''
    : '<p class="hint">Configure Substack on the <a href="/config">Config</a> page before using Publish All.</p>';
  return `
    <section class="detail-section">
      <h2>🚀 Publish + Optional Promotion</h2>
      <p class="hint">Convenience bundle: run the required publish step, then optionally post a Note and Tweet in sequence.</p>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractDraftId(draftUrl: string): string | null {
  const match = draftUrl.match(/\/post\/(\d+)/);
  return match ? match[1] : null;
}

export { extractDraftId };
