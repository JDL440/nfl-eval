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

export function renderArticlePreview(data: ArticlePreviewData): string {
  const { config, article, htmlBody, coverImageUrl, inlineImageUrls } = data;

  const authorDate = formatDate(article.created_at);

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
        <span class="preview-author">${escapeHtml(config.leagueConfig.name)}</span>
        <span class="preview-date">${escapeHtml(authorDate)}</span>
      </div>

      <hr class="preview-divider">

      <div class="preview-body">
        ${htmlBody}
      </div>

      ${inlineImageUrls.length > 0
        ? `<div class="preview-inline-images">
            ${inlineImageUrls.map((url, i) =>
              `<figure><img src="${escapeHtml(url)}" alt="Inline image ${i + 1}" class="preview-inline-img" loading="lazy" /></figure>`
            ).join('\n')}
          </div>`
        : ''}

      <div class="subscribe-cta">
        <p class="subscribe-cta-text">Thanks for reading! Subscribe to get new posts delivered to your inbox.</p>
        <button class="subscribe-cta-button">Subscribe</button>
      </div>
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
