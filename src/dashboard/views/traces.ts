import type { Article, LlmTrace } from '../../types.js';
import type { AppConfig } from '../../config/index.js';
import { escapeHtml, formatDate, renderLayout } from './layout.js';
import { markdownToHtml } from '../../services/markdown.js';

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
    return Array.isArray(parsed) ? parsed as TracePart[] : [];
  } catch {
    return [];
  }
}

function hasStructuredTracePart(part: TracePart): boolean {
  return Boolean(part.label || part.kind || part.channel);
}

function formatTokens(total: number | null): string {
  if (total == null || total === 0) return '—';
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k`;
  return String(total);
}

function statusBadge(status: string): string {
  if (status === 'completed') return '<span class="badge badge-success">completed</span>';
  if (status === 'failed') return '<span class="badge badge-error">failed</span>';
  return `<span class="badge badge-info">${escapeHtml(status)}</span>`;
}

function renderTracePreview(text: string | null, maxLength = 160): string {
  if (!text) return '—';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return escapeHtml(compact);
  return escapeHtml(compact.slice(0, maxLength).trimEnd() + '…');
}

function slugifyTraceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trace-block';
}

function looksLikeMarkdown(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return /^(#{1,6}\s|> |\s*[-*+]\s|\s*\d+\.\s|```|\|.+\|)/m.test(trimmed)
    || /(\*\*|__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/m.test(trimmed);
}

