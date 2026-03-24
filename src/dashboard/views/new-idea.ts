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

export function renderNewIdeaPage(config: { labName: string; expertAgents?: string[] }): string {
  const agents = config.expertAgents ?? [];
  const teamOptions = NFL_TEAMS.map(t => `
    <option value="${t.abbr}">${t.abbr} — ${escapeHtml(t.city)} ${escapeHtml(t.name)}</option>
  `).join('');
  const agentChips = agents.length > 0 ? agents.map(a => `
    <button type="button" class="agent-badge" data-agent="${escapeHtml(a)}"
      onclick="toggleAgent(this, '${escapeHtml(a)}')">
      ${escapeHtml(a)}
    </button>
  `).join('') : '<span class="form-hint">No expert agents available</span>';

  return renderLayout('New Idea', `
    <div class="idea-form-container">
      <h1>New Article Idea</h1>
      <p class="idea-page-intro">Lead with one prompt, then set a primary team and depth if you already know the shape of the article. Expert pinning and automation controls stay tucked away until you need them.</p>

      <div class="quick-actions">
        <button type="button" class="quick-action-btn" id="surprise-btn"
          onclick="surpriseMe()">🎲 Surprise Me</button>
      </div>

      <form id="idea-form" class="idea-form">
        <div class="form-group">
          <label for="prompt">What's the idea?</label>
          <textarea id="prompt" name="prompt" rows="5" required
            placeholder="Analyze the Seahawks' defensive secondary heading into 2025, focusing on Devon Witherspoon's development and the safety room depth..."></textarea>
          <p class="form-hint">Describe the angle you want. The dashboard can infer the rest unless you need to guide it.</p>
        </div>

        <div class="form-group">
          <label for="primary-team">Primary Team</label>
          <select id="primary-team" name="primaryTeam" class="input input-full select">
            <option value="">Let the prompt infer it</option>
            ${teamOptions}
          </select>
          <p class="form-hint">Optional, but useful when you already know the main team for the article.</p>
        </div>

        <div class="form-group">
          <label for="depth-level">Depth Level</label>
          <select id="depth-level" name="depthLevel" class="input input-full select">
            <option value="1">1 — Casual Fan</option>
            <option value="2" selected>2 — The Beat</option>
            <option value="3">3 — Deep Dive</option>
          </select>
          <p class="form-hint">This is the default Stage 1 setup. Open advanced options only when you need extra steering.</p>
        </div>

        <details class="idea-advanced">
          <summary>Advanced options</summary>
          <p class="idea-advanced-copy">Use these only when you want cross-team context, expert pinning, or automation controls before Stage 1 runs.</p>

          <div class="form-group">
            <label>Additional Teams <span class="form-hint">(optional cross-team context)</span></label>
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
            <label>Pin Expert Agents <span class="form-hint">(optional — always include these agents on the panel)</span></label>
            <div id="selected-agents" class="team-chips"></div>
            <div class="agent-grid">
              ${agentChips}
            </div>
            <input type="hidden" id="pinned-agents" name="pinnedAgents" value="">
          </div>

          <div class="form-group form-checkbox">
            <label>
              <input type="checkbox" id="auto-advance" name="autoAdvance">
              Auto-advance through pipeline
              <span class="form-hint">(stops at Stage 7 for review)</span>
            </label>
          </div>
        </details>

        <div id="form-status" class="form-status" style="display:none"></div>

        <div class="form-actions">
          <a href="/" class="btn btn-secondary">Cancel</a>
          <button type="submit" class="btn btn-primary" id="submit-btn">
            Create Idea
          </button>
        </div>
      </form>
    </div>

    <script>
      let primaryTeam = '';
      const selectedTeams = new Set();

      function buildTeamsPayload() {
        const teams = primaryTeam
          ? [primaryTeam].concat(Array.from(selectedTeams).filter(abbr => abbr !== primaryTeam))
          : Array.from(selectedTeams);
        document.getElementById('teams').value = teams.join(',');
        return teams;
      }

      function renderTeamButtons() {
        document.querySelectorAll('.team-badge').forEach(function(btn) {
          const abbr = btn.getAttribute('data-team');
          const isPrimary = abbr === primaryTeam;
          const isSelected = !isPrimary && selectedTeams.has(abbr);
          btn.classList.toggle('selected', isSelected);
          btn.classList.toggle('team-badge-primary', isPrimary);
          btn.setAttribute('aria-pressed', (isPrimary || isSelected) ? 'true' : 'false');
        });
      }

      function renderChips() {
        const container = document.getElementById('selected-teams');
        const chips = [];
        if (primaryTeam) {
          chips.push('<span class="team-chip team-chip-primary">Primary: ' + primaryTeam + '</span>');
        }
        chips.push(...Array.from(selectedTeams).map(abbr =>
          '<span class="team-chip">' + abbr +
          ' <button type="button" onclick="removeTeam(\\'' + abbr + '\\')">&times;</button></span>'
        ));
        container.innerHTML = chips.join('');
      }

      function setPrimaryTeam(abbr) {
        primaryTeam = abbr || '';
        if (primaryTeam) selectedTeams.delete(primaryTeam);
        document.getElementById('primary-team').value = primaryTeam;
        buildTeamsPayload();
        renderChips();
        renderTeamButtons();
      }

      function surpriseMe() {
        const prompt = document.getElementById('prompt');
        const teams = buildTeamsPayload();
        let text = 'Generate a surprising, timely NFL article idea.';
        if (teams.length > 0) {
          text += ' Focus on the ' + teams.join(', ') + '.';
        } else {
          text += ' Pick a team and angle that would genuinely interest fans right now.';
        }
        text += ' Focus on an underreported storyline, a bold prediction, or a contrarian take that challenges conventional wisdom.';
        prompt.value = text;
        prompt.focus();
        prompt.classList.add('highlight-flash');
        setTimeout(() => prompt.classList.remove('highlight-flash'), 1200);
      }

      function toggleTeam(btn, abbr) {
        if (abbr === primaryTeam) return;
        if (selectedTeams.has(abbr)) {
          selectedTeams.delete(abbr);
        } else {
          selectedTeams.add(abbr);
        }
        buildTeamsPayload();
        renderChips();
        renderTeamButtons();
      }

      function removeTeam(abbr) {
        selectedTeams.delete(abbr);
        buildTeamsPayload();
        renderChips();
        renderTeamButtons();
      }

      const pinnedAgents = new Set();

      function toggleAgent(btn, name) {
        if (pinnedAgents.has(name)) {
          pinnedAgents.delete(name);
          btn.classList.remove('selected');
        } else {
          pinnedAgents.add(name);
          btn.classList.add('selected');
        }
        document.getElementById('pinned-agents').value = Array.from(pinnedAgents).join(',');
        renderAgentChips();
      }

      function renderAgentChips() {
        var container = document.getElementById('selected-agents');
        container.innerHTML = Array.from(pinnedAgents).map(function(name) {
          return '<span class="team-chip">' + name +
            ' <button type="button" onclick="removeAgent(\\'' + name + '\\')">&times;</button></span>';
        }).join('');
      }

      function removeAgent(name) {
        pinnedAgents.delete(name);
        var btn = document.querySelector('.agent-badge[data-agent="' + name + '"]');
        if (btn) btn.classList.remove('selected');
        document.getElementById('pinned-agents').value = Array.from(pinnedAgents).join(',');
        renderAgentChips();
      }

      (function initAutoAdvance() {
        const cb = document.getElementById('auto-advance');
        const saved = localStorage.getItem('nfl-lab-auto-advance');
        if (saved === 'true') cb.checked = true;
        cb.addEventListener('change', () => {
          localStorage.setItem('nfl-lab-auto-advance', cb.checked ? 'true' : 'false');
        });
      })();

      document.getElementById('primary-team').addEventListener('change', function(e) {
        setPrimaryTeam(e.target.value);
      });

      renderChips();
      renderTeamButtons();

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
        status.textContent = '🧠 Building your Stage 1 idea from the prompt…';

        try {
          const res = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              teams: buildTeamsPayload(),
              depthLevel: parseInt(document.getElementById('depth-level').value, 10),
              autoAdvance: document.getElementById('auto-advance').checked,
              pinnedAgents: Array.from(pinnedAgents),
            }),
          });

          const data = await res.json();
          if (res.ok) {
            const articleUrl = '/articles/' + data.id + (data.autoAdvance ? '?from=auto-advance' : '');
            status.className = 'form-status success';
            status.innerHTML = '✅ Created: <a href="' + articleUrl + '"><strong>' + data.title + '</strong></a>.'
              + (data.autoAdvance ? ' Running auto-advance pipeline…' : '')
              + ' <a href="' + articleUrl + '" class="btn btn-primary btn-sm" style="margin-left:0.5rem">View Article →</a>';
            if (data.autoAdvance) {
              fetch('/api/articles/' + data.id + '/auto-advance', { method: 'POST' }).catch(() => {});
            }
          } else {
            status.className = 'form-status error';
            status.textContent = data.error || 'Failed to create idea';
            btn.disabled = false;
            btn.textContent = 'Create Idea';
          }
        } catch (err) {
          status.className = 'form-status error';
          status.textContent = 'Network error: ' + err.message;
          btn.disabled = false;
          btn.textContent = 'Create Idea';
        }
      });
    </script>
  `, config.labName);
}
