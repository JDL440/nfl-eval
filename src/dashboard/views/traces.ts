import type { Article, LlmTrace } from '../../types.js';
import type { AppConfig } from '../../config/index.js';
import { STAGE_NAMES, type Stage } from '../../types.js';
import { escapeHtml, formatDate, renderLayout } from './layout.js';
import { markdownToHtml } from '../../services/markdown.js';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface TracePart {
  channel?: 'system' | 'user';
  kind?: string;
  label?: string;
  content?: string;
}

interface ToolCallTraceView {
  toolName?: string;
  args?: unknown;
  source?: string;
  isError?: boolean;
  resultText?: string;
}

interface TraceMetadataView {
  availableTools?: string[];
  toolCalls?: ToolCallTraceView[];
  toolCallCount?: number;
  toolCallBudget?: number;
}

export interface AdjacentTraces {
  prevId: string | null;
  nextId: string | null;
}

// ── Parsing Helpers ──────────────────────────────────────────────────────────

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function parseTraceParts(raw: string | null): TracePart[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TracePart[]) : [];
  } catch {
    return [];
  }
}

function hasStructuredTracePart(part: TracePart): boolean {
  return Boolean(part.label || part.kind || part.channel);
}

// ── Formatting Helpers ───────────────────────────────────────────────────────

function formatTokens(total: number | null): string {
  if (total == null || total === 0) return '—';
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k`;
  return String(total);
}

function formatTokenSplit(trace: LlmTrace): string {
  const pIn = trace.prompt_tokens;
  const pOut = trace.completion_tokens;
  if (pIn != null && pOut != null && (pIn > 0 || pOut > 0)) {
    return `${formatTokens(pIn)} in / ${formatTokens(pOut)} out`;
  }
  return formatTokens(trace.total_tokens);
}

function formatDuration(trace: LlmTrace): string {
  if (trace.completed_at && trace.started_at) {
    const start = new Date(trace.started_at).getTime();
    const end = new Date(trace.completed_at).getTime();
    const ms = end - start;
    if (!isNaN(ms) && ms >= 0) {
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
      return `${(ms / 60_000).toFixed(1)}m`;
    }
  }
  if (trace.latency_ms != null) return `${trace.latency_ms}ms`;
  return '—';
}

function statusBadge(status: string): string {
  if (status === 'completed') return '<span class="badge badge-success">completed</span>';
  if (status === 'failed') return '<span class="badge badge-error">failed</span>';
  return `<span class="badge badge-info">${escapeHtml(status)}</span>`;
}

function slugifyTraceKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'trace-block';
}

function looksLikeMarkdown(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return (
    /^(#{1,6}\s|> |\s*[-*+]\s|\s*\d+\.\s|```|\|.+\|)/m.test(trimmed) ||
    /(\*\*|__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/m.test(trimmed)
  );
}

// ── JSON Highlighting ────────────────────────────────────────────────────────

function highlightJson(raw: string): string {
  const tokenPattern =
    /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let cursor = 0;
  let html = '';

  for (const match of raw.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > cursor) {
      html += escapeHtml(raw.slice(cursor, index));
    }

    let className = 'trace-json-number';
    if (token === 'true' || token === 'false') {
      className = 'trace-json-boolean';
    } else if (token === 'null') {
      className = 'trace-json-null';
    } else if (token.startsWith('"')) {
      className = raw.slice(index + token.length).trimStart().startsWith(':')
        ? 'trace-json-key'
        : 'trace-json-string';
    }

    html += `<span class="${className}">${escapeHtml(token)}</span>`;
    cursor = index + token.length;
  }

  if (cursor < raw.length) {
    html += escapeHtml(raw.slice(cursor));
  }

  return html;
}

function renderJsonPreview(value: unknown): string {
  const pretty = JSON.stringify(value, null, 2) ?? String(value);
  return `<pre class="trace-json-code"><code>${highlightJson(pretty)}</code></pre>`;
}

