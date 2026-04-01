/**
 * AgentRunner — loads agent charters/skills, calls LLM Gateway.
 *
 * Charters are markdown files in chartersDir with ## sections.
 * Skills are markdown files in skillsDir with YAML frontmatter.
 *
 * NOTE: Memory injection is intentionally DISABLED. The AgentMemory subsystem
 * (storage, schema, bootstrapping) is kept dormant for a future spike/redesign.
 * No memory entries are recalled or injected into prompts at runtime.
 * See: memory.ts, buildSystemPromptParts(), and run() step 3 for the disabled paths.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { z } from 'zod';
import { LLMGateway, parseStructuredJson, StructuredOutputError, type ChatMessage } from '../llm/gateway.js';
import { AgentMemory, type MemoryEntry } from './memory.js';
import type { Repository } from '../db/repository.js';
import {
  buildToolCatalogPrompt,
  executeToolCall,
  getSafeLocalToolCatalog,
  listAvailableTools,
  stableToolCallKey,
  type ToolCallingConfig,
  type ToolExecutionResult as LegacyToolExecutionResult,
} from './local-tools.js';
import type {
  ToolDefinition,
  ToolExecutionResult as StructuredToolExecutionResult,
} from '../tools/catalog-types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentCharter {
  name: string;
  identity: string;
  responsibilities: string[];
  knowledge: string[];
  boundaries: string[];
  model?: string;
}

export interface AgentSkill {
  name: string;
  description: string;
  domain: string;
  confidence: number;
  tools: string[];
  content: string;
}

export interface AgentRunParams {
  agentName: string;
  task: string;
  /** Optional provider override when the gateway has multiple providers registered. */
  provider?: string;
  articleContext?: {
    slug: string;
    title: string;
    stage: number;
    content?: string;
  };
  skills?: string[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  /** Optional live roster context — injected into system prompt when provided. */
  rosterContext?: string;
  /** Optional conversation history — injected as formatted context in the user message. */
  conversationContext?: string;
  trace?: {
    repo: Repository;
    articleId?: string;
    stage?: number;
    surface?: string;
    stageRunId?: string | null;
    runId?: string | null;
  };
  toolCalling?: ToolCallingConfig;
}

// Map agent names to model-policy stage keys so the correct model tier is used
const AGENT_STAGE_KEY: Record<string, string> = {
  'lead': 'lead',
  'writer': 'writer',
  'editor': 'editor',
  'publisher': 'lightweight',
  'panel-moderator': 'lead',  // same tier as panel; avoids needing depthLevel
  'scribe': 'scribe',
};

/** Separate thinking/reasoning tokens from LLM output. */
/**
 * Safety-net: if the LLM returned a raw JSON envelope (e.g. because the
 * provider was copilot-cli and bypassed the tool-loop), unwrap the inner
 * content so callers never see `{"type":"final","content":"..."}`.
 */
export function unwrapFinalEnvelope(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return text;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof parsed.type === 'string' &&
      parsed.type.toLowerCase() === 'final' &&
      typeof parsed.content === 'string' &&
      parsed.content.trim().length > 0
    ) {
      return parsed.content;
    }
  } catch {
    // Not valid JSON — return as-is
  }
  return text;
}

export function separateThinking(content: string): { thinking: string | null; output: string } {
  const thinkParts: string[] = [];

  // Matched pairs: <think>...</think>, <thinking>...</thinking>, <reasoning>...</reasoning>
  let result = content.replace(/<(think|thinking|reasoning)>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => {
    thinkParts.push(inner.trim());
    return '';
  });

  // Qwen-style: no opening tag, everything before </think>
  if (thinkParts.length === 0) {
    const closeIdx = result.indexOf('</think>');
    if (closeIdx >= 0) {
      thinkParts.push(result.slice(0, closeIdx).trim());
      result = result.slice(closeIdx + '</think>'.length);
    }
  }

  return {
    thinking: thinkParts.length > 0 ? thinkParts.join('\n\n') : null,
    output: result.trim() || content.trim(),
  };
}

export interface AgentRunResult {
  content: string;
  thinking: string | null;
  model: string;
  provider: string;
  agentName: string;
  memoriesUsed: number;
  tokensUsed?: { prompt: number; completion: number; cached?: number };
  traceId?: string;
}

export interface AgentToolLoopOptions {
  enabledProviders?: string[];
  maxToolCalls?: number;
  enableWebSearch?: boolean;
}

interface PromptTracePart {
  channel: 'system' | 'user';
  kind: string;
  label: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface ToolCallTrace {
  toolName: string;
  toolCallId?: string;
  args: Record<string, unknown>;
  source: string;
  isError: boolean;
  resultText: string;
}

const ToolLoopTurnSchema = z.union([
  z.object({
    type: z.literal('final'),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal('tool_call'),
    toolName: z.string().min(1),
    toolCallId: z.string().min(1).optional(),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
]);

/**
 * Detect whether a JSON object looks like an agent persona or config envelope
 * echoed back by the LLM (e.g. `{"name":"Lead","role":"...","model":"auto"}`).
 * These should never become artifact content.
 */
export function looksLikePersonaOrConfig(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const keys = new Set(Object.keys(obj).map((k) => k.toLowerCase()));
  // Must have "name" plus at least one persona-like key
  if (!keys.has('name')) return false;
  const personaKeys = ['role', 'persona', 'model', 'identity', 'badge', 'scope'];
  const matchCount = personaKeys.filter((k) => keys.has(k)).length;
  if (matchCount === 0) return false;
  // Reject if the object also has content-like keys (it may be a real response)
  const contentKeys = ['content', 'markdown', 'prompt', 'article', 'draft', 'summary', 'analysis', 'output', 'result'];
  if (contentKeys.some((k) => keys.has(k))) return false;
  return true;
}

/**
 * Detect whether a "final" content string is actually raw JSON data
 * (e.g. a tool result the LLM echoed back) rather than prose content.
 * Used by the tool loop to reject data payloads and re-prompt the LLM.
 */
export function looksLikeJsonDataPayload(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return false;

    // Check if most values are numbers/booleans/null — typical of data payloads
    const entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
    if (entries.length === 0) return false;

    let dataLikeCount = 0;
    let textLikeCount = 0;
    for (const val of entries) {
      if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
        dataLikeCount++;
      } else if (typeof val === 'string' && val.length > 60) {
        textLikeCount++;
      } else if (typeof val === 'object') {
        // Nested objects/arrays are data-like (e.g. tool result arrays)
        dataLikeCount++;
      }
    }
    // If >50% of top-level values are data-like and no significant text, it's a data payload
    return dataLikeCount > textLikeCount && textLikeCount < 2;
  } catch {
    return false;
  }
}

const TOOL_LOOP_RESPONSE_SCHEMA = z.object({
  type: z.enum(['final', 'tool_call']),
  content: z.string().optional(),
  toolName: z.string().optional(),
  toolCallId: z.string().optional(),
  args: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'final' && (!value.content || value.content.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content'],
      message: 'final responses must include non-empty content',
    });
  }
  if (value.type === 'tool_call') {
    if (!value.toolName || value.toolName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toolName'],
        message: 'tool_call responses must include toolName',
      });
    }
    if (!value.args || typeof value.args !== 'object' || Array.isArray(value.args)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['args'],
        message: 'tool_call responses must include an args object',
      });
    }
  }
});

