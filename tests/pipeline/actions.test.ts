import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  resetContextConfigCache,
  recordAgentUsage,
  parsePanelComposition,
  type ActionContext,
  type PanelMember,
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

    it('fails when all panelists fail', async () => {
      // No charters for nonexistent agents
      createArticleWithStage(fixtures, 'test-rd-allfail', 3 as Stage, {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '## Panel\n- **noagent1** — Does not exist\n- **noagent2** — Also does not exist',
      });

      const result = await STAGE_ACTIONS.runDiscussion('test-rd-allfail', fixtures.ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All panelists failed');
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

// ── Upstream context tests ──────────────────────────────────────────────────

describe('Configurable upstream context', () => {
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

  it('writeDraft includes idea.md as upstream context by default', async () => {
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

  it('runEditor includes idea.md and discussion-summary.md by default', async () => {
    const draft = longText(900);
    createArticleWithStage(fixtures, 'test-ctx-ed', 5 as Stage, {
      'idea.md': '# Angle\nSeahawks secondary.',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nKey discussion points.',
      'draft.md': draft,
    });

    const result = await STAGE_ACTIONS.runEditor('test-ctx-ed', fixtures.ctx);
    expect(result.success).toBe(true);

    const review = fixtures.repo.artifacts.get('test-ctx-ed', 'editor-review.md');
    expect(review).toBeTruthy();
  });

  it('runPublisherPass includes editor-review.md by default', async () => {
    const draft = longText(900);
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
    createArticleWithStage(fixtures, 'test-ctx-article-override', 4 as Stage, {
      'idea.md': '# Idea\nUPSTREAM IDEA',
      'discussion-prompt.md': '# Prompt',
      'panel-composition.md': '# Panel',
      'discussion-summary.md': '# Summary\nPRIMARY SUMMARY',
      '_config.json': JSON.stringify({ writeDraft: [] }, null, 2),
    });

    const result = await STAGE_ACTIONS.writeDraft('test-ctx-article-override', fixtures.ctx);
    expect(result.success).toBe(true);

    const draft = fixtures.repo.artifacts.get('test-ctx-article-override', 'draft.md') ?? '';
    expect(draft).toContain('PRIMARY SUMMARY');
    expect(draft).not.toContain('Upstream Context: idea.md');
  });

  it('works with empty include list (minimal context)', async () => {
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