// ── Block Rendering ──────────────────────────────────────────────────────────

function renderTraceBlock(
  title: string,
  rawContent: string | null,
  options?: {
    open?: boolean;
    jsonValue?: unknown;
    rawOnly?: boolean;
    cssClass?: string;
  },
): string {
  if (!rawContent) return '';
  const blockId = slugifyTraceKey(`${title}-${Math.random().toString(36).slice(2, 8)}`);
  const jsonValue = options?.jsonValue;
  const rawOnly = options?.rawOnly === true;
  const hasJsonPreview = !rawOnly && jsonValue !== undefined;
  const hasMarkdownPreview = !rawOnly && !hasJsonPreview && looksLikeMarkdown(rawContent);
  const showPreviewByDefault = hasJsonPreview || hasMarkdownPreview;
  const extraClass = options?.cssClass ? ` ${options.cssClass}` : '';
  const controls =
    hasJsonPreview || hasMarkdownPreview
      ? `<div class="trace-preview-toolbar">
        <button type="button" class="btn btn-secondary trace-preview-btn${!showPreviewByDefault ? ' is-active' : ''}" onclick="toggleTracePreview('${blockId}', 'raw')">Raw</button>
        ${
          hasJsonPreview
            ? `<button type="button" class="btn btn-secondary trace-preview-btn${showPreviewByDefault ? ' is-active' : ''}" onclick="toggleTracePreview('${blockId}', 'preview')">Preview JSON</button>`
            : ''
        }
        ${
          hasMarkdownPreview
            ? `<button type="button" class="btn btn-secondary trace-preview-btn${showPreviewByDefault ? ' is-active' : ''}" onclick="toggleTracePreview('${blockId}', 'preview')">Preview Markdown</button>`
            : ''
        }
      </div>`
      : '';
  const preview = hasJsonPreview
    ? `<div class="trace-preview-pane" data-trace-pane="preview"${showPreviewByDefault ? '' : ' style="display:none"'}>${renderJsonPreview(jsonValue)}</div>`
    : hasMarkdownPreview
      ? `<div class="trace-preview-pane artifact-rendered" data-trace-pane="preview"${showPreviewByDefault ? '' : ' style="display:none"'}>${markdownToHtml(rawContent)}</div>`
      : '';

  return `
    <details class="trace-block${extraClass}"${options?.open ? ' open' : ''} data-trace-block="${blockId}">
      <summary>${escapeHtml(title)}</summary>
      ${controls}
      <pre class="artifact-pre trace-pre" data-trace-pane="raw"${showPreviewByDefault ? ' style="display:none"' : ''}>${escapeHtml(rawContent)}</pre>
      ${preview}
    </details>`;
}

// ── Card Sub-sections ────────────────────────────────────────────────────────

function parseTraceMetadata(raw: string | null): TraceMetadataView {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  return parsed as TraceMetadataView;
}

function renderToolMetadata(trace: LlmTrace): string {
  const metadata = parseTraceMetadata(trace.metadata_json);
  const availableTools = Array.isArray(metadata.availableTools) ? metadata.availableTools : [];
  const toolCalls = Array.isArray(metadata.toolCalls) ? metadata.toolCalls : [];
  const toolStats =
    typeof metadata.toolCallCount === 'number' && typeof metadata.toolCallBudget === 'number'
      ? `<div class="muted" style="margin:0.4rem 0 0.75rem 0">Tool calls used: ${metadata.toolCallCount} / ${metadata.toolCallBudget}</div>`
      : '';
  if (availableTools.length === 0 && toolCalls.length === 0 && !toolStats) {
    return '';
  }

  const availableToolsBlock =
    availableTools.length > 0
      ? renderTraceBlock('Available Tools', availableTools.join('\n'), { rawOnly: true })
      : '';

  const toolCallsBlock =
    toolCalls.length > 0
      ? renderTraceBlock('Tool Calls', JSON.stringify(toolCalls, null, 2), {
          open: true,
          jsonValue: toolCalls,
        })
      : '';

  return toolStats + availableToolsBlock + toolCallsBlock;
}

