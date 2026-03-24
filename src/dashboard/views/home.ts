/**
 * home.ts — Home page view for the editorial workstation.
 *
 * Renders dashboard flows plus supporting sections:
 *   1. Primary flows — create idea, continue article, ready to publish
 *   2. Ready to Publish (Stage 7)
 *   3. Pipeline summary — collapsible by stage
 *   4. Continue Articles (Stages 1–6)
 *   5. Recently Published (Stage 8, last 30 days)
 *   6. Search & Filter — secondary browse path
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import { STAGE_NAMES, VALID_STAGES } from '../../types.js';
import type { Article, Stage } from '../../types.js';
import type { AppConfig } from '../../config/index.js';

export interface HomeData {
  config: AppConfig;
  readyArticles: Article[];
  continueArticles: Article[];
  published: Article[];
  pipelineSummary: Record<number, { name: string; count: number }>;
  teams?: string[];
}

export type PipelineSummary = Record<number, { name: string; count: number }>;

// ── Full page ────────────────────────────────────────────────────────────────

export function renderHome(data: HomeData): string {
  const { config, readyArticles, continueArticles, published, pipelineSummary, teams = [] } = data;

  const content = `
    <div class="dashboard-grid">
      <section class="section section-primary" id="primary-flows">
        <h2>⭐ Start Here</h2>
        <p class="section-intro">Use the main dashboard path for the everyday workflow: create an idea, continue an in-flight article, or finish a publish-ready draft.</p>
        ${renderPrimaryFlows(continueArticles, readyArticles)}
      </section>

      <section class="section section-ready" id="ready-to-publish">
        <h2>🚀 Ready to Publish</h2>
        <p class="section-intro">Articles at Stage 7 that are waiting for final publish review.</p>
        <div hx-get="/htmx/ready-to-publish" hx-trigger="refreshPublish from:body, sse:article_published" hx-swap="innerHTML">
          ${renderReadyToPublish(readyArticles)}
        </div>
      </section>

      <section class="section section-pipeline" id="pipeline">
        <h2>📊 Pipeline</h2>
        <p class="section-intro">See where work is stacked across stages. Open a stage to inspect specific articles.</p>
        <div hx-get="/htmx/pipeline-summary" hx-trigger="refreshPipeline from:body, sse:stage_changed" hx-swap="innerHTML">
          ${renderPipelineSummary(pipelineSummary)}
        </div>
      </section>

      <section class="section section-ideas" id="continue-articles">
        <h2>📝 Continue Articles</h2>
        <p class="section-intro">Jump back into the latest Stage 1–6 work without digging through the full pipeline.</p>
        ${renderIdeaForm()}
        <div id="ideas-list" hx-get="/htmx/continue-articles" hx-trigger="refreshIdeas from:body, refreshPipeline from:body, sse:article_created, sse:stage_changed" hx-swap="innerHTML">
          ${renderContinueArticles(continueArticles)}
        </div>
      </section>

      <section class="section section-published" id="published">
        <h2>✅ Recently Published</h2>
        <div hx-get="/htmx/published" hx-trigger="refreshPublished from:body, sse:article_published" hx-swap="innerHTML">
          ${renderPublished(published)}
        </div>
      </section>

      <section class="section section-filters" id="pipeline-filters">
        <h2>🔍 Search &amp; Filter</h2>
        <p class="section-intro">Need the long-tail browse path? Search the full dashboard by article, stage, team, or depth.</p>
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
          <a href="/articles/${escapeHtml(a.id)}/publish" class="btn btn-primary">Review &amp; Publish</a>
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
  return renderContinueArticles(articles);
}

export function renderContinueArticles(articles: Article[]): string {
  if (articles.length === 0) {
    return '<p class="empty-state">No active articles yet — create one above to start the pipeline.</p>';
  }
  return `<div class="article-list">
    ${articles.map(a => {
      const stage = a.current_stage as Stage;
      const stageName = STAGE_NAMES[stage] ?? `Stage ${stage}`;
      return `
      <div class="article-card card-idea">
        <div class="card-header">
          <a href="/articles/${escapeHtml(a.id)}" class="article-title">${escapeHtml(a.title)}</a>
          ${a.primary_team ? `<span class="badge badge-team">${escapeHtml(a.primary_team)}</span>` : ''}
        </div>
        <div class="card-meta">
          <span class="badge badge-stage badge-stage-${stage}">Stage ${stage} · ${escapeHtml(stageName)}</span>
          <span class="meta-date">Updated ${formatDate(a.updated_at)}</span>
        </div>
        <div class="card-actions">
          <a href="/articles/${escapeHtml(a.id)}" class="btn btn-secondary">Continue Article</a>
        </div>
      </div>
    `;
    }).join('')}
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
      <a href="/ideas/new" class="btn btn-primary btn-lg">✨ Create Idea</a>
      <span class="idea-hint">Start with one prompt. Teams, depth, and expert pins live on the next page if you need them.</span>
    </div>`;
}

function renderPrimaryFlows(continueArticles: Article[], readyArticles: Article[]): string {
  const latestActiveArticle = continueArticles[0];
  const readyArticle = readyArticles[0];

  return `
    <div class="primary-flow-grid">
      <article class="primary-flow-card">
        <span class="primary-flow-eyebrow">Stage 1</span>
        <h3>Create idea</h3>
        <p>Start a new article from a single prompt, then add optional guidance only if the story needs it.</p>
        <div class="card-actions">
          <a href="/ideas/new" class="btn btn-primary">Create Idea</a>
        </div>
      </article>
      <article class="primary-flow-card">
        <span class="primary-flow-eyebrow">Continue</span>
        <h3>Continue article</h3>
        <p>${latestActiveArticle
          ? `Pick up ${escapeHtml(latestActiveArticle.title)} from Stage ${latestActiveArticle.current_stage}.`
          : 'No active article yet. Start a fresh idea and it will show up here.'}</p>
        <div class="card-actions">
          <a href="${latestActiveArticle ? `/articles/${escapeHtml(latestActiveArticle.id)}` : '/ideas/new'}" class="btn btn-secondary">
            ${latestActiveArticle ? 'Continue Article' : 'Create First Idea'}
          </a>
        </div>
      </article>
      <article class="primary-flow-card">
        <span class="primary-flow-eyebrow">Stage 7</span>
        <h3>Ready to publish</h3>
        <p>${readyArticle
          ? `${readyArticles.length} article${readyArticles.length === 1 ? '' : 's'} waiting for final publish review.`
          : 'Nothing is waiting for publish review right now.'}</p>
        <div class="card-actions">
          <a href="${readyArticle ? `/articles/${escapeHtml(readyArticle.id)}/publish` : '#ready-to-publish'}" class="btn btn-secondary">
            ${readyArticle ? 'Review &amp; Publish' : 'Check Ready Queue'}
          </a>
        </div>
      </article>
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
