/**
 * AgentRunner — loads agent charters/skills, injects memories, calls LLM Gateway.
 *
 * Charters are markdown files in chartersDir with ## sections.
 * Skills are markdown files in skillsDir with YAML frontmatter.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { LLMGateway, type ChatMessage } from '../llm/gateway.js';
import { AgentMemory, type MemoryEntry } from './memory.js';
import type { Repository } from '../db/repository.js';

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

interface PromptTracePart {
  channel: 'system' | 'user';
  kind: string;
  label: string;
  content: string;
  metadata?: Record<string, unknown>;
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

  constructor(options: {
    gateway: LLMGateway;
    memory: AgentMemory;
    chartersDir: string;
    skillsDir: string;
  }) {
    this._gateway = options.gateway;
    this.memory = options.memory;
    this.chartersDir = options.chartersDir;
    this.skillsDir = options.skillsDir;
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

  /** Compose a system prompt from charter sections, skills, memories, and optional roster. */
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

    // Memories
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

  /** Main execution method — orchestrates charter, skills, memory, and LLM call. */
  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const {
      agentName,
      task,
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

    // 3. Recall relevant memories
    const memories = this.memory.recall(agentName, { limit: 10 });

    // 4. Compose system prompt
    const systemParts = this.buildSystemPromptParts(charter, skills, memories, params.rosterContext);
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
    const model = charter.model && charter.model !== 'auto' ? charter.model : undefined;
    const stageKey = AGENT_STAGE_KEY[agentName];
    const taskFamily = model || stageKey ? undefined : 'deep_reasoning';
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
    });
    const requestStartedAt = Date.now();
    let response;
    try {
      response = await this._gateway.chat({
        messages,
        model,
        temperature,
        maxTokens,
        responseFormat,
        stageKey: model ? undefined : stageKey,
        taskFamily,
      });
    } catch (error) {
      if (traceId) {
        const message = error instanceof Error ? error.message : String(error);
        params.trace?.repo.failLlmTrace(traceId, {
          model: model ?? null,
          errorMessage: message,
          latencyMs: Date.now() - requestStartedAt,
        });
      }
      throw error;
    }

    // 8. Separate thinking tokens from output (Qwen, DeepSeek, etc.)
    const { thinking, output: cleanContent } = separateThinking(response.content);
    if (traceId) {
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
      });
    }

    // 8b. Boost relevance of memories that were used in this successful run
    for (const mem of memories) {
      this.memory.touch(mem.id);
    }

    // 9. Store learning memory — extract a meaningful summary from the output
    const outputPreview = cleanContent.replace(/^#+\s.*/gm, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (outputPreview.length > 20) {
      const context = articleContext
        ? `[${articleContext.slug}] `
        : '';
      this.memory.store({
        agentName,
        category: 'learning',
        content: `${context}${outputPreview}`,
        relevanceScore: 0.6,
      });
    }

    // 10. Return result — thinking stored separately so callers can save it as a debug artifact
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
