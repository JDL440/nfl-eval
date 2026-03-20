/**
 * new-idea.ts — Smart idea submission form (prompt → Lead agent → idea.md).
 */

import { renderLayout, escapeHtml } from './layout.js';

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

// ── Title extraction from idea markdown ──────────────────────────────────────

export function extractTitleFromIdea(ideaMarkdown: string): string {
  // 1. Look for ## Working Title\n{title}
  const workingTitleMatch = ideaMarkdown.match(/^## Working Title\s*\n+(.+)/m);
  if (workingTitleMatch) {
    return workingTitleMatch[1].trim();
  }

  // 2. Fall back to # Article Idea: {title}
  const h1Match = ideaMarkdown.match(/^# Article Idea:\s*(.+)/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // 3. Fall back to first non-empty line
  const lines = ideaMarkdown.split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed) return trimmed;
  }

  return 'Untitled Idea';
}

// ── Idea template (used in Lead agent system prompt) ─────────────────────────

export const IDEA_TEMPLATE = `# Article Idea: {Generated Title}

## Working Title
{Clickbait-adjacent but honest title, 60-80 characters}

## Angle / Tension
{The core question or conflict — 1-3 paragraphs}
{Why it matters NOW}
{What makes this interesting to fans}

## Primary Team
{TEAM_ABBR} — {Full Team Name}

## Depth Level
{1|2|3} — {Level Name} ({word range}, {agent count} agents)

## Suggested Panel
{Agent1} + {Agent2} + ... (role breakdown)

## Key Context
- {Relevant data point 1}
- {Relevant data point 2}
- {Relevant data point 3}

## Score
- Relevance: {1-3}
- Timeliness: {1-3}
- Reader Value: {1-3}
- Uniqueness: {1-3}
- **Total: {N}/12**`;

// ── Success partial (still used for htmx-swapped confirmations) ──────────────

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

// ── Smart idea form ──────────────────────────────────────────────────────────

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

        <div class="form-group">
          <label for="depth-level">Depth Level</label>
          <select id="depth-level" name="depthLevel" class="input input-full select">
            <option value="1">1 — Casual Fan</option>
            <option value="2" selected>2 — The Beat</option>
            <option value="3">3 — Deep Dive</option>
          </select>
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
        status.textContent = '🧠 Generating idea from your prompt…';

        try {
          const res = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              teams: Array.from(selectedTeams),
              depthLevel: parseInt(document.getElementById('depth-level').value, 10),
              autoAdvance: document.getElementById('auto-advance').checked,
            }),
          });

          const data = await res.json();
          if (res.ok) {
            if (data.autoAdvance) {
              status.className = 'form-status info';
              status.innerHTML = '✅ Created: <strong>' + data.title + '</strong>. Running auto-advance pipeline…';
              btn.textContent = 'Auto-advancing…';
              try {
                const advRes = await fetch('/api/articles/' + data.id + '/auto-advance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                const advData = await advRes.json();
                var redirectError = '';
                if (advData.steps && advData.steps.length > 0) {
                  const stageNames = advData.steps.map(s => 'Stage ' + s.to).join(' → ');
                  status.className = 'form-status success';
                  status.innerHTML = '🚀 Auto-advanced: ' + stageNames + '<br>Now at <strong>Stage ' + advData.currentStage + '</strong>.' + (advData.reason ? ' <em>' + advData.reason + '</em>' : '') + '<br>Redirecting…';
                } else {
                  status.className = 'form-status success';
                  status.innerHTML = 'Article created at <strong>Stage ' + advData.currentStage + '</strong>.' + (advData.reason ? ' <em>' + advData.reason + '</em>' : '') + '<br>Redirecting…';
                  if (advData.reason) { redirectError = advData.reason; }
                }
              } catch (advErr) {
                redirectError = advErr.message || 'Unknown auto-advance error';
                status.className = 'form-status success';
                status.innerHTML = 'Article created but auto-advance encountered an issue. Redirecting…';
              }
              var redirectUrl = '/articles/' + data.id + '?from=auto-advance';
              if (redirectError) { redirectUrl += '&error=' + encodeURIComponent(redirectError); }
              setTimeout(() => { window.location.href = redirectUrl; }, 2500);
            } else {
              status.className = 'form-status success';
              status.innerHTML = '✅ Created: <strong>' + data.title + '</strong>. Redirecting…';
              setTimeout(() => { window.location.href = '/articles/' + data.id; }, 1000);
            }
          } else {
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
