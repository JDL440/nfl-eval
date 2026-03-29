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
import { LLMGateway, type ChatMessage } from '../llm/gateway.js';
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
  tokensUsed?: { prompt: number; completion: number };
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
          args: {},
          source: typeof record['source'] === 'string' ? record['source'] : 'provider',
          isError: record['isError'] === true,
          resultText: '',
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

  private async buildToolLoopPromptPart(): Promise<PromptTracePart | null> {
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
        `You may ask for up to ${this.maxToolCalls} tool calls.`,
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
        maxToolCalls: this.maxToolCalls,
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
          maxToolCalls: this.maxToolCalls,
          toolNames: toolEvents.map((event) => event.tool.name),
        },
      },
      responseEnvelope: {
        ...(existingResponse && typeof existingResponse === 'object' ? existingResponse as Record<string, unknown> : {}),
        toolLoop: {
          calls: toolEvents.map((event) => ({
            toolName: event.tool.name,
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
  }): Promise<import('../llm/gateway.js').ChatResponse> {
    const messages = [...params.messages];
    const toolEvents: LegacyToolExecutionResult[] = [];
    const toolResultCache = new Map<string, LegacyToolExecutionResult>();
    let aggregatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finalResponse: import('../llm/gateway.js').ChatResponse | null = null;

    for (let attempt = 0; attempt <= this.maxToolCalls; attempt += 1) {
      const response = await this._gateway.chat({
        messages,
        model: params.model,
        provider: params.provider,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        responseFormat: 'json',
        stageKey: params.stageKey,
        taskFamily: params.taskFamily,
        providerContext: params.providerContext,
      });

      aggregatedUsage = {
        promptTokens: aggregatedUsage.promptTokens + (response.usage?.promptTokens ?? 0),
        completionTokens: aggregatedUsage.completionTokens + (response.usage?.completionTokens ?? 0),
        totalTokens: aggregatedUsage.totalTokens + (response.usage?.totalTokens ?? 0),
      };

      let raw: unknown;
      try {
        raw = JSON.parse(response.content);
      } catch {
        throw new Error(`Tool loop response was not valid JSON: ${response.content.slice(0, 200)}`);
      }
      const parsed = ToolLoopTurnSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`Tool loop response did not match the required JSON contract: ${parsed.error.message}`);
      }

      if (parsed.data.type === 'final') {
        finalResponse = {
          ...response,
          content: parsed.data.content,
        };
        break;
      }

      if (attempt >= this.maxToolCalls) {
        throw new Error(`Tool loop exceeded the max of ${this.maxToolCalls} tool calls without a final answer.`);
      }

      const toolCall = parsed.data;
      const normalizedArgs = normalizeToolCallArgs(toolCall.args);
      const cacheKey = stableToolCallKey(toolCall.toolName, normalizedArgs);
      const toolResult = toolResultCache.has(cacheKey)
        ? toolResultCache.get(cacheKey)!
        : await (async () => {
          try {
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
      throw new Error('Tool loop ended without a final response.');
    }

    return {
      ...finalResponse,
      usage: aggregatedUsage.totalTokens > 0 ? aggregatedUsage : undefined,
      providerMetadata: this.mergeToolLoopMetadata(finalResponse.providerMetadata, toolEvents, params.route),
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
    const toolLoopEnabled = params.toolCalling?.enabled === true
      ? false
      : this.shouldUseToolLoop(route.providerId, responseFormat);
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
      const toolLoopPart = await this.buildToolLoopPromptPart();
      if (toolLoopPart) {
        systemParts.push(toolLoopPart);
      }
    }
    const useNativeLmstudioTools = params.toolCalling?.enabled === true && route.providerId === 'lmstudio';
    if (availableTools.length > 0 && !useNativeLmstudioTools) {
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
      if (availableTools.length > 0 && responseFormat !== 'json' && route.providerId !== 'copilot-cli') {
        const toolConversation: ChatMessage[] = [...messages];
        const seenCalls = new Set<string>();
        const priorToolResults = new Map<string, StructuredToolExecutionResult>();
        const maxToolCalls = Math.max(1, params.toolCalling?.maxToolCalls ?? 4);
        let aggregatedUsage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        } | undefined;
        let finalResponse: import('../llm/gateway.js').ChatResponse | undefined;

        for (let attempt = 0; attempt < maxToolCalls; attempt += 1) {
          const structured = await this._gateway.chatStructuredWithResponse(
            {
              messages: toolConversation,
              tools: route.providerId === 'lmstudio' ? buildNativeToolDefinitions(availableTools) : undefined,
              provider,
              model,
              temperature,
              maxTokens,
              stageKey: model ? undefined : stageKey,
              taskFamily,
              disallowedProviderIds: ['copilot-cli'],
              providerContext,
            },
            TOOL_LOOP_RESPONSE_SCHEMA,
          );
          lastProviderMetadata = structured.response.providerMetadata;
          lastProviderId = structured.response.provider;
          lastModelId = structured.response.model;

          if (structured.response.usage) {
            aggregatedUsage = aggregatedUsage ?? {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            };
            aggregatedUsage.promptTokens += structured.response.usage.promptTokens;
            aggregatedUsage.completionTokens += structured.response.usage.completionTokens;
            aggregatedUsage.totalTokens += structured.response.usage.totalTokens;
          }

          if (structured.data.type === 'final') {
            finalResponse = {
              ...structured.response,
              content: structured.data.content ?? '',
              usage: aggregatedUsage ?? structured.response.usage,
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
        const failedTraceMetadata = availableTools.length > 0 || toolCalls.length > 0
          ? {
            ...(availableTools.length > 0
              ? { availableTools: availableTools.map((tool) => tool.manifest.name) }
              : {}),
            ...(params.toolCalling?.enabled === true
              ? {
                toolCallCount: toolCalls.length,
                toolCallBudget: Math.max(1, params.toolCalling?.maxToolCalls ?? 4),
              }
              : {}),
            ...(toolCalls.length > 0 ? { toolCalls } : {}),
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
      throw error;
    }

    // 8. Separate thinking tokens from output (Qwen, DeepSeek, etc.)
    const { thinking, output: cleanContent } = separateThinking(response.content);
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
              toolCallBudget: Math.max(1, params.toolCalling?.maxToolCalls ?? 4),
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
        ? { prompt: response.usage.promptTokens, completion: response.usage.completionTokens }
        : undefined,
      traceId: traceId ?? undefined,
    };
  }
}
