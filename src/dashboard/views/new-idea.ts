/**
 * new-idea.ts — Smart idea submission form (prompt → Lead agent → idea.md).
 */

import { renderLayout, escapeHtml } from './layout.js';
import type { TeamEntry } from '../../config/index.js';
import {
  buildEditorialUiState,
  buildLegacyFields,
  formatLegacyDepthLabel,
  getPresetDescription,
  hasEditorialOverrides,
  renderAnalyticsModeOptions,
  renderArticleFormOptions,
  renderPanelShapeOptions,
  renderPresetOptions,
  renderReaderProfileOptions,
  serializePresetClientMap,
} from './editorial-controls.js';

interface NewIdeaProviderOption {
  id: string;
  name: string;
  default?: boolean;
}

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

/** Strip trailing parenthetical character counts like "(78 characters)" or "(65 chars)". */
function stripCharCount(title: string): string {
  return title.replace(/\s*\(\d+\s*char(?:acter)?s?\)\s*$/i, '').trim();
}

export function extractTitleFromIdea(ideaMarkdown: string): string {
  // Safety net: unwrap JSON envelope if the LLM response leaked through
  let md = ideaMarkdown;
  const trimmed = md.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
        md = parsed.content;
      }
    } catch { /* not JSON — continue with original */ }
  }

  // 1. Look for ## Working Title\n{title}
  const workingTitleMatch = md.match(/^## Working Title\s*\n+(.+)/m);
  if (workingTitleMatch) {
    return stripCharCount(workingTitleMatch[1].trim());
  }

  // 2. Fall back to # Article Idea: {title}
  const h1Match = md.match(/^# Article Idea:\s*(.+)/m);
  if (h1Match) {
    return stripCharCount(h1Match[1].trim());
  }

  // 3. Fall back to first non-empty line
  const lines = md.split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed) return stripCharCount(trimmed);
  }

  return 'Untitled Idea';
}

// ── Idea template (used in Lead agent system prompt) ─────────────────────────

