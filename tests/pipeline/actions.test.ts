import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { Repository } from '../../src/db/repository.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { PipelineAuditor } from '../../src/pipeline/audit.js';
import { AgentRunner } from '../../src/agents/runner.js';
import { AgentMemory } from '../../src/agents/memory.js';
import {
  LLMGateway,
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
} from '../../src/llm/gateway.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import type { AppConfig } from '../../src/config/index.js';
import type { Stage } from '../../src/types.js';

import {
  STAGE_ACTIONS,
  executeTransition,
  autoAdvanceArticle,
  resetContextConfigCache,
  recordAgentUsage,
  parsePanelComposition,
  type ActionContext,
  type PanelMember,
} from '../../src/pipeline/actions.js';
import {
  addConversationTurn,
  addRevisionSummary,
  getRevisionHistory,
} from '../../src/pipeline/conversation.js';
import {
  executeWriterFactCheckPass,
} from '../../src/pipeline/writer-factcheck.js';
import {
  buildWriterPreflightChecklist,
} from '../../src/pipeline/writer-preflight.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadPolicy(): ModelPolicy {
  return new ModelPolicy(
    join(process.cwd(), 'src', 'config', 'defaults', 'models.json'),
  );
}

/** Minimal charter markdown used by tests. */
const AGENT_CHARTERS: Record<string, string> = {
  lead: '# Lead\n\n## Identity\nThe Lead orchestrates pipeline tasks.\n\n## Responsibilities\n- Coordinate work\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n',
  'panel-moderator': '# Panel Moderator\n\n## Identity\nThe Moderator runs panel discussions.\n\n## Responsibilities\n- Facilitate discussion\n\n## Boundaries\n- Neutral stance\n\n## Model\nauto\n',
  writer: '# Writer\n\n## Identity\nThe Writer creates analytical articles.\n\n## Responsibilities\n- Write prose\n\n## Boundaries\n- No fabrication\n\n## Model\nauto\n',
  editor: '# Editor\n\n## Identity\nThe Editor reviews drafts.\n\n## Responsibilities\n- Check quality\n\n## Boundaries\n- No rewrites\n\n## Model\nauto\n',
  publisher: '# Publisher\n\n## Identity\nThe Publisher prepares articles for publication.\n\n## Responsibilities\n- Final checks\n\n## Boundaries\n- Follow checklist\n\n## Model\nauto\n',
};

function longText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
}

const PANEL_FACTCHECK_OK = '# Panel Fact-Check\n\nNo blocking issues found in the panel summary.';

function validDraft(wordCount = 900): string {
  return `# Headline

*Subtitle*

> **📋 TLDR**
> - First takeaway
> - Second takeaway
> - Third takeaway
> - Fourth takeaway

**By: The NFL Lab Expert Panel**

${longText(wordCount)}

---

**Next from the panel:** Should Seattle double down on the offensive line or spend that money on a pass catcher?
`;
}

function draftWithNameMismatch(wordCount = 500): string {
  return `# Headline

*Subtitle*

> **📋 TLDR**
> - First takeaway
> - Second takeaway
> - Third takeaway
> - Fourth takeaway

**By: The NFL Lab Expert Panel**

**Jackson Smith-Njigba** is the cleanest separator in this offense, and the article should keep that exact name consistent with the supplied material.

${longText(wordCount)}

---

**Next from the panel:** Why Seattle's third-receiver usage could decide the next playoff push.
`;
}

function draftWithUnsupportedPreciseClaims(wordCount = 500): string {
  return `# Headline

*Subtitle*

> **📋 TLDR**
> - First takeaway
> - Second takeaway
> - Third takeaway
> - Fourth takeaway

**By: The NFL Lab Expert Panel**

**Geno Smith**'s $32 million extension on March 14, 2026 would be justified by his 4,320 passing yards, even though the supplied material never nails down those exact numbers.

${longText(wordCount)}

---

**Next from the panel:** The next cap domino this front office cannot dodge.
`;
}

function draftWithPlaceholderLeakage(wordCount = 500): string {
  return `# Headline

*Subtitle*

> **📋 TLDR**
> - First takeaway
> - Second takeaway
> - Third takeaway
> - Fourth takeaway

**By: The NFL Lab Expert Panel**

TODO: tighten this lede once the final version is ready.

${longText(wordCount)}

---

**Next from the panel:** Should Seattle bet on internal growth or add another veteran pass catcher?
`;
}

interface TestFixtures {
  tempDir: string;
  articlesDir: string;
  chartersDir: string;
  skillsDir: string;
  logsDir: string;
  repo: Repository;
  engine: PipelineEngine;
  auditor: PipelineAuditor;
  runner: AgentRunner;
  memory: AgentMemory;
  config: AppConfig;
  ctx: ActionContext;
}

class CopilotCliUsageProvider implements LLMProvider {
  readonly id = 'copilot-cli';
  readonly name = 'GitHub Copilot CLI';

