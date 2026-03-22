import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
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

describe('Dashboard Server', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-dash-test-'));
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

  // ── HTML pages ──────────────────────────────────────────────────────────────

  describe('HTML pages', () => {
    it('home page returns 200 with HTML', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('NFL Lab');
      expect(html).toContain('Ready to Publish');
      expect(html).toContain('Pipeline');
      expect(html).toContain('Recent Ideas');
    });

    it('home page shows articles in correct sections', async () => {
      repo.createArticle({ id: 'idea-1', title: 'Idea One' });
      repo.createArticle({ id: 'ready-1', title: 'Ready One' });
      // Advance ready-1 through stages to 7
      for (let s = 2; s <= 7; s++) {
        repo.advanceStage('ready-1', s - 1, s, 'test');
      }

      const res = await app.request('/');
      const html = await res.text();
      expect(html).toContain('Idea One');
      expect(html).toContain('Ready One');
    });

    it('article detail page renders', async () => {
      repo.createArticle({ id: 'detail-test', title: 'Detail Test Article' });

      const res = await app.request('/articles/detail-test');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Detail Test Article');
      expect(html).toContain('Stage 1');
      expect(html).toContain('Audit Log');
      expect(html).toContain('Agent Context Settings');
      expect(html).toContain('/htmx/articles/detail-test/context-config');
    });

    it('article detail returns 404 for missing article', async () => {
      const res = await app.request('/articles/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ── API routes ──────────────────────────────────────────────────────────────

  describe('API routes', () => {
    it('GET /api/articles returns JSON array', async () => {
      repo.createArticle({ id: 'api-1', title: 'API One' });
      repo.createArticle({ id: 'api-2', title: 'API Two' });

      const res = await app.request('/api/articles');
      expect(res.status).toBe(200);
      const body = await res.json() as { articles: unknown[]; total: number };
      expect(body.articles).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('GET /api/articles filters by stage', async () => {
      repo.createArticle({ id: 'filter-1', title: 'Filter One' });
      repo.createArticle({ id: 'filter-2', title: 'Filter Two' });
      repo.advanceStage('filter-2', 1, 2, 'test');

      const res = await app.request('/api/articles?stage=1');
      const body = await res.json() as { articles: { id: string }[]; total: number };
      expect(body.total).toBe(1);
      expect(body.articles[0].id).toBe('filter-1');
    });

    it('GET /api/articles/:id returns single article', async () => {
      repo.createArticle({ id: 'single-1', title: 'Single One' });

      const res = await app.request('/api/articles/single-1');
      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; title: string };
      expect(body.id).toBe('single-1');
      expect(body.title).toBe('Single One');
    });

    it('GET /api/articles/:id returns 404 for missing', async () => {
      const res = await app.request('/api/articles/missing');
      expect(res.status).toBe(404);
      const body = await res.json() as { error: string };
      expect(body.error).toBeDefined();
    });

    it('POST /api/articles creates article', async () => {
      const res = await app.request('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'new-idea', title: 'New Idea', primary_team: 'seahawks' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string; current_stage: number; primary_team: string };
      expect(body.id).toBe('new-idea');
      expect(body.current_stage).toBe(1);
      expect(body.primary_team).toBe('seahawks');

      // Verify it persists
      const check = repo.getArticle('new-idea');
      expect(check).not.toBeNull();
      expect(check!.title).toBe('New Idea');
    });

    it('POST /api/articles returns 400 without required fields', async () => {
      const res = await app.request('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'no-title' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/articles/:id/advance advances stage', async () => {
      repo.createArticle({ id: 'advance-test', title: 'Advance Test' });

      const res = await app.request('/api/articles/advance-test/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_stage: 1, to_stage: 2, agent: 'test' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { current_stage: number };
      expect(body.current_stage).toBe(2);

      // Verify in DB
      const article = repo.getArticle('advance-test');
      expect(article!.current_stage).toBe(2);
    });

    it('POST /api/articles/:id/advance returns 400 for stage mismatch', async () => {
      repo.createArticle({ id: 'mismatch-test', title: 'Mismatch' });

      const res = await app.request('/api/articles/mismatch-test/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_stage: 3, to_stage: 4 }),
      });
      expect(res.status).toBe(400);
    });

    it('GET /api/pipeline/summary returns correct counts', async () => {
      repo.createArticle({ id: 'sum-1', title: 'S1' });
      repo.createArticle({ id: 'sum-2', title: 'S2' });
      repo.createArticle({ id: 'sum-3', title: 'S3' });
      repo.advanceStage('sum-2', 1, 2, 'test');

      const res = await app.request('/api/pipeline/summary');
      expect(res.status).toBe(200);
      const body = await res.json() as {
        stages: Record<string, { name: string; count: number }>;
        total: number;
      };
      expect(body.total).toBe(3);
      expect(body.stages['1'].count).toBe(2);
      expect(body.stages['1'].name).toBe('Idea Generation');
      expect(body.stages['2'].count).toBe(1);
      expect(body.stages['2'].name).toBe('Discussion Prompt');
    });
  });

  // ── htmx partials ──────────────────────────────────────────────────────────

  describe('htmx partial routes', () => {
    it('GET /htmx/pipeline-summary returns HTML fragment', async () => {
      repo.createArticle({ id: 'htmx-1', title: 'H1' });

      const res = await app.request('/htmx/pipeline-summary');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('pipeline-overview');
      expect(html).toContain('Idea Generation');
      // Should be a fragment, not a full page
      expect(html).not.toContain('<!DOCTYPE html>');
    });

    it('GET /htmx/ready-to-publish returns HTML fragment', async () => {
      const res = await app.request('/htmx/ready-to-publish');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No articles ready to publish');
    });

    it('GET /htmx/ready-to-publish shows stage 7 articles', async () => {
      repo.createArticle({ id: 'pub-ready', title: 'Pub Ready' });
      for (let s = 2; s <= 7; s++) {
        repo.advanceStage('pub-ready', s - 1, s, 'test');
      }

      const res = await app.request('/htmx/ready-to-publish');
      const html = await res.text();
      expect(html).toContain('Pub Ready');
      expect(html).toContain('card-ready');
    });

    it('GET /htmx/recent-ideas returns HTML fragment', async () => {
      repo.createArticle({ id: 'idea-htmx', title: 'Idea Htmx' });

      const res = await app.request('/htmx/recent-ideas');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Idea Htmx');
      expect(html).toContain('card-idea');
    });

    it('GET /htmx/articles/:id/context-config returns defaults when no overrides', async () => {
      repo.createArticle({ id: 'ctx-1', title: 'Ctx One' });

      const res = await app.request('/htmx/articles/ctx-1/context-config');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('context-config-form');

      const idx = html.indexOf('data-stage="composePanel"');
      expect(idx).toBeGreaterThanOrEqual(0);
      const composeSection = html.slice(idx);
      // composePanel includes idea.md by default
      expect(composeSection).toMatch(/name="composePanel" value="idea\.md" checked/);
      expect(html).toContain('type="checkbox"');
    });

    it('POST /api/articles/:id/context-config saves overrides and DELETE resets', async () => {
      repo.createArticle({ id: 'ctx-2', title: 'Ctx Two' });

      const body = new URLSearchParams();
      body.append('composePanel', 'idea.md');
      body.append('composePanel', 'discussion-summary.md');
      body.append('writeDraft', 'discussion-prompt.md');

      function extractStage(html: string, stage: string): string {
        const idx = html.indexOf(`data-stage="${stage}"`);
        if (idx < 0) return '';
        const rest = html.slice(idx);
        const nextIdx = rest.slice(1).search(/data-stage="/);
        return nextIdx >= 0 ? rest.slice(0, nextIdx + 1) : rest;
      }

      const postRes = await app.request('/api/articles/ctx-2/context-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'hx-request': 'true',
        },
        body: body.toString(),
      });
      expect(postRes.status).toBe(200);
      expect(repo.artifacts.get('ctx-2', '_config.json')).toBeTruthy();
      const postHtml = await postRes.text();
      const postCompose = extractStage(postHtml, 'composePanel');
      const postWrite = extractStage(postHtml, 'writeDraft');
      expect(postCompose).toMatch(/name="composePanel" value="discussion-summary\.md" checked/);
      expect(postWrite).toMatch(/name="writeDraft" value="discussion-prompt\.md" checked/);

      const delRes = await app.request('/api/articles/ctx-2/context-config', {
        method: 'DELETE',
        headers: { 'hx-request': 'true' },
      });
      expect(delRes.status).toBe(200);
      expect(repo.artifacts.get('ctx-2', '_config.json')).toBeNull();
      const delHtml = await delRes.text();
      const delCompose = extractStage(delHtml, 'composePanel');
      // back to defaults: composePanel includes idea.md but not discussion-summary.md
      expect(delCompose).toMatch(/name="composePanel" value="idea\.md" checked/);
      expect(delCompose).not.toMatch(/name="composePanel" value="discussion-summary\.md" checked/);
    });

    it('GET /htmx/published returns HTML fragment', async () => {
      const res = await app.request('/htmx/published');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No recently published');
    });

    it('GET /htmx/stage/:stage returns HTML fragment', async () => {
      repo.createArticle({ id: 'stage-htmx', title: 'Stage Htmx' });

      const res = await app.request('/htmx/stage/1');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Stage Htmx');
      expect(html).toContain('Idea Generation');
    });
  });

  // ── Repository additions ───────────────────────────────────────────────────

  describe('repository new methods', () => {
    it('getStageTransitions returns transitions in order', () => {
      repo.createArticle({ id: 'trans-test', title: 'Trans Test' });
      repo.advanceStage('trans-test', 1, 2, 'agent-a', 'note-a');
      repo.advanceStage('trans-test', 2, 3, 'agent-b', 'note-b');

      const transitions = repo.getStageTransitions('trans-test');
      // Initial creation + 2 advances = 3 transitions
      expect(transitions.length).toBe(3);
      expect(transitions[0].to_stage).toBe(1); // creation
      expect(transitions[1].to_stage).toBe(2);
      expect(transitions[2].to_stage).toBe(3);
      expect(transitions[1].agent).toBe('agent-a');
    });

    it('getPublisherPass returns null when no pass exists', () => {
      repo.createArticle({ id: 'no-pass', title: 'No Pass' });
      expect(repo.getPublisherPass('no-pass')).toBeNull();
    });

    it('getPublisherPass returns pass when recorded', () => {
      repo.createArticle({ id: 'has-pass', title: 'Has Pass' });
      // Advance to stage 6 first
      for (let s = 2; s <= 6; s++) {
        repo.advanceStage('has-pass', s - 1, s, 'test');
      }
      repo.recordPublisherPass('has-pass', { title_final: 1, body_clean: 1 });

      const pass = repo.getPublisherPass('has-pass');
      expect(pass).not.toBeNull();
      expect(pass!.title_final).toBe(1);
      expect(pass!.body_clean).toBe(1);
      expect(pass!.subtitle_final).toBe(0);
    });

    it('listArticles with no filters returns all', () => {
      repo.createArticle({ id: 'list-1', title: 'L1' });
      repo.createArticle({ id: 'list-2', title: 'L2' });

      const all = repo.listArticles();
      expect(all).toHaveLength(2);
    });

    it('listArticles filters by stage', () => {
      repo.createArticle({ id: 'ls-1', title: 'LS1' });
      repo.createArticle({ id: 'ls-2', title: 'LS2' });
      repo.advanceStage('ls-2', 1, 2, 'test');

      const stage1 = repo.listArticles({ stage: 1 });
      expect(stage1).toHaveLength(1);
      expect(stage1[0].id).toBe('ls-1');

      const stage2 = repo.listArticles({ stage: 2 });
      expect(stage2).toHaveLength(1);
      expect(stage2[0].id).toBe('ls-2');
    });

    it('listArticles filters by status', () => {
      repo.createArticle({ id: 'st-1', title: 'ST1' });
      const articles = repo.listArticles({ status: 'proposed' });
      expect(articles).toHaveLength(1);

      const none = repo.listArticles({ status: 'published' });
      expect(none).toHaveLength(0);
    });

    it('listArticles respects limit', () => {
      for (let i = 0; i < 5; i++) {
        repo.createArticle({ id: `lim-${i}`, title: `Lim ${i}` });
      }
      const limited = repo.listArticles({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  // ── Article detail view enhancements ──────────────────────────────────────

  describe('article detail view', () => {
    it('renders stage timeline with stage-dot classes', async () => {
      repo.createArticle({ id: 'timeline-test', title: 'Timeline Test' });
      repo.advanceStage('timeline-test', 1, 2, 'test');

      const res = await app.request('/articles/timeline-test');
      const html = await res.text();
      expect(html).toContain('stage-dot completed');
      expect(html).toContain('stage-dot current');
      expect(html).toContain('stage-dot future');
      expect(html).toContain('stage-connector');
    });

    it('renders artifact tabs with htmx attributes', async () => {
      repo.createArticle({ id: 'tabs-test', title: 'Tabs Test' });

      const res = await app.request('/articles/tabs-test');
      const html = await res.text();
      expect(html).toContain('tab-bar');
      expect(html).toContain('tab-btn');
      expect(html).toContain('hx-get="/htmx/articles/tabs-test/artifact/idea.md"');
      expect(html).toContain('Artifacts');
    });

    it('renders action panel with guard status', async () => {
      repo.createArticle({ id: 'action-test', title: 'Action Test' });

      const res = await app.request('/articles/action-test');
      const html = await res.text();
      expect(html).toContain('action-panel');
      expect(html).toContain('Advance ▶');
      expect(html).toContain('guard-status');
    });

    it('renders published badge for stage 8 articles', async () => {
      repo.createArticle({ id: 'pub-detail', title: 'Published Detail' });
      for (let s = 2; s <= 8; s++) {
        repo.advanceStage('pub-detail', s - 1, s, 'test');
      }

      const res = await app.request('/articles/pub-detail');
      const html = await res.text();
      expect(html).toContain('badge-published-lg');
      expect(html).toContain('Published');
    });

    it('renders audit log section', async () => {
      repo.createArticle({ id: 'audit-test', title: 'Audit Test' });
      repo.advanceStage('audit-test', 1, 2, 'agent-x', 'test note');

      const res = await app.request('/articles/audit-test');
      const html = await res.text();
      expect(html).toContain('Audit Log');
      expect(html).toContain('audit-entry');
      expect(html).toContain('agent-x');
      expect(html).toContain('test note');
    });

    it('renders article metadata section', async () => {
      repo.createArticle({ id: 'meta-test', title: 'Meta Test', primary_team: 'seahawks' });

      const res = await app.request('/articles/meta-test');
      const html = await res.text();
      expect(html).toContain('Article Metadata');
      expect(html).toContain('seahawks');
      expect(html).toContain('Depth');
    });
  });

  // ── htmx artifact and advance routes ──────────────────────────────────────

  describe('htmx article routes', () => {
    it('GET /htmx/articles/:id/artifact/:name returns file content', async () => {
      repo.createArticle({ id: 'art-file', title: 'Artifact File Test' });
      repo.artifacts.put('art-file', 'idea.md', '# Test Idea\n\nSome content here.');

      const res = await app.request('/htmx/articles/art-file/artifact/idea.md');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('artifact-rendered');
      expect(html).toContain('Test Idea');
      expect(html).toContain('Some content here.');
      // Should be an HTML fragment
      expect(html).not.toContain('<!DOCTYPE html>');
    });

    it('GET /htmx/articles/:id/artifact/:name shows placeholder for missing file', async () => {
      repo.createArticle({ id: 'art-missing', title: 'Missing Artifact' });

      const res = await app.request('/htmx/articles/art-missing/artifact/draft.md');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Not yet created');
    });

    it('GET /htmx/articles/:id/artifact/:name returns 400 for invalid name', async () => {
      repo.createArticle({ id: 'art-bad', title: 'Bad Name' });

      const res = await app.request('/htmx/articles/art-bad/artifact/secrets.txt');
      expect(res.status).toBe(400);
    });

    it('GET /htmx/articles/:id/artifact/:name returns 404 for unknown article', async () => {
      const res = await app.request('/htmx/articles/nonexistent/artifact/idea.md');
      expect(res.status).toBe(404);
    });

    it('GET /htmx/articles/:id/artifact/:name escapes HTML in content', async () => {
      repo.createArticle({ id: 'art-xss', title: 'XSS Test' });
      repo.artifacts.put('art-xss', 'idea.md', '<script>alert("xss")</script>');

      const res = await app.request('/htmx/articles/art-xss/artifact/idea.md');
      const html = await res.text();
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('POST /htmx/articles/:id/advance returns 404 for unknown article', async () => {
      const res = await app.request('/htmx/articles/nonexistent/advance', {
        method: 'POST',
      });
      expect(res.status).toBe(404);
      const html = await res.text();
      expect(html).toContain('Article not found');
    });

    it('POST /htmx/articles/:id/advance returns error when guard fails', async () => {
      repo.createArticle({ id: 'adv-fail', title: 'Advance Fail' });
      // Stage 1 article with no idea.md on disk — guard should fail

      const res = await app.request('/htmx/articles/adv-fail/advance', {
        method: 'POST',
      });
      expect(res.status).toBe(422);
      const html = await res.text();
      expect(html).toContain('advance-error');
    });

    it('POST /htmx/articles/:id/advance succeeds when guard passes', async () => {
      repo.createArticle({ id: 'adv-ok', title: 'Advance OK' });
      // Create idea.md so guard passes
      repo.artifacts.put('adv-ok', 'idea.md', '# Great Idea\n\nDetails here.');

      const res = await app.request('/htmx/articles/adv-ok/advance', {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('advance-success');
      expect(html).toContain('Stage 2');

      // Verify DB updated
      const article = repo.getArticle('adv-ok');
      expect(article!.current_stage).toBe(2);
    });
  });

  // ── Regress endpoints ───────────────────────────────────────────────────

  describe('regress endpoints', () => {
    it('POST /api/articles/:id/regress sends article back', async () => {
      repo.createArticle({ id: 'reg-api', title: 'Regress API' });
      repo.advanceStage('reg-api', 1, 3, 'test');

      const res = await app.request('/api/articles/reg-api/regress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_stage: 1, reason: 'Needs rework' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { previousStage: number; currentStage: number; reason: string };
      expect(body.previousStage).toBe(3);
      expect(body.currentStage).toBe(1);
      expect(body.reason).toBe('Needs rework');
    });

    it('POST /api/articles/:id/regress returns 404 for missing article', async () => {
      const res = await app.request('/api/articles/ghost/regress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_stage: 1 }),
      });
      expect(res.status).toBe(404);
    });

    it('POST /api/articles/:id/regress returns 400 for invalid target', async () => {
      repo.createArticle({ id: 'reg-bad', title: 'Bad Regress' });
      const res = await app.request('/api/articles/reg-bad/regress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_stage: 5 }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /htmx/articles/:id/regress returns success HTML', async () => {
      repo.createArticle({ id: 'reg-htmx', title: 'Regress HTMX' });
      repo.advanceStage('reg-htmx', 1, 3, 'test');

      const formData = new URLSearchParams({ to_stage: '1', reason: 'Fix it' });
      const res = await app.request('/htmx/articles/reg-htmx/regress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('advance-success');
      expect(html).toContain('Stage 1');
    });

    it('POST /htmx/articles/:id/regress returns 404 for missing article', async () => {
      const res = await app.request('/htmx/articles/ghost/regress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ to_stage: '1' }).toString(),
      });
      expect(res.status).toBe(404);
    });

    it('POST /htmx/articles/:id/regress returns 422 for invalid target', async () => {
      repo.createArticle({ id: 'reg-htmx-bad', title: 'Bad' });
      const res = await app.request('/htmx/articles/reg-htmx-bad/regress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ to_stage: '5' }).toString(),
      });
      expect(res.status).toBe(422);
    });
  });
});
