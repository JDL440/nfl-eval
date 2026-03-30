/**
 * traces.test.ts — Tests for the Trace Page UX overhaul:
 *   - Enriched card headers (stage badge, task family, provider, token split, model delta, duration, param pills)
 *   - Internals toggle (hidden for completed, shown for failed)
 *   - Context & Injection section (skills, memories, article context, etc.)
 *   - Copy trace ID button
 *   - Data attributes on cards
 *   - Filter bar on timeline
 *   - Stage dividers
 *   - Standalone page with prev/next navigation
 *   - Adjacent traces query
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';

function makeTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    dataDir: '/tmp/test',
    league: 'nfl',
    leagueConfig: {
      name: 'NFL Lab',
      panelName: 'Test Panel',
      dataSource: 'nflverse',
      positions: [],
      substackConfig: {
        labName: 'NFL Lab',
        subscribeCaption: 'Test',
        footerPatterns: [],
      },
    },
    dbPath: '/tmp/test/pipeline.db',
    articlesDir: '/tmp/test/articles',
    imagesDir: '/tmp/test/images',
    chartersDir: '/tmp/test/charters',
    skillsDir: '/tmp/test/skills',
    memoryDbPath: '/tmp/test/memory.db',
    logsDir: '/tmp/test/logs',
    cacheDir: '/tmp/test/data-cache',
    port: 3456,
    env: 'development',
    ...overrides,
  };
}

// ── Phase 1: Enriched Headers & Internals ───────────────────────────────────

describe('Trace page — enriched headers & internals', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'trace-test-'));
    const dbPath = join(tempDir, 'pipeline.db');
    repo = new Repository(dbPath);
    const config = makeTestConfig({ dbPath, articlesDir: join(tempDir, 'articles') });
    app = createApp(repo, config);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('renders stage badge for known stage', async () => {
    repo.createArticle({ id: 'a1', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a1',
      stage: 3,
      agentName: 'writer',
      surface: 'copilot',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o', outputText: 'ok' });

    const res = await app.request('/articles/a1/traces');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stage 3');
    expect(html).toContain('Panel Composition');
  });

  it('renders stage badge null fallback', async () => {
    repo.createArticle({ id: 'a2', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a2',
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/a2/traces');
    const html = await res.text();
    expect(html).toContain('Stage ?');
  });

  it('renders task family badge', async () => {
    repo.createArticle({ id: 'a3', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a3',
      stage: 5,
      agentName: 'writer',
      taskFamily: 'draft-article',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/a3/traces');
    const html = await res.text();
    expect(html).toContain('draft-article');
    expect(html).toContain('trace-pill-family');
  });

  it('shows provider label when present', async () => {
    repo.createArticle({ id: 'a4', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a4',
      stage: 5,
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, { provider: 'anthropic', model: 'claude-sonnet-4' });

    const res = await app.request('/articles/a4/traces');
    const html = await res.text();
    expect(html).toContain('Provider:');
    expect(html).toContain('anthropic');
  });

  it('displays token split', async () => {
    repo.createArticle({ id: 'a5', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a5',
      stage: 5,
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, {
      model: 'gpt-4o',
      promptTokens: 2500,
      completionTokens: 1200,
    });

    const res = await app.request('/articles/a5/traces');
    const html = await res.text();
    expect(html).toContain('2.5k in');
    expect(html).toContain('1.2k out');
  });

  it('shows model delta when requested differs from actual', async () => {
    repo.createArticle({ id: 'a6', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a6',
      stage: 5,
      agentName: 'writer',
      requestedModel: 'gpt-4o',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o-mini' });

    const res = await app.request('/articles/a6/traces');
    const html = await res.text();
    expect(html).toContain('(req:');
    expect(html).toContain('gpt-4o-mini');
    expect(html).toContain('gpt-4o');
  });

  it('shows Duration label instead of Latency', async () => {
    repo.createArticle({ id: 'a7', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a7',
      stage: 5,
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o', latencyMs: 1500 });

    const res = await app.request('/articles/a7/traces');
    const html = await res.text();
    expect(html).toContain('Duration:');
    expect(html).not.toContain('Latency:');
  });

  it('renders parameter pills for temperature', async () => {
    repo.createArticle({ id: 'a8', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a8',
      stage: 5,
      agentName: 'writer',
      temperature: 0.7,
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/a8/traces');
    const html = await res.text();
    expect(html).toContain('trace-pill');
    expect(html).toContain('temp');
    expect(html).toContain('0.7');
  });

  it('hides internals for completed traces', async () => {
    repo.createArticle({ id: 'a9', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a9',
      stage: 5,
      agentName: 'writer',
      systemPrompt: 'You are a test agent',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o', outputText: 'done' });

    const res = await app.request('/articles/a9/traces');
    const html = await res.text();
    expect(html).toContain('trace-internals-hidden');
  });

  it('shows internals for failed traces', async () => {
    repo.createArticle({ id: 'a10', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a10',
      stage: 5,
      agentName: 'writer',
      systemPrompt: 'You are a test agent',
    });
    repo.failLlmTrace(traceId, { errorMessage: 'timeout' });

    const res = await app.request('/articles/a10/traces');
    const html = await res.text();
    // The failed trace card should exist
    expect(html).toContain(`id="trace-${traceId}"`);
    // Extract the card section for this trace
    const cardStart = html.indexOf(`id="trace-${traceId}"`);
    const cardSection = html.slice(cardStart, cardStart + 3000);
    // Internals should be present but NOT hidden — class should be "trace-internals" without "-hidden"
    expect(cardSection).toContain('trace-internals');
    expect(cardSection).not.toContain('trace-internals-hidden');
  });

  it('timeline card links to standalone page', async () => {
    repo.createArticle({ id: 'a11', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'a11',
      stage: 5,
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/a11/traces');
    const html = await res.text();
    expect(html).toContain(`href="/traces/${traceId}"`);
  });
});

// ── Phase 2: Context & Copy ─────────────────────────────────────────────────

describe('Trace page — context & copy', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'trace-ctx-'));
    const dbPath = join(tempDir, 'pipeline.db');
    repo = new Repository(dbPath);
    const config = makeTestConfig({ dbPath, articlesDir: join(tempDir, 'articles') });
    app = createApp(repo, config);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('renders skills in context injection', async () => {
    repo.createArticle({ id: 'c1', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'c1',
      stage: 5,
      agentName: 'writer',
      skills: ['data-analysis', 'narrative-writing'],
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/c1/traces');
    const html = await res.text();
    expect(html).toContain('Skills');
    expect(html).toContain('Context & Injection');
  });

  it('renders memories in context injection', async () => {
    repo.createArticle({ id: 'c2', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'c2',
      stage: 5,
      agentName: 'writer',
      memories: [{ text: 'Always cite sources', relevance: 0.9 }],
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/c2/traces');
    const html = await res.text();
    expect(html).toContain('Memories');
    expect(html).toContain('Context & Injection');
  });

  it('omits context section when all context fields are null', async () => {
    repo.createArticle({ id: 'c3', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'c3',
      stage: 5,
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/c3/traces');
    const html = await res.text();
    expect(html).not.toContain('Context & Injection');
  });

  it('includes copy button on trace cards', async () => {
    repo.createArticle({ id: 'c4', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'c4',
      stage: 5,
      agentName: 'writer',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/c4/traces');
    const html = await res.text();
    expect(html).toContain('trace-copy-btn');
  });
});

// ── Phase 3: Filtering & Navigation ─────────────────────────────────────────

describe('Trace page — filtering & data attributes', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'trace-filt-'));
    const dbPath = join(tempDir, 'pipeline.db');
    repo = new Repository(dbPath);
    const config = makeTestConfig({ dbPath, articlesDir: join(tempDir, 'articles') });
    app = createApp(repo, config);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('includes data attributes on trace cards', async () => {
    repo.createArticle({ id: 'f1', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 'f1',
      stage: 3,
      agentName: 'composer',
      surface: 'copilot',
    });
    repo.completeLlmTrace(traceId, { model: 'gpt-4o' });

    const res = await app.request('/articles/f1/traces');
    const html = await res.text();
    expect(html).toContain('data-stage="3"');
    expect(html).toContain('data-agent="composer"');
    expect(html).toContain('data-status="completed"');
  });

  it('renders filter bar for multiple traces', async () => {
    repo.createArticle({ id: 'f2', title: 'Test' });
    const t1 = repo.startLlmTrace({ articleId: 'f2', stage: 3, agentName: 'composer' });
    repo.completeLlmTrace(t1, { model: 'gpt-4o' });
    const t2 = repo.startLlmTrace({ articleId: 'f2', stage: 5, agentName: 'writer' });
    repo.completeLlmTrace(t2, { model: 'gpt-4o' });

    const res = await app.request('/articles/f2/traces');
    const html = await res.text();
    expect(html).toContain('trace-filter-bar');
  });

  it('omits filter bar for single trace', async () => {
    repo.createArticle({ id: 'f3', title: 'Test' });
    const t1 = repo.startLlmTrace({ articleId: 'f3', stage: 5, agentName: 'writer' });
    repo.completeLlmTrace(t1, { model: 'gpt-4o' });

    const res = await app.request('/articles/f3/traces');
    const html = await res.text();
    expect(html).not.toContain('trace-filter-bar');
  });

  it('renders stage dividers between stage groups', async () => {
    repo.createArticle({ id: 'f4', title: 'Test' });
    const t1 = repo.startLlmTrace({ articleId: 'f4', stage: 3, agentName: 'composer' });
    repo.completeLlmTrace(t1, { model: 'gpt-4o' });
    const t2 = repo.startLlmTrace({ articleId: 'f4', stage: 5, agentName: 'writer' });
    repo.completeLlmTrace(t2, { model: 'gpt-4o' });

    const res = await app.request('/articles/f4/traces');
    const html = await res.text();
    expect(html).toContain('trace-stage-divider');
  });
});

// ── Phase 4: Standalone Page & Adjacent Traces ──────────────────────────────

describe('Trace page — standalone & adjacent navigation', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'trace-nav-'));
    const dbPath = join(tempDir, 'pipeline.db');
    repo = new Repository(dbPath);
    const config = makeTestConfig({ dbPath, articlesDir: join(tempDir, 'articles') });
    app = createApp(repo, config);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('renders standalone page with sections', async () => {
    repo.createArticle({ id: 's1', title: 'Test' });
    const traceId = repo.startLlmTrace({
      articleId: 's1',
      stage: 5,
      agentName: 'writer',
      systemPrompt: 'You are a writer',
      userMessage: 'Write about football',
    });
    repo.completeLlmTrace(traceId, {
      model: 'gpt-4o',
      outputText: 'Here is the article',
      provider: 'openai',
    });

    const res = await app.request(`/traces/${traceId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Trace detail');
    expect(html).toContain('detail-section');
    expect(html).toContain('writer');
    expect(html).toContain('Duration:');
  });

  it('shows prev/next links for middle trace', async () => {
    repo.createArticle({ id: 's2', title: 'Test' });
    // Create three traces
    const t1 = repo.startLlmTrace({ articleId: 's2', stage: 3, agentName: 'a1' });
    repo.completeLlmTrace(t1, { model: 'gpt-4o' });
    const t2 = repo.startLlmTrace({ articleId: 's2', stage: 5, agentName: 'a2' });
    repo.completeLlmTrace(t2, { model: 'gpt-4o' });
    const t3 = repo.startLlmTrace({ articleId: 's2', stage: 6, agentName: 'a3' });
    repo.completeLlmTrace(t3, { model: 'gpt-4o' });

    // Determine the middle trace from the actual DB ordering
    const allTraces = repo.getArticleLlmTraces('s2', 0);
    expect(allTraces.length).toBe(3);
    const middleId = allTraces[1].id;

    const res = await app.request(`/traces/${middleId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('← Previous');
    expect(html).toContain('Next →');
  });

  it('getAdjacentTraces returns correct prev/next IDs', () => {
    repo.createArticle({ id: 's3', title: 'Test' });
    const t1 = repo.startLlmTrace({ articleId: 's3', stage: 3, agentName: 'a1' });
    repo.completeLlmTrace(t1, { model: 'gpt-4o' });
    const t2 = repo.startLlmTrace({ articleId: 's3', stage: 5, agentName: 'a2' });
    repo.completeLlmTrace(t2, { model: 'gpt-4o' });
    const t3 = repo.startLlmTrace({ articleId: 's3', stage: 6, agentName: 'a3' });
    repo.completeLlmTrace(t3, { model: 'gpt-4o' });

    // Get actual ordering from DB (started_at DESC, id DESC)
    const allTraces = repo.getArticleLlmTraces('s3', 0);
    expect(allTraces.length).toBe(3);
    const [first, middle, last] = allTraces;

    // Middle trace should have both prev and next
    const midAdj = repo.getAdjacentTraces('s3', middle.id);
    expect(midAdj.prevId).toBe(first.id);
    expect(midAdj.nextId).toBe(last.id);

    // First in list has no prev
    const firstAdj = repo.getAdjacentTraces('s3', first.id);
    expect(firstAdj.prevId).toBeNull();
    expect(firstAdj.nextId).toBe(middle.id);

    // Last in list has no next
    const lastAdj = repo.getAdjacentTraces('s3', last.id);
    expect(lastAdj.prevId).toBe(middle.id);
    expect(lastAdj.nextId).toBeNull();
  });
});