  chat(request: ChatRequest): Promise<ChatResponse> {
    return Promise.resolve({
      content: '# Prompt\n\nEstimated Copilot CLI output.',
      model: request.model ?? 'gpt-5.4',
      provider: this.id,
      usage: {
        promptTokens: 432,
        completionTokens: 210,
        totalTokens: 642,
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

class RecordingProvider implements LLMProvider {
  readonly id = 'recording';
  readonly name = 'Recording Provider';
  lastRequest: ChatRequest | null = null;

  constructor(private readonly responses: string[]) {}

  chat(request: ChatRequest): Promise<ChatResponse> {
    this.lastRequest = request;
    const content = this.responses.shift() ?? validDraft();
    return Promise.resolve({
      content,
      model: request.model ?? 'recording-model',
      provider: this.id,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
    });
  }

  listModels(): string[] {
    return ['recording-model'];
  }

  supportsModel(_model: string): boolean {
    return true;
  }
}

class PipelineTestProvider implements LLMProvider {
  readonly id = 'stub';
  readonly name = 'Pipeline Test Provider';

  chat(request: ChatRequest): Promise<ChatResponse> {
    const userContent = request.messages.find((message) => message.role === 'user')?.content ?? '';
    const lowered = userContent.toLowerCase();
    let content = `Stub response for: ${userContent}`;

    if (lowered.includes('lightweight preflight fact-check')) {
      content = '# Panel Fact-Check\n\nAll high-risk claims reviewed.';
    } else if (lowered.includes('write an analytical article draft') || lowered.includes('you are revising an existing draft')) {
      content = `${userContent}\n\n${validDraft()}`;
    } else if (lowered.includes('review the article draft')) {
      content = `${userContent}\n\n## Verdict\nAPPROVED`;
    } else if (lowered.includes('run the publisher pass')) {
      content = `${userContent}\n\n# Publisher Pass\n\nReady for dashboard handoff.`;
    } else if (lowered.includes('generate a discussion prompt')) {
      content = '# Prompt\n\nDiscussion prompt content.';
    } else if (lowered.includes('compose a panel')) {
      content = '# Panel Composition\n\n- cap - Cap analysis';
    } else if (lowered.includes('moderate the panel discussion')) {
      content = '# Summary\n\nPanel discussion summary.';
    }

    return Promise.resolve({
      content,
      model: request.model ?? 'stub-model',
      provider: this.id,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
    });
  }

  listModels(): string[] {
    return ['stub-model'];
  }

  supportsModel(_model: string): boolean {
    return true;
  }
}

function createFixtures(): TestFixtures {
  const tempDir = mkdtempSync(join(tmpdir(), 'nfl-actions-test-'));
  const articlesDir = join(tempDir, 'articles');
  const chartersDir = join(tempDir, 'charters');
  const skillsDir = join(tempDir, 'skills');
  const logsDir = join(tempDir, 'logs');
  const dbPath = join(tempDir, 'pipeline.db');
  const memoryDbPath = join(tempDir, 'memory.db');

  mkdirSync(articlesDir, { recursive: true });
  mkdirSync(chartersDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  // Write charter files
  for (const [name, content] of Object.entries(AGENT_CHARTERS)) {
    writeFileSync(join(chartersDir, `${name}.md`), content);
  }

  for (const skillName of ['substack-article', 'editor-review', 'fact-checking', 'writer-fact-check']) {
    writeFileSync(
      join(skillsDir, `${skillName}.md`),
      readFileSync(join(process.cwd(), 'src', 'config', 'defaults', 'skills', `${skillName}.md`), 'utf-8'),
    );
  }

  const repo = new Repository(dbPath);
  const engine = new PipelineEngine(repo);
  const auditor = new PipelineAuditor(repo, logsDir);
  const memory = new AgentMemory(memoryDbPath);
  const policy = loadPolicy();
  const gateway = new LLMGateway({
    modelPolicy: policy,
    providers: [new PipelineTestProvider()],
  });
  const runner = new AgentRunner({ gateway, memory, chartersDir, skillsDir });

  const config: AppConfig = {
    dataDir: tempDir,
    league: 'nfl',
    leagueConfig: {
      name: 'NFL Lab',
      panelName: 'The NFL Lab Expert Panel',
      dataSource: 'nflverse',
      positions: [],
      substackConfig: { labName: 'NFL Lab', subscribeCaption: '', footerPatterns: [] },
    },
    dbPath,
    articlesDir,
    imagesDir: join(tempDir, 'images'),
    chartersDir,
    skillsDir,
    memoryDbPath,
    logsDir,
    cacheDir: join(tempDir, 'data-cache'),
    port: 3456,
    env: 'development',
  };

  const ctx: ActionContext = { repo, engine, runner, auditor, config };

  return {
    tempDir, articlesDir, chartersDir, skillsDir, logsDir,
    repo, engine, auditor, runner, memory, config, ctx,
  };
}

function setRunnerProvider(fixtures: TestFixtures, provider: LLMProvider): void {
  const gateway = new LLMGateway({
    modelPolicy: loadPolicy(),
    providers: [provider],
  });
  const runner = new AgentRunner({
    gateway,
    memory: fixtures.memory,
    chartersDir: fixtures.chartersDir,
    skillsDir: fixtures.skillsDir,
  });
  fixtures.runner = runner;
  fixtures.ctx.runner = runner;
}

function createArticleWithStage(
  fixtures: TestFixtures,
  slug: string,
  stage: Stage,
  files: Record<string, string> = {},
): void {
  fixtures.repo.createArticle({ id: slug, title: `Test: ${slug}` });

  for (const [name, content] of Object.entries(files)) {
    fixtures.repo.artifacts.put(slug, name, content);
  }

  for (let s = 1; s < stage; s++) {
    fixtures.repo.advanceStage(slug, s, (s + 1) as Stage, 'test-setup');
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('STAGE_ACTIONS', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
  });

  // ── generatePrompt (1→2) ─────────────────────────────────────────────────

  describe('generatePrompt', () => {
    it('calls lead agent and writes discussion-prompt.md', async () => {
      createArticleWithStage(fixtures, 'test-gp', 1 as Stage, {
        'idea.md': '# Great Idea\nAnalyze the Seahawks draft.',
      });

      const result = await STAGE_ACTIONS.generatePrompt('test-gp', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      const content = fixtures.repo.artifacts.get('test-gp', 'discussion-prompt.md');
      expect(content).toBeTruthy();
    });

    it('returns error when idea.md is missing', async () => {
      createArticleWithStage(fixtures, 'test-gp-no-idea', 1 as Stage);

      const result = await STAGE_ACTIONS.generatePrompt('test-gp-no-idea', fixtures.ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('idea.md');
    });

    it('returns error when article not found', async () => {
      const result = await STAGE_ACTIONS.generatePrompt('nonexistent', fixtures.ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ── composePanel (2→3) ───────────────────────────────────────────────────

  describe('composePanel', () => {
    it('calls lead agent and writes panel-composition.md', async () => {
      createArticleWithStage(fixtures, 'test-cp', 2 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt\nDiscuss Seahawks cap space.',
      });

      const result = await STAGE_ACTIONS.composePanel('test-cp', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-cp', 'panel-composition.md')).toBeTruthy();
    });

    it('uses the deterministic default recipe when the roster supports it', async () => {
      const provider = new RecordingProvider(['# This response should not be used']);
      setRunnerProvider(fixtures, provider);

      writeFileSync(join(fixtures.chartersDir, 'sea.md'),
        '# SEA\n\n## Identity\nSeahawks team agent.\n\n## Responsibilities\n- Analyze roster\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');
      writeFileSync(join(fixtures.chartersDir, 'cap.md'),
        '# Cap\n\n## Identity\nCap specialist.\n\n## Responsibilities\n- Analyze contracts\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');
      writeFileSync(join(fixtures.chartersDir, 'playerrep.md'),
        '# PlayerRep\n\n## Identity\nPlayer valuation specialist.\n\n## Responsibilities\n- Analyze leverage\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');
      writeFileSync(join(fixtures.chartersDir, 'analytics.md'),
        '# Analytics\n\n## Identity\nAnalytics specialist.\n\n## Responsibilities\n- Analyze efficiency\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');

      fixtures.repo.createArticle({
        id: 'test-cp-deterministic',
        title: 'Should Seattle extend its star receiver now?',
        primary_team: 'sea',
        depth_level: 2,
      });
      fixtures.repo.advanceStage('test-cp-deterministic', 1, 2 as Stage, 'test-setup');
      fixtures.repo.artifacts.put('test-cp-deterministic', 'idea.md', '# Idea\nPay the receiver now or wait a year?');
      fixtures.repo.artifacts.put(
        'test-cp-deterministic',
        'discussion-prompt.md',
        '# Prompt\n## The Core Question\nShould Seattle extend its receiver now or wait?\n\n## Data Anchors\n- Market comps\n- Guarantees\n',
      );

      const result = await STAGE_ACTIONS.composePanel('test-cp-deterministic', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(provider.lastRequest).toBeNull();
      expect(fixtures.repo.artifacts.get('test-cp-deterministic', 'panel-composition.md')).toBe(
        '## Panel\n\n- **SEA** — SEA team context: roster needs, timeline, and competitive window\n- **Cap** — Salary cap analysis: market comps, structure, and flexibility\n- **PlayerRep** — Player valuation: leverage, guarantees, and negotiation pressure points',
      );
    });
  });

  // ── runDiscussion (3→4) ──────────────────────────────────────────────────

  describe('runDiscussion', () => {
    it('falls back to single-moderator when composition cannot be parsed', async () => {
      createArticleWithStage(fixtures, 'test-rd', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel\n- Analyst A\n- Analyst B',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-rd', 'discussion-summary.md')).toBeTruthy();
      // No panel-*.md artifacts saved in fallback mode
      expect(fixtures.repo.artifacts.get('test-rd', 'panel-sea.md')).toBeNull();
    });

    it('runs parallel panelists and synthesizes via moderator', async () => {
      // Write charters for panelist agents
      writeFileSync(join(fixtures.chartersDir, 'sea.md'),
        '# SEA\n\n## Identity\nSeahawks team agent.\n\n## Responsibilities\n- Analyze roster\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');
      writeFileSync(join(fixtures.chartersDir, 'cap.md'),
        '# Cap\n\n## Identity\nCap specialist agent.\n\n## Responsibilities\n- Analyze cap\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');

      createArticleWithStage(fixtures, 'test-rd-parallel', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt\nDiscuss Seahawks cap space.',
        'panel-composition.md': '## Panel\n- **SEA** — Seahawks team context: roster gaps, competitive window\n- **Cap** — Salary cap analysis: market comps, contract structure',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd-parallel', fixtures.ctx);

      expect(result.success).toBe(true);
      // Individual panel artifacts saved
      expect(fixtures.repo.artifacts.get('test-rd-parallel', 'panel-sea.md')).toBeTruthy();
      expect(fixtures.repo.artifacts.get('test-rd-parallel', 'panel-cap.md')).toBeTruthy();
      // Synthesis saved as discussion-summary.md
      expect(fixtures.repo.artifacts.get('test-rd-parallel', 'discussion-summary.md')).toBeTruthy();
    });

    it('succeeds when one panelist fails but others succeed', async () => {
      // Only write charter for 'sea', not 'badagent' — badagent will fail
      writeFileSync(join(fixtures.chartersDir, 'sea.md'),
        '# SEA\n\n## Identity\nSeahawks team agent.\n\n## Responsibilities\n- Analyze roster\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');

      createArticleWithStage(fixtures, 'test-rd-partial', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt\nDiscuss something.',
        'panel-composition.md': '## Panel\n- **SEA** — Seahawks context\n- **badagent** — This agent does not exist',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd-partial', fixtures.ctx);

      expect(result.success).toBe(true);
      // sea succeeded
      expect(fixtures.repo.artifacts.get('test-rd-partial', 'panel-sea.md')).toBeTruthy();
      // badagent did not produce an artifact
      expect(fixtures.repo.artifacts.get('test-rd-partial', 'panel-badagent.md')).toBeNull();
      // Synthesis still produced
      expect(fixtures.repo.artifacts.get('test-rd-partial', 'discussion-summary.md')).toBeTruthy();
    });

    it('falls back to single-moderator when all panelists fail', async () => {
      // No charters for nonexistent agents — fallback to panel-moderator
      createArticleWithStage(fixtures, 'test-rd-allfail', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '## Panel\n- **noagent1** — Does not exist\n- **noagent2** — Also does not exist',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd-allfail', fixtures.ctx);

      expect(result.success).toBe(true);
      // discussion-summary.md should still be produced via fallback
      expect(fixtures.repo.artifacts.get('test-rd-allfail', 'discussion-summary.md')).toBeTruthy();
    });

    it('saves thinking traces for panelist artifacts', async () => {
      writeFileSync(join(fixtures.chartersDir, 'sea.md'),
        '# SEA\n\n## Identity\nSeahawks team agent.\n\n## Responsibilities\n- Analyze roster\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n');

      createArticleWithStage(fixtures, 'test-rd-think', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '## Panel\n- **SEA** — Seahawks team context',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd-think', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-rd-think', 'panel-sea.md')).toBeTruthy();
      expect(fixtures.repo.artifacts.get('test-rd-think', 'discussion-summary.md')).toBeTruthy();
    });

    it('trims oversized depth-2 panels back to the default discussion size', async () => {
      for (const [name, identity] of [
        ['sea', 'Seahawks team agent.'],
        ['cap', 'Cap specialist.'],
        ['playerrep', 'Player valuation specialist.'],
        ['analytics', 'Analytics specialist.'],
      ] as const) {
        writeFileSync(join(fixtures.chartersDir, `${name}.md`),
          `# ${name}\n\n## Identity\n${identity}\n\n## Responsibilities\n- Analyze assigned lane\n\n## Boundaries\n- Stay on topic\n\n## Model\nauto\n`);
      }

      fixtures.repo.createArticle({
        id: 'test-rd-trim',
        title: 'Should Seattle extend its receiver now?',
        primary_team: 'sea',
        depth_level: 2,
      });
      fixtures.repo.advanceStage('test-rd-trim', 1, 2 as Stage, 'test-setup');
      fixtures.repo.advanceStage('test-rd-trim', 2, 3 as Stage, 'test-setup');
      fixtures.repo.artifacts.put('test-rd-trim', 'idea.md', '# Idea');
      fixtures.repo.artifacts.put(
        'test-rd-trim',
        'discussion-prompt.md',
        '# Prompt\n## The Core Question\nShould Seattle extend its receiver now or wait?\n\n## Data Anchors\n- Market comps',
      );
      fixtures.repo.artifacts.put(
        'test-rd-trim',
        'panel-composition.md',
        '## Panel\n- **SEA** — Seahawks context\n- **Cap** — Cap analysis\n- **PlayerRep** — Player leverage\n- **Analytics** — Historical comps',
      );

      const result = await STAGE_ACTIONS.runDiscussion('test-rd-trim', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-rd-trim', 'panel-sea.md')).toBeTruthy();
      expect(fixtures.repo.artifacts.get('test-rd-trim', 'panel-cap.md')).toBeTruthy();
      expect(fixtures.repo.artifacts.get('test-rd-trim', 'panel-playerrep.md')).toBeTruthy();
      expect(fixtures.repo.artifacts.get('test-rd-trim', 'panel-analytics.md')).toBeNull();
    });
  });

  // ── parsePanelComposition ────────────────────────────────────────────────

  describe('parsePanelComposition', () => {
    it('parses standard panel-composition format', () => {
      const content = `## Panel
- **SEA** — Seahawks team context: roster gaps, competitive window, cap position
- **Cap** — Salary cap analysis: market comps, contract structure, cap impact
- **PlayerRep** — Player valuation: production metrics, market leverage`;

      const result = parsePanelComposition(content);

      expect(result).toEqual([
        { agentName: 'sea', role: 'Seahawks team context: roster gaps, competitive window, cap position' },
        { agentName: 'cap', role: 'Salary cap analysis: market comps, contract structure, cap impact' },
        { agentName: 'playerrep', role: 'Player valuation: production metrics, market leverage' },
      ]);
    });

    it('parses colon-separated format', () => {
      const content = `## Panel
- **SEA**: Seahawks context
- **Cap**: Cap analysis`;

      const result = parsePanelComposition(content);
      expect(result).toHaveLength(2);
      expect(result[0].agentName).toBe('sea');
      expect(result[1].agentName).toBe('cap');
    });

    it('returns empty array for unparseable content', () => {
      const content = '# Panel\n- Analyst A\n- Analyst B';
      expect(parsePanelComposition(content)).toEqual([]);
    });

    it('returns empty array for empty content', () => {
      expect(parsePanelComposition('')).toEqual([]);
    });

    it('handles dash-separated format', () => {
      const content = '- **defense** - Defensive scheme analysis';
      const result = parsePanelComposition(content);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ agentName: 'defense', role: 'Defensive scheme analysis' });
    });
  });

  // ── writeDraft (4→5) ─────────────────────────────────────────────────────

  describe('writeDraft', () => {
    it('calls writer agent and writes draft.md', async () => {
      setRunnerProvider(fixtures, new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]));
      createArticleWithStage(fixtures, 'test-wd', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKey takeaways from panel discussion.',
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-wd', 'draft.md')).toBeTruthy();
    });

    it('passes the canonical TLDR contract to the writer via the substack-article skill', async () => {
      const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-contract', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKey takeaways from panel discussion.',
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd-contract', fixtures.ctx);

      expect(result.success).toBe(true);
      const systemPrompt = provider.lastRequest?.messages.find((message) => message.role === 'system')?.content ?? '';
      expect(systemPrompt).toContain('### Skill: substack-article');
      expect(systemPrompt).toContain('> **📋 TLDR**');
    });

    it('passes the bounded writer fact-check policy to the writer prompt', async () => {
      const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-factcheck-skill', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nUse current roster facts carefully.',
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd-factcheck-skill', fixtures.ctx);

      expect(result.success).toBe(true);
      const systemPrompt = provider.lastRequest?.messages.find((message) => message.role === 'system')?.content ?? '';
      expect(systemPrompt).toContain('### Skill: writer-fact-check');
      expect(systemPrompt).toContain('Raw open-ended web search');
      expect(systemPrompt).toContain('External approved-source checks: **max 3**');
    });

    it('passes a short editor-style preflight checklist to the writer prompt', async () => {
      const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-preflight-prompt', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nJaxon Smith-Njigba is central to the passing game.',
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd-preflight-prompt', fixtures.ctx);

      expect(result.success).toBe(true);
      const requestContent = provider.lastRequest?.messages.map((message) => message.content).join('\n\n---\n\n') ?? '';
      expect(requestContent).toContain(buildWriterPreflightChecklist());
      expect(requestContent).toContain('Do not expand a last name into a full name');
      expect(requestContent).toContain('contract figure, date, draft fact, or stat');
      expect(requestContent).not.toContain('Prose vs. tables');
      expect(requestContent).not.toContain('**Next from the panel:** teaser');
    });

    it('self-heals drafts missing the TLDR structure before succeeding', async () => {
      const provider = new RecordingProvider([
        PANEL_FACTCHECK_OK,
        `# Headline

*Subtitle*

${longText(400)}`,
        validDraft(500),
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-repair', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKey takeaways from panel discussion.',
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd-repair', fixtures.ctx);

      expect(result.success).toBe(true);
      const draft = fixtures.repo.artifacts.get('test-wd-repair', 'draft.md') ?? '';
      expect(draft).toContain('> **📋 TLDR**');
    });

    it('fails when the retry draft still misses the TLDR contract', async () => {
      const provider = new RecordingProvider([
        PANEL_FACTCHECK_OK,
        `# Headline

*Subtitle*

${longText(400)}`,
        `# Headline

*Subtitle*

${longText(450)}`,
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-repair-fail', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKey takeaways from panel discussion.',
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd-repair-fail', fixtures.ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Writer draft failed validation after self-heal');
      expect(result.error).toContain('TLDR');
    });

    it('retries when the draft expands a name beyond what the supplied artifacts support', async () => {
      const provider = new RecordingProvider([
        PANEL_FACTCHECK_OK,
        draftWithNameMismatch(),
        validDraft(),
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-name-preflight', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nSmith-Njigba is the featured separator in this article.',
      });

      const runSpy = vi.spyOn(fixtures.ctx.runner, 'run');

      const result = await STAGE_ACTIONS.writeDraft('test-wd-name-preflight', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(runSpy).toHaveBeenCalledTimes(3);
      const retryCall = runSpy.mock.calls[2]?.[0];
      expect(retryCall?.agentName).toBe('writer');
      expect(retryCall?.task).toContain('failed the writer preflight on hard factual issues');
      expect(retryCall?.task).toContain('Jackson Smith-Njigba');
      expect(retryCall?.task).toContain('Smith-Njigba');
      runSpy.mockRestore();
    });

    it('retries when the draft uses unsupported precise contract/date/stat language', async () => {
      const provider = new RecordingProvider([
        PANEL_FACTCHECK_OK,
        draftWithUnsupportedPreciseClaims(),
        validDraft(500),
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-precise-claim-preflight', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nGeno Smith remains the quarterback question, but keep contract language cautious.',
      });

      const runSpy = vi.spyOn(fixtures.ctx.runner, 'run');

      const result = await STAGE_ACTIONS.writeDraft('test-wd-precise-claim-preflight', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(runSpy).toHaveBeenCalledTimes(3);
      const retryCall = runSpy.mock.calls[2]?.[0];
      expect(retryCall?.task).toContain('unsupported precise contract language');
      expect(retryCall?.task).toContain('March 14, 2026');
      expect(retryCall?.task).toContain('4,320 passing yards');
      runSpy.mockRestore();
    });

    it('retries when the draft still contains placeholder scaffolding text', async () => {
      const provider = new RecordingProvider([
        PANEL_FACTCHECK_OK,
        draftWithPlaceholderLeakage(),
        validDraft(500),
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-placeholder-preflight', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKeep the lede crisp and publication-ready.',
      });

      const runSpy = vi.spyOn(fixtures.ctx.runner, 'run');

      const result = await STAGE_ACTIONS.writeDraft('test-wd-placeholder-preflight', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(runSpy).toHaveBeenCalledTimes(3);
      const retryCall = runSpy.mock.calls[2]?.[0];
      expect(retryCall?.task).toContain('placeholder or scaffolding text');
      expect(retryCall?.task).toContain('TODO');
      const preflightArtifact = fixtures.repo.artifacts.get('test-wd-placeholder-preflight', 'writer-preflight.md') ?? '';
      expect(preflightArtifact).toContain('**Repair triggered:** yes');
      expect(preflightArtifact).toContain('[placeholder-leakage]');
      expect(preflightArtifact).toContain('No deterministic writer-preflight issues found.');
      runSpy.mockRestore();
    });

    it('does not retry a non-risky draft that already respects the preflight', async () => {
      const provider = new RecordingProvider([
        PANEL_FACTCHECK_OK,
        validDraft(500),
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-preflight-clean', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nJaxon Smith-Njigba is central to the passing game.',
      });

      const runSpy = vi.spyOn(fixtures.ctx.runner, 'run');

      const result = await STAGE_ACTIONS.writeDraft('test-wd-preflight-clean', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(runSpy).toHaveBeenCalledTimes(2);
      const preflightArtifact = fixtures.repo.artifacts.get('test-wd-preflight-clean', 'writer-preflight.md') ?? '';
      expect(preflightArtifact).toContain('**Status:** passed');
      expect(preflightArtifact).toContain('**Repair triggered:** no');
      expect(preflightArtifact).toContain('No deterministic writer-preflight issues found.');
      runSpy.mockRestore();
    });

    it('keeps writer conversation handoff summary-only while still providing the full current editor review', async () => {
      const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-handoff', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKey takeaways from panel discussion.',
        'draft.md': '# Draft\nCURRENT DRAFT BODY',
        'editor-review.md': 'FULL_EDITOR_FEEDBACK_SHOULD_APPEAR\n- Fix the cap table\n- Rewrite the lede',
        '_config.json': JSON.stringify({ writeDraft: [] }, null, 2),
      });
      addConversationTurn(fixtures.repo, 'test-wd-handoff', 5, 'writer', 'assistant', 'WRITER_THREAD_SHOULD_NOT_APPEAR');
      addConversationTurn(fixtures.repo, 'test-wd-handoff', 6, 'editor', 'assistant', 'OLDER_EDITOR_THREAD_SHOULD_NOT_APPEAR');
      addConversationTurn(fixtures.repo, 'test-wd-handoff', 7, 'publisher', 'assistant', 'PUBLISHER_THREAD_SHOULD_NOT_APPEAR');
      addRevisionSummary(
        fixtures.repo,
        'test-wd-handoff',
        1,
        6,
        4,
        'editor',
        'REVISE',
        ['Fix EPA'],
        'Tighten the math.',
      );

      const result = await STAGE_ACTIONS.writeDraft('test-wd-handoff', fixtures.ctx);

      expect(result.success).toBe(true);
      const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
      const requestContent = provider.lastRequest?.messages.map((message) => message.content).join('\n\n---\n\n') ?? '';
      expect(userPrompt).toContain('## Shared Revision Handoff');
      expect(userPrompt).toContain('Tighten the math.');
      expect(userPrompt).toContain('FULL_EDITOR_FEEDBACK_SHOULD_APPEAR');
      expect(requestContent).toContain(buildWriterPreflightChecklist());
      expect(requestContent).toContain('Do not expand a last name into a full name');
      expect(requestContent).not.toContain('WRITER_THREAD_SHOULD_NOT_APPEAR');
      expect(requestContent).not.toContain('OLDER_EDITOR_THREAD_SHOULD_NOT_APPEAR');
      expect(requestContent).not.toContain('PUBLISHER_THREAD_SHOULD_NOT_APPEAR');
    });

    it('uses the shared writer task builder for revisions so the checklist survives revision prompts', async () => {
      const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-wd-revision-task', 4 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nSmith-Njigba remains the featured separator.',
        'draft.md': validDraft(500),
        'editor-review.md': '## Verdict\nREVISE\n\nTighten the lede and keep the facts cautious.',
        '_config.json': JSON.stringify({ writeDraft: [] }, null, 2),
      });

      const result = await STAGE_ACTIONS.writeDraft('test-wd-revision-task', fixtures.ctx);

      expect(result.success).toBe(true);
      const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
      expect(userPrompt).toContain('You are REVISING an existing draft — NOT writing from scratch.');
      expect(userPrompt).toContain(buildWriterPreflightChecklist());
      expect(userPrompt).toContain('do not turn Stage 5 into open-ended research');
    });
  });

  // ── runEditor (5→6) ──────────────────────────────────────────────────────

  describe('runEditor', () => {
    it('calls editor agent and writes editor-review.md', async () => {
      createArticleWithStage(fixtures, 'test-re', 5 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': validDraft(1000),
      });

      const result = await STAGE_ACTIONS.runEditor('test-re', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-re', 'editor-review.md')).toBeTruthy();
    });

    it('passes shared summary plus editor self-history, not raw cross-role transcript', async () => {
      createArticleWithStage(fixtures, 'test-re-handoff', 5 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': validDraft(1000),
      });
      addConversationTurn(fixtures.repo, 'test-re-handoff', 5, 'writer', 'assistant', 'WRITER_THREAD_SHOULD_NOT_APPEAR');
      addConversationTurn(fixtures.repo, 'test-re-handoff', 6, 'editor', 'assistant', 'EDITOR_PREVIOUS_REVIEW_SHOULD_APPEAR');
      addConversationTurn(fixtures.repo, 'test-re-handoff', 7, 'publisher', 'assistant', 'PUBLISHER_THREAD_SHOULD_NOT_APPEAR');
      addRevisionSummary(
        fixtures.repo,
        'test-re-handoff',
        1,
        6,
        4,
        'editor',
        'REVISE',
        ['Fix EPA'],
        'Tighten the math.',
      );

      const result = await STAGE_ACTIONS.runEditor('test-re-handoff', fixtures.ctx);

      expect(result.success).toBe(true);
      const review = fixtures.repo.artifacts.get('test-re-handoff', 'editor-review.md') ?? '';
      expect(review).toContain('## Shared Revision Handoff');
      expect(review).toContain('## Your Previous Reviews');
      expect(review).toContain('EDITOR_PREVIOUS_REVIEW_SHOULD_APPEAR');
      expect(review).not.toContain('WRITER_THREAD_SHOULD_NOT_APPEAR');
      expect(review).not.toContain('PUBLISHER_THREAD_SHOULD_NOT_APPEAR');
    });

    it('returns REVISE and records a revision summary when the editor sends the draft back', async () => {
      setRunnerProvider(fixtures, new RecordingProvider([
        `# Editor Review

        ## 🔴 ERRORS (Must Fix Before Publish)
        - [BLOCKER structure:missing-tldr] Restore the required TLDR block near the top before another pass.
        - [BLOCKER evidence:stale-stat] Refresh the stale stat before another pass.

        ## Verdict
REVISE`,
      ]));
      createArticleWithStage(fixtures, 'test-re-revise', 5 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': validDraft(1000),
      });

      const result = await STAGE_ACTIONS.runEditor('test-re-revise', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(result.outcome).toBe('REVISE');
      const history = getRevisionHistory(fixtures.repo, 'test-re-revise');
      expect(history).toHaveLength(1);
      expect(history[0]?.agent_name).toBe('editor');
      expect(history[0]?.outcome).toBe('REVISE');
      expect(history[0]?.blocker_type).toBe('mixed');
      expect(history[0]?.blocker_ids).toBe(JSON.stringify(['missing-tldr', 'stale-stat']));
    });

    it('passes writer-factcheck.md to editor as advisory context', async () => {
      const provider = new RecordingProvider([
        `# Editor Review

## Verdict
APPROVED`,
      ]);
      setRunnerProvider(fixtures, provider);
      createArticleWithStage(fixtures, 'test-re-writer-fc', 5 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary\nKey discussion points.',
        'draft.md': validDraft(1000),
        'writer-factcheck.md': [
          '# Writer Fact-Check',
          '',
          '## Verified Facts Used in Draft',
          '- Geno Smith contract framing — source class: `trusted_reference`',
        ].join('\n'),
      });

      const result = await STAGE_ACTIONS.runEditor('test-re-writer-fc', fixtures.ctx);

      expect(result.success).toBe(true);
      const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
      expect(userPrompt).toContain('## Upstream Context: writer-factcheck.md');
      expect(userPrompt).toContain('## Verified Facts Used in Draft');
      expect(userPrompt).toContain('treat it as an advisory Stage 5 ledger');
    });
  });

  // ── runPublisherPass (6→7) ────────────────────────────────────────────────

  describe('runPublisherPass', () => {
    it('calls publisher agent and writes publisher-pass.md', async () => {
      createArticleWithStage(fixtures, 'test-rp', 6 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': validDraft(1000),
        'editor-review.md': '## Verdict: APPROVED\nLooks great.',
      });

      const result = await STAGE_ACTIONS.runPublisherPass('test-rp', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-rp', 'publisher-pass.md')).toBeTruthy();
    });

    it('passes summary-only handoff to publisher', async () => {
      createArticleWithStage(fixtures, 'test-rp-handoff', 6 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': validDraft(1000),
        'editor-review.md': '## Verdict\nAPPROVED',
      });
      addConversationTurn(fixtures.repo, 'test-rp-handoff', 5, 'writer', 'assistant', 'WRITER_THREAD_SHOULD_NOT_APPEAR');
      addConversationTurn(fixtures.repo, 'test-rp-handoff', 6, 'editor', 'assistant', 'EDITOR_THREAD_SHOULD_NOT_APPEAR');
      addRevisionSummary(
        fixtures.repo,
        'test-rp-handoff',
        1,
        6,
        4,
        'editor',
        'REVISE',
        ['Fix EPA'],
        'Tighten the math.',
      );

      const result = await STAGE_ACTIONS.runPublisherPass('test-rp-handoff', fixtures.ctx);

      expect(result.success).toBe(true);
      const publisherPass = fixtures.repo.artifacts.get('test-rp-handoff', 'publisher-pass.md') ?? '';
      expect(publisherPass).toContain('## Shared Revision Handoff');
      expect(publisherPass).toContain('Tighten the math.');
      expect(publisherPass).not.toContain('WRITER_THREAD_SHOULD_NOT_APPEAR');
      expect(publisherPass).not.toContain('EDITOR_THREAD_SHOULD_NOT_APPEAR');
    });
  });

  // ── publish (7→8) ────────────────────────────────────────────────────────

  describe('publish', () => {
    it('returns error when substack_url not set', async () => {
      createArticleWithStage(fixtures, 'test-pub', 7 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': validDraft(1000),
        'editor-review.md': '## Verdict: APPROVED\nGood.',
      });

      const result = await STAGE_ACTIONS.publish('test-pub', fixtures.ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('substack_url');
    });
  });

  // ── Duration tracking ────────────────────────────────────────────────────

  describe('duration tracking', () => {
    it('records duration on success', async () => {
      createArticleWithStage(fixtures, 'test-dur', 1 as Stage, {
        'idea.md': '# Idea\nContent here.',
      });

      const result = await STAGE_ACTIONS.generatePrompt('test-dur', fixtures.ctx);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('records duration on failure', async () => {
      const result = await STAGE_ACTIONS.generatePrompt('nonexistent-article', fixtures.ctx);

      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── executeTransition ───────────────────────────────────────────────────────

describe('executeTransition', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
  });

  afterEach(() => {
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
  });

  it('validates guard → runs action → advances stage → audits', async () => {
    createArticleWithStage(fixtures, 'test-et', 1 as Stage, {
      'idea.md': '# Idea\nSeahawks draft analysis.',
    });

    const result = await executeTransition('test-et', 1 as Stage, fixtures.ctx);

    expect(result.success).toBe(true);
    expect(result.artifactPath).toBeFalsy();

    // Stage should have advanced to 2
    const article = fixtures.repo.getArticle('test-et');
    expect(article!.current_stage).toBe(2);

    // Audit log should have an entry
    const history = fixtures.auditor.getHistory('test-et');
    const advanceEntry = history.find(
      (e) => e.action === 'advance' && e.success,
    );
    expect(advanceEntry).toBeDefined();
    expect(advanceEntry!.fromStage).toBe(1);
    expect(advanceEntry!.toStage).toBe(2);
    expect(advanceEntry!.agent).toBe('generatePrompt');
  });

  it('fails when guard does not pass', async () => {
    // Create article at stage 1 with no idea.md → guard fails
    createArticleWithStage(fixtures, 'test-guard-fail', 1 as Stage);

    const result = await executeTransition('test-guard-fail', 1 as Stage, fixtures.ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Guard failed');

    // Stage should NOT have advanced
    const article = fixtures.repo.getArticle('test-guard-fail');
    expect(article!.current_stage).toBe(1);

    // Audit log should record the failure
    const history = fixtures.auditor.getHistory('test-guard-fail');
    expect(history.some((e) => e.action === 'guard_check' && !e.success)).toBe(true);
  });

  it('does not advance stage when action fails', async () => {
    createArticleWithStage(fixtures, 'test-act-fail', 2 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
    });

    // Remove the lead charter to make the action fail (agent not found)
    rmSync(join(fixtures.chartersDir, 'lead.md'));

    const result = await executeTransition('test-act-fail', 2 as Stage, fixtures.ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Agent charter not found');

    // Stage should NOT have advanced
    const article = fixtures.repo.getArticle('test-act-fail');
    expect(article!.current_stage).toBe(2);
  });

  it('returns error for undefined stage transition', async () => {
    const result = await executeTransition('any-id', 8 as Stage, fixtures.ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No action defined');
  });

  it('creates audit entry with duration on success', async () => {
    createArticleWithStage(fixtures, 'test-audit-dur', 1 as Stage, {
      'idea.md': '# Idea\nGood content.',
    });

    await executeTransition('test-audit-dur', 1 as Stage, fixtures.ctx);

    const history = fixtures.auditor.getHistory('test-audit-dur');
    const advance = history.find((e) => e.action === 'advance' && e.success);
    expect(advance).toBeDefined();
    expect(advance!.duration).toBeGreaterThanOrEqual(0);
  });

  it('creates audit entry on success', async () => {
    createArticleWithStage(fixtures, 'test-meta', 1 as Stage, {
      'idea.md': '# Idea\nGreat content.',
    });

    await executeTransition('test-meta', 1 as Stage, fixtures.ctx);

    const history = fixtures.auditor.getHistory('test-meta');
    const advance = history.find((e) => e.action === 'advance' && e.success);
    expect(advance).toBeDefined();
  });

  it('runs multi-stage transitions sequentially', async () => {
    createArticleWithStage(fixtures, 'test-multi', 1 as Stage, {
      'idea.md': '# Idea\nDetailed analysis.',
    });

    // Stage 1→2
    const r1 = await executeTransition('test-multi', 1 as Stage, fixtures.ctx);
    expect(r1.success).toBe(true);
    expect(fixtures.repo.getArticle('test-multi')!.current_stage).toBe(2);

    // Stage 2→3
    const r2 = await executeTransition('test-multi', 2 as Stage, fixtures.ctx);
    expect(r2.success).toBe(true);
    expect(fixtures.repo.getArticle('test-multi')!.current_stage).toBe(3);
  });
});

describe('autoAdvanceArticle draft structure recovery', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
  });

  afterEach(() => {
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
  });

  it('sends stage-5 drafts back to writer when the TLDR contract is missing', async () => {
    createArticleWithStage(fixtures, 'test-auto-tldr', 5 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': `# Headline\n\n*Subtitle*\n\n${longText(400)}`,
    });

    const result = await autoAdvanceArticle('test-auto-tldr', fixtures.ctx, {
      maxStage: 6,
      maxRevisions: 1,
    });

    expect(result.revisionCount).toBe(1);
    expect(result.steps.some((step) => step.type === 'regress' && /required structure/i.test(step.action))).toBe(true);
    expect(fixtures.repo.getArticle('test-auto-tldr')!.current_stage).toBe(4);
    expect(fixtures.repo.artifacts.get('test-auto-tldr', 'draft.md')).toContain('# Headline');
    const sendBackReview = fixtures.repo.artifacts.get('test-auto-tldr', 'editor-review.md') ?? '';
    expect(sendBackReview).toContain('## Verdict');
    expect(sendBackReview).toContain('REVISE');
    expect(sendBackReview).toContain('repair the required top-of-article TLDR structure');
  });

  it('regresses back to writer when runEditor succeeds with a REVISE verdict', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Editor Review\n\nNeeds a clearer verdict block.',
      `# Editor Review

        ## 🔴 ERRORS (Must Fix Before Publish)
        - [BLOCKER structure:missing-tldr] Tighten the opening and rework the TLDR framing.

        ## Verdict
REVISE`,
      '# Panel Fact-Check\n\nNo blocking issues found in the panel summary.',
      `# Headline

*Subtitle*

${longText(400)}`,
      `# Headline

*Subtitle*

${longText(450)}`,
    ]));
    createArticleWithStage(fixtures, 'test-auto-editor-revise', 5 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': validDraft(400),
    });

    const result = await autoAdvanceArticle('test-auto-editor-revise', fixtures.ctx, {
      maxStage: 6,
      maxRevisions: 1,
    });

    expect(result.revisionCount).toBe(1);
    expect(result.steps.some((step) =>
      step.type === 'advance' && step.from === 5 && step.to === 6,
    )).toBe(true);
    expect(result.steps.some((step) =>
      step.type === 'regress' && step.from === 6 && step.to === 4 && /Editor requested revisions/i.test(step.action),
    )).toBe(true);
    expect(fixtures.repo.getArticle('test-auto-editor-revise')!.current_stage).toBe(4);
    expect(fixtures.repo.getArticle('test-auto-editor-revise')!.status).toBe('revision');
    expect(fixtures.repo.artifacts.get('test-auto-editor-revise', 'lead-review.md')).toBeNull();
    expect(result.error).toContain('Writer draft failed validation after self-heal');
  });

  it('escalates repeated blocker signatures to lead review instead of regressing again', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      `# Editor Review

## 🔴 ERRORS (Must Fix Before Publish)
- [BLOCKER evidence:missing-source] Add the missing source before another pass.
- [BLOCKER evidence:stale-stat] Refresh the stale stat before another pass.

## Verdict
REVISE`,
    ]));
    createArticleWithStage(fixtures, 'test-auto-lead-review', 5 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': validDraft(400),
    });
    addRevisionSummary(
      fixtures.repo,
      'test-auto-lead-review',
      1,
      6,
      4,
      'editor',
      'REVISE',
      null,
      'Missing evidence remained unresolved.',
      {
        blockerType: 'evidence',
        blockerIds: ['stale-stat', 'missing-source'],
      },
    );

    const result = await autoAdvanceArticle('test-auto-lead-review', fixtures.ctx, {
      maxStage: 6,
      maxRevisions: 1,
    });

    const article = fixtures.repo.getArticle('test-auto-lead-review');
    expect(result.finalStage).toBe(6);
    expect(result.revisionCount).toBe(0);
    expect(result.steps.some((step) => step.type === 'regress')).toBe(false);
    expect(result.steps.some((step) => /Escalated to Lead review/i.test(step.action))).toBe(true);
    expect(article?.current_stage).toBe(6);
    expect(article?.status).toBe('needs_lead_review');
    const handoff = fixtures.repo.artifacts.get('test-auto-lead-review', 'lead-review.md') ?? '';
    expect(handoff).toContain('Repeated Blocker Fingerprint');
    expect(handoff).toContain('blocker_type: evidence');
    expect(handoff).toContain('missing-source, stale-stat');
    expect(fixtures.repo.artifacts.get('test-auto-lead-review', 'editor-review.md')).not.toContain('Auto-approved after');
  });

  it('holds stage-6 needs_lead_review articles without force-approving or regressing', async () => {
    createArticleWithStage(fixtures, 'test-auto-lead-hold', 6 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': validDraft(400),
      'editor-review.md': '# Editor Review\n\n## Verdict\nREVISE',
      'lead-review.md': '# Lead Review Handoff',
    });
    fixtures.repo.updateArticleStatus('test-auto-lead-hold', 'needs_lead_review');

    const result = await autoAdvanceArticle('test-auto-lead-hold', fixtures.ctx, {
      maxStage: 7,
      maxRevisions: 1,
    });

    const article = fixtures.repo.getArticle('test-auto-lead-hold');
    expect(result.finalStage).toBe(6);
    expect(result.revisionCount).toBe(0);
    expect(result.steps).toEqual([]);
    expect(article?.current_stage).toBe(6);
    expect(article?.status).toBe('needs_lead_review');
    expect(fixtures.repo.artifacts.get('test-auto-lead-hold', 'editor-review.md')).toContain('REVISE');
  });

  it('keeps non-repeated blockers on the existing revision-cap path', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Editor Review\n\nNeeds a clearer verdict block.',
      `# Editor Review

## 🔴 ERRORS (Must Fix Before Publish)
- [BLOCKER structure:missing-tldr] Tighten the TLDR framing before another pass.

## Verdict
REVISE`,
      '# Panel Fact-Check\n\nNo blocking issues found in the panel summary.',
      `# Headline

*Subtitle*

${longText(400)}`,
      `# Headline

*Subtitle*

${longText(450)}`,
    ]));
    createArticleWithStage(fixtures, 'test-auto-no-lead-review', 5 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': validDraft(400),
    });
    addRevisionSummary(
      fixtures.repo,
      'test-auto-no-lead-review',
      1,
      6,
      4,
      'editor',
      'REVISE',
      null,
      'The article still needs a source audit.',
      {
        blockerType: 'evidence',
        blockerIds: ['missing-source'],
      },
    );

    const result = await autoAdvanceArticle('test-auto-no-lead-review', fixtures.ctx, {
      maxStage: 6,
      maxRevisions: 1,
    });

    const article = fixtures.repo.getArticle('test-auto-no-lead-review');
    expect(result.finalStage).toBe(4);
    expect(result.revisionCount).toBe(1);
    expect(result.steps.some((step) =>
      step.type === 'regress' && /Editor requested revisions/i.test(step.action),
    )).toBe(true);
    expect(result.steps.some((step) => /Escalated to Lead review/i.test(step.action))).toBe(false);
    expect(article?.status).not.toBe('needs_lead_review');
    expect(fixtures.repo.artifacts.get('test-auto-no-lead-review', 'lead-review.md')).toBeNull();
    expect(result.error).toContain('Writer draft failed validation after self-heal');
  });
});

