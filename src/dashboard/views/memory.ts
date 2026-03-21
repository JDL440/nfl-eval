/**
 * memory.ts — Agent memory browser views.
 *
 * Renders:
 *   - /memory            — full memory browser with filters, stats, CRUD
 *   - htmx partials      — memory table, entry rows, inline edit forms
 */

import { renderLayout, escapeHtml, formatDate } from './layout.js';
import type { MemoryEntry, MemoryCategory } from '../../agents/memory.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoryStats {
  agentName: string;
  count: number;
  avgRelevance: number;
}

export interface MemoryPageData {
  labName: string;
  entries: MemoryEntry[];
  stats: MemoryStats[];
  filters: {
    agent?: string;
    category?: string;
    search?: string;
  };
  agentNames: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MemoryCategory[] = [
  'learning',
  'decision',
  'preference',
  'domain_knowledge',
  'error_pattern',
];

const CATEGORY_COLORS: Record<MemoryCategory, { bg: string; fg: string }> = {
  learning:         { bg: '#dbeafe', fg: '#1d4ed8' },
  decision:         { bg: '#ede9fe', fg: '#6d28d9' },
  preference:       { bg: '#fef3c7', fg: '#92400e' },
  domain_knowledge: { bg: '#dcfce7', fg: '#166534' },
  error_pattern:    { bg: '#fef2f2', fg: '#b91c1c' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function categoryBadge(category: string): string {
  const colors = CATEGORY_COLORS[category as MemoryCategory] ?? { bg: '#f1f5f9', fg: '#64748b' };
  return `<span class="badge" style="background:${colors.bg};color:${colors.fg}">${escapeHtml(category)}</span>`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function relevanceBar(score: number): string {
  const pct = Math.min(100, Math.round((score / 2.0) * 100));
  const color = score >= 1.0 ? 'var(--color-success)' : score >= 0.5 ? 'var(--color-warning)' : 'var(--color-danger)';
  return `<div class="memory-relevance">
    <div class="memory-relevance-bar" style="width:${pct}%;background:${color}"></div>
    <span class="memory-relevance-label">${score.toFixed(2)}</span>
  </div>`;
}

// ── Entry row (used in both main page and agent detail) ──────────────────────

export function renderMemoryRow(entry: MemoryEntry, showAgent = true): string {
  return `<tr id="memory-row-${entry.id}" class="memory-row">
    ${showAgent ? `<td class="memory-cell-agent">${escapeHtml(entry.agentName)}</td>` : ''}
    <td>${categoryBadge(entry.category)}</td>
    <td class="memory-cell-content" title="${escapeHtml(entry.content)}">${escapeHtml(truncate(entry.content, 120))}</td>
    <td>${relevanceBar(entry.relevanceScore)}</td>
    <td class="memory-cell-meta">${entry.accessCount}</td>
    <td class="memory-cell-meta">${formatDate(entry.createdAt)}</td>
    <td class="memory-cell-meta">${entry.expiresAt ? formatDate(entry.expiresAt) : '—'}</td>
    <td class="memory-cell-actions">
      <button class="btn btn-secondary btn-xs"
        hx-get="/htmx/memory/${entry.id}/edit"
        hx-target="#memory-row-${entry.id}"
        hx-swap="outerHTML">✏️</button>
      <button class="btn btn-danger btn-xs"
        hx-delete="/api/memory/${entry.id}"
        hx-target="#memory-row-${entry.id}"
        hx-swap="outerHTML"
        hx-confirm="Delete this memory entry?">🗑️</button>
    </td>
  </tr>`;
}

export function renderMemoryEditRow(entry: MemoryEntry, showAgent = true): string {
  const colSpan = showAgent ? 8 : 7;
  return `<tr id="memory-row-${entry.id}" class="memory-row memory-row-editing">
    <td colspan="${colSpan}">
      <form class="memory-edit-form"
        hx-put="/api/memory/${entry.id}"
        hx-target="#memory-row-${entry.id}"
        hx-swap="outerHTML">
        <div class="memory-edit-fields">
          <div class="memory-edit-field">
            <label>Category</label>
            <select name="category" class="input">
              ${CATEGORIES.map(cat =>
                `<option value="${cat}" ${cat === entry.category ? 'selected' : ''}>${cat}</option>`
              ).join('')}
            </select>
          </div>
          <div class="memory-edit-field">
            <label>Relevance (0–2)</label>
            <input type="number" name="relevanceScore" class="input" min="0" max="2" step="0.1" value="${entry.relevanceScore.toFixed(1)}">
          </div>
          <div class="memory-edit-field memory-edit-field-wide">
            <label>Content</label>
            <textarea name="content" class="input memory-edit-textarea" rows="3">${escapeHtml(entry.content)}</textarea>
          </div>
        </div>
        <div class="memory-edit-actions">
          <button type="submit" class="btn btn-primary btn-xs">Save</button>
          <button type="button" class="btn btn-secondary btn-xs"
            hx-get="/htmx/memory/${entry.id}/view"
            hx-target="#memory-row-${entry.id}"
            hx-swap="outerHTML">Cancel</button>
        </div>
      </form>
    </td>
  </tr>`;
}

// ── Memory table ─────────────────────────────────────────────────────────────

export function renderMemoryTable(entries: MemoryEntry[], showAgent = true): string {
  if (entries.length === 0) {
    return `<div class="empty-state">No memory entries found. Agents store learnings as they work.</div>`;
  }

  return `<table class="memory-table">
    <thead>
      <tr>
        ${showAgent ? '<th>Agent</th>' : ''}
        <th>Category</th>
        <th>Content</th>
        <th>Relevance</th>
        <th>Hits</th>
        <th>Created</th>
        <th>Expires</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="memory-tbody">
      ${entries.map(e => renderMemoryRow(e, showAgent)).join('')}
    </tbody>
  </table>`;
}

// ── Main page ────────────────────────────────────────────────────────────────

export function renderMemoryPage(data: MemoryPageData): string {
  const { labName, entries, stats, filters, agentNames } = data;
  const totalEntries = stats.reduce((sum, s) => sum + s.count, 0);
  const avgRelevance = totalEntries > 0
    ? stats.reduce((sum, s) => sum + s.avgRelevance * s.count, 0) / totalEntries
    : 0;

  const content = `
    <div class="memory-page">
      <h1>🧠 Agent Memory</h1>

      <!-- Stats summary -->
      <div class="memory-stats">
        <div class="memory-stat-card">
          <div class="memory-stat-value">${totalEntries}</div>
          <div class="memory-stat-label">Total Entries</div>
        </div>
        <div class="memory-stat-card">
          <div class="memory-stat-value">${stats.length}</div>
          <div class="memory-stat-label">Agents</div>
        </div>
        <div class="memory-stat-card">
          <div class="memory-stat-value">${avgRelevance.toFixed(2)}</div>
          <div class="memory-stat-label">Avg Relevance</div>
        </div>
        ${stats.map(s => `
          <div class="memory-stat-card memory-stat-agent">
            <div class="memory-stat-value">${s.count}</div>
            <div class="memory-stat-label">${escapeHtml(s.agentName)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Filter bar -->
      <section class="detail-section">
        <div class="memory-filter-bar"
          hx-get="/htmx/memory"
          hx-target="#memory-table-container"
          hx-trigger="change from:select, keyup changed delay:300ms from:input[name='search']"
          hx-include="[name='agent'],[name='category'],[name='search']">
          <select name="agent" class="input">
            <option value="">All Agents</option>
            ${agentNames.map(a =>
              `<option value="${escapeHtml(a)}" ${filters.agent === a ? 'selected' : ''}>${escapeHtml(a)}</option>`
            ).join('')}
          </select>
          <select name="category" class="input">
            <option value="">All Categories</option>
            ${CATEGORIES.map(cat =>
              `<option value="${cat}" ${filters.category === cat ? 'selected' : ''}>${cat}</option>`
            ).join('')}
          </select>
          <input type="text" name="search" class="input input-wide" placeholder="Search content…"
            value="${escapeHtml(filters.search ?? '')}">
          <div class="memory-filter-actions">
            <button class="btn btn-secondary btn-sm"
              hx-post="/api/memory/decay"
              hx-target="#memory-table-container"
              hx-confirm="Decay all agent memories? This reduces relevance scores."
              hx-swap="innerHTML">📉 Decay All</button>
            <button class="btn btn-danger btn-sm"
              hx-post="/api/memory/prune"
              hx-target="#memory-table-container"
              hx-confirm="Prune stale entries? This permanently deletes low-relevance and expired memories."
              hx-swap="innerHTML">🗑️ Prune Stale</button>
          </div>
        </div>
      </section>

      <!-- Memory table -->
      <section class="detail-section">
        <div id="memory-table-container">
          ${renderMemoryTable(entries)}
        </div>
      </section>

      <!-- Add new entry form -->
      <section class="detail-section">
        <h2>+ Add Memory Entry</h2>
        <form class="memory-add-form"
          hx-post="/api/memory"
          hx-target="#memory-table-container"
          hx-swap="innerHTML"
          hx-on::after-request="if(event.detail.successful) this.reset()">
          <div class="memory-add-fields">
            <div class="memory-add-field">
              <label>Agent Name</label>
              <input type="text" name="agentName" class="input" required placeholder="e.g. writer">
            </div>
            <div class="memory-add-field">
              <label>Category</label>
              <select name="category" class="input" required>
                ${CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
              </select>
            </div>
            <div class="memory-add-field">
              <label>Relevance</label>
              <input type="number" name="relevanceScore" class="input" min="0" max="2" step="0.1" value="1.0">
            </div>
            <div class="memory-add-field memory-add-field-wide">
              <label>Content</label>
              <textarea name="content" class="input" rows="3" required placeholder="What the agent learned…"></textarea>
            </div>
          </div>
          <div class="memory-add-actions">
            <button type="submit" class="btn btn-primary btn-sm">Add Entry</button>
          </div>
        </form>
      </section>
    </div>`;

  return renderLayout('Memory', content, labName);
}

// ── Agent detail memory section (partial) ────────────────────────────────────

export function renderAgentMemorySection(agentName: string, entries: MemoryEntry[]): string {
  return `
    <section class="detail-section" id="agent-memory-section">
      <h2>🧠 Memory (${entries.length})</h2>
      ${renderMemoryTable(entries, false)}
      <div style="margin-top:0.75rem">
        <a href="/memory?agent=${encodeURIComponent(agentName)}" class="btn btn-secondary btn-sm">View All in Memory Browser →</a>
      </div>
    </section>`;
}