function renderProviderSessionSummary(trace: LlmTrace): string {
  const bits: string[] = [];
  if (trace.provider_mode) bits.push(`Mode: ${escapeHtml(trace.provider_mode)}`);
  if (trace.provider_session_id) bits.push(`Session: ${escapeHtml(trace.provider_session_id)}`);
  if (trace.working_directory) bits.push(`CWD: ${escapeHtml(trace.working_directory)}`);
  return bits.length > 0
    ? `<div class="muted" style="margin-top:0.5rem">${bits.join(' · ')}</div>`
    : '';
}

// ── New: Stage Badge ─────────────────────────────────────────────────────────

function renderStageBadge(stage: number | null): string {
  if (stage == null) return '<span class="badge badge-info">Stage ?</span>';
  const name = STAGE_NAMES[stage as Stage];
  if (!name) return `<span class="badge badge-info">Stage ${stage}</span>`;
  return `<span class="badge badge-info">Stage ${stage}: ${escapeHtml(name)}</span>`;
}

// ── New: Model Display ───────────────────────────────────────────────────────

function renderModelDisplay(trace: LlmTrace): string {
  const actual = trace.model;
  const requested = trace.requested_model;
  if (!actual && !requested) return 'pending';
  if (actual && requested && actual !== requested) {
    return `${escapeHtml(actual)} <span class="muted">(req: ${escapeHtml(requested)})</span>`;
  }
  return escapeHtml(actual ?? requested ?? 'pending');
}

// ── New: Parameter Pills ─────────────────────────────────────────────────────

function renderParamPills(trace: LlmTrace): string {
  const pills: string[] = [];
  if (trace.temperature != null) pills.push(`temp ${trace.temperature}`);
  if (trace.max_tokens != null) pills.push(`max ${trace.max_tokens.toLocaleString()}`);
  if (trace.response_format) pills.push(`fmt: ${escapeHtml(trace.response_format)}`);
  if (trace.finish_reason) pills.push(escapeHtml(trace.finish_reason));
  if (pills.length === 0) return '';
  return `<div class="trace-param-pills">${pills.map((p) => `<span class="trace-pill">${p}</span>`).join('')}</div>`;
}

// ── New: Thinking Teaser ─────────────────────────────────────────────────────

function renderThinkingTeaser(text: string | null): string {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= 3) {
    return renderTraceBlock('Thinking', text, { open: true });
  }
  const preview = lines
    .slice(0, 3)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const truncated = preview.length > 120 ? preview.slice(0, 120) + '…' : preview;
  const blockId = slugifyTraceKey(`thinking-${Math.random().toString(36).slice(2, 8)}`);
  return `
    <details class="trace-block" data-trace-block="${blockId}">
      <summary>Thinking <span class="muted">(${lines.length} lines)</span> <span class="trace-teaser-text">${escapeHtml(truncated)}</span></summary>
      <pre class="artifact-pre trace-pre">${escapeHtml(text)}</pre>
    </details>`;
}

// ── New: Context & Injection (Phase 2) ───────────────────────────────────────

