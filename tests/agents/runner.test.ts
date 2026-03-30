import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AgentRunner,
  normalizeToolLoopResponse,
  type AgentCharter,
  type AgentSkill,
  type AgentRunParams,
} from '../../src/agents/runner.js';
import { AgentMemory, type MemoryEntry } from '../../src/agents/memory.js';
import { Repository } from '../../src/db/repository.js';
import {
  LLMGateway,
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
} from '../../src/llm/gateway.js';
import { StubProvider } from '../../src/llm/providers/stub.js';
import { LMStudioProvider } from '../../src/llm/providers/lmstudio.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadPolicy(): ModelPolicy {
  return new ModelPolicy(
    join(process.cwd(), 'src', 'config', 'defaults', 'models.json'),
  );
}

const WRITER_CHARTER = `# Writer

## Identity
The Writer creates compelling analytical articles about the NFL.

## Responsibilities
- Write clear, engaging prose
- Maintain factual accuracy
- Use data-driven insights

## Knowledge
- AP style guide
- NFL terminology

## Boundaries
- Never fabricate quotes
- Never speculate on injuries

## Model
auto
`;

const EDITOR_CHARTER = `# Editor

## Identity
The Editor reviews and improves article drafts.

## Responsibilities
- Check grammar and style
- Verify factual claims

## Knowledge
- Chicago Manual of Style

## Boundaries
- Do not rewrite entire sections
`;

const SUBSTACK_SKILL = `---
name: substack-article
description: How to write a Substack article
domain: writing
confidence: 0.9
tools: [prosemirror, substack]
---

# Writing for Substack

When writing articles for Substack, use clear headings and keep paragraphs short.
Aim for a conversational tone that draws readers in.
`;

const DATA_VIZ_SKILL = `---
name: data-visualization
description: Guidelines for presenting data
domain: analytics
confidence: 0.85
tools: [charts]
---

# Data Visualization

Present statistics with context. Always cite the source and time period.
`;

function createTempFixtures() {
  const tempDir = mkdtempSync(join(tmpdir(), 'nfl-lab-runner-test-'));
  const chartersDir = join(tempDir, 'charters');
  const skillsDir = join(tempDir, 'skills');
  const dbPath = join(tempDir, 'test-memory.db');

  mkdirSync(chartersDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });

  // Write charter files
  writeFileSync(join(chartersDir, 'writer.md'), WRITER_CHARTER);
  writeFileSync(join(chartersDir, 'editor.md'), EDITOR_CHARTER);

  // Write skill files
  writeFileSync(join(skillsDir, 'substack-article.md'), SUBSTACK_SKILL);
  writeFileSync(join(skillsDir, 'data-visualization.md'), DATA_VIZ_SKILL);

  return { tempDir, chartersDir, skillsDir, dbPath };
}

class CopilotCliUsageProvider implements LLMProvider {
  readonly id = 'copilot-cli';
  readonly name = 'GitHub Copilot CLI';

  chat(request: ChatRequest): Promise<ChatResponse> {
    return Promise.resolve({
      content: 'Estimated usage response',
      model: request.model ?? 'gpt-5.4',
      provider: this.id,
      usage: {
        promptTokens: 321,
        completionTokens: 123,
        totalTokens: 444,
      },
      finishReason: 'stop',
    });
  }

  listModels(): string[] {
    return ['gpt-5.4', 'gpt-5-mini'];
  }

  supportsModel(model: string): boolean {
    return model.startsWith('gpt-5');
  }
}

class ToolLoopProvider implements LLMProvider {
  readonly id = 'tool-loop';
  readonly name = 'Tool Loop Provider';
  readonly requests: ChatRequest[] = [];
  private callCount = 0;

  constructor(
    private readonly formatResponse?: (content: string, callCount: number) => string,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    this.callCount += 1;
    if (request.responseFormat === 'json') {
      const wrap = (content: string): string => this.formatResponse
        ? this.formatResponse(content, this.callCount)
        : content;
      if (this.callCount === 1) {
        return {
          content: wrap(JSON.stringify({
            type: 'tool_call',
            toolName: 'article_get',
            args: { article_id: 'trace-article' },
          })),
          model: request.model ?? 'gpt-5.4',
          provider: this.id,
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
        };
      }
      return {
        content: wrap(JSON.stringify({
          type: 'final',
          content: 'Tool-assisted final answer',
        })),
        model: request.model ?? 'gpt-5.4',
        provider: this.id,
        usage: { promptTokens: 7, completionTokens: 3, totalTokens: 10 },
        finishReason: 'stop',
      };
    }

    return {
      content: 'Fallback text response',
      model: request.model ?? 'gpt-5.4',
      provider: this.id,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    };
  }

  listModels(): string[] {
    return ['gpt-5.4', 'gpt-5-mini'];
  }

  supportsModel(model: string): boolean {
    return model.startsWith('gpt-5');
  }
}

class EndlessToolProvider implements LLMProvider {
  readonly id = 'tool-loop';
  readonly name = 'Endless Tool Provider';
  readonly requests: ChatRequest[] = [];

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    if (request.responseFormat === 'json') {
      return {
        content: JSON.stringify({
          type: 'tool_call',
          toolName: 'article_get',
          args: { article_id: 'trace-article' },
        }),
        model: request.model ?? 'gpt-5.4',
        provider: this.id,
        usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
        finishReason: 'stop',
        providerMetadata: {
          requestEnvelope: {
            endpoint: 'http://localhost:1234/v1/chat/completions',
            body: {
              model: request.model ?? 'gpt-5.4',
              response_format: request.responseSchema ?? null,
            },
          },
          responseEnvelope: {
            id: 'chatcmpl-endless',
            choices: [{
              message: {
                content: JSON.stringify({
                  type: 'tool_call',
                  toolName: 'article_get',
                  args: { article_id: 'trace-article' },
                }),
              },
            }],
          },
        },
      };
    }
    return {
      content: 'Fallback text response',
      model: request.model ?? 'gpt-5.4',
      provider: this.id,
      finishReason: 'stop',
    };
  }

  listModels(): string[] {
    return ['gpt-5.4'];
  }

  supportsModel(model: string): boolean {
    return model.startsWith('gpt-5');
  }
}

