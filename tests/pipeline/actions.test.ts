import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { Repository } from '../../src/db/repository.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { PipelineAuditor } from '../../src/pipeline/audit.js';
import { AgentRunner } from '../../src/agents/runner.js';
import { AgentMemory } from '../../src/agents/memory.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import { StubProvider } from '../../src/llm/providers/stub.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import type { AppConfig } from '../../src/config/index.js';
import type { Stage } from '../../src/types.js';

import {
  STAGE_ACTIONS,
  executeTransition,
  type ActionContext,
} from '../../src/pipeline/actions.js';

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

  const repo = new Repository(dbPath);
  const engine = new PipelineEngine(repo);
  const auditor = new PipelineAuditor(repo, logsDir);
  const memory = new AgentMemory(memoryDbPath);
  const policy = loadPolicy();
  const gateway = new LLMGateway({
    modelPolicy: policy,
    providers: [new StubProvider()],
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
    port: 3456,
    env: 'development',
  };

  const ctx: ActionContext = { repo, engine, runner, auditor, config };

  return {
    tempDir, articlesDir, chartersDir, skillsDir, logsDir,
    repo, engine, auditor, runner, memory, config, ctx,
  };
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
  });

  // ── runDiscussion (3→4) ──────────────────────────────────────────────────

  describe('runDiscussion', () => {
    it('calls panel-moderator and writes discussion-summary.md', async () => {
      createArticleWithStage(fixtures, 'test-rd', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel\n- Analyst A\n- Analyst B',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-rd', 'discussion-summary.md')).toBeTruthy();
    });
  });

  // ── writeDraft (4→5) ─────────────────────────────────────────────────────

  describe('writeDraft', () => {
    it('calls writer agent and writes draft.md', async () => {
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
  });

  // ── runEditor (5→6) ──────────────────────────────────────────────────────

  describe('runEditor', () => {
    it('calls editor agent and writes editor-review.md', async () => {
      createArticleWithStage(fixtures, 'test-re', 5 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'discussion-summary.md': '# Summary',
        'draft.md': longText(1000),
      });

      const result = await STAGE_ACTIONS.runEditor('test-re', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-re', 'editor-review.md')).toBeTruthy();
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
        'draft.md': longText(1000),
        'editor-review.md': '## Verdict: APPROVED\nLooks great.',
      });

      const result = await STAGE_ACTIONS.runPublisherPass('test-rp', fixtures.ctx);

      expect(result.success).toBe(true);
      expect(fixtures.repo.artifacts.get('test-rp', 'publisher-pass.md')).toBeTruthy();
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
        'draft.md': longText(1000),
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
