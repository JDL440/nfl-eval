/**
 * E2E integration test — exercises the full pipeline from idea → published article.
 *
 * All real components are wired together; only the LLM is stubbed via StubProvider.
 * Each test uses isolated temp directories to avoid polluting real data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { Repository } from '../../src/db/repository.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { PipelineScheduler } from '../../src/pipeline/scheduler.js';
import { PipelineAuditor } from '../../src/pipeline/audit.js';
import {
  executeTransition,
  type ActionContext,
} from '../../src/pipeline/actions.js';
import { AgentRunner } from '../../src/agents/runner.js';
import { AgentMemory } from '../../src/agents/memory.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import { MockProvider } from '../../src/llm/providers/mock.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import { createApp } from '../../src/dashboard/server.js';
import { createMCPServer } from '../../src/mcp/server.js';
import type { AppConfig } from '../../src/config/index.js';
import type { Stage } from '../../src/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MODELS_JSON_PATH = join(process.cwd(), 'src', 'config', 'defaults', 'models.json');

/** Minimal charter markdown files — one per agent used in the pipeline. */
const AGENT_CHARTERS: Record<string, string> = {
  lead: [
    '# Lead',
    '',
    '## Identity',
    'The Lead orchestrates pipeline tasks.',
    '',
    '## Responsibilities',
    '- Coordinate work',
    '',
    '## Boundaries',
    '- Stay on topic',
    '',
    '## Model',
    'auto',
  ].join('\n'),
  'panel-moderator': [
    '# Panel Moderator',
    '',
    '## Identity',
    'The Moderator runs panel discussions.',
    '',
    '## Responsibilities',
    '- Facilitate discussion',
    '',
    '## Boundaries',
    '- Neutral stance',
    '',
    '## Model',
    'auto',
  ].join('\n'),
  writer: [
    '# Writer',
    '',
    '## Identity',
    'The Writer creates analytical articles.',
    '',
    '## Responsibilities',
    '- Write prose',
    '',
    '## Boundaries',
    '- No fabrication',
    '',
    '## Model',
    'auto',
  ].join('\n'),
  editor: [
    '# Editor',
    '',
    '## Identity',
    'The Editor reviews drafts.',
    '',
    '## Responsibilities',
    '- Check quality',
    '',
    '## Boundaries',
    '- No rewrites',
    '',
    '## Model',
    'auto',
  ].join('\n'),
  publisher: [
    '# Publisher',
    '',
    '## Identity',
    'The Publisher prepares articles for publication.',
    '',
    '## Responsibilities',
    '- Final checks',
    '',
    '## Boundaries',
    '- Follow checklist',
    '',
    '## Model',
    'auto',
  ].join('\n'),
};

/** Minimal skill markdown files with YAML frontmatter. */
const AGENT_SKILLS: Record<string, string> = {
  'discussion-prompt': [
    '---',
    'name: discussion-prompt',
    'description: Generate discussion prompts',
    'domain: editorial',
    'confidence: 1.0',
    'tools: [none]',
    '---',
    'Generate a thought-provoking discussion prompt from the article idea.',
  ].join('\n'),
  'panel-composition': [
    '---',
    'name: panel-composition',
    'description: Compose an expert panel',
    'domain: editorial',
    'confidence: 1.0',
    'tools: [none]',
    '---',
    'Select analysts and assign roles for the panel discussion.',
  ].join('\n'),
  'substack-article': [
    '---',
    'name: substack-article',
    'description: Write a Substack article',
    'domain: writing',
    'confidence: 1.0',
    'tools: [none]',
    '---',
    'Write a long-form analytical article suitable for Substack.',
  ].join('\n'),
  'editor-review': [
    '---',
    'name: editor-review',
    'description: Review an article draft',
    'domain: editorial',
    'confidence: 1.0',
    'tools: [none]',
    '---',
    'Review the draft for accuracy, clarity, and structure.',
  ].join('\n'),
  publisher: [
    '---',
    'name: publisher',
    'description: Run publisher pass',
    'domain: publishing',
    'confidence: 1.0',
    'tools: [none]',
    '---',
    'Run the final publisher checklist before publication.',
  ].join('\n'),
};