// ── Upstream context tests ──────────────────────────────────────────────────

describe('Configurable upstream context', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
    resetContextConfigCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
    resetContextConfigCache();
  });

  it('writeDraft includes idea.md as upstream context by default', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]));
    createArticleWithStage(fixtures, 'test-ctx-wd', 4 as Stage, {
      'idea.md': '# Original Angle\nSeahawks cap space.',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel\nCap + SEA',
      'discussion-summary.md': '# Summary\nKey findings about cap.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-ctx-wd', fixtures.ctx);
    expect(result.success).toBe(true);

    const draft = fixtures.repo.artifacts.get('test-ctx-wd', 'draft.md');
    expect(draft).toBeTruthy();
  });

  it('runEditor includes idea.md, discussion-summary.md, and writer-factcheck.md by default', async () => {
    const draft = validDraft(900);
    createArticleWithStage(fixtures, 'test-ctx-ed', 5 as Stage, {
      'idea.md': '# Angle\nSeahawks secondary.',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion points.',
      'draft.md': draft,
      'writer-factcheck.md': '# Writer Fact-Check\n\nTracked risky claims.',
    });

    const result = await STAGE_ACTIONS.runEditor('test-ctx-ed', fixtures.ctx);
    expect(result.success).toBe(true);

    const review = fixtures.repo.artifacts.get('test-ctx-ed', 'editor-review.md');
    expect(review).toBeTruthy();
    expect(review).toContain('writer-factcheck.md');
  });

  it('runPublisherPass includes editor-review.md by default', async () => {
    const draft = validDraft(900);
    createArticleWithStage(fixtures, 'test-ctx-pub', 6 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': draft,
      'editor-review.md': '# Review\n## Verdict\nAPPROVE\n\nLooks good.',
    });

    const result = await STAGE_ACTIONS.runPublisherPass('test-ctx-pub', fixtures.ctx);
    expect(result.success).toBe(true);

    const pass = fixtures.repo.artifacts.get('test-ctx-pub', 'publisher-pass.md');
    expect(pass).toBeTruthy();
  });

  it('respects pipeline-context.json overrides', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]));
    const configDir = join(fixtures.tempDir, 'config');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'pipeline-context.json'), JSON.stringify({
      writeDraft: { primary: 'discussion-summary.md', include: ['*'] },
    }));

    createArticleWithStage(fixtures, 'test-ctx-override', 4 as Stage, {
      'idea.md': '# Idea\nCap analysis.',
      'discussion-prompt.md': '# Prompt\nCap question.',
      'panel-composition.md': '# Panel\nCap + SEA',
      'discussion-summary.md': '# Summary\nFindings.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-ctx-override', fixtures.ctx);
    expect(result.success).toBe(true);
  });

  it('uses per-article overrides stored in _config.json', async () => {
    const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
    setRunnerProvider(fixtures, provider);
    createArticleWithStage(fixtures, 'test-ctx-article-override', 4 as Stage, {
      'idea.md': '# Idea\nUPSTREAM IDEA',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nPRIMARY SUMMARY',
      '_config.json': JSON.stringify({ writeDraft: [] }, null, 2),
    });

    const result = await STAGE_ACTIONS.writeDraft('test-ctx-article-override', fixtures.ctx);
    expect(result.success).toBe(true);

    const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
    expect(userPrompt).toContain('PRIMARY SUMMARY');
    expect(userPrompt).not.toContain('Upstream Context: idea.md');
  });

  it('works with empty include list (minimal context)', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]));
    const configDir = join(fixtures.tempDir, 'config');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'pipeline-context.json'), JSON.stringify({
      writeDraft: { primary: 'discussion-summary.md', include: [] },
    }));

    createArticleWithStage(fixtures, 'test-ctx-minimal', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nJust the summary.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-ctx-minimal', fixtures.ctx);
    expect(result.success).toBe(true);
  });

  it('generatePrompt respects pipeline-context.json overrides', async () => {
    const provider = new RecordingProvider(['# Prompt\n\nGenerated prompt.']);
    setRunnerProvider(fixtures, provider);
    const configDir = join(fixtures.tempDir, 'config');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'pipeline-context.json'), JSON.stringify({
      generatePrompt: { primary: 'idea.md', include: ['discussion-summary.md'] },
    }));

    createArticleWithStage(fixtures, 'test-ctx-gp', 1 as Stage, {
      'idea.md': '# Idea\nPRIMARY IDEA',
      'discussion-summary.md': '# Summary\nEXTRA SUMMARY CONTEXT',
    });

    const result = await STAGE_ACTIONS.generatePrompt('test-ctx-gp', fixtures.ctx);
    expect(result.success).toBe(true);

    const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
    expect(userPrompt).toContain('EXTRA SUMMARY CONTEXT');
  });

  it('runDiscussion respects pipeline-context.json overrides during moderator fallback', async () => {
    const provider = new RecordingProvider(['# Summary\n\nPanel discussion summary.']);
    setRunnerProvider(fixtures, provider);
    const configDir = join(fixtures.tempDir, 'config');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'pipeline-context.json'), JSON.stringify({
      runDiscussion: { primary: 'discussion-prompt.md', include: ['idea.md', 'panel-composition.md'] },
    }));

    createArticleWithStage(fixtures, 'test-ctx-rd', 3 as Stage, {
      'idea.md': '# Idea\nDISAGREEMENT ANGLE',
      'discussion-prompt.md': '# Prompt\nPROMPT BODY',
      'panel-composition.md': '# Panel\nUnparseable panel text',
    });

    const result = await STAGE_ACTIONS.runDiscussion('test-ctx-rd', fixtures.ctx);
    expect(result.success).toBe(true);

    const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
    expect(userPrompt).toContain('DISAGREEMENT ANGLE');
    expect(userPrompt).toContain('panel-composition.md');
  });

  it('rich context preset widens writeDraft defaults', async () => {
    const provider = new RecordingProvider([PANEL_FACTCHECK_OK, validDraft()]);
    setRunnerProvider(fixtures, provider);
    fixtures.ctx.config.contextPreset = 'rich';
    createArticleWithStage(fixtures, 'test-ctx-rich', 4 as Stage, {
      'idea.md': '# Idea\nUPSTREAM IDEA',
      'discussion-prompt.md': '# Prompt\nPROMPT CONTEXT',
      'panel-composition.md': '# Panel\nPANEL CONTEXT',
      'discussion-summary.md': '# Summary\nPRIMARY SUMMARY',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-ctx-rich', fixtures.ctx);
    expect(result.success).toBe(true);

    const userPrompt = provider.lastRequest?.messages.find((message) => message.role === 'user')?.content ?? '';
    expect(userPrompt).toContain('PROMPT CONTEXT');
    expect(userPrompt).toContain('PANEL CONTEXT');
  });
});