function highlightJson(raw: string): string {
  const tokenPattern = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
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

function renderTraceBlock(
  title: string,
  rawContent: string | null,
  options?: {
    open?: boolean;
    jsonValue?: unknown;
  },
): string {
  if (!rawContent) return '';
  const blockId = slugifyTraceKey(`${title}-${Math.random().toString(36).slice(2, 8)}`);
  const jsonValue = options?.jsonValue;
  const hasJsonPreview = jsonValue !== undefined;
  const hasMarkdownPreview = !hasJsonPreview && looksLikeMarkdown(rawContent);
  const controls = hasJsonPreview || hasMarkdownPreview
    ? `<div class="trace-preview-toolbar">
        <button type="button" class="btn btn-secondary trace-preview-btn is-active" onclick="toggleTracePreview('${blockId}', 'raw')">Raw</button>
        ${hasJsonPreview
          ? `<button type="button" class="btn btn-secondary trace-preview-btn" onclick="toggleTracePreview('${blockId}', 'preview')">Preview JSON</button>`
          : ''}
        ${hasMarkdownPreview
          ? `<button type="button" class="btn btn-secondary trace-preview-btn" onclick="toggleTracePreview('${blockId}', 'preview')">Preview Markdown</button>`
          : ''}
      </div>`
    : '';
  const preview = hasJsonPreview
    ? `<div class="trace-preview-pane" data-trace-pane="preview" style="display:none">${renderJsonPreview(jsonValue)}</div>`
    : hasMarkdownPreview
      ? `<div class="trace-preview-pane artifact-rendered" data-trace-pane="preview" style="display:none">${markdownToHtml(rawContent)}</div>`
      : '';

  return `
    <details class="trace-block"${options?.open ? ' open' : ''} data-trace-block="${blockId}">
      <summary>${escapeHtml(title)}</summary>
      ${controls}
      <pre class="artifact-pre trace-pre" data-trace-pane="raw">${escapeHtml(rawContent)}</pre>
      ${preview}
    </details>`;
}

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
  const toolStats = typeof metadata.toolCallCount === 'number' && typeof metadata.toolCallBudget === 'number'
    ? `<div class="muted" style="margin:0.4rem 0 0.75rem 0">Tool calls used: ${metadata.toolCallCount} / ${metadata.toolCallBudget}</div>`
    : '';
  if (availableTools.length === 0 && toolCalls.length === 0 && !toolStats) {
    return '';
  }

  const availableToolsBlock = availableTools.length > 0
    ? renderTraceBlock('Available Tools', availableTools.join('\n'))
    : '';

  const toolCallsBlock = toolCalls.length > 0
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

function renderTracePreviewScript(): string {
  return `
    <script>
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
    </script>`;
}

export function renderTraceCards(traces: LlmTrace[]): string {
  if (traces.length === 0) {
    return '<p class="empty-state">No LLM traces captured for this run</p>';
  }

  return `
    <div class="review-list trace-list">
      ${traces.map((trace, index) => {
        const parts = parseTraceParts(trace.context_parts_json);
        const structuredParts = parts.filter(hasStructuredTracePart);
        const contextList = structuredParts.length > 0
          ? `<ul class="info-list trace-parts-list">
              ${structuredParts.map((part) => `
                <li>
                  <strong>${escapeHtml(part.label ?? part.kind ?? 'Context')}</strong>
                  <span class="muted">(${escapeHtml(part.channel ?? 'unknown')})</span>
                </li>`).join('')}
            </ul>`
          : parts.length > 0
            ? '<p class="empty-state">Structured labels were not preserved for this older trace</p>'
          : '<p class="empty-state">No structured context parts captured</p>';

        return `
          <article id="trace-${escapeHtml(trace.id)}" class="review-card trace-card">
            <div class="review-header">
              <span class="verdict-badge verdict-approved">🧠 ${escapeHtml(trace.agent_name)}</span>
              <span class="meta-date">${formatDate(trace.started_at)}</span>
              ${statusBadge(trace.status)}
            </div>
            <div class="review-stats">
              <span class="stat stat-note">Surface: ${escapeHtml(trace.surface ?? '—')}</span>
              <span class="stat stat-suggestion">Model: ${escapeHtml(trace.model ?? trace.requested_model ?? 'pending')}</span>
              <span class="stat stat-note">Tokens: ${formatTokens(trace.total_tokens)}</span>
              <span class="stat stat-note">Latency: ${trace.latency_ms != null ? `${trace.latency_ms}ms` : '—'}</span>
            </div>
            ${trace.error_message ? `<div class="trace-error-banner">❌ ${escapeHtml(trace.error_message)}</div>` : ''}
            ${renderProviderSessionSummary(trace)}
            <div class="trace-subsection">
              <h3>Context Stack</h3>
              ${contextList}
            </div>
            ${renderTraceBlock('System Prompt', trace.system_prompt, { open: index === 0 })}
            ${renderTraceBlock('User Message', trace.user_message, { open: index === 0 })}
            ${renderTraceBlock('Provider-Wrapped Prompt', trace.incremental_prompt)}
            ${renderTraceBlock('Provider Request Envelope', trace.provider_request_json, {
              jsonValue: parseJson(trace.provider_request_json),
            })}
            ${renderTraceBlock('Provider Response Envelope', trace.provider_response_json, {
              jsonValue: parseJson(trace.provider_response_json),
            })}
            ${renderToolMetadata(trace)}
            ${renderTraceBlock('Thinking', trace.thinking_text)}
            ${renderTraceBlock('Assistant Output', trace.output_text, { open: true })}
          </article>`;
      }).join('')}
    </div>`;
}

export function renderArticleTraceTimelinePage(data: {
  config: AppConfig;
  article: Article;
  traces: LlmTrace[];
}): string {
  const { config, article, traces } = data;
  const content = `
    <div class="page-header trace-page-header">
      <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Article detail</a>
      <h1>LLM Trace Timeline</h1>
      <p class="page-subtitle">${escapeHtml(article.title)} · ${traces.length} trace${traces.length === 1 ? '' : 's'}</p>
    </div>
    <section class="detail-section">
      ${renderTraceCards(traces)}
    </section>
    ${renderTracePreviewScript()}`;

  return renderLayout(`Trace Timeline — ${article.title}`, content, config.leagueConfig.name);
}

export function renderStandaloneTracePage(data: {
  config: AppConfig;
  trace: LlmTrace;
}): string {
  const { config, trace } = data;
  const title = trace.article_id
    ? `Trace ${trace.id} — ${trace.article_id}`
    : `Trace ${trace.id}`;
  const backLink = trace.article_id
    ? `<a href="/articles/${escapeHtml(trace.article_id)}/traces" class="back-link">← Article trace timeline</a>`
    : '<a href="/ideas/new" class="back-link">← New Idea</a>';
  const content = `
    <div class="page-header trace-page-header">
      ${backLink}
      <h1>LLM Trace</h1>
      <p class="page-subtitle">${escapeHtml(title)}</p>
    </div>
    <section class="detail-section">
      ${renderTraceCards([trace])}
    </section>
    ${renderTracePreviewScript()}`;

  return renderLayout(`LLM Trace — ${trace.id}`, content, config.leagueConfig.name);
}
