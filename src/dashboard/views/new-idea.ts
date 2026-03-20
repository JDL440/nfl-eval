/**
 * new-idea.ts — Standalone idea submission form and success partial.
 */

import { renderLayout, escapeHtml } from './layout.js';
import type { AppConfig } from '../../config/index.js';

// ── NFL teams (legacy string list for existing callers) ──────────────────────

const NFL_TEAMS_LEGACY = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
];

// ── NFL teams with abbreviations ─────────────────────────────────────────────

export const NFL_TEAMS = [
  { abbr: 'ARI', name: 'Cardinals', city: 'Arizona' },
  { abbr: 'ATL', name: 'Falcons', city: 'Atlanta' },
  { abbr: 'BAL', name: 'Ravens', city: 'Baltimore' },
  { abbr: 'BUF', name: 'Bills', city: 'Buffalo' },
  { abbr: 'CAR', name: 'Panthers', city: 'Carolina' },
  { abbr: 'CHI', name: 'Bears', city: 'Chicago' },
  { abbr: 'CIN', name: 'Bengals', city: 'Cincinnati' },
  { abbr: 'CLE', name: 'Browns', city: 'Cleveland' },
  { abbr: 'DAL', name: 'Cowboys', city: 'Dallas' },
  { abbr: 'DEN', name: 'Broncos', city: 'Denver' },
  { abbr: 'DET', name: 'Lions', city: 'Detroit' },
  { abbr: 'GB', name: 'Packers', city: 'Green Bay' },
  { abbr: 'HOU', name: 'Texans', city: 'Houston' },
  { abbr: 'IND', name: 'Colts', city: 'Indianapolis' },
  { abbr: 'JAX', name: 'Jaguars', city: 'Jacksonville' },
  { abbr: 'KC', name: 'Chiefs', city: 'Kansas City' },
  { abbr: 'LAC', name: 'Chargers', city: 'Los Angeles' },
  { abbr: 'LAR', name: 'Rams', city: 'Los Angeles' },
  { abbr: 'LV', name: 'Raiders', city: 'Las Vegas' },
  { abbr: 'MIA', name: 'Dolphins', city: 'Miami' },
  { abbr: 'MIN', name: 'Vikings', city: 'Minnesota' },
  { abbr: 'NE', name: 'Patriots', city: 'New England' },
  { abbr: 'NO', name: 'Saints', city: 'New Orleans' },
  { abbr: 'NYG', name: 'Giants', city: 'New York' },
  { abbr: 'NYJ', name: 'Jets', city: 'New York' },
  { abbr: 'PHI', name: 'Eagles', city: 'Philadelphia' },
  { abbr: 'PIT', name: 'Steelers', city: 'Pittsburgh' },
  { abbr: 'SEA', name: 'Seahawks', city: 'Seattle' },
  { abbr: 'SF', name: '49ers', city: 'San Francisco' },
  { abbr: 'TB', name: 'Buccaneers', city: 'Tampa Bay' },
  { abbr: 'TEN', name: 'Titans', city: 'Tennessee' },
  { abbr: 'WAS', name: 'Commanders', city: 'Washington' },
];

// ── Slug generation ──────────────────────────────────────────────────────────

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface IdeaFormData {
  title: string;
  description: string;
  primary_team?: string;
  depth_level?: number;
  time_sensitive?: boolean;
  target_publish_date?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateIdeaForm(data: IdeaFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.length < 3) {
    errors.push({ field: 'title', message: 'Title must be at least 3 characters' });
  } else if (data.title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be 200 characters or less' });
  }

  if (!data.description || data.description.length < 20) {
    errors.push({ field: 'description', message: 'Description must be at least 20 characters' });
  }

  if (data.depth_level != null && ![1, 2, 3].includes(data.depth_level)) {
    errors.push({ field: 'depth_level', message: 'Depth level must be 1, 2, or 3' });
  }

  return errors;
}

// ── Form rendering ───────────────────────────────────────────────────────────

