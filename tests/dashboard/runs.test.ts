/**
 * tests/dashboard/runs.test.ts
 *
 * Tests for the Pipeline Runs page:
 *   GET /runs          — 200 with runs table
 *   GET /runs?status=error — filters to errors only
 *   Empty state when no runs exist
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';

function makeTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    dataDir: '/tmp/test-runs',
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
    dbPath: '/tmp/test-runs/pipeline.db',
    articlesDir: '/tmp/test-runs/articles',
    imagesDir: '/tmp/test-runs/images',
    chartersDir: '/tmp/test-runs/charters',
    skillsDir: '/tmp/test-runs/skills',
    memoryDbPath: '/tmp/test-runs/memory.db',
    logsDir: '/tmp/test-runs/logs',
    cacheDir: '/tmp/test/data-cache',
    port: 3457,
    env: 'development',
    ...overrides,
  };
}

describe('Pipeline Runs page', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-runs-test-'));
    const dbPath = join(tempDir, 'test.db');
    const articlesDir = join(tempDir, 'articles');
    mkdirSync(articlesDir, { recursive: true });
    repo = new Repository(dbPath);
    app = createApp(repo, makeTestConfig({ dbPath, articlesDir }));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Helper to seed data ────────────────────────────────────────────────────

  function createArticleAndRun(
    articleId: string,
    articleTitle: string,
    status: 'completed' | 'failed' | 'started' = 'completed',
    notes: string | null = null,
  ): string {
    repo.createArticle({ id: articleId, title: articleTitle });
    const runId = repo.startStageRun({
      articleId,
      stage: 1,
      surface: 'ideaGeneration',
      actor: 'test-agent',
      requestedModel: 'gpt-4o',
    });
    if (status !== 'started') {
      repo.finishStageRun(runId, status, notes);
    }
    return runId;
  }

  // ── GET /runs ──────────────────────────────────────────────────────────────

  describe('GET /runs', () => {
    it('returns 200 with HTML page', async () => {
      const res = await app.request('/runs');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('includes page title and nav', async () => {
      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('Pipeline Runs');
      expect(html).toContain('📊 Runs');
    });

    it('shows runs table with correct columns', async () => {
      createArticleAndRun('article-1', 'My Test Article');

      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('<table');
      expect(html).toContain('<th>Time</th>');
      expect(html).toContain('<th>Article</th>');
      expect(html).toContain('<th>Stage</th>');
      expect(html).toContain('<th>Status</th>');
      expect(html).toContain('<th>Model</th>');
      expect(html).toContain('<th>Duration</th>');
      expect(html).toContain('<th>Tokens</th>');
      expect(html).toContain('<th>Error</th>');
    });

    it('shows article title as link to article detail', async () => {
      createArticleAndRun('article-link-test', 'Linked Article Title');

      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('Linked Article Title');
      expect(html).toContain('/articles/article-link-test');
    });

    it('shows success badge for completed runs', async () => {
      createArticleAndRun('article-ok', 'Success Article', 'completed');

      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('✅');
      expect(html).toContain('success');
    });

    it('shows error badge for failed runs', async () => {
      createArticleAndRun('article-fail', 'Failed Article', 'failed', 'Something went wrong');

      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('❌');
      expect(html).toContain('error');
    });

    it('shows error notes in error column for failed runs', async () => {
      createArticleAndRun('article-err', 'Error Article', 'failed', 'Upstream LLM timeout');

      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('Upstream LLM timeout');
      expect(html).toContain('<code');
    });

    it('shows model name in model column', async () => {
      createArticleAndRun('article-model', 'Model Article', 'completed');

      const res = await app.request('/runs');
      const html = await res.text();
      expect(html).toContain('gpt-4o');
    });

    it('shows most recent runs first (desc order)', async () => {
      createArticleAndRun('older-article', 'Older Article', 'completed');
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) { /* spin */ }
      createArticleAndRun('newer-article', 'Newer Article', 'completed');

      const res = await app.request('/runs');
      const html = await res.text();
      const newerPos = html.indexOf('Newer Article');
      const olderPos = html.indexOf('Older Article');
      expect(newerPos).toBeLessThan(olderPos);
    });
  });

  // ── GET /runs?status=error (error filter) ──────────────────────────────────

  describe('GET /runs?status=error', () => {
    it('filters to error runs only', async () => {
      createArticleAndRun('ok-article', 'OK Article', 'completed');
      createArticleAndRun('err-article', 'Error Article', 'failed', 'Timeout error');

      const res = await app.request('/runs?status=error');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Error Article');
      expect(html).not.toContain('OK Article');
    });

    it('shows error notes when filtering to failed', async () => {
      createArticleAndRun('fail-article', 'Fail Article', 'failed', 'Rate limit exceeded');

      const res = await app.request('/runs?status=error');
      const html = await res.text();
      expect(html).toContain('Rate limit exceeded');
    });
  });

  // ── GET /runs?status=success ───────────────────────────────────────────────

  describe('GET /runs?status=success', () => {
    it('filters to completed runs only', async () => {
      createArticleAndRun('done-article', 'Done Article', 'completed');
      createArticleAndRun('bad-article', 'Bad Article', 'failed', 'Error');

      const res = await app.request('/runs?status=success');
      const html = await res.text();
      expect(html).toContain('Done Article');
      expect(html).not.toContain('Bad Article');
    });
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state when no runs exist', async () => {
      const res = await app.request('/runs');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No pipeline runs recorded yet');
    });

    it('shows filter empty state when no runs match', async () => {
      createArticleAndRun('only-completed', 'Only Completed Article', 'completed');

      const res = await app.request('/runs?status=error');
      const html = await res.text();
      expect(html).toContain('No runs match your filters');
    });
  });

  // ── HTMX partial /htmx/runs ────────────────────────────────────────────────

  describe('GET /htmx/runs', () => {
    it('returns 200 with runs table fragment', async () => {
      createArticleAndRun('htmx-article', 'HTMX Article', 'completed');

      const res = await app.request('/htmx/runs');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('HTMX Article');
      expect(html).toContain('<table');
    });

    it('filters by status', async () => {
      createArticleAndRun('htmx-ok', 'HTMX OK', 'completed');
      createArticleAndRun('htmx-fail', 'HTMX Fail', 'failed', 'Error msg');

      const res = await app.request('/htmx/runs?status=error');
      const html = await res.text();
      expect(html).toContain('HTMX Fail');
      expect(html).not.toContain('HTMX OK');
    });

    it('returns empty state fragment when no runs', async () => {
      const res = await app.request('/htmx/runs');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No pipeline runs recorded yet');
      expect(html).not.toContain('<!DOCTYPE html>');
    });
  });

  // ── Nav link ───────────────────────────────────────────────────────────────

  describe('nav link', () => {
    it('home page includes 📊 Runs nav link', async () => {
      const res = await app.request('/');
      const html = await res.text();
      expect(html).toContain('href="/runs"');
      expect(html).toContain('📊 Runs');
    });
  });
});