class LegacyLmStudioLoopProvider implements LLMProvider {
  readonly id = 'lmstudio';
  readonly name = 'LM Studio';
  readonly requests: ChatRequest[] = [];
  sawToolResult = false;
  private callCount = 0;

  constructor(private readonly toolCallsBeforeFinal: number) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    if (request.messages.some((message) => typeof message.content === 'string' && message.content.includes('Trace Article'))) {
      this.sawToolResult = true;
    }
    this.callCount += 1;

    if (request.responseFormat === 'json') {
      if (this.callCount <= this.toolCallsBeforeFinal) {
        return {
          content: JSON.stringify({
            type: 'tool_call',
            toolName: 'article_get',
            args: { article_id: 'trace-article' },
          }),
          model: request.model ?? 'qwen/qwen3.5-35b-a3b',
          provider: this.id,
          usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
          finishReason: 'stop',
        };
      }

      return {
        content: JSON.stringify({
          type: 'final',
          content: this.sawToolResult ? 'Used article_get successfully' : 'Missing tool result',
        }),
        model: request.model ?? 'qwen/qwen3.5-35b-a3b',
        provider: this.id,
        usage: { promptTokens: 6, completionTokens: 3, totalTokens: 9 },
        finishReason: 'stop',
      };
    }

    return {
      content: 'Fallback text response',
      model: request.model ?? 'qwen/qwen3.5-35b-a3b',
      provider: this.id,
      finishReason: 'stop',
    };
  }

  listModels(): string[] {
    return ['qwen/qwen3.5-35b-a3b'];
  }

  supportsModel(model: string): boolean {
    return model.includes('qwen');
  }
}

class TracingCopilotProvider implements LLMProvider {
  readonly id = 'copilot-cli';
  readonly name = 'GitHub Copilot CLI';

  chat(request: ChatRequest): Promise<ChatResponse> {
    return Promise.resolve({
      content: 'Tracing response',
      model: request.model ?? 'gpt-5.4',
      provider: this.id,
      finishReason: 'stop',
      providerMetadata: {
        providerMode: 'one-shot',
        providerSessionId: null,
        workingDirectory: 'C:\\github\\worktrees\\copilot-session-reuse',
        incrementalPrompt: 'Provider delta',
        requestEnvelope: {
          sessionReuseRequested: true,
          providerContext: request.providerContext,
        },
        responseEnvelope: {
          stdout: 'Tracing response',
        },
      },
    });
  }

  listModels(): string[] {
    return ['gpt-5.4'];
  }