function parseToolLoopArgsCandidate(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed args aliases and fall back to schema validation.
  }
  return undefined;
}

export function normalizeToolLoopResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const rawType = typeof record['type'] === 'string' ? record['type'].trim().toLowerCase() : null;
  const type = rawType === 'toolcall'
    ? 'tool_call'
    : rawType;

  const renderPanelMarkdown = (items: unknown): string | null => {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }
    const lines = items.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }
      const entry = item as Record<string, unknown>;
      const name = ['agentName', 'agent', 'name', 'id', 'slug']
        .map((key) => entry[key])
        .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
      const role = ['role', 'focus', 'description', 'lane', 'reason']
        .map((key) => entry[key])
        .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
      if (!name || !role) {
        return [];
      }
      return [`- **${name.trim()}** — ${role.trim()}`];
    });
    if (lines.length === 0) {
      return null;
    }
    return ['## Panel', '', ...lines].join('\n');
  };

  const extractFinalContentCandidate = (candidate: unknown, depth = 0): string | null => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return null;
    }
    const nested = candidate as Record<string, unknown>;
    const stringFields = [
      'content',
      'message',
      'final',
      'output',
      'result',
      'markdown',
      'discussion_prompt',
      'discussionPrompt',
      'prompt',
    ];
    for (const field of stringFields) {
      const fieldValue = nested[field];
      if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) {
        return fieldValue;
      }
    }
    const panelCollections = [
      nested['panel'],
      nested['panels'],
      nested['panelists'],
      nested['analysts'],
      nested['members'],
      nested['selectedAgents'],
      nested['selected_agents'],
      nested['agents'],
    ];
    for (const collection of panelCollections) {
      const rendered = renderPanelMarkdown(collection);
      if (rendered) {
        return rendered;
      }
    }
    if (depth < 2) {
      for (const value of Object.values(nested)) {
        const renderedFromArray = renderPanelMarkdown(value);
        if (renderedFromArray) {
          return renderedFromArray;
        }
        const nestedContent = extractFinalContentCandidate(value, depth + 1);
        if (nestedContent) {
          return nestedContent;
        }
      }
    }
    return null;
  };

  if (type === 'message') {
    const content = typeof record['content'] === 'string'
      ? record['content']
      : typeof record['message'] === 'string'
        ? record['message']
        : typeof record['final'] === 'string'
          ? record['final']
          : null;
    if (content && content.trim().length > 0) {
      return {
        ...record,
        type: 'final',
        content,
      };
    }
  }

  const wrappedContent = extractFinalContentCandidate(record)
    ?? (record['status'] === 'success' ? extractFinalContentCandidate(record['data']) : null);
  if (wrappedContent) {
    return {
      ...record,
      type: 'final',
      content: wrappedContent,
    };
  }

  // Alias tool-call type variants AND fix missing toolName when using alternative
  // field names like `name`, `tool_name`, `function`, etc.
  if (type === 'tool_call' || type === 'tool' || type === 'tool_use' || type === 'function_call') {
    const toolName = typeof record['toolName'] === 'string'
      ? record['toolName']
      : typeof record['toolname'] === 'string'
        ? record['toolname']
      : typeof record['tool_name'] === 'string'
        ? record['tool_name']
      : typeof record['name'] === 'string'
        ? record['name']
      : typeof record['function'] === 'string'
        ? record['function']
      : typeof record['function_name'] === 'string'
        ? record['function_name']
        : null;
    const args = parseToolLoopArgsCandidate(record['args'])
      ?? parseToolLoopArgsCandidate(record['arguments'])
      ?? parseToolLoopArgsCandidate(record['Arguments'])
      ?? parseToolLoopArgsCandidate(record['input'])
      ?? parseToolLoopArgsCandidate(record['parameters'])
      ?? {};
    if (toolName && toolName.trim().length > 0) {
      return {
        ...record,
        type: 'tool_call',
        toolName,
        args,
      };
    }
  }

  // Handle `type: "final"` with missing or empty `content` — look for alternative
  // content field names (text, answer, response, etc.).
  if (type === 'final') {
    const altContent = typeof record['content'] === 'string' && record['content'].trim().length > 0
      ? record['content']
      : typeof record['text'] === 'string' && (record['text'] as string).trim().length > 0
        ? record['text']
      : typeof record['answer'] === 'string' && (record['answer'] as string).trim().length > 0
        ? record['answer']
      : typeof record['response'] === 'string' && (record['response'] as string).trim().length > 0
        ? record['response']
      : typeof record['result'] === 'string' && (record['result'] as string).trim().length > 0
        ? record['result']
      : typeof record['output'] === 'string' && (record['output'] as string).trim().length > 0
        ? record['output']
      : typeof record['message'] === 'string' && (record['message'] as string).trim().length > 0
        ? record['message']
      : typeof record['markdown'] === 'string' && (record['markdown'] as string).trim().length > 0
        ? record['markdown']
        : null;
    if (altContent) {
      return { ...record, type: 'final', content: altContent };
    }
    // type is "final" but no recognisable content anywhere — stringify the whole object
    const stringified = JSON.stringify(value, null, 2);
    if (stringified.length > 2) {
      return { type: 'final', content: stringified };
    }
  }

  // Heuristic: the LLM used `type` as the tool name instead of using the
  // standard envelope.  E.g. {"type":"query_player_stats","args":{…}}
  // Detect this by checking whether the object carries `args`/`arguments`/`input`
  // or the type value looks like a tool name (contains _ or -) and isn't a
  // known envelope keyword.
  const ENVELOPE_TYPES = new Set([
    'final', 'tool_call', 'tool', 'tool_use', 'function_call',
    'message', 'response', 'error', 'text', 'assistant',
  ]);
  if (type && !ENVELOPE_TYPES.has(type)) {
    const hasArgsField = record['args'] !== undefined
      || record['arguments'] !== undefined
      || record['Arguments'] !== undefined
      || record['input'] !== undefined;
    const looksLikeToolName = /[_\-]/.test(type) || type.startsWith('query') || type.startsWith('search');
    if (hasArgsField || looksLikeToolName) {
      const args = parseToolLoopArgsCandidate(record['args'])
        ?? parseToolLoopArgsCandidate(record['arguments'])
        ?? parseToolLoopArgsCandidate(record['Arguments'])
        ?? parseToolLoopArgsCandidate(record['input'])
        ?? {};
      return {
        ...record,
        type: 'tool_call',
        toolName: type,
        args,
      };
    }
  }

  // Guard: reject persona/config envelopes echoed back by the LLM.
  // These look like {"name":"Lead","role":"...","model":"auto"} and should never
  // become artifact content.  Re-prompt instead.
  if (looksLikePersonaOrConfig(value)) {
    return {
      type: 'final',
      content: '',  // empty → schema validation will reject, triggering re-prompt
    };
  }

  // Last resort: if the response is a non-empty object without a recognized type,
  // treat the entire payload as a final response by serialising it as markdown-safe JSON.
  // This handles LLMs that return the idea/content directly as a JSON structure
  // instead of wrapping it in the {"type":"final","content":"..."} envelope.
  if (!type || (type !== 'final' && type !== 'tool_call')) {
    const stringified = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    if (stringified.length > 2) {
      return { type: 'final', content: stringified };
    }
  }

  return value;
}