function renderContextInjection(trace: LlmTrace): string {
  const blocks: string[] = [];

  if (trace.skills_json) {
    const skills = parseJson(trace.skills_json);
    if (Array.isArray(skills) && skills.length > 0) {
      const list = skills
        .map((s: unknown) => (typeof s === 'string' ? s : ((s as Record<string, string>)?.name ?? JSON.stringify(s))))
        .join('\n');
      blocks.push(renderTraceBlock('Skills', list, { rawOnly: true }));
    } else if (typeof skills === 'string') {
      blocks.push(renderTraceBlock('Skills', skills, { rawOnly: true }));
    }
  }

  if (trace.memories_json) {
    const memories = parseJson(trace.memories_json);
    if (Array.isArray(memories) && memories.length > 0) {
      blocks.push(
        renderTraceBlock('Memories', JSON.stringify(memories, null, 2), {
          jsonValue: memories,
        }),
      );
    } else if (typeof memories === 'string' && memories.trim()) {
      blocks.push(renderTraceBlock('Memories', memories));
    }
  }

  if (trace.article_context_json) {
    blocks.push(
      renderTraceBlock('Article Context', trace.article_context_json, {
        jsonValue: parseJson(trace.article_context_json),
      }),
    );
  }

  if (trace.conversation_context) {
    blocks.push(renderTraceBlock('Conversation Context', trace.conversation_context));
  }

  if (trace.roster_context) {
    blocks.push(renderTraceBlock('Roster Context', trace.roster_context));
  }

  if (trace.messages_json) {
    blocks.push(
      renderTraceBlock('Messages (Multi-turn)', trace.messages_json, {
        jsonValue: parseJson(trace.messages_json),
      }),
    );
  }

  if (blocks.length === 0) return '';

  return `
    <div class="trace-subsection">
      <h3>Context & Injection</h3>
      ${blocks.join('\n')}
    </div>`;
}

// ── New: Copy Trace ID Button (Phase 2) ──────────────────────────────────────

function renderCopyButton(traceId: string): string {
  return `<button type="button" class="btn btn-secondary btn-sm trace-copy-btn" onclick="copyTraceId('${escapeHtml(traceId)}')" title="Copy trace ID">📋</button>`;
}

// ── New: Filter Bar (Phase 3) ────────────────────────────────────────────────

function renderFilterBar(traces: LlmTrace[]): string {
  const stages = [...new Set(traces.map((t) => t.stage).filter((s): s is number => s != null))].sort(
    (a, b) => a - b,
  );
  const agents = [...new Set(traces.map((t) => t.agent_name))].sort();
  const hasFailures = traces.some((t) => t.status === 'failed');

  const stageOptions = stages
    .map((s) => {
      const name = STAGE_NAMES[s as Stage] ?? `Stage ${s}`;
      return `<option value="${s}">Stage ${s}: ${escapeHtml(name)}</option>`;
    })
    .join('');

  const agentOptions = agents.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');

  return `
    <div class="trace-filter-bar" id="trace-filter-bar">
      <select id="trace-filter-stage" onchange="applyTraceFilters()">
        <option value="">All Stages</option>
        ${stageOptions}
      </select>
      <select id="trace-filter-agent" onchange="applyTraceFilters()">
        <option value="">All Agents</option>
        ${agentOptions}
      </select>
      <div class="trace-filter-status-group">
        <button type="button" class="btn btn-secondary btn-sm trace-status-btn is-active" data-filter-status="" onclick="filterByStatus(this)">All</button>
        <button type="button" class="btn btn-secondary btn-sm trace-status-btn" data-filter-status="completed" onclick="filterByStatus(this)">✅ Completed</button>
        ${hasFailures ? '<button type="button" class="btn btn-secondary btn-sm trace-status-btn" data-filter-status="failed" onclick="filterByStatus(this)">❌ Failed</button>' : ''}
      </div>
      <span class="trace-filter-count" id="trace-filter-count">${traces.length} trace${traces.length === 1 ? '' : 's'}</span>
    </div>`;
}

// ── Stage Divider Rendering (Phase 3) ────────────────────────────────────────

function renderTracesWithDividers(traces: LlmTrace[]): string {
  if (traces.length === 0) {
    return '<p class="empty-state">No LLM traces captured for this run</p>';
  }

  const html: string[] = [];
  let currentStage: number | null | undefined = undefined;

  for (const trace of traces) {
    if (trace.stage !== currentStage) {
      currentStage = trace.stage;
      const stageCount = traces.filter((t) => t.stage === currentStage).length;
      const stageName =
        currentStage != null
          ? STAGE_NAMES[currentStage as Stage] ?? `Stage ${currentStage}`
          : 'Unknown Stage';
      const stageLabel = currentStage != null ? `Stage ${currentStage}: ${stageName}` : stageName;
      html.push(`
        <div class="trace-stage-divider" data-divider-stage="${currentStage ?? ''}">
          <span class="trace-stage-divider-label">${escapeHtml(stageLabel)}</span>
          <span class="trace-stage-divider-count">${stageCount} trace${stageCount === 1 ? '' : 's'}</span>
        </div>`);
    }
    html.push(renderSingleTraceCard(trace, false));
  }

  return `<div class="review-list trace-list">${html.join('')}</div>`;
}

