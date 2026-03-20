/**
 * publish.ts — Publish preview and result views for the editorial workstation.
 *
 * Renders:
 *   - Publish preview: article content, publisher checklist, draft/publish buttons
 *   - Publish result: success/failure after draft creation or publishing
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import type { Article, PublisherPass } from '../../types.js';
import type { ProseMirrorNode, ProseMirrorDoc } from '../../services/prosemirror.js';
import type { AppConfig } from '../../config/index.js';

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
      return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}</figure>`;
    }
    case 'image2': {
      const src = String(node.attrs?.src ?? '');
      const alt = String(node.attrs?.alt ?? '');
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
    }
    case 'caption':
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
  htmlPreview: string;
  publisherPass: PublisherPass | null;
}

export function renderPublishPreview(data: PublishPreviewData): string {
  const { config, article, htmlPreview, publisherPass } = data;

  const hasDraft = !!article.substack_draft_url;
  const draftId = hasDraft ? extractDraftId(article.substack_draft_url!) : null;

  const checklist = publisherPass ? renderChecklist(publisherPass, article.id) : '';
  const allPassed = publisherPass ? checkAllPassed(publisherPass) : false;

  const content = `
    <div class="article-detail">
      <div class="detail-header">
        <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Article Detail</a>
        <h1>Publish: ${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        <div class="detail-meta">
          ${article.primary_team ? `<span class="badge badge-team">${escapeHtml(article.primary_team)}</span>` : ''}
          <span class="badge badge-stage badge-stage-${article.current_stage}">
            Stage ${article.current_stage}
          </span>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          <section class="detail-section">
            <h2>Article Preview</h2>
            <div class="article-preview" id="article-preview"
                 hx-get="/htmx/articles/${escapeHtml(article.id)}/preview"
                 hx-trigger="load"
                 hx-swap="innerHTML">
              ${htmlPreview}
            </div>
          </section>
        </div>

        <div class="detail-sidebar">
          ${checklist}

          <section class="detail-section">
            <h2>Publish Actions</h2>
            <div id="publish-actions" class="action-bar" style="flex-direction:column;gap:0.5rem;">
              ${hasDraft
                ? `<p class="status-info">Draft created: <a href="${escapeHtml(article.substack_draft_url!)}" target="_blank">View on Substack ↗</a></p>
                   <button class="btn btn-primary btn-publish"
                     hx-post="/api/articles/${escapeHtml(article.id)}/publish"
                     hx-target="#publish-result"
                     hx-swap="innerHTML"
                     ${allPassed ? '' : 'disabled title="Complete all publisher checks first"'}>
                     Publish to Substack
                   </button>`
                : `<button class="btn btn-secondary"
                     hx-post="/api/articles/${escapeHtml(article.id)}/draft"
                     hx-target="#publish-actions"
                     hx-swap="innerHTML">
                     Create Draft
                   </button>`}
            </div>
            <div id="publish-result"></div>
          </section>

          ${renderNoteComposer(article)}
          ${renderTweetComposer(article)}

          ${renderPublishAll(article.id, hasDraft && allPassed)}
        </div>
      </div>
    </div>`;

  return renderLayout(`Publish — ${article.title}`, content, config.leagueConfig.name);
}

// ── Publish result (htmx partial) ────────────────────────────────────────────

export interface PublishResultData {
  article: Article;
  success: boolean;
  draftUrl?: string;
  publishedUrl?: string;
  error?: string;
}

export function renderPublishResult(data: PublishResultData): string {
  const { article, success, draftUrl, publishedUrl, error } = data;

  if (!success) {
    return `
      <div class="alert alert-error">
        <strong>Error:</strong> ${escapeHtml(error ?? 'Unknown error')}
      </div>`;
  }

  if (publishedUrl) {
    return `
      <div class="alert alert-success">
        <strong>Published!</strong> Article is live on Substack.
        <a href="${escapeHtml(publishedUrl)}" target="_blank">View article ↗</a>
      </div>`;
  }

  if (draftUrl) {
    return `
      <p class="status-info">Draft created: <a href="${escapeHtml(draftUrl)}" target="_blank">View on Substack ↗</a></p>
      <button class="btn btn-primary btn-publish"
        hx-post="/api/articles/${escapeHtml(article.id)}/publish"
        hx-target="#publish-result"
        hx-swap="innerHTML">
        Publish to Substack
      </button>`;
  }

  return `<div class="alert alert-success"><strong>Success</strong></div>`;
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
    <section class="detail-section">
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
    <section class="detail-section">
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

export function renderPublishAll(articleId: string, publishEnabled: boolean): string {
  const id = escapeHtml(articleId);
  return `
    <section class="detail-section">
      <h2>🚀 Publish All</h2>
      <p class="hint">Publish to Substack, then optionally post a Note and Tweet in sequence.</p>
      <div class="publish-all-options">
        <label class="composer-check">
          <input type="checkbox" id="pa-note" checked> Post Substack Note
        </label>
        <label class="composer-check">
          <input type="checkbox" id="pa-tweet" checked> Post Tweet
        </label>
      </div>
      <button class="btn btn-publish btn-lg" id="publish-all-btn"
        onclick="publishAll('${id}')"
        ${publishEnabled ? '' : 'disabled title="Complete all publisher checks and create a draft first"'}>
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