function renderFormFields(errors: ValidationError[] = []): string {
  const errorMap = new Map(errors.map(e => [e.field, e.message]));

  const errorHtml = (field: string) => {
    const msg = errorMap.get(field);
    return msg ? `<p class="field-error">${escapeHtml(msg)}</p>` : '';
  };

  const teamOptions = NFL_TEAMS_LEGACY.map(
    t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`,
  ).join('');

  return `
    <div class="form-group${errorMap.has('title') ? ' has-error' : ''}">
      <label for="idea-title" class="form-label">Title <span class="required">*</span></label>
      <input type="text" id="idea-title" name="title" placeholder="e.g. Can Jalen Hurts Sustain His MVP Pace?"
        required minlength="3" maxlength="200" class="input input-full" />
      ${errorHtml('title')}
    </div>

    <div class="form-group${errorMap.has('description') ? ' has-error' : ''}">
      <label for="idea-description" class="form-label">Central Question / Idea <span class="required">*</span></label>
      <textarea id="idea-description" name="description" rows="4"
        placeholder="Describe the central question or thesis for this article…"
        required minlength="20" class="input input-full textarea"></textarea>
      ${errorHtml('description')}
    </div>

    <div class="form-row-2col">
      <div class="form-group">
        <label for="idea-team" class="form-label">Primary Team</label>
        <select id="idea-team" name="primary_team" class="input input-full select">
          <option value="">— None —</option>
          ${teamOptions}
        </select>
      </div>

      <div class="form-group">
        <label for="idea-depth" class="form-label">Depth Level</label>
        <select id="idea-depth" name="depth_level" class="input input-full select">
          <option value="1">1 — Casual Fan</option>
          <option value="2" selected>2 — The Beat</option>
          <option value="3">3 — Deep Dive</option>
        </select>
      </div>
    </div>

    <div class="form-row-2col">
      <div class="form-group">
        <label class="form-label toggle-label">
          <input type="checkbox" name="time_sensitive" value="1" class="toggle-input" />
          <span class="toggle-text">Time Sensitive</span>
        </label>
      </div>

      <div class="form-group">
        <label for="idea-date" class="form-label">Target Publish Date</label>
        <input type="date" id="idea-date" name="target_publish_date" class="input input-full" />
      </div>
    </div>`;
}

export function renderNewIdeaForm(config: AppConfig, errors: ValidationError[] = []): string {
  const content = `
    <div class="idea-page">
      <a href="/" class="back-link">← Back to Dashboard</a>
      <h1>💡 Submit New Idea</h1>
      <p class="page-subtitle">Describe your article idea. It will enter the pipeline at Stage 1.</p>

      <form class="idea-form-full" id="idea-form"
        hx-post="/htmx/ideas"
        hx-swap="outerHTML"
        hx-indicator="#idea-spinner">

        ${renderFormFields(errors)}

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg">Submit Idea</button>
          <span id="idea-spinner" class="htmx-indicator">Submitting…</span>
        </div>
      </form>
    </div>`;

  return renderLayout('New Idea', content, config.leagueConfig.name);
}

export function renderIdeaFormPartial(errors: ValidationError[] = []): string {
  const errorBanner = errors.length > 0
    ? `<div class="form-error-banner">
        <strong>Please fix the following errors:</strong>
        <ul>${errors.map(e => `<li>${escapeHtml(e.message)}</li>`).join('')}</ul>
      </div>`
    : '';

  return `
    <form class="idea-form-full" id="idea-form"
      hx-post="/htmx/ideas"
      hx-swap="outerHTML"
      hx-indicator="#idea-spinner">

      ${errorBanner}
      ${renderFormFields(errors)}

      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-lg">Submit Idea</button>
        <span id="idea-spinner" class="htmx-indicator">Submitting…</span>
      </div>
    </form>`;
}

export function renderIdeaSuccess(article: { id: string; title: string }): string {
  return `
    <div class="idea-success" id="idea-form">
      <div class="success-icon">✅</div>
      <h2>Idea Submitted!</h2>
      <p><strong>${escapeHtml(article.title)}</strong> has been added to the pipeline.</p>
      <div class="success-actions">
        <a href="/articles/${escapeHtml(article.id)}" class="btn btn-primary">View Article</a>
        <a href="/ideas/new" class="btn btn-secondary">Submit Another</a>
        <a href="/" class="btn btn-secondary">Back to Dashboard</a>
      </div>
    </div>`;
}

// ── New smart idea form ──────────────────────────────────────────────────────

export function renderNewIdeaPage(config: { labName: string }): string {
  return renderLayout('New Idea', `
    <div class="idea-form-container">
      <h1>New Article Idea</h1>
      <form id="idea-form" class="idea-form">
        <div class="form-group">
          <label for="prompt">What's the idea?</label>
          <textarea id="prompt" name="prompt" rows="5" required
            placeholder="Analyze the Seahawks' defensive secondary heading into 2025, focusing on Devon Witherspoon's development and the safety room depth..."></textarea>
        </div>

        <div class="form-group">
          <label>Teams <span class="form-hint">(click to select)</span></label>
          <div id="selected-teams" class="team-chips"></div>
          <div class="team-grid">
            ${NFL_TEAMS.map(t => `
              <button type="button" class="team-badge" data-team="${t.abbr}"
                onclick="toggleTeam(this, '${t.abbr}')">
                ${t.abbr}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="teams" name="teams" value="">
        </div>

        <div class="form-group form-checkbox">
          <label>
            <input type="checkbox" id="auto-advance" name="autoAdvance">
            Auto-advance through pipeline
            <span class="form-hint">(stops at Stage 7 for review)</span>
          </label>
        </div>

        <div class="form-actions">
          <a href="/" class="btn btn-secondary">Cancel</a>
          <button type="submit" class="btn btn-primary" id="submit-btn">
            Create Article
          </button>
        </div>

        <div id="form-status" class="form-status" style="display:none"></div>
      </form>
    </div>

    <script>
      const selectedTeams = new Set();

      function toggleTeam(btn, abbr) {
        if (selectedTeams.has(abbr)) {
          selectedTeams.delete(abbr);
          btn.classList.remove('selected');
        } else {
          selectedTeams.add(abbr);
          btn.classList.add('selected');
        }
        document.getElementById('teams').value = Array.from(selectedTeams).join(',');
        renderChips();
      }

      function renderChips() {
        const container = document.getElementById('selected-teams');
        container.innerHTML = Array.from(selectedTeams).map(abbr =>
          '<span class="team-chip">' + abbr +
          ' <button type="button" onclick="removeTeam(\\'' + abbr + '\\')">&times;</button></span>'
        ).join('');
      }

      function removeTeam(abbr) {
        selectedTeams.delete(abbr);
        document.querySelector('.team-badge[data-team="' + abbr + '"]').classList.remove('selected');
        document.getElementById('teams').value = Array.from(selectedTeams).join(',');
        renderChips();
      }

      document.getElementById('idea-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const status = document.getElementById('form-status');
        const prompt = document.getElementById('prompt').value.trim();
        if (!prompt) return;

        btn.disabled = true;
        btn.textContent = 'Creating...';
        status.style.display = 'block';
        status.className = 'form-status info';
        status.textContent = 'Generating title and creating article...';

        try {
          const res = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              teams: Array.from(selectedTeams),
              autoAdvance: document.getElementById('auto-advance').checked,
            }),
          });

          const data = await res.json();
          if (res.ok) {
            if (data.autoAdvance) {
              status.className = 'form-status info';
              status.innerHTML = '✅ Article created! <strong>Running auto-advance pipeline…</strong> This may take a moment.';
              btn.textContent = 'Auto-advancing…';
              try {
                const advRes = await fetch('/api/articles/' + data.id + '/auto-advance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                const advData = await advRes.json();
                if (advData.steps && advData.steps.length > 0) {
                  const stageNames = advData.steps.map(s => 'Stage ' + s.to).join(' → ');
                  status.className = 'form-status success';
                  status.innerHTML = '🚀 Auto-advanced: ' + stageNames + '<br>Now at <strong>Stage ' + advData.currentStage + '</strong>.' + (advData.reason ? ' <em>' + advData.reason + '</em>' : '') + '<br>Redirecting…';
                } else {
                  status.className = 'form-status success';
                  status.innerHTML = 'Article created at <strong>Stage ' + advData.currentStage + '</strong>.' + (advData.reason ? ' <em>' + advData.reason + '</em>' : '') + '<br>Redirecting…';
                }
              } catch (advErr) {
                status.className = 'form-status success';
                status.innerHTML = 'Article created but auto-advance encountered an issue. Redirecting…';
              }
              setTimeout(() => { window.location.href = '/articles/' + data.id + '?from=auto-advance'; }, 2500);
            } else {
              status.className = 'form-status success';
              status.textContent = 'Article created! Redirecting...';
              window.location.href = '/articles/' + data.id;
            }
          }else {
            status.className = 'form-status error';
            status.textContent = data.error || 'Failed to create article';
            btn.disabled = false;
            btn.textContent = 'Create Article';
          }
        } catch (err) {
          status.className = 'form-status error';
          status.textContent = 'Network error: ' + err.message;
          btn.disabled = false;
          btn.textContent = 'Create Article';
        }
      });
    </script>
  `, config.labName);
}