// ── Core Card Rendering ──────────────────────────────────────────────────────

function renderSingleTraceCard(trace: LlmTrace, isStandalone: boolean): string {
  const isFailed = trace.status === 'failed';
  const internalsOpen = isFailed || isStandalone;

  const parts = parseTraceParts(trace.context_parts_json);
  const structuredParts = parts.filter(hasStructuredTracePart);
  const contextList =
    structuredParts.length > 0
      ? `<ul class="info-list trace-parts-list">
          ${structuredParts
            .map(
              (part) => `
            <li>
              <strong>${escapeHtml(part.label ?? part.kind ?? 'Context')}</strong>
              <span class="muted">(${escapeHtml(part.channel ?? 'unknown')})</span>
            </li>`,
            )
            .join('')}
        </ul>`
      : parts.length > 0
        ? '<p class="empty-state">Structured labels were not preserved for this older trace</p>'
        : '<p class="empty-state">No structured context parts captured</p>';

  const headerLink = !isStandalone
    ? `<a href="/traces/${escapeHtml(trace.id)}" class="trace-card-link">`
    : '';
  const headerLinkEnd = !isStandalone ? '</a>' : '';

  return `
    <article id="trace-${escapeHtml(trace.id)}" class="review-card trace-card"
      data-stage="${trace.stage ?? ''}"
      data-agent="${escapeHtml(trace.agent_name)}"
      data-status="${escapeHtml(trace.status)}">

      <div class="review-header">
        ${headerLink}
          <span class="verdict-badge verdict-approved">🧠 ${escapeHtml(trace.agent_name)}</span>
          ${trace.task_family ? `<span class="trace-pill trace-pill-family">${escapeHtml(trace.task_family)}</span>` : ''}
          ${renderStageBadge(trace.stage)}
        ${headerLinkEnd}
        <span class="meta-date">${formatDate(trace.started_at)}</span>
        ${statusBadge(trace.status)}
        ${renderCopyButton(trace.id)}
      </div>

      <div class="review-stats">
        ${trace.surface ? `<span class="stat stat-note">Surface: ${escapeHtml(trace.surface)}</span>` : ''}
        ${trace.provider ? `<span class="stat stat-note">Provider: ${escapeHtml(trace.provider)}</span>` : ''}
        <span class="stat stat-suggestion">Model: ${renderModelDisplay(trace)}</span>
        <span class="stat stat-note">Tokens: ${formatTokenSplit(trace)}</span>
        <span class="stat stat-note">Duration: ${formatDuration(trace)}</span>
      </div>

      ${renderParamPills(trace)}

      ${trace.error_message ? `<div class="trace-error-banner">❌ ${escapeHtml(trace.error_message)}</div>` : ''}
      ${renderProviderSessionSummary(trace)}

      ${renderTraceBlock('Assistant Output', trace.output_text, { open: true })}
      ${renderThinkingTeaser(trace.thinking_text)}
      ${renderToolMetadata(trace)}

      <div class="trace-subsection">
        <h3>Context Stack</h3>
        ${contextList}
      </div>

      ${renderContextInjection(trace)}

      <div class="trace-internals${internalsOpen ? '' : ' trace-internals-hidden'}" data-trace-internals="${escapeHtml(trace.id)}">
        <div class="trace-internals-header">
          <button type="button" class="btn btn-secondary btn-sm trace-internals-toggle" onclick="toggleInternals('${escapeHtml(trace.id)}')">
            ${internalsOpen ? '▾ Hide internals' : '▸ Show internals'}
          </button>
        </div>
        <div class="trace-internals-content"${internalsOpen ? '' : ' style="display:none"'}>
          ${renderTraceBlock('System Prompt', trace.system_prompt, { cssClass: 'trace-internal-block' })}
          ${renderTraceBlock('User Message', trace.user_message, { cssClass: 'trace-internal-block' })}
          ${renderTraceBlock('Provider-Wrapped Prompt', trace.incremental_prompt, { cssClass: 'trace-internal-block' })}
          ${renderTraceBlock('Provider Request Envelope', trace.provider_request_json, {
            jsonValue: parseJson(trace.provider_request_json),
            cssClass: 'trace-internal-block',
          })}
          ${renderTraceBlock('Provider Response Envelope', trace.provider_response_json, {
            jsonValue: parseJson(trace.provider_response_json),
            cssClass: 'trace-internal-block',
          })}
        </div>
      </div>
    </article>`;
}

