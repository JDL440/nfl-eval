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
}

export interface AgentRunResult {
  content: string;
  model: string;
  provider: string;
  agentName: string;
  memoriesUsed: number;
  tokensUsed?: { prompt: number; completion: number };
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
      case 'model':
        charter.model = body.trim() || undefined;
        break;
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
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
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

  /** Compose a system prompt from charter sections, skills, and memories. */
  composeSystemPrompt(
    charter: AgentCharter,
    skills: AgentSkill[],
    memories: MemoryEntry[],
  ): string {
    const parts: string[] = [];

    // Identity
    if (charter.identity) {
      parts.push(charter.identity);
    }

    // Responsibilities
    if (charter.responsibilities.length > 0) {
      parts.push(
        '## Responsibilities\n' +
          charter.responsibilities.map((r) => `- ${r}`).join('\n'),
      );
    }

    // Skills
    if (skills.length > 0) {
      const skillBlocks = skills.map(
        (s) => `### Skill: ${s.name}\n${s.content}`,
      );
      parts.push('## Skills\n' + skillBlocks.join('\n\n'));
    }

    // Memories
    if (memories.length > 0) {
      const memLines = memories.map((m) => `- [${m.category}] ${m.content}`);
      parts.push('## Relevant Context\n' + memLines.join('\n'));
    }

    // Boundaries
    if (charter.boundaries.length > 0) {
      parts.push(
        '## Boundaries\n' +
          charter.boundaries.map((b) => `- ${b}`).join('\n'),
      );
    }

    return parts.join('\n\n');
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
    const systemPrompt = this.composeSystemPrompt(charter, skills, memories);

    // 5. Build user message
    let userMessage = task;
    if (articleContext) {
      const contextParts = [
        `Article: ${articleContext.title} (${articleContext.slug})`,
        `Stage: ${articleContext.stage}`,
      ];
      if (articleContext.content) {
        contextParts.push(`\n---\n${articleContext.content}\n---`);
      }
      userMessage = contextParts.join('\n') + '\n\n' + task;
    }

    // 6. Build messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    // 7. Call LLM Gateway
    const model = charter.model && charter.model !== 'auto' ? charter.model : undefined;
    const response = await this._gateway.chat({
      messages,
      model,
      temperature,
      maxTokens,
      responseFormat,
      taskFamily: model ? undefined : 'balanced',
    });

    // 8. Store learning memory
    const learningContent = articleContext
      ? `Completed ${task.slice(0, 80)} for "${articleContext.title}" (${articleContext.slug})`
      : `Completed ${task.slice(0, 120)}`;

    this.memory.store({
      agentName,
      category: 'learning',
      content: learningContent,
      relevanceScore: 0.8,
    });

    // 9. Return result
    return {
      content: response.content,
      model: response.model,
      provider: response.provider,
      agentName,
      memoriesUsed: memories.length,
      tokensUsed: response.usage
        ? { prompt: response.usage.promptTokens, completion: response.usage.completionTokens }
        : undefined,
    };
  }
}
