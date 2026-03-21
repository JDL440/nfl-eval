/**
 * agents.ts — Agent charter and skill viewer pages.
 *
 * Renders:
 *   - /agents           — grid listing of all charters + skills
 *   - /agents/:name     — full charter detail
 *   - /agents/skills/:name — full skill detail
 */

import { renderLayout, escapeHtml } from './layout.js';
import { markdownToHtml } from '../../services/markdown.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CharterSummary {
  name: string;
  filename: string;
  type: 'team' | 'specialist';
  identity: string;
}

export interface SkillSummary {
  name: string;
  filename: string;
}

export interface AgentsPageData {
  labName: string;
  charters: CharterSummary[];
  skills: SkillSummary[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEAM_ABBRS = new Set([
  'ari', 'atl', 'bal', 'buf', 'car', 'chi', 'cin', 'cle',
  'dal', 'den', 'det', 'gb', 'hou', 'ind', 'jax', 'kc',
  'lac', 'lar', 'lv', 'mia', 'min', 'ne', 'no', 'nyg',
  'nyj', 'phi', 'pit', 'sf', 'sea', 'tb', 'ten', 'was',
]);

export function classifyCharter(filename: string): 'team' | 'specialist' {
  const stem = filename.replace(/\.md$/i, '').toLowerCase();
  return TEAM_ABBRS.has(stem) ? 'team' : 'specialist';
}

export function extractIdentity(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Strip blockquote prefix, list markers, and markdown formatting
    let clean = trimmed
      .replace(/^>\s*/, '')       // blockquote >
      .replace(/^[-*+]\s+/, '')   // list markers - * +
      .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold**
      .replace(/\*(.+?)\*/g, '$1')      // *italic*
      .replace(/__(.+?)__/g, '$1')      // __bold__
      .replace(/_(.+?)_/g, '$1')        // _italic_
      .replace(/`(.+?)`/g, '$1')        // `code`
      .trim();
    if (clean) return clean;
  }
  return '';
}

function countSection(content: string, heading: string): number {
  const regex = new RegExp(`^##\\s+${heading}`, 'im');
  const match = regex.exec(content);
  if (!match) return 0;
  const rest = content.slice(match.index + match[0].length);
  const nextHeading = rest.search(/^##\s+/m);
  const section = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  return (section.match(/^[-*]\s+/gm) || []).length;
}

function extractSkillsReferenced(content: string): string[] {
  const skills: string[] = [];
  const regex = /skills\/([a-z0-9-]+(?:\.md)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    skills.push(m[1].replace(/\.md$/i, ''));
  }
  return [...new Set(skills)];
}

// ── Main listing page ────────────────────────────────────────────────────────

export function renderAgentsPage(data: AgentsPageData): string {
  const { labName, charters, skills } = data;

  const teamCharters = charters.filter(c => c.type === 'team');
  const specialistCharters = charters.filter(c => c.type === 'specialist');

  const content = `
    <div class="agents-page">
      <h1>🤖 Agent Charters &amp; Skills</h1>

      <section class="detail-section">
        <h2>📋 Charters (${charters.length})</h2>

        <h3>Team Experts (${teamCharters.length})</h3>
        <div class="agent-grid">
          ${teamCharters.map(c => renderCharterCard(c)).join('')}
        </div>

        <h3>Specialists (${specialistCharters.length})</h3>
        <div class="agent-grid">
          ${specialistCharters.map(c => renderCharterCard(c)).join('')}
        </div>
      </section>

      <section class="detail-section">
        <h2>🧠 Skills (${skills.length})</h2>
        <div class="agent-grid">
          ${skills.map(s => `
            <a href="/agents/skills/${escapeHtml(s.name)}" class="agent-card agent-card-skill">
              <div class="agent-card-header">
                <span class="agent-card-name">${escapeHtml(s.name)}</span>
                <span class="badge badge-skill">skill</span>
              </div>
              <div class="agent-card-file">${escapeHtml(s.filename)}</div>
            </a>
          `).join('')}
        </div>
      </section>
    </div>`;

  return renderLayout('Agents', content, labName);
}

function renderCharterCard(c: CharterSummary): string {
  const badgeClass = c.type === 'team' ? 'badge-team' : 'badge-specialist';
  return `
    <a href="/agents/${escapeHtml(c.name)}" class="agent-card">
      <div class="agent-card-header">
        <span class="agent-card-name">${escapeHtml(c.name)}</span>
        <span class="badge ${badgeClass}">${escapeHtml(c.type)}</span>
      </div>
      <div class="agent-card-identity">${escapeHtml(c.identity)}</div>
    </a>`;
}

// ── Charter detail page ──────────────────────────────────────────────────────

export function renderCharterDetail(name: string, content: string, labName: string): string {
  const responsibilitiesCount = countSection(content, 'Responsibilities');
  const boundariesCount = countSection(content, 'Boundaries');
  const skillsReferenced = extractSkillsReferenced(content);

  const html = `
    <div class="agents-detail">
      <a href="/agents" class="back-link">← Back to Agents</a>
      <div class="detail-badges">
        ${responsibilitiesCount ? `<span class="badge badge-specialist">${responsibilitiesCount} responsibilities</span>` : ''}
        ${boundariesCount ? `<span class="badge badge-depth">${boundariesCount} boundaries</span>` : ''}
        ${skillsReferenced.length ? `<span class="badge badge-team">${skillsReferenced.length} skills</span>` : ''}
      </div>
      <div id="charter-display">
        <div class="charter-content">
          ${markdownToHtml(content)}
        </div>
        <div class="agent-edit-actions">
          <button class="btn btn-secondary btn-sm"
            hx-get="/htmx/agents/${escapeHtml(name)}/edit"
            hx-target="#charter-display"
            hx-swap="innerHTML">✏️ Edit</button>
        </div>
      </div>
    </div>`;

  return renderLayout(`Charter: ${name}`, html, labName);
}

export function renderCharterEditForm(name: string, rawContent: string): string {
  return `
    <form class="agent-edit-form"
      hx-put="/api/agents/${escapeHtml(name)}"
      hx-target="#charter-display"
      hx-swap="innerHTML">
      <textarea class="input input-full agent-edit-textarea" name="content" rows="24">${escapeHtml(rawContent)}</textarea>
      <div class="agent-edit-actions">
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
        <button type="button" class="btn btn-secondary btn-sm"
          hx-get="/htmx/agents/${escapeHtml(name)}/view"
          hx-target="#charter-display"
          hx-swap="innerHTML">Cancel</button>
      </div>
    </form>`;
}

export function renderCharterView(name: string, content: string): string {
  return `
    <div class="charter-content">
      ${markdownToHtml(content)}
    </div>
    <div class="agent-edit-actions">
      <button class="btn btn-secondary btn-sm"
        hx-get="/htmx/agents/${escapeHtml(name)}/edit"
        hx-target="#charter-display"
        hx-swap="innerHTML">✏️ Edit</button>
    </div>`;
}

// ── Skill detail page ────────────────────────────────────────────────────────

export function renderSkillDetail(name: string, content: string, labName: string): string {
  const html = `
    <div class="agents-detail">
      <a href="/agents" class="back-link">← Back to Agents</a>
      <div id="skill-display">
        <div class="skill-content">
          ${markdownToHtml(content)}
        </div>
        <div class="agent-edit-actions">
          <button class="btn btn-secondary btn-sm"
            hx-get="/htmx/agents/skills/${escapeHtml(name)}/edit"
            hx-target="#skill-display"
            hx-swap="innerHTML">✏️ Edit</button>
        </div>
      </div>
    </div>`;

  return renderLayout(`Skill: ${name}`, html, labName);
}

export function renderSkillEditForm(name: string, rawContent: string): string {
  return `
    <form class="agent-edit-form"
      hx-put="/api/agents/skills/${escapeHtml(name)}"
      hx-target="#skill-display"
      hx-swap="innerHTML">
      <textarea class="input input-full agent-edit-textarea" name="content" rows="24">${escapeHtml(rawContent)}</textarea>
      <div class="agent-edit-actions">
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
        <button type="button" class="btn btn-secondary btn-sm"
          hx-get="/htmx/agents/skills/${escapeHtml(name)}/view"
          hx-target="#skill-display"
          hx-swap="innerHTML">Cancel</button>
      </div>
    </form>`;
}

export function renderSkillView(name: string, content: string): string {
  return `
    <div class="skill-content">
      ${markdownToHtml(content)}
    </div>
    <div class="agent-edit-actions">
      <button class="btn btn-secondary btn-sm"
        hx-get="/htmx/agents/skills/${escapeHtml(name)}/edit"
        hx-target="#skill-display"
        hx-swap="innerHTML">✏️ Edit</button>
    </div>`;
}
