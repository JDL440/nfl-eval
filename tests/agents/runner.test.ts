import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AgentRunner,
  type AgentCharter,
  type AgentSkill,
  type AgentRunParams,
} from '../../src/agents/runner.js';
import { AgentMemory, type MemoryEntry } from '../../src/agents/memory.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import { StubProvider } from '../../src/llm/providers/stub.js';
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AgentRunner', () => {
  let tempDir: string;
  let chartersDir: string;
  let skillsDir: string;
  let dbPath: string;
  let memory: AgentMemory;
  let gateway: LLMGateway;
  let runner: AgentRunner;

  beforeEach(() => {
    const fixtures = createTempFixtures();
    tempDir = fixtures.tempDir;
    chartersDir = fixtures.chartersDir;
    skillsDir = fixtures.skillsDir;
    dbPath = fixtures.dbPath;

    memory = new AgentMemory(dbPath);
    const policy = loadPolicy();
    gateway = new LLMGateway({
      modelPolicy: policy,
      providers: [new StubProvider()],
    });
    runner = new AgentRunner({ gateway, memory, chartersDir, skillsDir });
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

    it('recalls memories before running', async () => {
      // Seed a memory
      memory.store({
        agentName: 'writer',
        category: 'learning',
        content: 'Always mention EPA per play',
      });

      const result = await runner.run({
        agentName: 'writer',
        task: 'Write about QB efficiency',
      });

      expect(result.memoriesUsed).toBe(1);
    });

    it('stores a learning memory after successful run', async () => {
      const beforeCount = memory.recall('writer').length;

      await runner.run({
        agentName: 'writer',
        task: 'Analyze rushing efficiency',
      });

      const afterMemories = memory.recall('writer');
      expect(afterMemories.length).toBe(beforeCount + 1);
      expect(afterMemories.some((m) => m.content.includes('Analyze rushing efficiency'))).toBe(true);
    });

    it('stores learning memory with article context', async () => {
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
      const learning = memories.find((m) => m.content.includes('Seahawks 2025 Draft Preview'));
      expect(learning).toBeDefined();
      expect(learning!.content).toContain('seahawks-draft-2025');
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
  });
});