  supportsModel(model: string): boolean {
    return model.startsWith('gpt-5');
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

  describe('AgentRunner', () => {
  let tempDir: string;
  let chartersDir: string;
  let skillsDir: string;
  let dbPath: string;
  let pipelineDbPath: string;
  let memory: AgentMemory;
  let gateway: LLMGateway;
  let runner: AgentRunner;

  beforeEach(() => {
    const fixtures = createTempFixtures();
    tempDir = fixtures.tempDir;
    chartersDir = fixtures.chartersDir;
    skillsDir = fixtures.skillsDir;
    dbPath = fixtures.dbPath;
    pipelineDbPath = join(tempDir, 'pipeline.db');

    memory = new AgentMemory(dbPath);
    const policy = loadPolicy();
    gateway = new LLMGateway({
      modelPolicy: policy,
      providers: [new StubProvider()],
    });
    runner = new AgentRunner({ gateway, memory, chartersDir, skillsDir });
  });

  it('disables the legacy tool loop when explicit toolCalling is enabled', async () => {
    const provider = new ToolLoopProvider();
    const gateway = new LLMGateway({
      modelPolicy: loadPolicy(),
      providers: [provider],
    });
    const runnerWithLegacyLoop = new AgentRunner({
      gateway,
      memory,
      chartersDir,
      skillsDir,
      toolLoop: {
        enabledProviders: ['tool-loop'],
        maxToolCalls: 3,
      },
    });

    const result = await runnerWithLegacyLoop.run({
      agentName: 'writer',
      provider: 'tool-loop',
      task: 'Say hello',
      toolCalling: {
        enabled: true,
        includeLocalExtensions: true,
        requestedTools: ['non-existent-tool'],
        allowWriteTools: false,
        context: {
          surface: 'ideaGeneration',
          agentName: 'writer',
        },
      },
    });

    expect(result.content).toBe('Fallback text response');
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.responseFormat).toBeUndefined();
  });

  it('records available tools and tool calls on failed traced runs', async () => {
    const provider = new EndlessToolProvider();
    const gateway = new LLMGateway({
      modelPolicy: loadPolicy(),
      providers: [provider],
    });
    const runnerWithTracing = new AgentRunner({
      gateway,
      memory,
      chartersDir,
      skillsDir,
    });

    const repo = new Repository(pipelineDbPath);
    repo.createArticle({ id: 'trace-article', title: 'Trace Article' });

    await expect(runnerWithTracing.run({
      agentName: 'writer',
      provider: 'tool-loop',
      task: 'Use tools forever',
      trace: {
        repo,
        articleId: 'trace-article',
        stage: 1,
        surface: 'ideaGeneration',
      },
      toolCalling: {
        enabled: true,
        includePipelineTools: true,
        requestedTools: ['article_get'],
        allowWriteTools: false,
        maxToolCalls: 2,
        context: {
          repo,
          stage: 1,
          surface: 'ideaGeneration',
          agentName: 'writer',
        },
      },
    })).rejects.toThrow('Tool calling exhausted its 2 call budget');

    const traces = repo.getArticleLlmTraces('trace-article', 0);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.status).toBe('failed');
    const metadata = JSON.parse(traces[0]?.metadata_json ?? '{}');
    expect(metadata.availableTools).toContain('article_get');
    expect(metadata.toolCalls).toHaveLength(2);
    expect(metadata.toolCallCount).toBe(2);
    expect(metadata.toolCallBudget).toBe(2);
    expect(traces[0]?.provider_request_json).toContain('response_format');
    expect(traces[0]?.provider_response_json).toContain('article_get');

    repo.close();
  });

  it('uses the per-run max tool budget for LM Studio manual tool loops', async () => {
    const provider = new LegacyLmStudioLoopProvider(5);
    const gateway = new LLMGateway({
      modelPolicy: loadPolicy(),
      providers: [provider],
    });
    const legacyLmStudioRunner = new AgentRunner({
      gateway,
      memory,
      chartersDir,
      skillsDir,
      toolLoop: {
        enabledProviders: ['lmstudio'],
        maxToolCalls: 3,
      },
    });

    const repo = new Repository(pipelineDbPath);
    repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
    const engine = {
      validateArticle: () => ({ valid: true }),
      getAvailableActions: () => [],
    };

    const result = await legacyLmStudioRunner.run({
      agentName: 'writer',
      provider: 'lmstudio',
      task: 'Use article_get until you can answer.',
      toolCalling: {
        enabled: true,
        includePipelineTools: true,
        requestedTools: ['article_get'],
        allowWriteTools: false,
        maxToolCalls: 5,
        context: {
          repo,
          engine: engine as any,
          stage: 1,
          surface: 'ideaGeneration',
          agentName: 'writer',
        },
      },
    });

    expect(result.content).toBe('Used article_get successfully');
    expect(provider.requests).toHaveLength(6);
    expect(provider.sawToolResult).toBe(true);
    expect(provider.requests[0]?.messages[0]?.content).toContain('You may ask for up to 5 tool calls.');

    repo.close();
  });

  it('reports the requested LM Studio manual tool budget when the loop exhausts', async () => {
    const provider = new LegacyLmStudioLoopProvider(6);
    const gateway = new LLMGateway({
      modelPolicy: loadPolicy(),
      providers: [provider],
    });
    const legacyLmStudioRunner = new AgentRunner({
      gateway,
      memory,
      chartersDir,
      skillsDir,
      toolLoop: {
        enabledProviders: ['lmstudio'],
        maxToolCalls: 3,
      },
    });

    const repo = new Repository(pipelineDbPath);
    repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
    const engine = {
      validateArticle: () => ({ valid: true }),
      getAvailableActions: () => [],
    };

    await expect(legacyLmStudioRunner.run({
      agentName: 'writer',
      provider: 'lmstudio',
      task: 'Use article_get forever.',
      toolCalling: {
        enabled: true,
        includePipelineTools: true,
        requestedTools: ['article_get'],
        allowWriteTools: false,
        maxToolCalls: 5,
        context: {
          repo,
          engine: engine as any,
          stage: 1,
          surface: 'ideaGeneration',
          agentName: 'writer',
        },
      },
    })).rejects.toThrow('Tool loop exceeded the max of 5 tool calls without a final answer.');

    expect(provider.requests[0]?.messages[0]?.content).toContain('You may ask for up to 5 tool calls.');

    repo.close();
  });

  afterEach(() => {
    memory.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Charter Loading ─────────────────────────────────────────────────────

  describe('loadCharter', () => {
    it('loads a charter from a markdown file', () => {
      const charter = runner.loadCharter('writer');
      expect(charter).not.toBeNull();
      expect(charter!.name).toBe('Writer');
      expect(charter!.identity).toContain('compelling analytical articles');
      expect(charter!.responsibilities).toHaveLength(3);
      expect(charter!.responsibilities[0]).toBe('Write clear, engaging prose');
      expect(charter!.knowledge).toEqual(['AP style guide', 'NFL terminology']);
      expect(charter!.boundaries).toHaveLength(2);
      expect(charter!.boundaries).toContain('Never fabricate quotes');
      expect(charter!.model).toBe('auto');
    });

    it('loads charter without a model section', () => {
      const charter = runner.loadCharter('editor');
      expect(charter).not.toBeNull();
      expect(charter!.name).toBe('Editor');
      expect(charter!.model).toBeUndefined();
    });

    it('loads charter from subdirectory (charter.md)', () => {
      const subDir = join(chartersDir, 'analyst-seahawks');
      mkdirSync(subDir, { recursive: true });
      writeFileSync(
        join(subDir, 'charter.md'),
        '# Seahawks Analyst\n\n## Identity\nAnalyze Seahawks performance.\n',
      );

      const charter = runner.loadCharter('analyst-seahawks');
      expect(charter).not.toBeNull();
      expect(charter!.name).toBe('Seahawks Analyst');
      expect(charter!.identity).toBe('Analyze Seahawks performance.');
    });

    it('returns null for missing charter', () => {
      const charter = runner.loadCharter('nonexistent-agent');
      expect(charter).toBeNull();
    });
  });

  // ── Skill Loading ───────────────────────────────────────────────────────

  describe('loadSkill', () => {
    it('loads a skill from a markdown file with YAML frontmatter', () => {
      const skill = runner.loadSkill('substack-article');
      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('substack-article');
      expect(skill!.description).toBe('How to write a Substack article');
      expect(skill!.domain).toBe('writing');
      expect(skill!.confidence).toBe(0.9);
      expect(skill!.tools).toEqual(['prosemirror', 'substack']);
      expect(skill!.content).toContain('Writing for Substack');
      expect(skill!.content).toContain('conversational tone');
    });

    it('parses skill confidence as a number', () => {
      const skill = runner.loadSkill('data-visualization');
      expect(skill).not.toBeNull();
      expect(skill!.confidence).toBe(0.85);
    });

    it('returns null for missing skill', () => {
      const skill = runner.loadSkill('nonexistent-skill');
      expect(skill).toBeNull();
    });
  });

  // ── Listing ─────────────────────────────────────────────────────────────

  describe('listAgents', () => {
    it('scans charters directory for agent names', () => {
      const agents = runner.listAgents();
      expect(agents).toContain('writer');
      expect(agents).toContain('editor');
      expect(agents.length).toBeGreaterThanOrEqual(2);
    });

    it('includes agents from subdirectories with charter.md', () => {
      const subDir = join(chartersDir, 'scout');
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, 'charter.md'), '# Scout\n\n## Identity\nScout players.\n');

      const agents = runner.listAgents();
      expect(agents).toContain('scout');
    });

    it('returns empty array if charters dir does not exist', () => {
      const emptyRunner = new AgentRunner({
        gateway,
        memory,
        chartersDir: join(tempDir, 'no-such-dir'),
        skillsDir,
      });
      expect(emptyRunner.listAgents()).toEqual([]);
    });

    it('returns sorted agent names', () => {
      const agents = runner.listAgents();
      const sorted = [...agents].sort();
      expect(agents).toEqual(sorted);
    });
  });

  describe('listSkills', () => {
    it('scans skills directory for skill names', () => {
      const skills = runner.listSkills();
      expect(skills).toContain('substack-article');
      expect(skills).toContain('data-visualization');
      expect(skills).toHaveLength(2);
    });

    it('returns empty array if skills dir does not exist', () => {
      const emptyRunner = new AgentRunner({
        gateway,
        memory,
        chartersDir,
        skillsDir: join(tempDir, 'no-such-dir'),
      });
      expect(emptyRunner.listSkills()).toEqual([]);
    });
  });

  // ── System Prompt Composition ───────────────────────────────────────────

  describe('composeSystemPrompt', () => {
    // NOTE: composeSystemPrompt still accepts and renders memories when passed directly
    // (e.g. for testing). The injection path is disabled in run(); these tests document
    // the dormant capability that a future redesign can restore.
    it('composes system prompt from charter, skills, and memories', () => {
      const charter: AgentCharter = {
        name: 'Writer',
        identity: 'The Writer creates articles.',
        responsibilities: ['Write prose', 'Use data'],
        knowledge: ['AP style'],
        boundaries: ['No fabrication'],
      };

      const skills: AgentSkill[] = [
        {
          name: 'substack-article',
          description: 'Substack writing',
          domain: 'writing',
          confidence: 0.9,
          tools: ['prosemirror'],
          content: 'Use clear headings.',
        },
      ];

      const memories: MemoryEntry[] = [
        {
          id: 1,
          agentName: 'writer',
          category: 'learning',
          content: 'EPA per play is key metric',
          sourceSession: null,
          createdAt: '2024-01-01',
          expiresAt: null,
          relevanceScore: 1.0,
          accessCount: 0,
        },
      ];

      const prompt = runner.composeSystemPrompt(charter, skills, memories);

      // Charter identity
      expect(prompt).toContain('The Writer creates articles.');
      // Responsibilities
      expect(prompt).toContain('## Responsibilities');
      expect(prompt).toContain('- Write prose');
      expect(prompt).toContain('- Use data');
      // Skills
      expect(prompt).toContain('## Skills');
      expect(prompt).toContain('### Skill: substack-article');
      expect(prompt).toContain('Use clear headings.');
      // Memories
      expect(prompt).toContain('## Relevant Context');
      expect(prompt).toContain('[learning] EPA per play is key metric');
      // Boundaries
      expect(prompt).toContain('## Boundaries');
      expect(prompt).toContain('- No fabrication');
    });

    it('omits empty sections gracefully', () => {
      const charter: AgentCharter = {
        name: 'Minimal',
        identity: 'Minimal agent.',
        responsibilities: [],
        knowledge: [],
        boundaries: [],
      };

      const prompt = runner.composeSystemPrompt(charter, [], []);
      expect(prompt).toBe('Minimal agent.');
      expect(prompt).not.toContain('## Responsibilities');
      expect(prompt).not.toContain('## Skills');
      expect(prompt).not.toContain('## Relevant Context');
      expect(prompt).not.toContain('## Boundaries');
    });

    // NOTE: tests the dormant memory rendering order in composeSystemPrompt directly.
    // run() never produces this ordering at runtime; kept so the shape is verifiable.
    it('orders sections: identity, responsibilities, skills, memories, boundaries', () => {
      const charter: AgentCharter = {
        name: 'Test',
        identity: 'IDENTITY_MARKER',
        responsibilities: ['RESP_MARKER'],
        knowledge: [],
        boundaries: ['BOUND_MARKER'],
      };

      const skills: AgentSkill[] = [{
        name: 'test-skill',
        description: 'test',
        domain: 'test',
        confidence: 1,
        tools: [],
        content: 'SKILL_MARKER',
      }];

      const memories: MemoryEntry[] = [{
        id: 1, agentName: 'test', category: 'learning',
        content: 'MEMORY_MARKER', sourceSession: null,
        createdAt: '', expiresAt: null, relevanceScore: 1, accessCount: 0,
      }];

      const prompt = runner.composeSystemPrompt(charter, skills, memories);
      const idxIdentity = prompt.indexOf('IDENTITY_MARKER');
      const idxResp = prompt.indexOf('RESP_MARKER');
      const idxSkill = prompt.indexOf('SKILL_MARKER');
      const idxMem = prompt.indexOf('MEMORY_MARKER');
      const idxBound = prompt.indexOf('BOUND_MARKER');

      expect(idxIdentity).toBeLessThan(idxResp);
      expect(idxResp).toBeLessThan(idxSkill);
      expect(idxSkill).toBeLessThan(idxMem);
      expect(idxMem).toBeLessThan(idxBound);
    });

    it('includes roster context when provided', () => {
      const charter: AgentCharter = {
        name: 'Test',
        identity: 'Test agent.',
        responsibilities: [],
        knowledge: [],
        boundaries: ['No fabrication'],
      };

      const rosterCtx = '## Current SEA Roster\n- **Sam Darnold** (QB) — 96% snaps';
      const prompt = runner.composeSystemPrompt(charter, [], [], rosterCtx);

      expect(prompt).toContain('## Current Team Roster');
      expect(prompt).toContain('Sam Darnold');
      // Roster should come before boundaries
      const rosterIdx = prompt.indexOf('Current Team Roster');
      const boundIdx = prompt.indexOf('## Boundaries');
      expect(rosterIdx).toBeLessThan(boundIdx);
    });

    it('omits roster section when not provided', () => {
      const charter: AgentCharter = {
        name: 'Test',
        identity: 'Test agent.',
        responsibilities: [],
        knowledge: [],
        boundaries: [],
      };

      const prompt = runner.composeSystemPrompt(charter, [], []);
      expect(prompt).not.toContain('Current Team Roster');
    });
  });

  // ── Run Method ──────────────────────────────────────────────────────────

  describe('run', () => {
    it('integrates gateway and memory for a basic run', async () => {
      const result = await runner.run({
        agentName: 'writer',
        task: 'Write a short article about the Seahawks',
      });

      expect(result.agentName).toBe('writer');
      expect(result.content).toBeTruthy();
      expect(result.model).toBeTruthy();
      expect(result.provider).toBe('stub');
      expect(result.memoriesUsed).toBeGreaterThanOrEqual(0);
    });

    // DEPRECATED BEHAVIOR — memory injection is disabled; run() always passes [].
    // This test documents the dormant path: stored memories exist in the DB but are
    // not recalled or counted. Update to re-enable when injection is redesigned.
    it('does not inject stored memories at runtime (injection disabled)', async () => {
      // Seed a memory — it will be stored but not recalled/injected
      memory.store({
        agentName: 'writer',
        category: 'learning',
        content: 'Always mention EPA per play',
      });

      const result = await runner.run({
        agentName: 'writer',
        task: 'Write about QB efficiency',
      });

      // memoriesUsed is always 0 while injection is disabled
      expect(result.memoriesUsed).toBe(0);
    });

    // DEPRECATED BEHAVIOR — touch() is only called on actually-recalled memories.
    // Since injection is disabled, run() never calls touch(); access_count stays at 0.
    it('does not touch stored memories when injection is disabled', async () => {
      // Seed two memories — they will be stored but not recalled or touched
      memory.store({
        agentName: 'writer',
        category: 'learning',
        content: 'Use EPA per play metrics',
      });
      memory.store({
        agentName: 'writer',
        category: 'decision',
        content: 'Prefer advanced stats over box score',
      });

      const before = memory.recall('writer');
      expect(before).toHaveLength(2);
      const beforeCounts = before.map((m) => ({ id: m.id, accessCount: m.accessCount }));

      await runner.run({
        agentName: 'writer',
        task: 'Analyze passing efficiency',
      });

      // access_count must NOT have changed — no memories were injected or touched
      for (const bc of beforeCounts) {
        const after = memory.recall('writer').find((m) => m.id === bc.id);
        expect(after).toBeDefined();
        expect(after!.accessCount).toBe(bc.accessCount);
      }
    });

    // DEPRECATED BEHAVIOR — touch() is not called when injection is disabled.
    it('does not call touch() on stored memories (injection disabled)', async () => {
      memory.store({
        agentName: 'writer',
        category: 'learning',
        content: 'Always cite sources',
      });

      const touchSpy = vi.spyOn(memory, 'touch');

      await runner.run({
        agentName: 'writer',
        task: 'Write about rushing trends',
      });

      // touch() must not be called because no memories are recalled/injected
      expect(touchSpy).not.toHaveBeenCalled();
      touchSpy.mockRestore();
    });

    it('does not auto-store generic learning memories after successful run', async () => {
      const beforeCount = memory.recall('writer').length;

      await runner.run({
        agentName: 'writer',
        task: 'Analyze rushing efficiency',
      });

      const afterMemories = memory.recall('writer');
      expect(afterMemories).toHaveLength(beforeCount);
    });

    it('does not auto-store article-scoped outputs as learning memories', async () => {
      const beforeCount = memory.recall('writer').length;

      await runner.run({
        agentName: 'writer',
        task: 'Draft intro paragraph',
        articleContext: {
          slug: 'seahawks-draft-2025',
          title: 'Seahawks 2025 Draft Preview',
          stage: 5,
        },
      });

      const memories = memory.recall('writer');
      expect(memories).toHaveLength(beforeCount);
    });

    it('throws when charter is missing', async () => {
      await expect(
        runner.run({
          agentName: 'nonexistent-agent',
          task: 'Do something',
        }),
      ).rejects.toThrow('Agent charter not found: nonexistent-agent');
    });

    it('gracefully excludes missing skills', async () => {
      const result = await runner.run({
        agentName: 'writer',
        task: 'Write article',
        skills: ['substack-article', 'nonexistent-skill', 'data-visualization'],
      });

      // Should succeed — missing skill is just excluded
      expect(result.content).toBeTruthy();
      expect(result.agentName).toBe('writer');
    });

    it('includes article context in the user message', async () => {
      const stub = new StubProvider();
      const chatSpy = vi.spyOn(stub, 'chat');

      const spyGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [stub],
      });
      const spyRunner = new AgentRunner({
        gateway: spyGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      await spyRunner.run({
        agentName: 'writer',
        task: 'Write conclusion',
        articleContext: {
          slug: 'test-article',
          title: 'Test Article Title',
          stage: 5,
          content: 'Some article text here.',
        },
      });

      const request = chatSpy.mock.calls[0][0];
      const userMsg = request.messages.find((m) => m.role === 'user');
      expect(userMsg?.content).toContain('Test Article Title');
      expect(userMsg?.content).toContain('test-article');
      expect(userMsg?.content).toContain('Stage: 5');
      expect(userMsg?.content).toContain('Some article text here.');
      expect(userMsg?.content).toContain('Write conclusion');
    });

    it('passes temperature and maxTokens to the gateway', async () => {
      const stub = new StubProvider();
      const chatSpy = vi.spyOn(stub, 'chat');

      const spyGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [stub],
      });
      const spyRunner = new AgentRunner({
        gateway: spyGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      await spyRunner.run({
        agentName: 'writer',
        task: 'Write creatively',
        temperature: 0.9,
        maxTokens: 2000,
      });

      const request = chatSpy.mock.calls[0][0];
      expect(request.temperature).toBe(0.9);
      expect(request.maxTokens).toBe(2000);
    });

    it('passes provider overrides to the gateway', async () => {
      const stub = new StubProvider();
      const chatSpy = vi.spyOn(stub, 'chat');

      const spyGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [stub],
      });
      const spyRunner = new AgentRunner({
        gateway: spyGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      await spyRunner.run({
        agentName: 'writer',
        task: 'Write with the explicit provider',
        provider: 'stub',
      });

      const request = chatSpy.mock.calls[0][0];
      expect(request.provider).toBe('stub');
    });

    it('returns token usage when available', async () => {
      const result = await runner.run({
        agentName: 'writer',
        task: 'Write a short piece',
      });

      // StubProvider returns zero usage
      expect(result.tokensUsed).toBeDefined();
      expect(result.tokensUsed!.prompt).toBe(0);
      expect(result.tokensUsed!.completion).toBe(0);
    });

    it('maps estimated copilot-cli usage into tokensUsed', async () => {
      const copilotGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [new CopilotCliUsageProvider()],
      });
      const copilotRunner = new AgentRunner({
        gateway: copilotGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      const result = await copilotRunner.run({
        agentName: 'writer',
        task: 'Write a short piece',
      });

      expect(result.provider).toBe('copilot-cli');
      expect(result.model).toMatch(/^gpt-5/);
      expect(result.tokensUsed).toEqual({ prompt: 321, completion: 123 });
    });

    it('persists canonical llm traces when trace context is provided', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const stageRunId = repo.startStageRun({
        articleId: 'trace-article',
        stage: 5,
        surface: 'writeDraft',
        actor: 'writer',
      });

      try {
        const result = await runner.run({
          agentName: 'writer',
          task: 'Write a short traceable draft',
          articleContext: {
            slug: 'trace-article',
            title: 'Trace Article',
            stage: 5,
            content: 'Artifact context',
          },
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
            stageRunId,
          },
        });

        const traces = repo.getStageRunLlmTraces(stageRunId);
        expect(result.traceId).toBeTruthy();
        expect(traces).toHaveLength(1);
        expect(traces[0].agent_name).toBe('writer');
        expect(traces[0].system_prompt).toContain('The Writer creates compelling analytical articles');
        expect(traces[0].user_message).toContain('Artifact context');
        expect(traces[0].output_text).toBe(result.content);
        expect(traces[0].status).toBe('completed');
      } finally {
        repo.close();
      }
    });

    it('executes a bounded tool loop and stores tool call metadata in traces', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider();
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Tool-assisted final answer');
        expect(result.tokensUsed).toEqual({ prompt: 17, completion: 8 });
        expect(provider.requests).toHaveLength(2);
        expect(provider.requests[1].messages.at(-1)).toMatchObject({
          role: 'tool',
          name: 'article_get',
          tool_call_id: 'tool-call-1',
        });

        const trace = repo.getLlmTrace(result.traceId!);
        expect(trace).not.toBeNull();
        const metadata = JSON.parse(trace!.metadata_json ?? '{}') as { toolCalls?: Array<{ toolName: string }> };
        expect(metadata.toolCalls?.[0]?.toolName).toBe('article_get');
      } finally {
        repo.close();
      }
    });

    it('parses qwen-style wrapped JSON during tool loops', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider((content, callCount) => callCount === 1
        ? `<think>Need article context.</think>\n\`\`\`json\n${content}\n\`\`\``
        : `Working through the result.\n</think>\n${content}\nDone.`);
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Tool-assisted final answer');
        expect(provider.requests).toHaveLength(2);
      } finally {
        repo.close();
      }
    });

    it('unwraps LM Studio typed wrapper args before executing tools', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider((content, callCount) => {
        if (callCount === 1) {
          return JSON.stringify({
            type: 'tool_call',
            toolName: 'article_get',
            args: {
              article_id: { type: 'string', value: 'trace-article' },
            },
          });
        }
        return content;
      });
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Tool-assisted final answer');
        const trace = repo.getLlmTrace(result.traceId!);
        const metadata = JSON.parse(trace!.metadata_json ?? '{}') as {
          toolCalls?: Array<{ args?: Record<string, unknown> }>;
        };
        expect(metadata.toolCalls?.[0]?.args).toEqual({ article_id: 'trace-article' });
      } finally {
        repo.close();
      }
    });

    it('normalizes message envelopes into final tool-loop responses', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider((content, callCount) => {
        if (callCount === 1) {
          return content;
        }
        return JSON.stringify({
          type: 'message',
          content: 'Normalized final answer',
        });
      });
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Normalized final answer');
      } finally {
        repo.close();
      }
    });

    it('normalizes success data envelopes into final tool-loop responses', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider((content, callCount) => {
        if (callCount === 1) {
          return content;
        }
        return JSON.stringify({
          status: 'success',
          data: {
            discussion_prompt: 'Normalized discussion prompt',
          },
        });
      });
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Normalized discussion prompt');
      } finally {
        repo.close();
      }
    });

    it('normalizes structured panel selections into final markdown responses', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider((content, callCount) => {
        if (callCount === 1) {
          return content;
        }
        return JSON.stringify({
          panel: [
            { agentName: 'sea', role: 'Seahawks context and roster pressure points' },
            { name: 'cap', focus: 'Cap constraints and contract structure' },
          ],
        });
      });
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Select a panel for the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 2,
            surface: 'composePanel',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 2,
              surface: 'composePanel',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toContain('## Panel');
        expect(result.content).toContain('- **sea** — Seahawks context and roster pressure points');
        expect(result.content).toContain('- **cap** — Cap constraints and contract structure');
      } finally {
        repo.close();
      }
    });

    it('returns validation failures as tool-role messages with hints', async () => {
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const provider = new ToolLoopProvider((content, callCount) => {
        if (callCount === 1) {
          return JSON.stringify({
            type: 'tool_call',
            toolName: 'article_get',
            args: {},
          });
        }
        return JSON.stringify({
          type: 'final',
          content: 'Recovered after validation failure',
        });
      });
      const toolGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [provider],
      });
      const toolRunner = new AgentRunner({
        gateway: toolGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Recovered after validation failure');
        const toolMessage = provider.requests[1].messages.at(-1);
        expect(toolMessage).toMatchObject({
          role: 'tool',
          name: 'article_get',
          tool_call_id: 'tool-call-1',
        });
        expect(JSON.parse(toolMessage!.content)).toMatchObject({
          error: 'validation',
          tool: 'article_get',
        });
      } finally {
        repo.close();
      }
    });

    it('sends LM Studio text-based tool calls and preserves messages across turns', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'chatcmpl-1',
          object: 'chat.completion',
          model: 'qwen/qwen3.5-35b-a3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '{"type":"tool_call","toolName":"article_get","args":{"article_id":"trace-article"}}',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'chatcmpl-2',
          object: 'chat.completion',
          model: 'qwen/qwen3.5-35b-a3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '{"type":"final","content":"LM Studio tool flow worked"}',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 6, completion_tokens: 4, total_tokens: 10 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const gateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [new LMStudioProvider({ defaultModel: 'qwen/qwen3.5-35b-a3b' })],
      });
      const toolRunner = new AgentRunner({
        gateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          task: 'Summarize the tracked article',
          provider: 'lmstudio',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('LM Studio tool flow worked');

        const firstBody = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
        // Text-based tool calling: tool catalog in system prompt, no native tools
        expect(firstBody.tools).toBeUndefined();
        expect(firstBody.messages[0].content).toContain('# Available Tools');

        const secondBody = JSON.parse((fetchSpy.mock.calls[1] as [string, RequestInit])[1].body as string);
        // Assistant's tool_call JSON preserved, tool result sent as user message
        expect(secondBody.messages.at(-2)).toMatchObject({
          role: 'assistant',
          content: expect.stringContaining('article_get'),
        });
        expect(secondBody.messages.at(-1)).toMatchObject({
          role: 'user',
          content: expect.stringContaining('Tool result for article_get'),
        });
      } finally {
        fetchSpy.mockRestore();
        repo.close();
      }
    });

    it('reuses the prior tool result when LM Studio repeats an identical tool call', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'chatcmpl-1',
          object: 'chat.completion',
          model: 'qwen/qwen3.5-35b-a3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '{"type":"tool_call","toolName":"article_get","args":{"article_id":"trace-article"}}',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'chatcmpl-2',
          object: 'chat.completion',
          model: 'qwen/qwen3.5-35b-a3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '{"type":"tool_call","toolName":"article_get","args":{"article_id":"trace-article"}}',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'chatcmpl-3',
          object: 'chat.completion',
          model: 'qwen/qwen3.5-35b-a3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '{"type":"final","content":"Done after duplicate replay"}',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-article', title: 'Trace Article' });
      const gateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [new LMStudioProvider({ defaultModel: 'qwen/qwen3.5-35b-a3b' })],
      });
      const toolRunner = new AgentRunner({
        gateway,
        memory,
        chartersDir,
        skillsDir,
      });

      try {
        const result = await toolRunner.run({
          agentName: 'writer',
          provider: 'lmstudio',
          task: 'Summarize the tracked article',
          trace: {
            repo,
            articleId: 'trace-article',
            stage: 5,
            surface: 'writeDraft',
          },
          toolCalling: {
            enabled: true,
            includePipelineTools: true,
            requestedTools: ['article_get'],
            context: {
              repo,
              engine: new (await import('../../src/pipeline/engine.js')).PipelineEngine(repo),
              config: {
                dataDir: tempDir,
                league: 'nfl',
                leagueConfig: {
                  name: 'NFL Lab',
                  panelName: 'The NFL Lab Expert Panel',
                  dataSource: 'nflverse',
                  positions: [],
                  substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
                },
                dbPath: pipelineDbPath,
                articlesDir: tempDir,
                imagesDir: tempDir,
                chartersDir,
                skillsDir,
                memoryDbPath: dbPath,
                logsDir: tempDir,
                cacheDir: tempDir,
                port: 3456,
                env: 'development',
              },
              articleId: 'trace-article',
              stage: 5,
              surface: 'writeDraft',
              agentName: 'writer',
            },
          },
        });

        expect(result.content).toBe('Done after duplicate replay');
        // runWithToolLoop caches tool results — the duplicate call reuses the cached
        // output instead of re-executing. Verify the same result appears in the 3rd
        // request's messages (no duplicate-detection note; just the re-used output).
        const thirdBody = JSON.parse((fetchSpy.mock.calls[2] as [string, RequestInit])[1].body as string);
        // Both tool result messages should have the same content (cached result reused)
        const toolResultMsgs = thirdBody.messages.filter((m: { role: string; content: string }) =>
          m.role === 'user' && m.content.startsWith('Tool result for article_get:'));
        expect(toolResultMsgs.length).toBe(2);
        // The duplicate content matches the original (cached, not re-executed)
        expect(toolResultMsgs[1].content).toBe(toolResultMsgs[0].content);
      } finally {
        fetchSpy.mockRestore();
        repo.close();
      }
    });

    it('persists provider metadata for trace visibility', async () => {
      const tracingGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [new TracingCopilotProvider()],
      });
      const tracingRunner = new AgentRunner({
        gateway: tracingGateway,
        memory,
        chartersDir,
        skillsDir,
      });

      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-provider', title: 'Trace Provider' });
      const stageRunId = repo.startStageRun({
        articleId: 'trace-provider',
        stage: 5,
        surface: 'writeDraft',
        actor: 'writer',
      });

      try {
        await tracingRunner.run({
          agentName: 'writer',
          task: 'Write a traced draft',
          articleContext: {
            slug: 'trace-provider',
            title: 'Trace Provider',
            stage: 5,
            content: 'Context body',
          },
          trace: {
            repo,
            articleId: 'trace-provider',
            stage: 5,
            surface: 'writeDraft',
            stageRunId,
          },
        });

        const traces = repo.getStageRunLlmTraces(stageRunId);
        expect(traces[0].provider_mode).toBe('one-shot');
        expect(traces[0].working_directory).toBe('C:\\github\\worktrees\\copilot-session-reuse');
        expect(traces[0].incremental_prompt).toBe('Provider delta');
        expect(traces[0].provider_request_json).toContain('"trace-provider"');
        expect(traces[0].provider_response_json).toContain('Tracing response');
      } finally {
        repo.close();
      }
    });

    it('persists lmstudio request and response envelopes in traces', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'chatcmpl-lmstudio-trace',
        object: 'chat.completion',
        model: 'qwen-35',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'LM Studio traced response' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 20,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
      const tracingGateway = new LLMGateway({
        modelPolicy: loadPolicy(),
        providers: [new LMStudioProvider()],
      });
      const tracingRunner = new AgentRunner({
        gateway: tracingGateway,
        memory,
        chartersDir,
        skillsDir,
      });
      const repo = new Repository(pipelineDbPath);
      repo.createArticle({ id: 'trace-lmstudio', title: 'Trace LM Studio' });
      const stageRunId = repo.startStageRun({
        articleId: 'trace-lmstudio',
        stage: 5,
        surface: 'writeDraft',
        actor: 'writer',
      });

      try {
        await tracingRunner.run({
          agentName: 'writer',
          task: 'Write a traced draft',
          articleContext: {
            slug: 'trace-lmstudio',
            title: 'Trace LM Studio',
            stage: 5,
            content: 'Context body',
          },
          trace: {
            repo,
            articleId: 'trace-lmstudio',
            stage: 5,
            surface: 'writeDraft',
            stageRunId,
          },
          provider: 'lmstudio',
        });

        const traces = repo.getStageRunLlmTraces(stageRunId);
        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(traces[0].provider).toBe('lmstudio');
        expect(traces[0].provider_request_json).toContain('"endpoint":"http://localhost:1234/v1/chat/completions"');
        expect(traces[0].provider_request_json).toContain('"model":"qwen-35"');
        expect(traces[0].provider_response_json).toContain('"id":"chatcmpl-lmstudio-trace"');
        expect(traces[0].provider_response_json).toContain('LM Studio traced response');
      } finally {
        fetchSpy.mockRestore();
        repo.close();
      }
    });
  });
});