export const IDEA_TEMPLATE = `# Article Idea: {Generated Title}

## Working Title
{Clickbait-adjacent but honest title, 60-80 characters. Do NOT include the character count in the title.}

## Angle / Tension
{The core question or conflict — 1-3 paragraphs}
{Why it matters NOW}
{What makes this interesting to fans}

## Primary Team
{TEAM_ABBR} — {Full Team Name}

## Editorial Preset
{Preset label}

## Editorial Controls
- Reader Profile: {casual|engaged|hardcore}
- Article Form: {brief|standard|deep|feature}
- Panel Shape: {auto|news_reaction|contract_eval|trade_eval|draft_eval|scheme_breakdown|cohort_rank|market_map}
- Analytics Mode: {explain_only|normal|metrics_forward}
- Legacy Compatibility: {Depth label} / {Content profile}

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

export function escapeIdeaStatusHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderIdeaErrorStatus(details: {
  error?: unknown;
  traceId?: unknown;
  traceUrl?: unknown;
}): string {
  const message = typeof details.error === 'string' && details.error.trim()
    ? details.error.trim()
    : 'Failed to create article';
  const traceId = typeof details.traceId === 'string' ? details.traceId.trim() : '';
  const traceUrl = typeof details.traceUrl === 'string' ? details.traceUrl.trim() : '';

  if (!traceId && !traceUrl) {
    return escapeIdeaStatusHtml(message);
  }

  const traceDetails: string[] = [];
  if (traceId) {
    traceDetails.push('Trace ID: <code>' + escapeIdeaStatusHtml(traceId) + '</code>');
  }
  if (traceUrl) {
    traceDetails.push('<a href="' + escapeIdeaStatusHtml(traceUrl) + '">Open trace</a>');
  }

  return '<div>' + escapeIdeaStatusHtml(message) + '</div>'
    + '<div class="form-hint" style="margin-top:0.5rem">Need the failure trace? '
    + traceDetails.join(' · ')
    + '</div>';
}

// ── Smart idea form ──────────────────────────────────────────────────────────

export function renderNewIdeaPage(config: {
  labName: string;
  leagueName?: string;
  teams?: TeamEntry[];
  expertAgents?: string[];
  llmProviders?: NewIdeaProviderOption[];
}): string {
  const leagueName = config.leagueName ?? 'NFL';
  const teams = config.teams ?? [];
  const agents = config.expertAgents ?? [];
  const llmProviders = config.llmProviders ?? [];
  const editorial = buildEditorialUiState({ preset_id: 'beat_analysis' });
  const legacy = buildLegacyFields(editorial.article_form, editorial.reader_profile, editorial.analytics_mode);
  const advancedChecked = hasEditorialOverrides(editorial);
  const agentChips = agents.length > 0 ? agents.map(a => `
    <button type="button" class="agent-badge" data-agent="${escapeHtml(a)}"
      onclick="toggleAgent(this, '${escapeHtml(a)}')">
      ${escapeHtml(a)}
    </button>
  `).join('') : '<span class="form-hint">No expert agents available</span>';
  const providerField = llmProviders.length > 0
    ? `
        <div class="form-group">
          <label for="idea-provider">LLM Provider <span class="form-hint">(saved on the article and reused for later LLM stages)</span></label>
          <select id="idea-provider" name="provider" class="input input-full select">
            ${llmProviders.map((provider) => `
              <option value="${escapeHtml(provider.id)}"${provider.default ? ' selected' : ''}>
                ${escapeHtml(provider.default ? `${provider.name} (default)` : provider.name)}
              </option>
            `).join('')}
          </select>
          <div class="form-hint" style="margin-top:0.35rem">
            <strong>copilot</strong> = GitHub Copilot Pro+ via GitHub Models API ·
            <strong>copilot-cli</strong> = GitHub Copilot CLI agent.
          </div>
        </div>
      `
    : '';

  return renderLayout('New Idea', `
    <div class="idea-page-shell">
      <section class="detail-section idea-page-hero">
        <p class="section-kicker">Story intake</p>
        <h1>New Article Idea</h1>
        <p class="page-subtitle">Shape the prompt, choose the editorial preset, and override it only when the story genuinely needs a different panel or analytics posture.</p>
        <div class="idea-page-highlights">
          <span class="badge badge-stage badge-stage-1">Prompt → Lead → idea.md</span>
          <span class="badge badge-team">Mobile-first intake</span>
          <span class="badge badge-depth">Preset-first intake</span>
        </div>
      </section>

      <section class="detail-section idea-form-shell">
        <div class="quick-actions">
          <button type="button" class="quick-action-btn" id="surprise-btn"
            onclick="surpriseMe()">🎲 Surprise Me</button>
          <button type="button" class="quick-action-btn quick-action-btn--disabled" id="breaking-btn"
            onclick="breakingNews()">📰 Breaking News</button>
        </div>
        <div id="breaking-msg" class="quick-action-msg" style="display:none">
          Coming soon — automated news detection is not yet available
        </div>

        <form id="idea-form" class="idea-form">
          <div class="form-group">
            <label for="prompt">What's the idea?</label>
            <textarea id="prompt" name="prompt" rows="5" required
              placeholder="Enter your article idea — describe the topic, team, and angle you want to explore..."></textarea>
          </div>

          <div class="form-group">
            <label>Teams <span class="form-hint">(click to select)</span></label>
            <div id="selected-teams" class="team-chips"></div>
            <div class="team-grid">
              ${teams.map(t => `
                <button type="button" class="team-badge" data-team="${t.abbr}"
                  onclick="toggleTeam(this, '${t.abbr}')">
                  ${t.abbr}
                </button>
              `).join('')}
            </div>
            <input type="hidden" id="teams" name="teams" value="">
          </div>

          <div class="form-group">
            <label for="preset-id">Editorial Preset</label>
            <select id="preset-id" name="presetId" class="input input-full select">
              ${renderPresetOptions(editorial.preset_id)}
            </select>
            <div class="form-hint" id="idea-preset-hint">
              ${escapeHtml(getPresetDescription(editorial.preset_id))}
              <strong>Legacy compatibility:</strong> ${escapeHtml(formatLegacyDepthLabel(legacy.depthLevel))} · ${escapeHtml(legacy.contentProfile === 'accessible' ? 'Accessible' : 'Deep Dive')}
            </div>
          </div>

          <div class="form-group form-checkbox">
            <label>
              <input
                type="checkbox"
                id="use-editorial-overrides"
                ${advancedChecked ? 'checked' : ''}
                onchange="toggleEditorialOverrides(this.checked)">
              Override preset defaults
              <span class="form-hint">(for narrative exceptions, non-default panel shapes, or heavier analytics)</span>
            </label>
          </div>

          <div id="editorial-override-fields" data-editorial-advanced-fields>
            <div class="settings-grid-2">
              <div class="form-group">
                <label for="reader-profile">Reader profile</label>
                <select id="reader-profile" name="readerProfile" class="input input-full select"${advancedChecked ? '' : ' disabled'}>
                  ${renderReaderProfileOptions(editorial.reader_profile)}
                </select>
                <div class="form-hint">Casual presets should keep stats explained, not assumed.</div>
              </div>
              <div class="form-group">
                <label for="article-form">Article form</label>
                <select id="article-form" name="articleForm" class="input input-full select"${advancedChecked ? '' : ' disabled'}>
                  ${renderArticleFormOptions(editorial.article_form)}
                </select>
              </div>
              <div class="form-group">
                <label for="panel-shape">Panel shape</label>
                <select id="panel-shape" name="panelShape" class="input input-full select"${advancedChecked ? '' : ' disabled'}>
                  ${renderPanelShapeOptions(editorial.panel_shape)}
                </select>
              </div>
              <div class="form-group">
                <label for="analytics-mode">Analytics mode</label>
                <select id="analytics-mode" name="analyticsMode" class="input input-full select"${advancedChecked ? '' : ' disabled'}>
                  ${renderAnalyticsModeOptions(editorial.analytics_mode)}
                </select>
              </div>
              <div class="form-group">
                <label for="panel-min">Panel min</label>
                <input id="panel-min" name="panelMin" type="number" min="1" max="6" class="input input-full" placeholder="Auto"${advancedChecked ? '' : ' disabled'}>
              </div>
              <div class="form-group">
                <label for="panel-max">Panel max</label>
                <input id="panel-max" name="panelMax" type="number" min="1" max="6" class="input input-full" placeholder="Auto"${advancedChecked ? '' : ' disabled'}>
              </div>
              <div class="form-group">
                <label for="required-agents">Required agents</label>
                <input id="required-agents" name="requiredAgents" type="text" class="input input-full" placeholder="cap, analytics"${advancedChecked ? '' : ' disabled'}>
              </div>
              <div class="form-group">
                <label for="excluded-agents">Excluded agents</label>
                <input id="excluded-agents" name="excludedAgents" type="text" class="input input-full" placeholder="fantasy"${advancedChecked ? '' : ' disabled'}>
              </div>
            </div>

            <div class="form-group form-checkbox">
              <label>
                <input type="checkbox" id="allow-team-agent-omission" name="allowTeamAgentOmission"${advancedChecked ? '' : ' disabled'}>
                Allow panels without a primary team agent
              </label>
            </div>
          </div>

          ${providerField}

          <div class="form-group">
            <label>Pin Expert Agents <span class="form-hint">(optional — these agents will always be included on the panel)</span></label>
            <div id="selected-agents" class="team-chips"></div>
            <div class="idea-agent-grid">
              ${agentChips}
            </div>
            <input type="hidden" id="pinned-agents" name="pinnedAgents" value="">
          </div>

          <div id="form-status" class="form-status" style="display:none"></div>

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
        </form>
      </section>
    </div>

    <script>
      const escapeIdeaStatusHtml = ${escapeIdeaStatusHtml.toString()};
      const renderIdeaErrorStatus = ${renderIdeaErrorStatus.toString()};
      const editorialPresetMap = ${serializePresetClientMap()};

      function surpriseMe() {
        const prompt = document.getElementById('prompt');
        const teams = Array.from(selectedTeams);
        let text = 'Generate a surprising, timely ${escapeHtml(leagueName)} article idea.';
        if (teams.length > 0) {
          text += ' Focus on the ' + teams.join(', ') + '.';
        } else {
          text += ' Pick a team and angle that would genuinely interest fans right now.';
        }
        text += ' Focus on an underreported storyline, a bold prediction, or a contrarian take that challenges conventional wisdom.';
        prompt.value = text;
        prompt.focus();
        // Flash the prompt to show it was filled
        prompt.classList.add('highlight-flash');
        setTimeout(() => prompt.classList.remove('highlight-flash'), 1200);
      }

      function breakingNews() {
        const msg = document.getElementById('breaking-msg');
        msg.style.display = msg.style.display === 'none' ? 'block' : 'none';
      }

      function escapeHtmlClient(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function currentLegacyCompatibility() {
        const useOverrides = document.getElementById('use-editorial-overrides').checked;
        const presetId = document.getElementById('preset-id').value;
        const preset = editorialPresetMap[presetId] || editorialPresetMap['beat_analysis'];
        const readerProfile = useOverrides ? document.getElementById('reader-profile').value : preset.readerProfile;
        const articleForm = useOverrides ? document.getElementById('article-form').value : preset.articleForm;
        const analyticsMode = useOverrides ? document.getElementById('analytics-mode').value : preset.analyticsMode;
        const legacy = ${JSON.stringify(legacy)};
        const depthLevel = ({ brief: 1, standard: 2, deep: 3, feature: 4 }[articleForm]) || legacy.depthLevel;
        return {
          depthLevel,
          contentProfile: (readerProfile === 'casual' || analyticsMode === 'explain_only') ? 'accessible' : 'deep_dive',
        };
      }

      function updatePresetHint() {
        const presetId = document.getElementById('preset-id').value;
        const preset = editorialPresetMap[presetId] || editorialPresetMap['beat_analysis'];
        const compatibility = currentLegacyCompatibility();
        const depthLabels = {
          1: '1 — Casual Fan',
          2: '2 — The Beat',
          3: '3 — Deep Dive',
          4: '4 — Feature',
        };
        const hint = document.getElementById('idea-preset-hint');
        if (!hint) return;
        hint.innerHTML = escapeHtmlClient(preset.description)
          + ' <strong>Legacy compatibility:</strong> '
          + escapeHtmlClient(depthLabels[compatibility.depthLevel] || ('Depth ' + compatibility.depthLevel))
          + ' · '
          + escapeHtmlClient(compatibility.contentProfile === 'accessible' ? 'Accessible' : 'Deep Dive');
      }

      function syncPresetDefaults() {
        if (document.getElementById('use-editorial-overrides').checked) {
          updatePresetHint();
          return;
        }
        const presetId = document.getElementById('preset-id').value;
        const preset = editorialPresetMap[presetId] || editorialPresetMap['beat_analysis'];
        document.getElementById('reader-profile').value = preset.readerProfile;
        document.getElementById('article-form').value = preset.articleForm;
        document.getElementById('panel-shape').value = preset.panelShape;
        document.getElementById('analytics-mode').value = preset.analyticsMode;
        updatePresetHint();
      }

      function toggleEditorialOverrides(enabled) {
        document.querySelectorAll('#editorial-override-fields select, #editorial-override-fields input').forEach((field) => {
          field.disabled = !enabled;
        });
        syncPresetDefaults();
      }

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

      // ── Pinned agents ──────────────────────────
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

      // Persist auto-advance preference via localStorage
      (function initAutoAdvance() {
        const cb = document.getElementById('auto-advance');
        const saved = localStorage.getItem('nfl-lab-auto-advance');
        if (saved === 'true') cb.checked = true;
        cb.addEventListener('change', () => {
          localStorage.setItem('nfl-lab-auto-advance', cb.checked ? 'true' : 'false');
        });
      })();

      document.getElementById('preset-id').addEventListener('change', syncPresetDefaults);
      ['reader-profile', 'article-form', 'analytics-mode'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', updatePresetHint);
      });
      toggleEditorialOverrides(document.getElementById('use-editorial-overrides').checked);

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
              depthLevel: currentLegacyCompatibility().depthLevel,
              contentProfile: currentLegacyCompatibility().contentProfile,
              presetId: document.getElementById('preset-id').value,
              ...(document.getElementById('use-editorial-overrides').checked ? {
                readerProfile: document.getElementById('reader-profile').value,
                articleForm: document.getElementById('article-form').value,
                panelShape: document.getElementById('panel-shape').value,
                analyticsMode: document.getElementById('analytics-mode').value,
                panelMin: document.getElementById('panel-min').value,
                panelMax: document.getElementById('panel-max').value,
                requiredAgents: document.getElementById('required-agents').value,
                excludedAgents: document.getElementById('excluded-agents').value,
                allowTeamAgentOmission: document.getElementById('allow-team-agent-omission').checked,
              } : {}),
              provider: document.getElementById('idea-provider')?.value || undefined,
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
              localStorage.setItem('nfl-lab-auto-advance-' + data.id, 'true');
              fetch('/api/articles/' + data.id + '/auto-advance', { method: 'POST' }).catch(() => {});
            }
          } else {
            status.className = 'form-status error';
            status.innerHTML = renderIdeaErrorStatus(data);
            btn.disabled = false;
            btn.textContent = 'Create Article';
          }
        } catch (err) {
          status.className = 'form-status error';
          const message = err instanceof Error ? err.message : String(err);
          status.innerHTML = renderIdeaErrorStatus({ error: 'Network error: ' + message });
          btn.disabled = false;
          btn.textContent = 'Create Article';
        }
      });
    </script>
  `, config.labName);
}