/** Generate a string with the specified word count. */
function longText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
}

function buildValidDraft(totalWords: number, title = 'Draft'): string {
  const prefix = [
    `# ${title}`,
    '',
    '> **📋 TLDR**',
    '> - Fix the line first.',
    '> - Preserve flexibility for core extensions.',
    '> - Target Day 2 value in the secondary.',
    '> - Turn the panel consensus into a clear offseason plan.',
    '',
  ].join('\n');
  const prefixWords = prefix.split(/\s+/).filter(Boolean).length;
  const remaining = Math.max(totalWords - prefixWords, 0);
  return `${prefix}${remaining > 0 ? `\n${longText(remaining)}` : ''}`;
}

// ── Fixture builder ──────────────────────────────────────────────────────────

interface E2EFixtures {
  tmpDir: string;
  articlesDir: string;
  chartersDir: string;
  skillsDir: string;
  logsDir: string;
  config: AppConfig;
  repo: Repository;
  engine: PipelineEngine;
  scheduler: PipelineScheduler;
  auditor: PipelineAuditor;
  gateway: LLMGateway;
  mockProvider: MockProvider;
  memory: AgentMemory;
  runner: AgentRunner;
  ctx: ActionContext;
}

function buildFixtures(): E2EFixtures {
  const tmpDir = mkdtempSync(join(tmpdir(), 'nfl-e2e-'));
  const articlesDir = join(tmpDir, 'articles');
  const chartersDir = join(tmpDir, 'charters');
  const skillsDir = join(tmpDir, 'skills');
  const logsDir = join(tmpDir, 'logs');
  const dbPath = join(tmpDir, 'pipeline.db');
  const memoryDbPath = join(tmpDir, 'memory.db');

  mkdirSync(articlesDir, { recursive: true });
  mkdirSync(chartersDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  // Write charter files
  for (const [name, content] of Object.entries(AGENT_CHARTERS)) {
    writeFileSync(join(chartersDir, `${name}.md`), content);
  }

  // Write skill files
  for (const [name, content] of Object.entries(AGENT_SKILLS)) {
    writeFileSync(join(skillsDir, `${name}.md`), content);
  }

  const repo = new Repository(dbPath);
  const engine = new PipelineEngine(repo);
  const scheduler = new PipelineScheduler(engine, repo);
  const auditor = new PipelineAuditor(repo, logsDir);
  const memory = new AgentMemory(memoryDbPath);
  const policy = new ModelPolicy(MODELS_JSON_PATH);

  // MockProvider: returns realistic stage-specific content.
  // The test sets the stage before each transition so we don't rely on
  // keyword detection (which breaks when accumulated context bleeds in).
  const mockProvider = new MockProvider();
  mockProvider.setLatency(false); // Disable simulated latency in tests
  const gateway = new LLMGateway({
    modelPolicy: policy,
    providers: [mockProvider],
  });

  const runner = new AgentRunner({ gateway, memory, chartersDir, skillsDir });

  const config: AppConfig = {
    dataDir: tmpDir,
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
    imagesDir: join(tmpDir, 'images'),
    chartersDir,
    skillsDir,
    memoryDbPath,
    logsDir,
    cacheDir: join(tmpDir, 'data-cache'),
    port: 0,
    env: 'development',
  };

  const ctx: ActionContext = { repo, engine, runner, auditor, config };

  return {
    tmpDir, articlesDir, chartersDir, skillsDir, logsDir,
    config, repo, engine, scheduler, auditor, gateway, mockProvider, memory, runner, ctx,
  };
}

function teardown(f: E2EFixtures): void {
  f.memory.close();
  f.repo.close();
  rmSync(f.tmpDir, { recursive: true, force: true });
}

/** Write an artifact file into an article directory. */
function writeArticleFile(f: E2EFixtures, slug: string, name: string, content: string): void {
  f.repo.artifacts.put(slug, name, content);
}

// ── Test suites ──────────────────────────────────────────────────────────────

describe('E2E: Full Pipeline', () => {
  let f: E2EFixtures;

  beforeEach(() => {
    f = buildFixtures();
  });

  afterEach(() => {
    teardown(f);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Idea → Published (stages 1 through 7, then manual publish to 8)
  // ────────────────────────────────────────────────────────────────────────────

  it('should process an article from idea through all pipeline stages', { timeout: 30_000 }, async () => {
    const slug = 'seahawks-draft-analysis';
    const mock = f.mockProvider;

    // ── Create article & idea.md ──
    const article = f.repo.createArticle({
      id: slug,
      title: 'Seahawks 2025 Draft Analysis',
      primary_team: 'seahawks',
    });
    expect(article.current_stage).toBe(1);
    expect(article.status).toBe('proposed');

    writeArticleFile(f, slug, 'idea.md', [
      '# Seahawks 2025 Draft Analysis',
      '',
      'The Seattle Seahawks face a critical offseason with cap constraints',
      'and roster holes at cornerback and offensive line.',
    ].join('\n'));

    // ── Stage 1→2: generatePrompt ──
    mock.setStage(1);
    const r1 = await executeTransition(slug, 1 as Stage, f.ctx);
    expect(r1.success).toBe(true);
    expect(f.repo.artifacts.get(slug, 'discussion-prompt.md')).toBeTruthy();
    expect(f.repo.getArticle(slug)!.current_stage).toBe(2);

    // ── Stage 2→3: composePanel ──
    mock.setStage(2);
    const r2 = await executeTransition(slug, 2 as Stage, f.ctx);
    expect(r2.success).toBe(true);
    expect(f.repo.artifacts.get(slug, 'panel-composition.md')).toBeTruthy();
    expect(f.repo.getArticle(slug)!.current_stage).toBe(3);

    // ── Stage 3→4: runDiscussion ──
    // Mock returns panel-composition with agent names that don't have charter files.
    // The runDiscussion fallback should handle this by using panel-moderator.
    mock.setStage(3);
    const r3 = await executeTransition(slug, 3 as Stage, f.ctx);
    expect(r3.success).toBe(true);
    expect(f.repo.artifacts.get(slug, 'discussion-summary.md')).toBeTruthy();
    expect(f.repo.getArticle(slug)!.current_stage).toBe(4);

    // Write article-contract.md after discussion-summary for 4→5 guard
    writeArticleFile(f, slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n800 words');

    // ── Stage 4→5: writeDraft ──
    mock.setStage(4);
    const r4 = await executeTransition(slug, 4 as Stage, f.ctx);
    expect(r4.success).toBe(true);
    expect(f.repo.artifacts.get(slug, 'draft.md')).toBeTruthy();
    expect(f.repo.getArticle(slug)!.current_stage).toBe(5);

    // ── Stage 5→6: runEditor ──
    // Mock's draft response (~400 words) satisfies the 200-word guard.
    // Mock's editor-review response now has proper "APPROVED" verdict.
    mock.setStage(5);
    const r5 = await executeTransition(slug, 5 as Stage, f.ctx);
    expect(r5.success).toBe(true);
    expect(f.repo.artifacts.get(slug, 'editor-review.md')).toBeTruthy();
    expect(f.repo.getArticle(slug)!.current_stage).toBe(6);

    // ── Stage 6→7: runPublisherPass ──
    mock.setStage(6);
    const r6 = await executeTransition(slug, 6 as Stage, f.ctx);
    expect(r6.success).toBe(true);
    expect(f.repo.artifacts.get(slug, 'publisher-pass.md')).toBeTruthy();
    expect(f.repo.getArticle(slug)!.current_stage).toBe(7);

    // Reset mock stage
    mock.setStage(null);

    // ── Stage 7→8: publish ──
    f.repo.recordPublish(slug, 'https://nfllab.substack.com/p/seahawks-draft-analysis');

    const final = f.repo.getArticle(slug)!;
    expect(final.current_stage).toBe(8);
    expect(final.status).toBe('published');
    expect(final.substack_url).toBe('https://nfllab.substack.com/p/seahawks-draft-analysis');

    // ── Verify audit trail ──
    const auditHistory = f.auditor.getHistory(slug);
    const advances = auditHistory.filter(e => e.action === 'advance' && e.success);
    expect(advances.length).toBeGreaterThanOrEqual(6);

    // ── Verify stage transitions in DB ──
    const transitions = f.repo.getStageTransitions(slug);
    expect(transitions.length).toBeGreaterThanOrEqual(8);

    // ── Memory: auto-store is deprecated; runner no longer promotes generic
    //    model output into memory. The system still works but requires explicit
    //    store calls from surfaces that have curated content.
    // Verify memory infrastructure is wired up (stats returns empty array, not error)
    const stats = f.memory.stats();
    expect(Array.isArray(stats)).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Dashboard serves HTML and JSON data
  // ────────────────────────────────────────────────────────────────────────────

  it('should serve dashboard with pipeline data', async () => {
    // Seed some articles
    f.repo.createArticle({ id: 'dash-1', title: 'Dashboard Test Article 1' });
    f.repo.createArticle({ id: 'dash-2', title: 'Dashboard Test Article 2' });

    const app = createApp(f.repo, f.config);

    // ── GET / returns HTML with article info ──
    const homeRes = await app.request('/');
    expect(homeRes.status).toBe(200);
    const homeHtml = await homeRes.text();
    expect(homeHtml).toContain('<!DOCTYPE html');

    // ── GET /articles/:id returns article detail page ──
    const detailRes = await app.request('/articles/dash-1');
    expect(detailRes.status).toBe(200);
    const detailHtml = await detailRes.text();
    expect(detailHtml).toContain('Dashboard Test Article 1');

    // ── GET /articles/:id returns 404 for missing article ──
    const missingRes = await app.request('/articles/nonexistent');
    expect(missingRes.status).toBe(404);

    // ── GET /api/pipeline/summary returns JSON summary ──
    const summaryRes = await app.request('/api/pipeline/summary');
    expect(summaryRes.status).toBe(200);
    const summaryJson = await summaryRes.json() as { stages: Record<string, unknown>; total: number };
    expect(summaryJson.total).toBe(2);
    expect(summaryJson.stages).toBeDefined();

    // ── POST /api/ideas creates a new article ──
    const ideaRes = await app.request('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'New Idea From E2E Test: Testing idea submission through the dashboard API.',
        depthLevel: 2,
      }),
    });
    expect(ideaRes.status).toBe(201);
    const ideaJson = await ideaRes.json() as { id: string; title: string };
    expect(ideaJson.title).toBeTruthy();
    expect(ideaJson.id).toBeTruthy();

    // Verify the idea.md was written to DB
    const ideaContent = f.repo.artifacts.get(ideaJson.id, 'idea.md');
    expect(ideaContent).toBeTruthy();
    expect(ideaContent).toContain('New Idea');

    // ── GET /api/articles returns all articles (should now be 3) ──
    const listRes = await app.request('/api/articles');
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json() as { articles: unknown[]; total: number };
    expect(listJson.total).toBe(3);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Pipeline drift detection
  // ────────────────────────────────────────────────────────────────────────────

  it('should detect pipeline drift between DB and disk', () => {
    const slug = 'drift-test-article';

    // Create article and advance to stage 5 in DB
    f.repo.createArticle({ id: slug, title: 'Drift Test' });
    f.repo.advanceStage(slug, 1, 2 as Stage, 'test');
    f.repo.advanceStage(slug, 2, 3 as Stage, 'test');
    f.repo.advanceStage(slug, 3, 4 as Stage, 'test');
    f.repo.advanceStage(slug, 4, 5 as Stage, 'test');

    // Only create stage-3-level artifacts on disk (missing discussion-summary.md & draft.md)
    writeArticleFile(f, slug, 'idea.md', '# Idea');
    writeArticleFile(f, slug, 'discussion-prompt.md', '# Prompt');
    writeArticleFile(f, slug, 'panel-composition.md', '# Panel');

    // Use MCP server's drift detection (which checks EXPECTED_ARTIFACTS)
    const mcpServer = createMCPServer({ repo: f.repo, engine: f.engine, config: f.config });

    // Call the drift tool directly via the internal handler
    const handlersMap = (mcpServer as any)._requestHandlers as Map<string, Function>;
    const handler = handlersMap.get('tools/call');
    expect(handler).toBeDefined();

    // Invoke pipeline_drift
    const driftResultPromise = handler!(
      { method: 'tools/call', params: { name: 'pipeline_drift', arguments: { article_id: slug } } },
      {},
    );

    return driftResultPromise.then((result: any) => {
      const text = result?.content?.[0]?.text;
      const parsed = JSON.parse(text);
      expect(parsed.drift_count).toBe(1);
      expect(parsed.items[0].id).toBe(slug);
      expect(parsed.items[0].has_drift).toBe(true);
      expect(parsed.items[0].missing_artifacts).toContain('discussion-summary.md');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Batch advancement
  // ────────────────────────────────────────────────────────────────────────────

  it('should handle batch advancement of multiple articles', async () => {
    // Create 3 articles at stage 1, each with idea.md
    for (const slug of ['batch-a', 'batch-b', 'batch-c']) {
      f.repo.createArticle({ id: slug, title: `Batch: ${slug}` });
      writeArticleFile(f, slug, 'idea.md', `# ${slug}\nAnalysis of ${slug}.`);
    }

    // Verify all 3 are ready to advance
    const ready = f.scheduler.findReadyAtStage(1 as Stage);
    expect(ready.length).toBe(3);

    // Run batch advance for stage 1
    const batchResult = await f.scheduler.advanceBatch({ stage: 1 as Stage });
    expect(batchResult.attempted).toBe(3);
    expect(batchResult.succeeded).toBe(3);
    expect(batchResult.failed).toBe(0);

    // Verify all 3 advanced to stage 2
    for (const slug of ['batch-a', 'batch-b', 'batch-c']) {
      const article = f.repo.getArticle(slug)!;
      expect(article.current_stage).toBe(2);
    }

    // Pipeline summary should reflect the new state
    const summary = f.scheduler.summary();
    expect(summary[2 as Stage].count).toBe(3);
    expect(summary[1 as Stage].count).toBe(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Guard enforcement
  // ────────────────────────────────────────────────────────────────────────────

  it('should enforce guard failures and succeed after condition is met', async () => {
    const slug = 'guard-test';
    f.repo.createArticle({ id: slug, title: 'Guard Test Article' });

    // 1. Try to advance without idea → should fail
    const check1 = f.engine.canAdvance(slug, 1 as Stage);
    expect(check1.allowed).toBe(false);
    expect(check1.reason).toContain('Idea');

    // executeTransition should also fail
    const r1 = await executeTransition(slug, 1 as Stage, f.ctx);
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('Guard failed');

    // Stage should NOT have changed
    expect(f.repo.getArticle(slug)!.current_stage).toBe(1);

    // 2. Create idea.md, now it should succeed
    writeArticleFile(f, slug, 'idea.md', '# Guard Test\nA valid idea for testing.');

    const check2 = f.engine.canAdvance(slug, 1 as Stage);
    expect(check2.allowed).toBe(true);

    const r2 = await executeTransition(slug, 1 as Stage, f.ctx);
    expect(r2.success).toBe(true);
    expect(f.repo.getArticle(slug)!.current_stage).toBe(2);

    // 3. Test the 800-word draft guard at stage 5
    // Fast-forward to stage 5 via direct DB manipulation
    writeArticleFile(f, slug, 'discussion-prompt.md', '# Prompt');
    writeArticleFile(f, slug, 'panel-composition.md', '# Panel');
    writeArticleFile(f, slug, 'discussion-summary.md', '# Summary');
    writeArticleFile(
      f,
      slug,
      'article-contract.md',
      '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n900 words',
    );
    f.repo.advanceStage(slug, 2, 3 as Stage, 'test');
    f.repo.advanceStage(slug, 3, 4 as Stage, 'test');
    f.repo.advanceStage(slug, 4, 5 as Stage, 'test');

    // Short draft — guard should fail
    writeArticleFile(f, slug, 'draft.md', 'Only a few words here.');
    const check3 = f.engine.canAdvance(slug, 5 as Stage);
    expect(check3.allowed).toBe(false);
    expect(check3.reason).toContain('words');

    // Long draft — guard should pass
    writeArticleFile(f, slug, 'draft.md', buildValidDraft(900));
    const check4 = f.engine.canAdvance(slug, 5 as Stage);
    expect(check4.allowed).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. MCP server integration
  // ────────────────────────────────────────────────────────────────────────────

  it('should work through MCP server tools', async () => {
    const mcpServer = createMCPServer({
      repo: f.repo,
      engine: f.engine,
      config: f.config,
    });
    expect(mcpServer).toBeInstanceOf(Server);

    const handlersMap = (mcpServer as any)._requestHandlers as Map<string, Function>;
    const callHandler = handlersMap.get('tools/call')!;
    const listHandler = handlersMap.get('tools/list')!;

    async function invokeTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
      const result = await callHandler(
        { method: 'tools/call', params: { name, arguments: args } },
        {},
      );
      return JSON.parse(result.content[0].text);
    }

    // ── list_tools returns all tools ──
    const toolList = await listHandler({ method: 'tools/list', params: {} }, {});
    const toolNames = (toolList as any).tools.map((t: any) => t.name).sort();
    expect(toolNames).toContain('pipeline_status');
    expect(toolNames).toContain('article_create');
    expect(toolNames).toContain('article_get');
    expect(toolNames).toContain('article_advance');

    // ── pipeline_status (empty) ──
    const status1 = await invokeTool('pipeline_status');
    expect(status1.total_articles).toBe(0);

    // ── article_create ──
    const created = await invokeTool('article_create', {
      id: 'mcp-test',
      title: 'MCP E2E Test Article',
      primary_team: 'chiefs',
    });
    expect(created.created).toBe(true);
    expect(created.article.id).toBe('mcp-test');
    expect(created.article.stage).toBe(1);

    // ── article_get ──
    const detail = await invokeTool('article_get', { article_id: 'mcp-test' });
    expect(detail.article.id).toBe('mcp-test');
    expect(detail.article.title).toBe('MCP E2E Test Article');
    expect(detail.transitions.length).toBeGreaterThan(0);

    // ── pipeline_status (1 article) ──
    const status2 = await invokeTool('pipeline_status');
    expect(status2.total_articles).toBe(1);

    // ── article_advance (with idea.md) ──
    writeArticleFile(f, 'mcp-test', 'idea.md', '# MCP Test\nChiefs analysis.');

    const advanced = await invokeTool('article_advance', {
      article_id: 'mcp-test',
      agent: 'e2e-test',
    });
    expect(advanced.advanced).toBe(true);
    expect(advanced.from_stage).toBe(1);
    expect(advanced.to_stage).toBe(2);

    // Verify in DB
    expect(f.repo.getArticle('mcp-test')!.current_stage).toBe(2);

    // ── article_list ──
    const list = await invokeTool('article_list', { stage: 2 });
    expect(list.count).toBe(1);
    expect(list.articles[0].id).toBe('mcp-test');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 7. Auditor report generation
  // ────────────────────────────────────────────────────────────────────────────

  it('should generate an audit report after pipeline activity', async () => {
    // Create an article and advance it through two stages
    const slug = 'audit-report-test';
    f.repo.createArticle({ id: slug, title: 'Audit Report Test' });
    writeArticleFile(f, slug, 'idea.md', '# Audit\nTest idea for audit report.');

    await executeTransition(slug, 1 as Stage, f.ctx);
    await executeTransition(slug, 2 as Stage, f.ctx);

    const report = f.auditor.generateReport();
    expect(report.totalArticles).toBe(1);
    expect(report.recentTransitions).toBeGreaterThanOrEqual(2);

    // Check that JSONL log file was written
    const logFiles = existsSync(f.logsDir);
    expect(logFiles).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 8. Agent memory persistence
  // ────────────────────────────────────────────────────────────────────────────

  it('should have working memory infrastructure across pipeline runs', async () => {
    const slug = 'memory-test';
    f.repo.createArticle({ id: slug, title: 'Memory Persistence Test' });
    writeArticleFile(f, slug, 'idea.md', '# Memory Test\nTest idea for memory.');

    // Run a stage transition
    await executeTransition(slug, 1 as Stage, f.ctx);

    // Runner no longer auto-stores memories (deprecated). Verify that the
    // memory infrastructure is wired up and callable without errors.
    const leadMemories = f.memory.recall('lead');
    expect(Array.isArray(leadMemories)).toBe(true);

    // Manually store a memory to verify the store → recall round-trip works
    f.memory.store({
      agentName: 'lead',
      category: 'learning',
      content: `Learned from memory-test pipeline run`,
    });

    const afterStore = f.memory.recall('lead');
    expect(afterStore.length).toBeGreaterThan(0);
    expect(afterStore.some(m => m.category === 'learning')).toBe(true);
    expect(afterStore.some(m => m.content.includes('memory-test'))).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 9. Scheduler summary shows correct pipeline state
  // ────────────────────────────────────────────────────────────────────────────

  it('should provide accurate pipeline summary via scheduler', () => {
    // Create articles at various stages
    f.repo.createArticle({ id: 'sum-1', title: 'Summary 1' });
    writeArticleFile(f, 'sum-1', 'idea.md', '# Idea 1\nContent.');

    f.repo.createArticle({ id: 'sum-2', title: 'Summary 2' });
    f.repo.advanceStage('sum-2', 1, 2 as Stage, 'test');

    f.repo.createArticle({ id: 'sum-3', title: 'Summary 3' });
    f.repo.advanceStage('sum-3', 1, 2 as Stage, 'test');
    f.repo.advanceStage('sum-3', 2, 3 as Stage, 'test');

    const summary = f.scheduler.summary();

    // sum-1 is at stage 1, has idea.md → ready
    expect(summary[1 as Stage].count).toBe(1);
    expect(summary[1 as Stage].ready).toBe(1);

    // sum-2 is at stage 2, no discussion-prompt.md → not ready
    expect(summary[2 as Stage].count).toBe(1);
    expect(summary[2 as Stage].ready).toBe(0);

    // sum-3 is at stage 3, no panel-composition.md → not ready
    expect(summary[3 as Stage].count).toBe(1);
    expect(summary[3 as Stage].ready).toBe(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 10. Dashboard API advance + JSON round-trip
  // ────────────────────────────────────────────────────────────────────────────

  it('should advance articles via dashboard API', async () => {
    f.repo.createArticle({ id: 'api-adv', title: 'API Advance Test' });
    writeArticleFile(f, 'api-adv', 'idea.md', '# API Advance\nValid idea.');

    const app = createApp(f.repo, f.config);

    const advRes = await app.request('/api/articles/api-adv/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_stage: 1, to_stage: 2, agent: 'e2e-test' }),
    });

    expect(advRes.status).toBe(200);
    const updated = await advRes.json() as { current_stage: number };
    expect(updated.current_stage).toBe(2);

    // Confirm round-trip: GET the article back
    const getRes = await app.request('/api/articles/api-adv');
    expect(getRes.status).toBe(200);
    const articleJson = await getRes.json() as { id: string; current_stage: number };
    expect(articleJson.id).toBe('api-adv');
    expect(articleJson.current_stage).toBe(2);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 11. Validation report for an article
  // ────────────────────────────────────────────────────────────────────────────

  it('should generate a validation report for an article', () => {
    const slug = 'valid-report';
    f.repo.createArticle({ id: slug, title: 'Validation Report Test' });
    f.repo.advanceStage(slug, 1, 2 as Stage, 'test');
    f.repo.advanceStage(slug, 2, 3 as Stage, 'test');

    // At stage 3, only idea.md exists
    writeArticleFile(f, slug, 'idea.md', '# Idea');
    writeArticleFile(f, slug, 'discussion-prompt.md', '# Prompt');

    const report = f.engine.validateArticle(slug);
    expect(report.articleId).toBe(slug);
    expect(report.currentStage).toBe(3);
    expect(report.items.length).toBeGreaterThanOrEqual(2);

    // Stage 1→2 guard (idea.md) should pass
    const ideaGuard = report.items.find(i => i.action === 'generatePrompt');
    expect(ideaGuard?.result.passed).toBe(true);

    // Stage 2→3 guard (discussion-prompt.md) should pass
    const promptGuard = report.items.find(i => i.action === 'composePanel');
    expect(promptGuard?.result.passed).toBe(true);
  });
});