describe('normalizeToolLoopResponse', () => {
  it('passes through a valid final envelope', () => {
    const input = { type: 'final', content: 'hello world' };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('final');
    expect(result.content).toBe('hello world');
  });

  it('passes through a valid tool_call envelope', () => {
    const input = { type: 'tool_call', toolName: 'web_search', args: { q: 'test' } };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('tool_call');
    expect(result.toolName).toBe('web_search');
  });

  it('wraps a raw object without a type field as a final response', () => {
    // This simulates an LLM returning idea content directly as JSON
    const input = {
      'Working Title': 'Why the Seahawks Will Win the Super Bowl',
      'Angle': 'Statistical analysis of defensive improvements',
      'Key Points': ['Point 1', 'Point 2'],
    };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('final');
    expect(typeof result.content).toBe('string');
    expect(result.content).toContain('Working Title');
    expect(result.content).toContain('Seahawks');
  });

  it('wraps an object with an unrecognized type field as a final response', () => {
    // 'greeting' is not an envelope type and doesn't look like a tool name
    const input = { type: 'greeting', data: 'some content' };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('final');
    expect(typeof result.content).toBe('string');
  });

  it('recognises tool call where type is the tool name with args', () => {
    // LLMs sometimes use type as the tool name instead of the standard envelope
    const input = { type: 'query_player_stats', args: { player: 'Brady Cook', season: 2025 } };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('tool_call');
    expect(result.toolName).toBe('query_player_stats');
    expect(result.args).toEqual({ player: 'Brady Cook', season: 2025 });
  });

  it('recognises tool call where type is a hyphenated tool name', () => {
    const input = { type: 'web-search', arguments: { query: 'NFL draft' } };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('tool_call');
    expect(result.toolName).toBe('web-search');
    expect(result.args).toEqual({ query: 'NFL draft' });
  });

  it('recognises bare tool call where type is the tool name without args', () => {
    const input = { type: 'panel_composition' };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('tool_call');
    expect(result.toolName).toBe('panel_composition');
  });

  it('extracts content from a known nested field', () => {
    const input = { content: '# My Article Idea\n\nThis is the idea.' };
    const result = normalizeToolLoopResponse(input) as Record<string, unknown>;
    expect(result.type).toBe('final');
    expect(result.content).toBe('# My Article Idea\n\nThis is the idea.');
  });

  it('handles string input by returning it as-is', () => {
    const result = normalizeToolLoopResponse('just a string');
    expect(result).toBe('just a string');
  });

  it('handles null/undefined input', () => {
    expect(normalizeToolLoopResponse(null)).toBeNull();
    expect(normalizeToolLoopResponse(undefined)).toBeUndefined();
  });
});