function extractProviderToolCalls(providerMetadata: import('../llm/gateway.js').ProviderMetadata | undefined): ToolCallTrace[] {
  const responseEnvelope = providerMetadata?.responseEnvelope;
  if (!responseEnvelope || typeof responseEnvelope !== 'object') {
    return [];
  }
  const toolLoop = (responseEnvelope as Record<string, unknown>)['toolLoop'];
  if (toolLoop && typeof toolLoop === 'object') {
    const calls = (toolLoop as Record<string, unknown>)['calls'];
    if (Array.isArray(calls)) {
      return calls.flatMap((call) => {
        if (!call || typeof call !== 'object') return [];
        const record = call as Record<string, unknown>;
        const toolName = typeof record['toolName'] === 'string' ? record['toolName'] : null;
        if (!toolName) return [];
        return [{
          toolName,
          args: record['args'] && typeof record['args'] === 'object' ? record['args'] as Record<string, unknown> : {},
          source: typeof record['source'] === 'string' ? record['source'] : 'provider',
          isError: record['isError'] === true,
          resultText: typeof record['output'] === 'string' ? record['output'] : '',
        }];
      });
    }
  }
  const choices = Array.isArray((responseEnvelope as Record<string, unknown>)['choices'])
    ? (responseEnvelope as Record<string, unknown>)['choices'] as Array<Record<string, unknown>>
    : [];
  return choices.flatMap((choice) => {
    const message = choice['message'];
    if (!message || typeof message !== 'object') return [];
    const toolCalls = Array.isArray((message as Record<string, unknown>)['tool_calls'])
      ? (message as Record<string, unknown>)['tool_calls'] as Array<Record<string, unknown>>
      : [];
    return toolCalls.flatMap((call) => {
      const fn = call['function'];
      if (!fn || typeof fn !== 'object') return [];
      const toolName = typeof (fn as Record<string, unknown>)['name'] === 'string'
        ? (fn as Record<string, unknown>)['name'] as string
        : null;
      if (!toolName) return [];
      const toolCallId = typeof call['id'] === 'string' ? call['id'] : undefined;
      const rawArguments = typeof (fn as Record<string, unknown>)['arguments'] === 'string'
        ? (fn as Record<string, unknown>)['arguments'] as string
        : '{}';
      let args: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(rawArguments);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        args = {};
      }
      return [{
        toolName,
        toolCallId,
        args,
        source: 'provider',
        isError: false,
        resultText: '',
      }];
    });
  });
}

function buildNativeToolDefinitions(tools: ToolDefinition[]): import('../llm/gateway.js').ChatToolDefinition[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.manifest.name,
      description: tool.manifest.description,
      parameters: tool.manifest.parameters as unknown as Record<string, unknown>,
    },
  }));
}

function normalizeToolCallArgValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeToolCallArgValue(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 2 && 'type' in record && 'value' in record) {
    return normalizeToolCallArgValue(record['value']);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, normalizeToolCallArgValue(child)]),
  );
}

function normalizeToolCallArgs(args: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!args) return {};
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, normalizeToolCallArgValue(value)]),
  );
}

function buildToolMessageContent(result: StructuredToolExecutionResult): string {
  return result.text;
}

