/**
 * home.ts — Home page view for the editorial workstation.
 *
 * Renders four sections:
 *   1. Ready to Publish (Stage 7) — primary action area
 *   2. Pipeline summary — collapsible by stage
 *   3. Recent Ideas (Stage 1) — with idea submission form
 *   4. Recently Published (Stage 8, last 30 days)
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import { STAGE_NAMES, VALID_STAGES } from '../../types.js';
import type { Article, Stage } from '../../types.js';
import type { AppConfig } from '../../config/index.js';

export interface HomeData {
  config: AppConfig;
  readyArticles: Article[];
  recentIdeas: Article[];
  published: Article[];
  pipelineSummary: Record<number, { name: string; count: number }>;
  teams?: string[];
}

export type PipelineSummary = Record<number, { name: string; count: number }>;

// ── Full page ────────────────────────────────────────────────────────────────

export function renderHome(data: HomeData): string {
  const { config, readyArticles, recentIdeas, published, pipelineSummary, teams = [] } = data;

  const content = `
    <div class="dashboard-grid">
      <section class="section section-filters" id="pipeline-filters">
        <h2>🔍 Search &amp; Filter</h2>
        <div class="filter-bar">
          <input type="search" name="search" placeholder="Search articles…" class="filter-input"
            hx-get="/htmx/filtered-articles" hx-trigger="input changed delay:300ms, search"
            hx-target="#filtered-results" hx-swap="innerHTML"
            hx-include=".filter-bar" />
          <select name="stage" class="filter-select"
            hx-get="/htmx/filtered-articles" hx-trigger="change"
            hx-target="#filtered-results" hx-swap="innerHTML"
            hx-include=".filter-bar">
            <option value="">All Stages</option>
            ${VALID_STAGES.map(s => `<option value="${s}">Stage ${s} · ${STAGE_NAMES[s]}</option>`).join('')}
          </select>
          <select name="team" class="filter-select"
            hx-get="/htmx/filtered-articles" hx-trigger="change"
            hx-target="#filtered-results" hx-swap="innerHTML"
            hx-include=".filter-bar">
            <option value="">All Teams</option>
            ${teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
          </select>
          <select name="depth" class="filter-select"
            hx-get="/htmx/filtered-articles" hx-trigger="change"
            hx-target="#filtered-results" hx-swap="innerHTML"
            hx-include=".filter-bar">
            <option value="">All Depths</option>
            <option value="1">1 — Casual Fan</option>
            <option value="2">2 — The Beat</option>
            <option value="3">3 — Deep Dive</option>
          </select>
          <label class="filter-checkbox" style="display:flex;align-items:center;gap:0.25rem;font-size:0.85rem;cursor:pointer;">
            <input type="checkbox" name="include_archived" value="1"
              hx-get="/htmx/filtered-articles" hx-trigger="change"
              hx-target="#filtered-results" hx-swap="innerHTML"
              hx-include=".filter-bar" />
            Include archived
          </label>
        </div>
        <div id="filtered-results"></div>
      </section>

      <section class="section section-ready" id="ready-to-publish">
        <h2>🚀 Ready to Publish</h2>
        <div hx-get="/htmx/ready-to-publish" hx-trigger="refreshPublish from:body, sse:article_published" hx-swap="innerHTML">
          ${renderReadyToPublish(readyArticles)}
        </div>
      </section>

      <section class="section section-pipeline" id="pipeline">
        <h2>📊 Pipeline</h2>
        <div hx-get="/htmx/pipeline-summary" hx-trigger="refreshPipeline from:body, sse:stage_changed" hx-swap="innerHTML">
          ${renderPipelineSummary(pipelineSummary)}
        </div>
      </section>

      <section class="section section-ideas" id="recent-ideas">
        <h2>💡 Recent Ideas</h2>
        ${renderIdeaForm()}
        <div id="ideas-list" hx-get="/htmx/recent-ideas" hx-trigger="refreshIdeas from:body, sse:article_created" hx-swap="innerHTML">
          ${renderRecentIdeas(recentIdeas)}
        </div>
      </section>

      <section class="section section-published" id="published">
        <h2>✅ Recently Published</h2>
        <div hx-get="/htmx/published" hx-trigger="refreshPublished from:body, sse:article_published" hx-swap="innerHTML">
          ${renderPublished(published)}
        </div>
      </section>
    </div>`;

  return renderLayout('Dashboard', content, config.leagueConfig.name);
}

// ── Partials (HTML fragments) ────────────────────────────────────────────────

export function renderReadyToPublish(articles: Article[]): string {
  if (articles.length === 0) {
    return '<p class="empty-state">No articles ready to publish</p>';
  }
  return `<div class="article-list">
    ${articles.map(a => `
      <div class="article-card card-ready">
        <div class="card-header">
          <a href="/articles/${escapeHtml(a.id)}" class="article-title">${escapeHtml(a.title)}</a>
          ${a.primary_team ? `<span class="badge badge-team">${escapeHtml(a.primary_team)}</span>` : ''}
        </div>
        <div class="card-meta">
          <span class="badge badge-stage badge-stage-7">Stage 7 · Publisher Pass</span>
          <span class="meta-date">Updated ${formatDate(a.updated_at)}</span>
        </div>
        <div class="card-actions">
          ${a.substack_draft_url
            ? `<a href="${escapeHtml(a.substack_draft_url)}" target="_blank" class="btn btn-secondary">Preview ↗</a>`
            : ''}
          <a href="/articles/${escapeHtml(a.id)}" class="btn btn-primary">Review &amp; Publish</a>
        </div>
      </div>
    `).join('')}
  </div>`;
}

export function renderPipelineSummary(summary: PipelineSummary): string {
  const total = Object.values(summary).reduce((sum, s) => sum + s.count, 0);
  return `
    <div class="pipeline-overview">
      <div class="pipeline-total">
        <span class="total-count">${total}</span>
        <span class="total-label">articles in pipeline</span>
      </div>
      <div class="pipeline-stages">
        ${VALID_STAGES.map(stage => {
          const s = summary[stage];
          if (!s) return '';
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return `
            <div class="pipeline-stage" hx-get="/htmx/stage/${stage}" hx-target="#stage-detail" hx-swap="innerHTML">
              <div class="stage-bar">
                <div class="stage-bar-fill stage-color-${stage}" style="width: ${pct}%"></div>
              </div>
              <div class="stage-info">
                <span class="stage-name">${escapeHtml(s.name)}</span>
                <span class="stage-count">${s.count}</span>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div id="stage-detail"></div>
    </div>`;
}

export function renderRecentIdeas(articles: Article[]): string {
  if (articles.length === 0) {
    return '<p class="empty-state">No ideas yet — submit one above</p>';
  }
  return `<div class="article-list">
    ${articles.map(a => `
      <div class="article-card card-idea">
        <div class="card-header">
          <a href="/articles/${escapeHtml(a.id)}" class="article-title">${escapeHtml(a.title)}</a>
          ${a.primary_team ? `<span class="badge badge-team">${escapeHtml(a.primary_team)}</span>` : ''}
        </div>
        <div class="card-meta">
          <span class="badge badge-stage badge-stage-1">Stage 1 · Idea</span>
          <span class="meta-date">Created ${formatDate(a.created_at)}</span>
        </div>
        <div class="card-actions">
          <a href="/articles/${escapeHtml(a.id)}" class="btn btn-secondary">Draft Prompt ▶</a>
        </div>
      </div>
    `).join('')}
  </div>`;
}

export function renderPublished(articles: Article[]): string {
  if (articles.length === 0) {
    return '<p class="empty-state">No recently published articles</p>';
  }
  return `<div class="article-list">
    ${articles.map(a => `
      <div class="article-card card-published">
        <div class="card-header">
          <a href="/articles/${escapeHtml(a.id)}" class="article-title">${escapeHtml(a.title)}</a>
          ${a.primary_team ? `<span class="badge badge-team">${escapeHtml(a.primary_team)}</span>` : ''}
        </div>
        <div class="card-meta">
          <span class="badge badge-stage badge-stage-8">Published</span>
          <span class="meta-date">Published ${formatDate(a.published_at)}</span>
        </div>
        <div class="card-actions">
          ${a.substack_url
            ? `<a href="${escapeHtml(a.substack_url)}" target="_blank" class="btn btn-secondary">View on Substack ↗</a>`
            : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

export function renderStageArticles(articles: Article[], stage: Stage): string {
  const stageName = STAGE_NAMES[stage] ?? `Stage ${stage}`;
  if (articles.length === 0) {
    return `<p class="empty-state">No articles in ${escapeHtml(stageName)}</p>`;
  }
  return `
    <h3>${escapeHtml(stageName)} (${articles.length})</h3>
    <div class="article-list article-list-compact">
      ${articles.map(a => `
        <div class="article-card card-compact">
          <a href="/articles/${escapeHtml(a.id)}" class="article-title">${escapeHtml(a.title)}</a>
          ${a.primary_team ? `<span class="badge badge-team">${escapeHtml(a.primary_team)}</span>` : ''}
          <span class="meta-date">${formatDate(a.updated_at)}</span>
        </div>
      `).join('')}
    </div>`;
}

// ── Idea submission form ─────────────────────────────────────────────────────

function renderIdeaForm(): string {
  return `
    <div class="idea-quick-actions">
      <a href="/ideas/new" class="btn btn-primary btn-lg">✨ New Article Idea</a>
      <span class="idea-hint">Submit a prompt and let the pipeline do the rest</span>
    </div>`;
}

// ── Filtered articles partial ──────────────────────────────────────────────

export function renderFilteredArticles(articles: Article[]): string {
  if (articles.length === 0) {
    return '<p class="empty-state">No articles match your filters</p>';
  }
  return `<div class="filtered-list">
    ${articles.map(a => {
      const stage = a.current_stage as Stage;
      const stageName = STAGE_NAMES[stage] ?? `Stage ${stage}`;
      return `
      <a href="/articles/${escapeHtml(a.id)}" class="filtered-item">
        <span class="badge badge-stage badge-stage-${stage}">S${stage}</span>
        <span class="article-title">${escapeHtml(a.title)}</span>
        ${a.primary_team ? `<span class="badge badge-team">${escapeHtml(a.primary_team)}</span>` : ''}
        <span class="meta-date">${formatDate(a.updated_at)}</span>
      </a>`;
    }).join('')}
  </div>`;
}