export function renderTraceCards(traces: LlmTrace[]): string {
  if (traces.length === 0) {
    return '<p class="empty-state">No LLM traces captured for this run</p>';
  }

  return `
    <div class="review-list trace-list">
      ${traces.map((trace) => renderSingleTraceCard(trace, false)).join('')}
    </div>`;
}

// ── Page Rendering ───────────────────────────────────────────────────────────

export function renderArticleTraceTimelinePage(data: {
  config: AppConfig;
  article: Article;
  traces: LlmTrace[];
}): string {
  const { config, article, traces } = data;
  const content = `
    <section class="detail-section page-header trace-page-header">
      <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Article detail</a>
      <h1>Trace timeline</h1>
      <p class="page-subtitle">${escapeHtml(article.title)} · <span id="trace-total-count">${traces.length}</span> trace${traces.length === 1 ? '' : 's'}</p>
    </section>
    ${traces.length > 1 ? renderFilterBar(traces) : ''}
    <section class="detail-section">
      ${renderTracesWithDividers(traces)}
    </section>
    ${renderTracePageScripts()}`;

  return renderLayout(`Trace Timeline — ${article.title}`, content, config.leagueConfig.name);
}

export function renderStandaloneTracePage(data: {
  config: AppConfig;
  trace: LlmTrace;
  adjacent?: AdjacentTraces;
}): string {
  const { config, trace, adjacent } = data;
  const title = trace.article_id
    ? `Trace — ${trace.agent_name} · ${trace.article_id}`
    : `Trace — ${trace.agent_name}`;
  const backLink = trace.article_id
    ? `<a href="/articles/${escapeHtml(trace.article_id)}/traces" class="back-link">← Article trace timeline</a>`
    : '<a href="/ideas/new" class="back-link">← New Idea</a>';

  const prevLink = adjacent?.prevId
    ? `<a href="/traces/${escapeHtml(adjacent.prevId)}" class="btn btn-secondary btn-sm">← Previous</a>`
    : '';
  const nextLink = adjacent?.nextId
    ? `<a href="/traces/${escapeHtml(adjacent.nextId)}" class="btn btn-secondary btn-sm">Next →</a>`
    : '';
  const navBar =
    prevLink || nextLink
      ? `<div class="trace-nav-bar">${prevLink}<span class="trace-nav-spacer"></span>${nextLink}</div>`
      : '';

  const content = `
    <section class="detail-section page-header trace-page-header">
      ${backLink}
      <h1>Trace detail</h1>
      <p class="page-subtitle">${escapeHtml(title)} · ${formatDuration(trace)}</p>
      ${navBar}
    </section>
    <section class="detail-section">
      ${renderSingleTraceCard(trace, true)}
    </section>
    ${navBar ? `<section class="detail-section">${navBar}</section>` : ''}
    ${renderTracePageScripts()}`;

  return renderLayout(`LLM Trace — ${trace.id}`, content, config.leagueConfig.name);
}