describe('post-revision retrospective automation', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
  });

  afterEach(() => {
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
  });

  function createPublisherReadyArticle(slug: string): void {
    createArticleWithStage(fixtures, slug, 6 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary',
      'draft.md': validDraft(1000),
      'editor-review.md': '## Verdict\nAPPROVED\n\nReady for publisher pass.',
    });
  }

  it('does not create a retrospective when revision_count is 0', async () => {
    createPublisherReadyArticle('retro-zero');
    setRunnerProvider(fixtures, new RecordingProvider(['# Publisher Pass\n\nReady for dashboard handoff.']));

    const result = await autoAdvanceArticle('retro-zero', fixtures.ctx, { maxStage: 7 });

    expect(result.finalStage).toBe(7);
    expect(fixtures.repo.artifacts.get('retro-zero', 'revision-retrospective-r1.md')).toBeNull();
    expect(fixtures.repo.getArticleRetrospectives('retro-zero')).toHaveLength(0);
  });

  it('creates one retrospective after a single revisioned completion path', async () => {
    createPublisherReadyArticle('retro-one');
    setRunnerProvider(fixtures, new RecordingProvider(['# Publisher Pass\n\nReady for dashboard handoff.']));
    addConversationTurn(fixtures.repo, 'retro-one', 5, 'writer', 'assistant', 'Initial draft.');
    addConversationTurn(fixtures.repo, 'retro-one', 6, 'editor', 'assistant', '## Verdict\nREVISE\n\nFix the EPA section.');
    addRevisionSummary(
      fixtures.repo,
      'retro-one',
      1,
      6,
      4,
      'editor',
      'REVISE',
      ['Fix the EPA section'],
      'Fix the EPA section before publish.',
    );

    const result = await autoAdvanceArticle('retro-one', fixtures.ctx, { maxStage: 7 });

    expect(result.finalStage).toBe(7);
    const artifact = fixtures.repo.artifacts.get('retro-one', 'revision-retrospective-r1.md');
    expect(artifact).toContain('# Post-Revision Retrospective');
    expect(artifact).toContain('Writer Perspective');
    expect(artifact).toContain('Editor Perspective');
    expect(artifact).toContain('Lead Perspective');

    const retrospectives = fixtures.repo.getArticleRetrospectives('retro-one');
    expect(retrospectives).toHaveLength(1);
    expect(retrospectives[0].completion_stage).toBe(7);
    expect(retrospectives[0].revision_count).toBe(1);
    expect(JSON.parse(retrospectives[0].participant_roles)).toEqual(['editor', 'lead', 'writer']);

    const findings = fixtures.repo.getRetrospectiveFindings(retrospectives[0].id);
    expect(findings.length).toBeGreaterThanOrEqual(6);
    expect(new Set(findings.map((finding) => finding.role))).toEqual(new Set(['writer', 'editor', 'lead']));
  });

  it('captures multiple revisions and stays idempotent on rerun', async () => {
    createPublisherReadyArticle('retro-multi');
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Publisher Pass\n\nReady for dashboard handoff.',
      '# Publisher Pass\n\nReady for dashboard handoff.',
    ]));
    addRevisionSummary(
      fixtures.repo,
      'retro-multi',
      1,
      6,
      4,
      'editor',
      'REVISE',
      ['Fix stale contract figures'],
      'Fix stale contract figures.',
    );
    addRevisionSummary(
      fixtures.repo,
      'retro-multi',
      2,
      6,
      4,
      'editor',
      'REVISE',
      ['Fix stale contract figures'],
      'Fix stale contract figures and tighten the opening.',
    );

    await autoAdvanceArticle('retro-multi', fixtures.ctx, { maxStage: 7 });
    await autoAdvanceArticle('retro-multi', fixtures.ctx, { maxStage: 7 });

    const retrospectives = fixtures.repo.getArticleRetrospectives('retro-multi');
    expect(retrospectives).toHaveLength(1);
    expect(retrospectives[0].revision_count).toBe(2);

    const findings = fixtures.repo.getRetrospectiveFindings(retrospectives[0].id);
    expect(findings.some((finding) => finding.finding_text.includes('Fix stale contract figures'))).toBe(true);
  });

  it('marks force-approved completion paths in the retrospective', async () => {
    createPublisherReadyArticle('retro-force');
    setRunnerProvider(fixtures, new RecordingProvider(['# Publisher Pass\n\nReady for dashboard handoff.']));
    fixtures.repo.artifacts.put(
      'retro-force',
      'editor-review.md',
      '## Editor Review\n\n**Auto-approved after 3 revision cycles.** The editor requested further changes, but the maximum revision limit has been reached. The draft has been iteratively improved and is being moved forward.\n\n## Verdict\nAPPROVED',
    );
    addRevisionSummary(fixtures.repo, 'retro-force', 1, 6, 4, 'editor', 'REVISE', ['Fix stale stat'], 'Fix stale stat');
    addRevisionSummary(fixtures.repo, 'retro-force', 2, 6, 4, 'editor', 'REVISE', ['Fix stale stat'], 'Fix stale stat again');
    addRevisionSummary(fixtures.repo, 'retro-force', 3, 6, 4, 'editor', 'REVISE', ['Fix stale stat'], 'Fix stale stat once more');

    const result = await autoAdvanceArticle('retro-force', fixtures.ctx, { maxStage: 7 });

    expect(result.finalStage).toBe(7);
    const retrospectives = fixtures.repo.getArticleRetrospectives('retro-force');
    expect(retrospectives).toHaveLength(1);
    expect(retrospectives[0].force_approved_after_max_revisions).toBe(1);

    const artifact = fixtures.repo.artifacts.get('retro-force', 'revision-retrospective-r3.md');
    expect(artifact).toContain('**Force-approved after max revisions:** Yes');
  });
});

