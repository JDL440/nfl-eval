import type { Article, LlmTrace } from '../../types.js';
import type { AppConfig } from '../../config/index.js';
import { escapeHtml, formatDate, renderLayout } from './layout.js';

interface TracePart {
  channel?: 'system' | 'user';
  kind?: string;
  label?: string;
  content?: string;
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

function renderTextBlock(title: string, content: string | null, open = false): string {
  if (!content) return '';
  return `
    <details class="trace-block"${open ? ' open' : ''}>
      <summary>${escapeHtml(title)}</summary>
      <pre class="artifact-pre trace-pre">${escapeHtml(content)}</pre>
    </details>`;
}

function renderJsonBlock(title: string, raw: string | null, open = false): string {
  if (!raw) return '';
  const parsed = parseJson(raw);
  const text = typeof parsed === 'string'
    ? parsed
    : JSON.stringify(parsed, null, 2);
  return renderTextBlock(title, text, open);
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

export function renderTraceSummaryPanel(articleId: string, traces: LlmTrace[]): string {
  return `
    <div class="advanced-subsection">
      <h3>LLM Traces</h3>
      ${traces.length === 0
        ? '<p class="empty-state">No LLM traces recorded yet</p>'
        : `<div class="audit-log">
            ${traces.slice(0, 5).map((trace) => `
              <div class="audit-entry">
                <div class="audit-meta">
                  <span class="audit-agent">${escapeHtml(trace.agent_name)}</span>
                  <span class="muted">${escapeHtml(trace.surface ?? 'trace')}</span>
                  ${statusBadge(trace.status)}
                </div>
                <div class="audit-notes">
                  <strong>${escapeHtml(trace.model ?? trace.requested_model ?? 'pending model')}</strong>
                  · ${formatDate(trace.started_at)}
                  ${trace.stage != null ? ` · Stage ${trace.stage}` : ''}
                  ${trace.stage_run_id ? ` · <a href="/runs/${escapeHtml(trace.stage_run_id)}#trace-${escapeHtml(trace.id)}">View trace</a>` : ''}
                </div>
                <div class="muted">${renderTracePreview(trace.output_text ?? trace.error_message)}</div>
              </div>`).join('')}
           </div>`
      }
      <p style="margin-top:0.75rem"><a href="/articles/${escapeHtml(articleId)}/traces">View full trace timeline →</a></p>
    </div>`;
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
            ${trace.error_message ? `<div class="stage-run-error">❌ ${escapeHtml(trace.error_message)}</div>` : ''}
            ${renderProviderSessionSummary(trace)}
            <div class="advanced-subsection">
              <h3>Context Stack</h3>
              ${contextList}
            </div>
            ${renderTextBlock('System Prompt', trace.system_prompt, index === 0)}
            ${renderTextBlock('User Message', trace.user_message, index === 0)}
            ${renderTextBlock('Provider-Wrapped Prompt', trace.incremental_prompt)}
            ${renderJsonBlock('Provider Request Envelope', trace.provider_request_json)}
            ${renderJsonBlock('Provider Response Envelope', trace.provider_response_json)}
            ${renderTextBlock('Thinking', trace.thinking_text)}
            ${renderTextBlock('Assistant Output', trace.output_text, true)}
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
    <div class="page-header">
      <a href="/articles/${escapeHtml(article.id)}" class="back-link">← Article detail</a>
      <h1>LLM Trace Timeline</h1>
      <p class="page-subtitle">${escapeHtml(article.title)} · ${traces.length} trace${traces.length === 1 ? '' : 's'}</p>
    </div>
    <section class="detail-section">
      ${renderTraceCards(traces)}
    </section>`;

  return renderLayout(`Trace Timeline — ${article.title}`, content, config.leagueConfig.name);
}