// ── Client-Side Scripts ──────────────────────────────────────────────────────

function renderTracePageScripts(): string {
  return `
    <script>
      /* ── Preview toggle (existing) ── */
      function toggleTracePreview(blockId, pane) {
        var block = document.querySelector('[data-trace-block="' + blockId + '"]');
        if (!block) return;
        block.querySelectorAll('[data-trace-pane]').forEach(function(node) {
          node.style.display = node.getAttribute('data-trace-pane') === pane ? '' : 'none';
        });
        block.querySelectorAll('.trace-preview-btn').forEach(function(button, index) {
          var isRawButton = index === 0;
          var shouldBeActive = (pane === 'raw' && isRawButton) || (pane === 'preview' && !isRawButton);
          button.classList.toggle('is-active', shouldBeActive);
        });
      }

      /* ── Internals toggle ── */
      function toggleInternals(traceId) {
        var wrapper = document.querySelector('[data-trace-internals="' + traceId + '"]');
        if (!wrapper) return;
        var content = wrapper.querySelector('.trace-internals-content');
        var btn = wrapper.querySelector('.trace-internals-toggle');
        if (!content || !btn) return;
        var isHidden = content.style.display === 'none';
        content.style.display = isHidden ? '' : 'none';
        wrapper.classList.toggle('trace-internals-hidden', !isHidden);
        btn.textContent = isHidden ? '▾ Hide internals' : '▸ Show internals';
      }

      /* ── Copy trace ID ── */
      function copyTraceId(id) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(id).then(function() {
            showCopyFeedback(id);
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = id;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showCopyFeedback(id);
        }
      }
      function showCopyFeedback(id) {
        var btn = document.querySelector('#trace-' + CSS.escape(id) + ' .trace-copy-btn');
        if (!btn) return;
        var orig = btn.textContent;
        btn.textContent = '✅';
        setTimeout(function() { btn.textContent = orig; }, 1500);
      }

      /* ── Filter bar ── */
      var currentStatusFilter = '';

      function filterByStatus(btn) {
        currentStatusFilter = btn.getAttribute('data-filter-status') || '';
        document.querySelectorAll('.trace-status-btn').forEach(function(b) {
          b.classList.toggle('is-active', b === btn);
        });
        applyTraceFilters();
      }

      function applyTraceFilters() {
        var stageVal = (document.getElementById('trace-filter-stage') || {}).value || '';
        var agentVal = (document.getElementById('trace-filter-agent') || {}).value || '';
        var statusVal = currentStatusFilter;
        var cards = document.querySelectorAll('.trace-card');
        var dividers = document.querySelectorAll('.trace-stage-divider');
        var shown = 0;
        var total = cards.length;

        cards.forEach(function(card) {
          var matchStage = !stageVal || card.getAttribute('data-stage') === stageVal;
          var matchAgent = !agentVal || card.getAttribute('data-agent') === agentVal;
          var matchStatus = !statusVal || card.getAttribute('data-status') === statusVal;
          var visible = matchStage && matchAgent && matchStatus;
          card.style.display = visible ? '' : 'none';
          if (visible) shown++;
        });

        // Update divider visibility
        dividers.forEach(function(div) {
          var divStage = div.getAttribute('data-divider-stage');
          if (stageVal && divStage !== stageVal) {
            div.style.display = 'none';
          } else {
            // Check if any visible cards belong to this stage
            var hasVisible = Array.from(cards).some(function(c) {
              return c.getAttribute('data-stage') === divStage && c.style.display !== 'none';
            });
            div.style.display = hasVisible ? '' : 'none';
          }
        });

        var countEl = document.getElementById('trace-filter-count');
        if (countEl) {
          countEl.textContent = shown === total
            ? total + ' trace' + (total === 1 ? '' : 's')
            : 'Showing ' + shown + ' of ' + total;
        }
      }
    </script>`;
}