// ── Token usage recording ───────────────────────────────────────────────────

describe('Token usage recording', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
  });

  afterEach(() => {
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
  });

  it('records token usage after a successful agent run', async () => {
    createArticleWithStage(fixtures, 'test-usage', 1 as Stage, {
      'idea.md': '# Great Idea\nAnalyze the Seahawks draft.',
    });

    const result = await STAGE_ACTIONS.generatePrompt('test-usage', fixtures.ctx);
    expect(result.success).toBe(true);

    const events = fixtures.repo.getUsageEvents('test-usage');
    expect(events.length).toBeGreaterThanOrEqual(1);

    const event = events[0];
    expect(event.article_id).toBe('test-usage');
    expect(event.stage).toBe(1);
    expect(event.surface).toBe('generatePrompt');
    expect(event.event_type).toBe('completed');
    expect(event.provider).toBe('stub');
    expect(event.model_or_tool).toBeTruthy();
  });

  it('records usage for each stage action', async () => {
    createArticleWithStage(fixtures, 'test-usage-multi', 1 as Stage, {
      'idea.md': '# Idea\nDetailed analysis of Seahawks.',
    });

    const result = await STAGE_ACTIONS.generatePrompt('test-usage-multi', fixtures.ctx);
    expect(result.success).toBe(true);

    const events = fixtures.repo.getUsageEvents('test-usage-multi');
    const promptEvent = events.find(e => e.surface === 'generatePrompt');
    expect(promptEvent).toBeDefined();
    expect(promptEvent!.stage).toBe(1);
  });

  it('persists estimated copilot-cli usage into usage_events', async () => {
    setRunnerProvider(fixtures, new CopilotCliUsageProvider());
    createArticleWithStage(fixtures, 'test-usage-copilot', 1 as Stage, {
      'idea.md': '# Great Idea\nAnalyze the Seahawks draft.',
    });

    const result = await STAGE_ACTIONS.generatePrompt('test-usage-copilot', fixtures.ctx);
    expect(result.success).toBe(true);

    const events = fixtures.repo.getUsageEvents('test-usage-copilot');
    expect(events).toHaveLength(1);
    expect(events[0].provider).toBe('copilot-cli');
    expect(events[0].model_or_tool).toMatch(/^gpt-5/);
    expect(events[0].prompt_tokens).toBe(432);
    expect(events[0].output_tokens).toBe(210);
  });

  it('keeps same-second usage history deterministic without timing sleeps', () => {
    fixtures.repo.createArticle({ id: 'test-usage-order', title: 'Usage Order Test' });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-22T00:00:00Z'));
      for (const [surface, promptTokens] of [
        ['generatePrompt', 100],
        ['composePanel', 200],
        ['runDiscussion', 300],
      ] as const) {
        recordAgentUsage(fixtures.ctx, 'test-usage-order', 1, surface, {
          content: 'test',
          thinking: null,
          model: 'gpt-4o',
          provider: 'openai',
          agentName: 'writer',
          memoriesUsed: 0,
          tokensUsed: { prompt: promptTokens, completion: 25 },
        });
      }
    } finally {
      vi.useRealTimers();
    }

    expect(fixtures.repo.getUsageEvents('test-usage-order').map((event) => event.surface)).toEqual([
      'runDiscussion',
      'composePanel',
      'generatePrompt',
    ]);
  });

  it('does not record usage when tokensUsed is undefined', () => {
    fixtures.repo.createArticle({ id: 'test-no-tokens', title: 'No Tokens' });

    const fakeResult = {
      content: 'test',
      thinking: null,
      model: 'test-model',
      provider: 'test-provider',
      agentName: 'test-agent',
      memoriesUsed: 0,
      tokensUsed: undefined,
    };

    recordAgentUsage(fixtures.ctx, 'test-no-tokens', 1, 'generatePrompt', fakeResult);

    const events = fixtures.repo.getUsageEvents('test-no-tokens');
    expect(events.length).toBe(0);
  });

  it('records correct provider, model, stage, and surface values', () => {
    fixtures.repo.createArticle({ id: 'test-values', title: 'Values Test' });
    // Advance to stage 3 so current_stage matches
    fixtures.repo.advanceStage('test-values', 1, 2 as Stage, 'test');
    fixtures.repo.advanceStage('test-values', 2, 3 as Stage, 'test');

    const fakeResult = {
      content: 'test',
      thinking: null,
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'writer',
      memoriesUsed: 2,
      tokensUsed: { prompt: 500, completion: 200 },
    };

    recordAgentUsage(fixtures.ctx, 'test-values', 3, 'runDiscussion', fakeResult);

    const events = fixtures.repo.getUsageEvents('test-values');
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event.provider).toBe('openai');
    expect(event.model_or_tool).toBe('gpt-4o');
    expect(event.stage).toBe(3);
    expect(event.surface).toBe('runDiscussion');
    expect(event.event_type).toBe('completed');
    expect(event.prompt_tokens).toBe(500);
    expect(event.output_tokens).toBe(200);
  });
});

