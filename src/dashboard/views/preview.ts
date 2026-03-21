/**
 * preview.ts — Rich article preview for Substack-like rendering.
 *
 * Shows the article as it would appear on Substack, with cover image,
 * inline images, subscribe CTA, and mobile/desktop viewport toggle.
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import type { Article } from '../../types.js';
import type { AppConfig } from '../../config/index.js';

export interface ImageManifestEntry {
  type: string;
  path: string;
  prompt: string;
}

export interface ArticlePreviewData {
  config: AppConfig;
  article: Article;
  htmlBody: string;
  coverImageUrl: string | null;
  inlineImageUrls: string[];
}

function resolveImageUrl(entry: ImageManifestEntry): string {
  const parts = entry.path.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] ?? '';
  const slug = parts[parts.length - 2] ?? '';
  return slug && filename
    ? `/images/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`
    : '';
}

export function parseImageManifest(json: string): { cover: string | null; inlines: string[] } {
  try {
    const manifest: ImageManifestEntry[] = JSON.parse(json);
    let cover: string | null = null;
    const inlines: string[] = [];
    for (const entry of manifest) {
      const url = resolveImageUrl(entry);
      if (!url) continue;
      if (entry.type === 'cover' && !cover) {
        cover = url;
      } else {
        inlines.push(url);
      }
    }
    return { cover, inlines };
  } catch {
    return { cover: null, inlines: [] };
  }
}

/**
 * Insert inline images between block-level elements in the rendered HTML.
 * Distributes images evenly throughout the article body so they appear
 * interspersed rather than dumped at the end.
 */
function intersperse(htmlBody: string, inlineUrls: string[]): string {
  if (inlineUrls.length === 0) return htmlBody;

  // Split on block-level closing tags to find insertion points
  const blocks = htmlBody.split(/(?<=<\/(?:p|h[1-6]|blockquote|ul|ol|figure|pre)>)/);
  if (blocks.length < 3) {
    // Too few blocks — just append images at the end
    const imgs = inlineUrls.map((url, i) =>
      `<figure class="preview-inline-figure"><img src="${escapeHtml(url)}" alt="Inline image ${i + 1}" class="preview-inline-img" loading="lazy" /></figure>`
    ).join('\n');
    return htmlBody + '\n' + imgs;
  }

  // Place images roughly evenly: skip early paragraphs, distribute through the middle
  const startIdx = Math.max(3, Math.floor(blocks.length * 0.2));
  const endIdx = Math.floor(blocks.length * 0.85);
  const range = Math.max(endIdx - startIdx, 1);

  const result = [...blocks];
  for (let i = 0; i < inlineUrls.length; i++) {
    const pos = startIdx + Math.floor((i + 0.5) * range / inlineUrls.length);
    const insertAt = Math.min(pos, result.length - 1);
    const img = `<figure class="preview-inline-figure"><img src="${escapeHtml(inlineUrls[i])}" alt="Inline image ${i + 1}" class="preview-inline-img" loading="lazy" /></figure>`;
    result[insertAt] = result[insertAt] + '\n' + img;
  }

  return result.join('');
}

export function renderArticlePreview(data: ArticlePreviewData): string {
  const { config, article, htmlBody, coverImageUrl, inlineImageUrls } = data;

  const authorDate = formatDate(article.created_at);
  const bodyWithImages = intersperse(htmlBody, inlineImageUrls);

  // Publication blurb shown below the subscribe CTA (matches Substack footer)
  const pubName = config.leagueConfig.name;
  const blurb = `
    <div class="preview-blurb">
      <p><em>The ${escapeHtml(pubName)} is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement <strong>is</strong> the analysis. Welcome to the Lab.</em></p>
      <p><em>Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.</em></p>
    </div>`;

  const content = `
    <div class="preview-toolbar">
      <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Back to Article</a>
      <span class="preview-toolbar-title">${escapeHtml(article.title)}</span>
      <div class="preview-toolbar-actions">
        <button id="viewport-toggle" class="btn btn-secondary btn-sm" onclick="toggleViewport()">
          📱 Mobile
        </button>
      </div>
    </div>

    <div id="preview-frame" class="preview-container">
      ${coverImageUrl
        ? `<img src="${escapeHtml(coverImageUrl)}" alt="Cover image" class="preview-cover-image" />`
        : ''}

      <h1 class="preview-title">${escapeHtml(article.title)}</h1>
      ${article.subtitle
        ? `<p class="preview-subtitle">${escapeHtml(article.subtitle)}</p>`
        : ''}

      <div class="preview-author-line">
        <span class="preview-author">${escapeHtml(pubName)}</span>
        <span class="preview-date">${escapeHtml(authorDate)}</span>
      </div>

      <hr class="preview-divider">

      <div class="preview-body">
        ${bodyWithImages}
      </div>

      <div class="subscribe-cta">
        <p class="subscribe-cta-text">Thanks for reading ${escapeHtml(pubName)}! Subscribe for free to receive new posts and support our work.</p>
        <button class="subscribe-cta-button">Subscribe</button>
      </div>

      <hr class="preview-divider">

      ${blurb}
    </div>

    <script>
      (function() {
        var frame = document.getElementById('preview-frame');
        var btn = document.getElementById('viewport-toggle');
        var isMobile = false;
        window.toggleViewport = function() {
          isMobile = !isMobile;
          if (isMobile) {
            frame.classList.add('preview-mobile');
            btn.textContent = '🖥 Desktop';
          } else {
            frame.classList.remove('preview-mobile');
            btn.textContent = '📱 Mobile';
          }
        };
      })();
    </script>`;

  return renderLayout(`Preview — ${article.title}`, content, config.leagueConfig.name);
}