function buildRepeatedToolResultMessage(result: StructuredToolExecutionResult): StructuredToolExecutionResult {
  return {
    ...result,
    text: [
      result.text,
      '',
      'Note: This exact tool call was already executed earlier in this conversation.',
      'Reuse the result above instead of repeating the same tool call. If it answers the question, finalize now; otherwise choose a different tool.',
    ].join('\n'),
    isError: false,
  };
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

/** Parse a charter markdown file into structured sections. */
function parseCharter(raw: string, fileName: string): AgentCharter {
  const charter: AgentCharter = {
    name: fileName,
    identity: '',
    responsibilities: [],
    knowledge: [],
    boundaries: [],
  };

  // Split on ## headings
  const sections = raw.split(/^## /m);

  for (const section of sections) {
    const newlineIdx = section.indexOf('\n');
    if (newlineIdx === -1) continue;

    const heading = section.slice(0, newlineIdx).trim().toLowerCase();
    const body = section.slice(newlineIdx + 1).trim();

    switch (heading) {
      case 'identity':
        charter.identity = body;
        break;
      case 'responsibilities':
        charter.responsibilities = parseBulletList(body);
        break;
      case 'knowledge':
        charter.knowledge = parseBulletList(body);
        break;
      case 'boundaries':
        charter.boundaries = parseBulletList(body);
        break;
      case 'model': {
        // Normalize: charters may use "- Preferred: auto" or just "auto"
        let modelVal = body.trim();
        // Strip leading bullet prefix and optional "Preferred:" / "Default:" labels
        modelVal = modelVal.replace(/^[-*]\s*/, '').replace(/^(?:preferred|default)\s*:\s*/i, '').trim();
        charter.model = modelVal || undefined;
        break;
      }
    }
  }

  // Try to extract name from the first # heading
  const titleMatch = raw.match(/^# (.+)$/m);
  if (titleMatch) {
    charter.name = titleMatch[1].trim();
  }

  return charter;
}

/** Parse markdown bullet list (- item) into string array. */
function parseBulletList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line.length > 0);
}

/** Parse YAML frontmatter from a skill markdown file. */
function parseSkillFile(raw: string): AgentSkill | null {
  const normalized = raw.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const content = fmMatch[2].trim();

  const meta: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  // Parse tools from YAML array syntax: [a, b] or bare value
  let tools: string[] = [];
  if (meta.tools) {
    const bracketMatch = meta.tools.match(/^\[(.+)\]$/);
    if (bracketMatch) {
      tools = bracketMatch[1].split(',').map((t) => t.trim());
    } else {
      tools = [meta.tools];
    }
  }

  return {
    name: meta.name ?? '',
    description: meta.description ?? '',
    domain: meta.domain ?? '',
    confidence: parseFloat(meta.confidence ?? '1.0') || 1.0,
    tools,
    content,
  };
}

// ── AgentRunner ──────────────────────────────────────────────────────────────

export class AgentRunner {
  private readonly _gateway: LLMGateway;
  private readonly memory: AgentMemory;
  private readonly chartersDir: string;
  private readonly skillsDir: string;
  private readonly toolLoopProviders: Set<string>;
  private readonly maxToolCalls: number;
  private readonly toolLoopWebSearchEnabled: boolean;

  constructor(options: {
    gateway: LLMGateway;
    memory: AgentMemory;
    chartersDir: string;
    skillsDir: string;
    toolLoop?: AgentToolLoopOptions;
  }) {
    this._gateway = options.gateway;
    this.memory = options.memory;
    this.chartersDir = options.chartersDir;
    this.skillsDir = options.skillsDir;
    this.toolLoopProviders = new Set(options.toolLoop?.enabledProviders ?? []);
    this.maxToolCalls = Math.max(1, options.toolLoop?.maxToolCalls ?? 3);
    this.toolLoopWebSearchEnabled = options.toolLoop?.enableWebSearch ?? false;
  }

  get gateway(): LLMGateway {
    return this._gateway;
  }

  /** Load charter from filesystem. Tries {name}.md then {name}/charter.md. */
  loadCharter(agentName: string): AgentCharter | null {
    const candidates = [
      join(this.chartersDir, `${agentName}.md`),
      join(this.chartersDir, agentName, 'charter.md'),
    ];

    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        return parseCharter(raw, agentName);
      }
    }

    return null;
  }

  /** Load a skill by name from skillsDir. */
  loadSkill(skillName: string): AgentSkill | null {
    const filePath = join(this.skillsDir, `${skillName}.md`);
    if (!existsSync(filePath)) return null;

    const raw = readFileSync(filePath, 'utf-8');
    return parseSkillFile(raw);
  }

  /** List available agent names by scanning the charters directory. */
  listAgents(): string[] {
    if (!existsSync(this.chartersDir)) return [];

    const entries = readdirSync(this.chartersDir, { withFileTypes: true });
    const names: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        names.push(basename(entry.name, '.md'));
      } else if (entry.isDirectory()) {
        // Check for charter.md inside subdirectory
        const subCharter = join(this.chartersDir, entry.name, 'charter.md');
        if (existsSync(subCharter)) {
          names.push(entry.name);
        }
      }
    }

    return names.sort();
  }

  /** List available skill names by scanning the skills directory. */
  listSkills(): string[] {
    if (!existsSync(this.skillsDir)) return [];

    const entries = readdirSync(this.skillsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => basename(e.name, '.md'))
      .sort();
  }

  /**
   * Compose a system prompt from charter sections, skills, and optional roster.
   *
   * @param memories - DEPRECATED. Memory injection is disabled; pass [] at runtime.
   *   The parameter is retained so the method signature and trace infrastructure stay intact
   *   for a future redesign. Entries in this array will still render if passed directly
   *   (e.g., in unit tests), but run() no longer passes real recalled memories here.
   */
  composeSystemPrompt(
    charter: AgentCharter,
    skills: AgentSkill[],
    memories: MemoryEntry[],
    rosterContext?: string,
  ): string {
    return this.buildSystemPromptParts(charter, skills, memories, rosterContext)
      .map((part) => part.content)
      .join('\n\n');
  }

  private buildSystemPromptParts(
    charter: AgentCharter,
    skills: AgentSkill[],
    // DEPRECATED: memories param is kept for trace-shape parity and future redesign.
    // run() always passes [] here — see step 3 in run() for the disabled recall.
    memories: MemoryEntry[],
    rosterContext?: string,
  ): PromptTracePart[] {
    const parts: string[] = [];
    const traceParts: PromptTracePart[] = [];

    // Identity
    if (charter.identity) {
      parts.push(charter.identity);
      traceParts.push({
        channel: 'system',
        kind: 'charter_identity',
        label: 'Charter Identity',
        content: charter.identity,
      });
    }

    // Responsibilities
    if (charter.responsibilities.length > 0) {
      const content = '## Responsibilities\n' +
        charter.responsibilities.map((r) => `- ${r}`).join('\n');
      parts.push(content);
      traceParts.push({
        channel: 'system',
        kind: 'charter_responsibilities',
        label: 'Responsibilities',
        content,
        metadata: { count: charter.responsibilities.length },
      });
    }

    // Skills
    if (skills.length > 0) {
      const skillBlocks = skills.map(
        (s) => `### Skill: ${s.name}\n${s.content}`,
      );
      const content = '## Skills\n' + skillBlocks.join('\n\n');
      parts.push(content);
      traceParts.push({
        channel: 'system',
        kind: 'skills',
        label: 'Skills',
        content,
        metadata: { names: skills.map((skill) => skill.name) },
      });
    }

    // DEPRECATED — Memory injection block. This code path is intentionally dormant.
    // run() passes an empty array for memories; entries will not appear in live prompts.
    // Kept in place (with full trace instrumentation) so the shape is ready for a future
    // redesign that restores or replaces memory injection. Do not remove without a spike.
    if (memories.length > 0) {
      const memLines = memories.map((m) => `- [${m.category}] ${m.content}`);
      const content = '## Relevant Context\n' + memLines.join('\n');
      parts.push(content);
      traceParts.push({
        channel: 'system',
        kind: 'memories',
        label: 'Relevant Context',
        content,
        metadata: {
          ids: memories.map((memory) => memory.id),
          categories: memories.map((memory) => memory.category),
        },
      });
    }

    // Roster context (live data)
    if (rosterContext) {
      const content = '## Current Team Roster\n' + rosterContext;
      parts.push(content);
      traceParts.push({
        channel: 'system',
        kind: 'roster_context',
        label: 'Roster Context',
        content,
      });
    }

    // Boundaries
    if (charter.boundaries.length > 0) {
      const content = '## Boundaries\n' +
        charter.boundaries.map((b) => `- ${b}`).join('\n');
      parts.push(content);
      traceParts.push({
        channel: 'system',
        kind: 'charter_boundaries',
        label: 'Boundaries',
        content,
        metadata: { count: charter.boundaries.length },
      });
    }

    void parts;
    return traceParts;
  }

  private buildUserPrompt(
    task: string,
    articleContext?: AgentRunParams['articleContext'],
    conversationContext?: string,
  ): { userMessage: string; traceParts: PromptTracePart[] } {
    const traceParts: PromptTracePart[] = [];
    let baseUserMessage = task;

    if (articleContext) {
      const contextParts = [
        `Article: ${articleContext.title} (${articleContext.slug})`,
        `Stage: ${articleContext.stage}`,
      ];
      if (articleContext.content) {
        contextParts.push(`\n---\n${articleContext.content}\n---`);
      }
      const articleBlock = contextParts.join('\n');
      traceParts.push({
        channel: 'user',
        kind: 'article_context',
        label: 'Article Context',
        content: articleBlock,
        metadata: {
          slug: articleContext.slug,
          title: articleContext.title,
          stage: articleContext.stage,
        },
      });
      baseUserMessage = articleBlock + '\n\n' + task;
    }

    traceParts.push({
      channel: 'user',
      kind: 'task',
      label: 'Task',
      content: task,
    });

    if (conversationContext) {
      traceParts.unshift({
        channel: 'user',
        kind: 'conversation_context',
        label: 'Conversation Context',
        content: conversationContext,
      });
      return {
        userMessage: conversationContext + '\n\n---\n\n' + baseUserMessage,
        traceParts,
      };
    }

    return { userMessage: baseUserMessage, traceParts };
  }

  private async buildToolLoopPromptPart(maxToolCalls: number): Promise<PromptTracePart | null> {
    const tools = await getSafeLocalToolCatalog({ includeWebSearch: this.toolLoopWebSearchEnabled });
    if (tools.length === 0) return null;

    const toolBlocks = tools.map((tool) => {
      const required = tool.inputSchema.required ?? [];
      const requiredText = required.length > 0 ? `\nRequired args: ${required.join(', ')}` : '';
      const example = tool.examples?.[0] ? `\nExample args: ${JSON.stringify(tool.examples[0])}` : '';
      return `### ${tool.name}\n${tool.description}\nSide effects: ${tool.sideEffects}${requiredText}${example}`;
    });

    return {
      channel: 'system',
      kind: 'tool_loop',
      label: 'Tool Loop',
      content: [
        '## Tool Use Contract',
        `You may ask for up to ${maxToolCalls} tool calls.`,
        'If you need a tool, respond with valid JSON only in this shape:',
        '{"type":"tool_call","toolName":"<allowed tool>","args":{}}',
        'When you are ready to answer, respond with valid JSON only in this shape:',
        '{"type":"final","content":"<your final answer>"}',
        'Use only the listed tools. If you need argument help, call local_tool_catalog first.',
        '',
        '## Available Tools',
        ...toolBlocks,
      ].join('\n\n'),
      metadata: {
        maxToolCalls,
        webSearchEnabled: this.toolLoopWebSearchEnabled,
        tools: tools.map((tool) => tool.name),
      },
    };
  }

  private shouldUseToolLoop(providerId: string, responseFormat?: 'text' | 'json'): boolean {
    if (responseFormat === 'json') return false;
    return this.toolLoopProviders.has(providerId);
  }

  private mergeToolLoopMetadata(
    providerMetadata: import('../llm/gateway.js').ProviderMetadata | undefined,
    toolEvents: LegacyToolExecutionResult[],
    route: { providerId: string; model: string } | null,
    maxToolCalls: number,
  ): import('../llm/gateway.js').ProviderMetadata | undefined {
    if (toolEvents.length === 0 && !providerMetadata) {
      return undefined;
    }

    const existingRequest = providerMetadata?.requestEnvelope;
    const existingResponse = providerMetadata?.responseEnvelope;

    return {
      ...providerMetadata,
      requestEnvelope: {
        ...(existingRequest && typeof existingRequest === 'object' ? existingRequest as Record<string, unknown> : {}),
        toolLoop: {
          enabled: true,
          provider: route?.providerId ?? null,
          model: route?.model ?? null,
          maxToolCalls,
          toolNames: toolEvents.map((event) => event.tool.name),
        },
      },
      responseEnvelope: {
        ...(existingResponse && typeof existingResponse === 'object' ? existingResponse as Record<string, unknown> : {}),
        toolLoop: {
          calls: toolEvents.map((event) => ({
            toolName: event.tool.name,
            args: event.args,
            output: event.output,
            source: event.source,
            isError: event.isError,
          })),
        },
      },
    };
  }

  private async runWithToolLoop(params: {
    messages: ChatMessage[];
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stageKey?: string;
    taskFamily?: string;
    providerContext?: import('../llm/gateway.js').ProviderContext;
    route: { providerId: string; model: string };
    availableTools?: ToolDefinition[];
    toolContext?: import('../tools/catalog-types.js').ToolExecutionContext;
    maxToolCalls: number;
    /** Original requested budget for trace display (before inflation). */
    displayBudget?: number;
  }): Promise<import('../llm/gateway.js').ChatResponse> {
    const messages = [...params.messages];
    const toolEvents: LegacyToolExecutionResult[] = [];
    const toolResultCache = new Map<string, LegacyToolExecutionResult>();
    let aggregatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finalResponse: import('../llm/gateway.js').ChatResponse | null = null;
    let lastCallKey = '';
    let consecutiveDupes = 0;
    const MAX_CONSECUTIVE_DUPES = 3;
    let providerState: unknown;

    for (let attempt = 0; attempt <= params.maxToolCalls; attempt += 1) {
      const response = await this._gateway.chat({
        messages,
        providerState,
        model: params.model,
        provider: params.provider,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        responseFormat: 'json',
        stageKey: params.stageKey,
        taskFamily: params.taskFamily,
        providerContext: params.providerContext,
      });
      providerState = response.providerState;

      aggregatedUsage = {
        promptTokens: aggregatedUsage.promptTokens + (response.usage?.promptTokens ?? 0),
        completionTokens: aggregatedUsage.completionTokens + (response.usage?.completionTokens ?? 0),
        totalTokens: aggregatedUsage.totalTokens + (response.usage?.totalTokens ?? 0),
      };

      let raw: unknown;
      try {
        raw = JSON.parse(response.content);
      } catch {
        // Re-prompt once for invalid JSON before throwing
        if (attempt < params.maxToolCalls) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: 'Your response was not valid JSON. Please respond with valid JSON in this format: {"type":"final","content":"your full answer here"}',
          });
          continue;
        }
        throw new Error(`Tool loop response was not valid JSON: ${response.content.slice(0, 200)}`);
      }
      const parsed = ToolLoopTurnSchema.safeParse(normalizeToolLoopResponse(raw));
      if (!parsed.success) {
        // Re-prompt once for schema failures (e.g. empty content) before throwing
        if (attempt < params.maxToolCalls) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: 'Your response did not match the required format. The "content" field must be a non-empty string. Please respond with: {"type":"final","content":"your full answer here"}',
          });
          continue;
        }
        throw new Error(`Tool loop response did not match the required JSON contract: ${parsed.error.message}`);
      }

      if (parsed.data.type === 'final') {
        // Guard: if the "final" content is actually raw JSON data (e.g. a tool
        // result the LLM echoed back), reject it and re-prompt for a real answer.
        if (attempt < params.maxToolCalls && looksLikeJsonDataPayload(parsed.data.content)) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: [
              'Your response appears to contain raw data rather than a completed answer.',
              'Please use the data you gathered to write a proper response.',
              'Respond with {"type":"final","content":"your full answer here"} only.',
            ].join('\n\n'),
          });
          continue;
        }
        finalResponse = {
          ...response,
          content: parsed.data.content,
        };
        break;
      }

      if (attempt >= params.maxToolCalls) {
        const displayMax = params.displayBudget ?? params.maxToolCalls;
        const err = new Error(`Tool loop exceeded the max of ${displayMax} tool calls without a final answer.`);
        (err as Error & { toolEvents?: LegacyToolExecutionResult[] }).toolEvents = toolEvents;
        throw err;
      }

      const toolCall = parsed.data;
      const normalizedArgs = normalizeToolCallArgs(toolCall.args);
      const cacheKey = stableToolCallKey(toolCall.toolName, normalizedArgs);

      // Track consecutive identical tool calls to break infinite loops
      if (cacheKey === lastCallKey) {
        consecutiveDupes++;
      } else {
        consecutiveDupes = 1;
        lastCallKey = cacheKey;
      }

      if (consecutiveDupes > MAX_CONSECUTIVE_DUPES) {
        // LLM is stuck in a loop — force it to produce a final answer
        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role: 'user',
          content: [
            `You have called ${toolCall.toolName} with the same arguments ${consecutiveDupes} times in a row.`,
            'You already have the data you need. STOP calling tools.',
            'Respond with {"type":"final","content":"your complete answer here"} using the data you have gathered so far.',
          ].join('\n\n'),
        });
        continue;
      }

      const structuredTool = params.availableTools?.find((candidate) => candidate.manifest.name === toolCall.toolName);
      const toolResult = toolResultCache.has(cacheKey)
        ? toolResultCache.get(cacheKey)!
        : await (async () => {
          try {
            if (structuredTool) {
              const structuredResult = await executeToolCall(structuredTool, normalizedArgs, params.toolContext);
              return {
                tool: {
                  name: structuredTool.manifest.name,
                  description: structuredTool.manifest.description,
                  category: structuredTool.source,
                  sideEffects: structuredTool.safety.writesState ? 'writes_state' : 'none',
                  readOnlyHint: structuredTool.safety.readOnly,
                  destructiveHint: false,
                  idempotentHint: false,
                  openWorldHint: structuredTool.safety.externalSideEffects ?? false,
                  inputSchema: structuredTool.manifest.parameters,
                },
                args: normalizedArgs,
                output: structuredResult.text,
                isError: structuredResult.isError ?? false,
                source: 'local',
              } satisfies LegacyToolExecutionResult;
            }
            return await executeToolCall(toolCall.toolName, normalizedArgs, {
              includeWebSearch: this.toolLoopWebSearchEnabled,
            });
          } catch (error) {
            return {
              tool: {
                name: toolCall.toolName,
                description: 'Tool execution failed.',
                category: 'error',
                sideEffects: 'none',
                readOnlyHint: true,
                inputSchema: { type: 'object' },
              },
                args: normalizedArgs,
                output: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
                isError: true,
                source: 'local' as const,
            };
          }
        })();
      toolResultCache.set(cacheKey, toolResult);
      toolEvents.push(toolResult);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [
          `Tool result for ${toolResult.tool.name}:`,
          toolResult.output,
          'If you need another tool, respond with {"type":"tool_call","toolName":"...","args":{}}.',
          'Otherwise respond with {"type":"final","content":"..."} only.',
        ].join('\n\n'),
      });
    }

    if (!finalResponse) {
      const err = new Error('Tool loop ended without a final response.');
      (err as Error & { toolEvents?: LegacyToolExecutionResult[] }).toolEvents = toolEvents;
      throw err;
    }

    return {
      ...finalResponse,
      usage: aggregatedUsage.totalTokens > 0 ? aggregatedUsage : undefined,
      providerMetadata: this.mergeToolLoopMetadata(
        finalResponse.providerMetadata,
        toolEvents,
        params.route,
        params.displayBudget ?? params.maxToolCalls,
      ),
    };
  }

  /** Main execution method — orchestrates charter, skills, memory, and LLM call. */
  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const {
      agentName,
      task,
      provider,
      articleContext,
      skills: skillNames,
      temperature,
      maxTokens,
      responseFormat,
    } = params;

    // 1. Load charter
    const charter = this.loadCharter(agentName);
    if (!charter) {
      throw new Error(`Agent charter not found: ${agentName}`);
    }

    // 2. Load requested skills (missing skills are silently excluded)
    const skills: AgentSkill[] = [];
    if (skillNames) {
      for (const name of skillNames) {
        const skill = this.loadSkill(name);
        if (skill) skills.push(skill);
      }
    }

    // 3. [DEPRECATED] Memory recall — injection is disabled pending redesign.
    //    AgentMemory storage and schema remain intact (see memory.ts); nothing is retrieved
    //    or injected into prompts here. Replace this stub with a real recall strategy during
    //    the future memory spike. memoriesUsed in the result will always be 0 until then.
    const memories: MemoryEntry[] = [];

    const model = charter.model && charter.model !== 'auto' ? charter.model : undefined;
    const stageKey = AGENT_STAGE_KEY[agentName];
    const taskFamily = model || stageKey ? undefined : 'deep_reasoning';
    const route = this._gateway.previewRoute({
      messages: [],
      model,
      provider,
      stageKey: model ? undefined : stageKey,
      taskFamily,
    });
    const useLegacyLmStudioLoop = route.providerId === 'lmstudio'
      && process.env.LMSTUDIO_LEGACY_TOOLS === 'true';
    const useStructuredToolCalling = params.toolCalling?.enabled === true && !useLegacyLmStudioLoop;
    const toolLoopEnabled = (params.toolCalling?.enabled === true && useLegacyLmStudioLoop)
      || (!useStructuredToolCalling && this.shouldUseToolLoop(route.providerId, responseFormat));
    const effectiveToolCallBudget = Math.max(1, params.toolCalling?.maxToolCalls ?? this.maxToolCalls);
    const requestedTools = Array.from(new Set([
      ...(params.toolCalling?.requestedTools ?? []),
      ...skills.flatMap((skill) => skill.tools),
    ]));
    const toolContext = {
      ...(params.toolCalling?.context ?? {}),
      articleId: params.toolCalling?.context?.articleId ?? params.trace?.articleId ?? articleContext?.slug ?? null,
      stage: params.toolCalling?.context?.stage ?? params.trace?.stage ?? articleContext?.stage ?? null,
      surface: params.toolCalling?.context?.surface ?? params.trace?.surface ?? null,
      agentName: params.toolCalling?.context?.agentName ?? agentName,
    };
    const availableTools = await listAvailableTools({
      ...params.toolCalling,
      requestedTools,
      context: toolContext,
    });

    // 4. Compose system prompt
    const systemParts = this.buildSystemPromptParts(charter, skills, memories, params.rosterContext);
    if (toolLoopEnabled) {
      const toolLoopPart = await this.buildToolLoopPromptPart(effectiveToolCallBudget);
      if (toolLoopPart) {
        systemParts.push(toolLoopPart);
      }
    }
    if (availableTools.length > 0 && !useStructuredToolCalling) {
      const toolPrompt = buildToolCatalogPrompt(availableTools);
      systemParts.push({
        channel: 'system',
        kind: 'available_tools',
        label: 'Available Tools',
        content: toolPrompt,
        metadata: { names: availableTools.map((tool) => tool.manifest.name) },
      });
    }
    const systemPrompt = systemParts.map((part) => part.content).join('\n\n');

    // 5. Build user message
    const userPrompt = this.buildUserPrompt(task, articleContext, params.conversationContext);
    const userMessage = userPrompt.userMessage;

    // 6. Build messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    // 7. Call LLM Gateway
    const traceParts = [...systemParts, ...userPrompt.traceParts];
    const traceId = params.trace?.repo.startLlmTrace({
      runId: params.trace?.runId ?? null,
      stageRunId: params.trace?.stageRunId ?? null,
      articleId: params.trace?.articleId ?? articleContext?.slug ?? null,
      stage: params.trace?.stage ?? articleContext?.stage ?? null,
      surface: params.trace?.surface ?? null,
      agentName,
      requestedModel: model ?? null,
      stageKey: model ? null : stageKey ?? null,
      taskFamily: taskFamily ?? null,
      temperature: temperature ?? null,
      maxTokens: maxTokens ?? null,
      responseFormat: responseFormat ?? 'text',
      systemPrompt,
      userMessage,
      messages,
      contextParts: traceParts,
      skills: skills.map((skill) => ({
        name: skill.name,
        domain: skill.domain,
        description: skill.description,
        confidence: skill.confidence,
        tools: skill.tools,
      })),
      memories: memories.map((memory) => ({
        id: memory.id,
        category: memory.category,
        content: memory.content,
        relevanceScore: memory.relevanceScore,
      })),
      articleContext: articleContext ?? null,
      conversationContext: params.conversationContext ?? null,
      rosterContext: params.rosterContext ?? null,
      metadata: availableTools.length > 0
        ? { availableTools: availableTools.map((tool) => tool.manifest.name) }
        : null,
    });
    const requestStartedAt = Date.now();
    let response;
    const toolCalls: ToolCallTrace[] = [];
    let lastProviderMetadata: import('../llm/gateway.js').ProviderMetadata | undefined;
    let lastProviderId: string | null = null;
    let lastModelId: string | null = null;
    try {
      const providerContext = {
        articleId: params.trace?.articleId ?? articleContext?.slug ?? null,
        runId: params.trace?.runId ?? null,
        stageRunId: params.trace?.stageRunId ?? null,
        stage: params.trace?.stage ?? articleContext?.stage ?? null,
        surface: params.trace?.surface ?? null,
        traceId: traceId ?? null,
      };
      if (availableTools.length > 0 && responseFormat !== 'json' && route.providerId !== 'copilot-cli' && useStructuredToolCalling) {
        const toolConversation: ChatMessage[] = [...messages];
        const seenCalls = new Set<string>();
        const priorToolResults = new Map<string, StructuredToolExecutionResult>();
        const maxToolCalls = effectiveToolCallBudget;
        let aggregatedUsage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        } | undefined;
        let finalResponse: import('../llm/gateway.js').ChatResponse | undefined;
        let providerState: unknown;

        for (let attempt = 0; attempt < maxToolCalls; attempt += 1) {
          const nativeTools = buildNativeToolDefinitions(availableTools);
          const structuredResponse = await this._gateway.chat({
            messages: toolConversation,
            tools: nativeTools.length > 0 ? nativeTools : undefined,
            providerState,
            provider,
            model,
            temperature,
            maxTokens,
            // When native tools are provided to a provider that supports them
            // (e.g. LMStudio, Gemini), omit responseFormat so the provider can
            // decide how to constrain the output.  Other providers still use
            // JSON mode alongside native tools.
            responseFormat: nativeTools.length > 0 && (route.providerId === 'lmstudio' || route.providerId === 'gemini')
              ? undefined : 'json',
            stageKey: model ? undefined : stageKey,
            taskFamily,
            disallowedProviderIds: ['copilot-cli'],
            providerContext,
          });
          providerState = structuredResponse.providerState;
          lastProviderMetadata = structuredResponse.providerMetadata;
          lastProviderId = structuredResponse.provider;
          lastModelId = structuredResponse.model;

          if (structuredResponse.usage) {
            aggregatedUsage = aggregatedUsage ?? {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            };
            aggregatedUsage.promptTokens += structuredResponse.usage.promptTokens;
            aggregatedUsage.completionTokens += structuredResponse.usage.completionTokens;
            aggregatedUsage.totalTokens += structuredResponse.usage.totalTokens;
          }

          let structured;
          try {
            structured = TOOL_LOOP_RESPONSE_SCHEMA.safeParse(
              normalizeToolLoopResponse(parseStructuredJson(structuredResponse.content)),
            );
          } catch (e) {
            if (e instanceof StructuredOutputError) {
              // Model returned non-JSON text (e.g. thinking + prose).
              // Treat the raw content as the final answer rather than crashing.
              finalResponse = {
                ...structuredResponse,
                content: structuredResponse.content,
                usage: aggregatedUsage ?? structuredResponse.usage,
              };
              break;
            }
            throw e;
          }
          if (!structured.success) {
            throw new Error(`LLM response does not match schema: ${structured.error.message}`);
          }

          if (structured.data.type === 'final') {
            finalResponse = {
              ...structuredResponse,
              content: structured.data.content ?? '',
              usage: aggregatedUsage ?? structuredResponse.usage,
            };
            break;
          }

          const toolName = structured.data.toolName ?? '';
          const toolCallId = structured.data.toolCallId ?? `tool-call-${attempt + 1}`;
          const args = normalizeToolCallArgs(structured.data.args);
          const key = `${toolName}:${JSON.stringify(args)}`;
          const tool = availableTools.find((candidate) => candidate.manifest.name === toolName);

          let toolResult: StructuredToolExecutionResult;
          if (!tool) {
            toolResult = {
              text: JSON.stringify({ error: `Unknown or disallowed tool '${toolName}'` }, null, 2),
              isError: true,
            };
          } else if (seenCalls.has(key)) {
            toolResult = buildRepeatedToolResultMessage(
              priorToolResults.get(key) ?? {
                text: JSON.stringify({ error: `Duplicate tool call blocked for '${toolName}'` }, null, 2),
                isError: false,
              },
            );
          } else {
            seenCalls.add(key);
            toolResult = await executeToolCall(tool, args, toolContext);
            priorToolResults.set(key, toolResult);
          }

          toolCalls.push({
            toolName,
            toolCallId,
            args,
            source: tool?.source ?? 'unknown',
            isError: toolResult.isError === true,
            resultText: toolResult.text,
          });

          toolConversation.push({
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: {
                name: toolName,
                arguments: JSON.stringify(args),
              },
            }],
          });
          toolConversation.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: buildToolMessageContent(toolResult),
          });
        }

        if (!finalResponse) {
          throw new Error(`Tool calling exhausted its ${maxToolCalls} call budget without producing a final answer.`);
        }
        response = finalResponse;
      } else {
        response = toolLoopEnabled
          ? await this.runWithToolLoop({
            messages,
            model,
            provider,
            temperature,
            maxTokens,
            stageKey: model ? undefined : stageKey,
            taskFamily,
            providerContext,
            route,
            availableTools,
            toolContext,
            // Legacy tool loop: when LMSTUDIO_LEGACY_TOOLS=true, every
            // round-trip (including re-prompts for invalid JSON / schema errors)
            // counts against the budget, so allow 4x headroom.
            maxToolCalls: useLegacyLmStudioLoop
              ? Math.max(effectiveToolCallBudget * 4, 200)
              : effectiveToolCallBudget,
            displayBudget: effectiveToolCallBudget,
          })
          : await this._gateway.chat({
            messages,
            model,
            provider,
            temperature,
            maxTokens,
            responseFormat,
            stageKey: model ? undefined : stageKey,
            taskFamily,
            providerContext,
          });
      }
    } catch (error) {
      if (traceId) {
        const message = error instanceof Error ? error.message : String(error);
        const providerMetadata = error instanceof Error
          ? (error as Error & { providerMetadata?: import('../llm/gateway.js').ProviderMetadata }).providerMetadata
          : undefined;
        const traceProviderMetadata = providerMetadata ?? lastProviderMetadata;
        // Recover tool events from runWithToolLoop errors so they appear in the trace
        const legacyToolEvents = error instanceof Error
          ? (error as Error & { toolEvents?: LegacyToolExecutionResult[] }).toolEvents ?? []
          : [];
        const recoveredToolCalls: ToolCallTrace[] = legacyToolEvents.map((event) => ({
          toolName: event.tool.name,
          args: event.args ?? {},
          source: event.source ?? 'unknown',
          isError: event.isError === true,
          resultText: event.output ?? '',
        }));
        const allToolCalls = [...toolCalls, ...recoveredToolCalls];
        const failedTraceMetadata = availableTools.length > 0 || allToolCalls.length > 0
          ? {
            ...(availableTools.length > 0
              ? { availableTools: availableTools.map((tool) => tool.manifest.name) }
              : {}),
            ...(params.toolCalling?.enabled === true
                ? {
                  toolCallCount: allToolCalls.length,
                  toolCallBudget: effectiveToolCallBudget,
                }
              : {}),
            ...(allToolCalls.length > 0 ? { toolCalls: allToolCalls } : {}),
          }
          : null;
        params.trace?.repo.failLlmTrace(traceId, {
          provider: lastProviderId ?? route.providerId ?? provider ?? null,
          model: lastModelId ?? model ?? route.model ?? null,
          errorMessage: message,
          latencyMs: Date.now() - requestStartedAt,
          metadata: failedTraceMetadata,
          providerMode: traceProviderMetadata?.providerMode ?? null,
          providerSessionId: traceProviderMetadata?.providerSessionId ?? null,
          workingDirectory: traceProviderMetadata?.workingDirectory ?? null,
          incrementalPrompt: traceProviderMetadata?.incrementalPrompt ?? null,
          providerRequest: traceProviderMetadata?.requestEnvelope,
          providerResponse: traceProviderMetadata?.responseEnvelope,
        });
      }
      if (traceId && error instanceof Error) {
        const tracedError = error as Error & { traceId?: string; traceUrl?: string };
        if (!tracedError.traceId) {
          tracedError.traceId = traceId;
        }
        if (!tracedError.traceUrl) {
          tracedError.traceUrl = `/traces/${traceId}`;
        }
      }
      throw error;
    }

    // 8. Separate thinking tokens from output (Qwen, DeepSeek, etc.)
    //    Then unwrap any lingering JSON envelope (e.g. copilot-cli bypasses the
    //    tool-loop parser but the LLM still follows the envelope instructions).
    const { thinking, output: rawContent } = separateThinking(response.content);
    const cleanContent = unwrapFinalEnvelope(rawContent);
    if (traceId) {
      const providerToolCalls = extractProviderToolCalls(response.providerMetadata);
      const metadata = availableTools.length > 0 || toolCalls.length > 0 || providerToolCalls.length > 0
        ? {
          ...(availableTools.length > 0
            ? { availableTools: availableTools.map((tool) => tool.manifest.name) }
            : {}),
          ...(params.toolCalling?.enabled === true
              ? {
                toolCallCount: toolCalls.length + providerToolCalls.length,
                toolCallBudget: effectiveToolCallBudget,
              }
            : {}),
          ...((toolCalls.length > 0 || providerToolCalls.length > 0)
            ? { toolCalls: [...toolCalls, ...providerToolCalls] }
            : {}),
        }
        : null;
      params.trace?.repo.completeLlmTrace(traceId, {
        provider: response.provider,
        model: response.model,
        outputText: cleanContent,
        thinkingText: thinking,
        finishReason: response.finishReason ?? null,
        promptTokens: response.usage?.promptTokens ?? null,
        completionTokens: response.usage?.completionTokens ?? null,
        totalTokens: response.usage?.totalTokens ?? null,
        latencyMs: Date.now() - requestStartedAt,
        metadata,
        providerMode: response.providerMetadata?.providerMode ?? null,
        providerSessionId: response.providerMetadata?.providerSessionId ?? null,
        workingDirectory: response.providerMetadata?.workingDirectory ?? null,
        incrementalPrompt: response.providerMetadata?.incrementalPrompt ?? null,
        providerRequest: response.providerMetadata?.requestEnvelope,
        providerResponse: response.providerMetadata?.responseEnvelope,
      });
    }

    // 8b. [DEPRECATED] Relevance boost — dormant because memories is always [].
    //     Kept in place so the logic is ready when memory injection is re-enabled.
    for (const mem of memories) {
      this.memory.touch(mem.id);
    }

    // 9. Return result — thinking stored separately so callers can save it as a debug artifact.
    // Generic model outputs are too noisy to auto-promote into reusable memory. Useful memories
    // should be stored explicitly by the calling surface with a deliberate category and format.
    return {
      content: cleanContent,
      thinking,
      model: response.model,
      provider: response.provider,
      agentName,
      memoriesUsed: memories.length,
      tokensUsed: response.usage
        ? { prompt: response.usage.promptTokens, completion: response.usage.completionTokens, cached: response.usage.cachedTokens }
        : undefined,
      traceId: traceId ?? undefined,
    };
  }
}