// ── Fact-check preflight in writeDraft ──────────────────────────────────────

describe('writeDraft fact-check preflight', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = createFixtures();
    resetContextConfigCache();
  });

  afterEach(() => {
    fixtures.memory.close();
    fixtures.repo.close();
    rmSync(fixtures.tempDir, { recursive: true, force: true });
    resetContextConfigCache();
  });

  it('runs fact-check then writer when discussion-summary.md exists', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nNo blocking issues.',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-fc', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey takeaways from panel discussion.',
    });

    const runSpy = vi.spyOn(fixtures.ctx.runner, 'run');

    const result = await STAGE_ACTIONS.writeDraft('test-fc', fixtures.ctx);

    expect(result.success).toBe(true);
    // Two runner calls: fact-check (lead) + draft (writer)
    expect(runSpy).toHaveBeenCalledTimes(2);

    const firstCall = runSpy.mock.calls[0][0];
    expect(firstCall.agentName).toBe('lead');
    expect(firstCall.skills).toContain('fact-checking');

    const secondCall = runSpy.mock.calls[1][0];
    expect(secondCall.agentName).toBe('writer');

    runSpy.mockRestore();
  });

  it('stores panel-factcheck.md artifact', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nNo blocking issues.',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-fc-art', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-fc-art', fixtures.ctx);

    expect(result.success).toBe(true);
    const factCheck = fixtures.repo.artifacts.get('test-fc-art', 'panel-factcheck.md');
    expect(factCheck).toBeTruthy();
  });

  it('stores writer-factcheck.md scaffold artifact with fresh-draft budget', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nNo blocking issues.',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-art', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
      'panel-factcheck.md': '# Existing panel fact-check',
      'roster-context.md': '# Roster context',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-art', fixtures.ctx);

    expect(result.success).toBe(true);
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-art', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('**Mode:** Fresh draft');
    expect(writerFactCheck).toContain('External approved-source checks | 3');
    expect(writerFactCheck).toContain('`panel-factcheck.md` — available');
    expect(writerFactCheck).toContain('`fact-check-context.md` — missing');
    expect(writerFactCheck).toContain('Claims logged this pass: 0');
  });

  it('preserves prior writer-factcheck notes while updating the revision contract', async () => {
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nNo blocking issues.',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-revision', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
      'draft.md': validDraft(),
      'editor-review.md': '# Editor Review\n## Verdict\nREVISE',
      'writer-factcheck.md': '# Previous writer fact-check artifact',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-revision', fixtures.ctx);

    expect(result.success).toBe(true);
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-revision', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('**Mode:** Revision');
    expect(writerFactCheck).toContain('External approved-source checks | 1');
    expect(writerFactCheck).toContain('## Prior Artifact Notes');
    expect(writerFactCheck).toContain('# Previous writer fact-check artifact');
  });

  it('limits revision-mode approved-source fetches to one new check', async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><head><title>Official Transactions</title></head><body>Roster move.</body></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);
    setRunnerProvider(fixtures, new RecordingProvider([
      [
        '# Fact Check',
        '',
        '- First official update: https://www.seahawks.com/team/transactions/',
        '- Second official update: https://www.chiefs.com/news/',
      ].join('\n'),
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-revision-budget', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
      'draft.md': validDraft(),
      'editor-review.md': '# Editor Review\n## Verdict\nREVISE',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-revision-budget', fixtures.ctx);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-revision-budget', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('External approved-source checks used: 1/1');
    expect(writerFactCheck).toContain('domain: `seahawks.com`');
    expect(writerFactCheck).toContain('Approved-source budget exhausted before this fetch could run.');
  });

  it('records approved-source fetch usage and attributed results in writer-factcheck.md', async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><head><title>OTC Contract Details</title></head><body>Contract notes.</body></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nPer OverTheCap, the contract framing is here: https://overthecap.com/player/geno-smith/1234',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-usage', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-usage', fixtures.ctx);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-usage', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('OTC Contract Details');
    expect(writerFactCheck).toContain('source class: `trusted_reference`');
    expect(writerFactCheck).toContain('domain: `overthecap.com`');
    expect(writerFactCheck).toContain('External approved-source checks used: 1/3');

    const usageEvent = fixtures.repo.getUsageEvents('test-writer-fc-usage')
      .find(event => event.surface === 'writeDraft-writer-factcheck');
    expect(usageEvent).toBeDefined();
    expect(usageEvent?.request_count).toBe(1);
    const metadata = JSON.parse(usageEvent?.metadata_json ?? '{}') as Record<string, unknown>;
    expect(metadata.attributedCount).toBe(1);
    expect(metadata.domainsTouched).toEqual(['overthecap.com']);
  });

  it('allows official team primary pages as approved sources', async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><head><title>Team Transactions</title></head><body>Roster move.</body></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nOfficial update: https://www.seahawks.com/team/transactions/',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-team-site', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-team-site', fixtures.ctx);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-team-site', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('source class: `official_primary`');
    expect(writerFactCheck).toContain('source: Official team source: Team Transactions');
    expect(writerFactCheck).toContain('domain: `seahawks.com`');
  });

  it('blocks non-approved source domains without fetching them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setRunnerProvider(fixtures, new RecordingProvider([
      '# Fact Check\n\nRumor roundup: https://example.com/fake-report',
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-blocked', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-blocked', fixtures.ctx);

    expect(result.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-blocked', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('Blocked non-approved source from panel-factcheck.md');
    expect(writerFactCheck).toContain('Blocked sources: 1');

    const usageEvent = fixtures.repo.getUsageEvents('test-writer-fc-blocked')
      .find(event => event.surface === 'writeDraft-writer-factcheck');
    const metadata = JSON.parse(usageEvent?.metadata_json ?? '{}') as Record<string, unknown>;
    expect(metadata.blockedSourceCount).toBe(1);
    expect(usageEvent?.request_count).toBe(0);
  });

  it('enforces the external approved-source budget when more URLs are supplied', async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><head><title>Approved Source</title></head><body>Approved body.</body></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);
    setRunnerProvider(fixtures, new RecordingProvider([
      [
        '# Fact Check',
        '',
        '- First source https://www.pro-football-reference.com/players/A/Alpha00.htm',
        '- Second source https://www.pro-football-reference.com/players/B/Beta00.htm',
        '- Third source https://www.pro-football-reference.com/players/C/Gamma00.htm',
        '- Fourth source https://www.pro-football-reference.com/players/D/Delta00.htm',
      ].join('\n'),
      validDraft(),
    ]));
    createArticleWithStage(fixtures, 'test-writer-fc-budget', 4 as Stage, {
      'idea.md': '# Idea',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion findings.',
    });

    const result = await STAGE_ACTIONS.writeDraft('test-writer-fc-budget', fixtures.ctx);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const writerFactCheck = fixtures.repo.artifacts.get('test-writer-fc-budget', 'writer-factcheck.md') ?? '';
    expect(writerFactCheck).toContain('Approved-source budget exhausted before this fetch could run.');
    expect(writerFactCheck).toContain('External approved-source checks used: 3/3');
    expect(writerFactCheck).toContain('Remaining status: exhausted');

    const usageEvent = fixtures.repo.getUsageEvents('test-writer-fc-budget')
      .find(event => event.surface === 'writeDraft-writer-factcheck');
    const metadata = JSON.parse(usageEvent?.metadata_json ?? '{}') as Record<string, unknown>;
    expect(metadata.externalChecksUsed).toBe(3);
    expect(metadata.attributedCount).toBe(3);
    expect(metadata.omittedCount).toBe(1);
  });

  it('enforces the remaining wall-clock budget during slow approved-source fetches', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      if (!signal) {
        reject(new Error('missing abort signal'));
        return;
      }

      signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        Object.defineProperty(error, 'name', { value: 'AbortError' });
        reject(error);
      }, { once: true });
    }));

    const nowValues = [
      0,
      299_995,
      299_995,
      300_000,
    ];

    const reportPromise = executeWriterFactCheckPass({
      articleTitle: 'Budget Test',
      mode: 'fresh_draft',
      availableArtifacts: ['panel-factcheck.md'],
      urlEvidence: [
        {
          claim: 'Official update',
          url: 'https://www.seahawks.com/team/transactions/',
          artifactName: 'panel-factcheck.md',
        },
      ],
      fetchImpl: fetchMock as typeof fetch,
      now: () => new Date(nowValues.shift() ?? 300_000),
    });

    await vi.advanceTimersByTimeAsync(10);
    const report = await reportPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.verifiedFacts).toHaveLength(0);
    expect(report.omittedClaims[0]?.note).toBe('Wall-clock budget expired during approved-source fetch.');
    expect(report.usage.externalChecksUsed).toBe(1);
    expect(report.usage.fetchFailureCount).toBe(1);
    expect(report.usage.remainingStatus).toBe('exhausted');
    expect(report.usage.wallClockMs).toBe(300_000);
  });

  it('skips fact-check when discussion-summary.md does not exist', async () => {
    // Create article at stage 4 but WITHOUT discussion-summary.md —
    // writeDraft will fail on the primary artifact read, but the fact-check
    // should not have run. We manually add it later to isolate the skip.
    fixtures.repo.createArticle({ id: 'test-fc-skip', title: 'Test: test-fc-skip' });
    // Advance to stage 4
    for (let s = 1; s < 4; s++) {
      fixtures.repo.advanceStage('test-fc-skip', s, (s + 1) as Stage, 'test-setup');
    }
    // Only add idea.md (no discussion-summary.md)
    fixtures.repo.artifacts.put('test-fc-skip', 'idea.md', '# Idea');

    const runSpy = vi.spyOn(fixtures.ctx.runner, 'run');

    // This will fail because gatherContext needs discussion-summary.md as primary,
    // but fact-check should have been skipped (no runner call for lead).
    const result = await STAGE_ACTIONS.writeDraft('test-fc-skip', fixtures.ctx);

    expect(result.success).toBe(false);
    // Fact-check was skipped — no runner calls at all (writer also fails on missing primary)
    const leadCalls = runSpy.mock.calls.filter(c => c[0].agentName === 'lead');
    expect(leadCalls.length).toBe(0);
    expect(fixtures.repo.artifacts.get('test-fc-skip', 'panel-factcheck.md')).toBeNull();

    runSpy.mockRestore();
  });
});
