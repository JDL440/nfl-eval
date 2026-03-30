import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import {
  APP_TOOL_LOOP_PROVIDER_IDS,
  buildDashboardToolLoopOptions,
  createApp,
} from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';
import { addConversationTurn, addRevisionSummary } from '../../src/pipeline/conversation.js';

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

function parseSessionCookie(setCookieHeader: string | null): string {
  expect(setCookieHeader).toBeTruthy();
  return setCookieHeader!.split(';', 1)[0];
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
    vi.useRealTimers();
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('enables the app-owned tool loop for non-Copilot-CLI providers', () => {
    expect(buildDashboardToolLoopOptions()).toEqual({
      enabledProviders: [...APP_TOOL_LOOP_PROVIDER_IDS],
    });
    expect(APP_TOOL_LOOP_PROVIDER_IDS).toContain('lmstudio');
    expect(APP_TOOL_LOOP_PROVIDER_IDS).toContain('copilot');
    expect(APP_TOOL_LOOP_PROVIDER_IDS).not.toContain('copilot-cli');
  });

  function seedOlderCopilotUsage(articleId: string): void {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T00:00:00Z'));
    repo.recordUsageEvent({
      articleId,
      stage: 1,
      surface: 'ideaGeneration',
      provider: 'copilot-cli',
      modelOrTool: 'gpt-5.4',
      promptTokens: 1200,
      outputTokens: 300,
      costUsdEstimate: 0.01,
    });

    for (let i = 0; i < 110; i++) {
      vi.setSystemTime(new Date(`2026-03-22T00:${String(Math.floor((i + 1) / 60)).padStart(2, '0')}:${String((i + 1) % 60).padStart(2, '0')}Z`));
      repo.recordUsageEvent({
        articleId,
        stage: 5,
        surface: `panel-${i}`,
        provider: 'anthropic',
        modelOrTool: 'claude-sonnet-4',
        promptTokens: 500 + i,
        outputTokens: 200 + i,
        costUsdEstimate: 0.02,
      });
    }

    vi.useRealTimers();
  }

  // ── HTML pages ──────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('redirects protected HTML requests to /login when auth is enabled', async () => {
      const authApp = createApp(repo, makeTestConfig({
        dbPath: join(tempDir, 'test.db'),
        articlesDir: join(tempDir, 'articles'),
        dashboardAuth: {
          mode: 'local',
          username: 'joe',
          password: 'secret-pass',
          sessionCookieName: 'test_dashboard_session',
          sessionTtlHours: 12,
          secureCookies: false,
        },
      }));

      const res = await authApp.request('/');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/login?returnTo=%2F');
    });

    it('allows login, protects SSE/API/HTMX, and clears the session on logout', async () => {
      repo.createArticle({ id: 'auth-image', title: 'Auth Image Test' });
      repo.artifacts.put('auth-image', 'draft.md', '# Draft');
      const imageDir = join(tempDir, 'images', 'auth-image');
      mkdirSync(imageDir, { recursive: true });
      const pngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      writeFileSync(join(imageDir, 'cover.png'), pngBytes);

      const authApp = createApp(repo, makeTestConfig({
        dbPath: join(tempDir, 'test.db'),
        articlesDir: join(tempDir, 'articles'),
        imagesDir: join(tempDir, 'images'),
        dashboardAuth: {
          mode: 'local',
          username: 'joe',
          password: 'secret-pass',
          sessionCookieName: 'test_dashboard_session',
          sessionTtlHours: 12,
          secureCookies: false,
        },
      }));

      const apiRes = await authApp.request('/api/articles');
      expect(apiRes.status).toBe(401);

      const htmxRes = await authApp.request('/htmx/ready-to-publish', {
        headers: { 'HX-Request': 'true' },
      });
      expect(htmxRes.status).toBe(401);
      expect(htmxRes.headers.get('HX-Redirect')).toBe('/login?returnTo=%2Fhtmx%2Fready-to-publish');

      const sseRes = await authApp.request('/events');
      expect(sseRes.status).toBe(401);

      const imageRes = await authApp.request('/images/auth-image/cover.png');
      expect(imageRes.status).toBe(401);

      const loginPage = await authApp.request('/login');
      expect(loginPage.status).toBe(200);
      expect(await loginPage.text()).toContain('Dashboard Login');

      const loginRes = await authApp.request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: 'joe',
          password: 'secret-pass',
          returnTo: '/config',
        }).toString(),
      });
      expect(loginRes.status).toBe(302);
      const sessionCookie = parseSessionCookie(loginRes.headers.get('set-cookie'));
      expect(loginRes.headers.get('set-cookie')).toContain('HttpOnly');
      expect(loginRes.headers.get('set-cookie')).toContain('SameSite=Lax');
      expect(loginRes.headers.get('location')).toBe('/config');

      const authedConfigRes = await authApp.request('/config', {
        headers: { Cookie: sessionCookie },
      });
      expect(authedConfigRes.status).toBe(200);

      const authedImageRes = await authApp.request('/images/auth-image/cover.png', {
        headers: { Cookie: sessionCookie },
      });
      expect(authedImageRes.status).toBe(200);

      const logoutRes = await authApp.request('/logout', {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      });
      expect(logoutRes.status).toBe(302);
      expect(logoutRes.headers.get('set-cookie')).toContain('test_dashboard_session=;');

      const loggedOutRes = await authApp.request('/config', {
        headers: { Cookie: sessionCookie },
      });
      expect(loggedOutRes.status).toBe(302);
    });

    it('keeps published image routes public while auth is enabled', async () => {
      repo.createArticle({ id: 'published-image', title: 'Published Image Test' });
      for (let s = 2; s <= 8; s++) {
        repo.advanceStage('published-image', s - 1, s, 'test');
      }
      const imageDir = join(tempDir, 'images', 'published-image');
      mkdirSync(imageDir, { recursive: true });
      writeFileSync(join(imageDir, 'cover.png'), Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]));

      const authApp = createApp(repo, makeTestConfig({
        dbPath: join(tempDir, 'test.db'),
        articlesDir: join(tempDir, 'articles'),
        imagesDir: join(tempDir, 'images'),
        dashboardAuth: {
          mode: 'local',
          username: 'joe',
          password: 'secret-pass',
          sessionCookieName: 'test_dashboard_session',
          sessionTtlHours: 12,
          secureCookies: false,
        },
      }));

      const imageRes = await authApp.request('/images/published-image/cover.png');
      expect(imageRes.status).toBe(200);
    });
  });

  describe('HTML pages', () => {
    it('home page returns 200 with HTML', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('viewport-fit=cover');
      expect(html).toContain('NFL Lab');
      expect(html).toContain('shared-mobile-header');
      expect(html).toContain('header-inner');
      expect(html).toContain('shared-mobile-nav');
      expect(html).toContain('href="/config"');
      expect(html).toContain('href="/ideas/new"');
      expect(html.indexOf('>Intake<')).toBeLessThan(html.indexOf('>Ready to publish<'));
      expect(html).toContain('Ready to publish');
      expect(html).toContain('Pipeline');
      expect(html).toContain('Recent ideas');
      expect(html).not.toContain('pipeline-total');
      expect(html).not.toContain('total-count');
      expect(html).not.toContain('href="/agents"');
      expect(html).not.toContain('href="/memory"');
      expect(html).not.toContain('href="/runs"');
    });

    it('removed legacy dashboard pages return 404', async () => {
      const legacyPaths = ['/agents', '/memory', '/runs', '/runs/test-run'];

      for (const path of legacyPaths) {
        const res = await app.request(path);
        expect(res.status).toBe(404);
      }
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
      expect(html).toContain('mobile-detail-layout');
      expect(html).toContain('Stage 1');
      expect(html).toContain('Token Usage');
      expect(html).toContain('/articles/detail-test/traces');
      expect(html).not.toContain('Audit Log');
    });

    it('article detail usage panel keeps older copilot-cli usage after many later events', async () => {
      repo.createArticle({ id: 'detail-usage-history', title: 'Detail Usage History' });
      seedOlderCopilotUsage('detail-usage-history');

      const res = await app.request('/articles/detail-usage-history');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Token Usage');
      expect(html).toContain('copilot-cli');
      expect(html).toContain('gpt-5.4');
    });

    it('article detail renders revision history from persisted conversations', async () => {
      repo.createArticle({ id: 'detail-revisions', title: 'Detail Revisions' });
      addConversationTurn(repo, 'detail-revisions', 5, 'writer', 'assistant', '# First Draft\n\nOpening angle.');
      addConversationTurn(repo, 'detail-revisions', 6, 'editor', 'assistant', 'Need a stronger lead and fresher stats.\n\n## Verdict\nREVISE');
      addRevisionSummary(
        repo,
        'detail-revisions',
        1,
        6,
        4,
        'editor',
        'REVISE',
        ['Tighten the lead', 'Refresh the stats'],
        'Need a stronger lead and fresher stats.\n\n## Verdict\nREVISE',
        {
          blockerType: 'evidence',
          blockerIds: ['stale-stat'],
        },
      );

      const res = await app.request('/articles/detail-revisions');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Revision History');
      expect(html).toContain('Iteration 1');
      expect(html).toContain('Writer pass');
      expect(html).toContain('Editor pass');
      expect(html).toContain('Refresh the stats');
      expect(html).toContain('Blockers:');
      expect(html).toContain('type=evidence');
      expect(html).toContain('ids=stale-stat');
    });

    it('article detail links to trace views while trace pages surface llm details', async () => {
      repo.createArticle({ id: 'detail-traces', title: 'Detail Traces' });
      const traceId = repo.startLlmTrace({
        articleId: 'detail-traces',
        stage: 1,
        surface: 'generatePrompt',
        agentName: 'lead',
        requestedModel: 'gpt-5.4',
        systemPrompt: 'Trace system prompt',
        userMessage: 'Trace user prompt',
      });
      repo.completeLlmTrace(traceId, {
        provider: 'copilot-cli',
        model: 'gpt-5.4',
        outputText: 'Trace output preview',
        totalTokens: 200,
        providerMode: 'one-shot',
        workingDirectory: 'C:\\github\\worktrees\\copilot-session-reuse',
        incrementalPrompt: 'Actual provider prompt',
        providerRequest: { sessionReuseRequested: true },
        providerResponse: { stdout: 'Trace output preview' },
      });

      const detailRes = await app.request('/articles/detail-traces');
      const detailHtml = await detailRes.text();
      expect(detailRes.status).toBe(200);
      expect(detailHtml).toContain('/articles/detail-traces/traces');
      expect(detailHtml).toContain('🧠 Trace');

      const traceRes = await app.request(`/traces/${traceId}`);
      const traceHtml = await traceRes.text();
      expect(traceRes.status).toBe(200);
      expect(traceHtml).toContain('Trace output preview');
      expect(traceHtml).toContain(`trace-${traceId}`);
      expect(traceHtml).toContain('Article trace timeline');
      expect(traceHtml).toContain('CWD: C:\\github\\worktrees\\copilot-session-reuse');
    });

    it('article trace timeline page renders all traces for the article', async () => {
      repo.createArticle({ id: 'detail-trace-timeline', title: 'Detail Trace Timeline' });
      const stageRunOne = repo.startStageRun({
        articleId: 'detail-trace-timeline',
        stage: 1,
        surface: 'ideaGeneration',
        actor: 'lead',
      });
      const stageRunTwo = repo.startStageRun({
        articleId: 'detail-trace-timeline',
        stage: 2,
        surface: 'generatePrompt',
        actor: 'lead',
      });
      const traceOne = repo.startLlmTrace({
        articleId: 'detail-trace-timeline',
        stageRunId: stageRunOne,
        stage: 1,
        surface: 'ideaGeneration',
        agentName: 'lead',
        requestedModel: 'gpt-5.4',
        systemPrompt: 'Idea prompt',
        userMessage: 'Idea task',
      });
      const traceTwo = repo.startLlmTrace({
        articleId: 'detail-trace-timeline',
        stageRunId: stageRunTwo,
        stage: 2,
        surface: 'generatePrompt',
        agentName: 'lead',
        requestedModel: 'gpt-5.4',
        systemPrompt: 'Prompt prompt',
        userMessage: 'Prompt task',
      });
      repo.completeLlmTrace(traceOne, {
        provider: 'lmstudio',
        model: 'qwen-35',
        outputText: 'Idea output',
        totalTokens: 111,
        incrementalPrompt: 'Idea provider prompt',
        providerRequest: {
          endpoint: 'http://localhost:1234/v1/chat/completions',
          body: { model: 'qwen-35' },
        },
        providerResponse: {
          id: 'chatcmpl-idea',
          choices: [{ message: { content: 'Idea output' } }],
        },
      });
      repo.completeLlmTrace(traceTwo, {
        provider: 'lmstudio',
        model: 'qwen-35',
        outputText: '## Prompt output\n\n- First preview bullet',
        totalTokens: 222,
        metadata: {
          availableTools: ['query_team_efficiency', 'query_prediction_markets'],
          toolCalls: [
            {
              toolName: 'query_team_efficiency',
              args: { team: 'SEA', season: 2025 },
              source: 'local-extension',
              isError: false,
              resultText: 'SEA efficiency result',
            },
          ],
        },
        incrementalPrompt: 'Prompt provider prompt',
        providerRequest: {
          endpoint: 'http://localhost:1234/v1/chat/completions',
          body: { model: 'qwen-35', temperature: 0.7 },
        },
        providerResponse: {
          id: 'chatcmpl-prompt',
          choices: [{ message: { content: '## Prompt output\n\n- First preview bullet' } }],
        },
      });

      const res = await app.request('/articles/detail-trace-timeline/traces');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('Trace Timeline');
      expect(html).toContain('shared-mobile-header');
      expect(html).toContain('trace-page-header');
      expect(html).toContain('Idea output');
      expect(html).toContain('Prompt output');
      expect(html).toContain('ideaGeneration');
      expect(html).toContain('generatePrompt');
      expect(html).toContain('Provider-Wrapped Prompt');
      expect(html).not.toContain('Provider Prompt Delta');
      expect(html).toContain('Provider Request Envelope');
      expect(html).toContain('http://localhost:1234/v1/chat/completions');
      expect(html).toContain('chatcmpl-prompt');
      expect(html).toContain('Available Tools');
      expect(html).toContain('Tool Calls');
      expect(html).toContain('query_team_efficiency');
      expect(html).toContain('SEA efficiency result');
      expect(html).toContain('Preview JSON');
      expect(html).toContain('Preview Markdown');
      expect(html).toContain('trace-preview-btn');
      expect(html).toContain('artifact-rendered');
      expect(html).toContain('data-trace-pane="raw" style="display:none"');
      expect(html).toContain('data-trace-pane="preview"');
    });

    it('standalone trace page renders a failed unattached trace', async () => {
      const traceId = repo.startLlmTrace({
        stage: 1,
        surface: 'ideaGeneration',
        agentName: 'lead',
        requestedModel: 'qwen/qwen3.5-35b-a3b',
        systemPrompt: 'Idea prompt',
        userMessage: 'Idea task',
      });
      repo.failLlmTrace(traceId, {
        provider: 'lmstudio',
        model: 'qwen/qwen3.5-35b-a3b',
        errorMessage: 'Tool calling exhausted its 50 call budget without producing a final answer.',
        metadata: {
          availableTools: ['query_team_efficiency'],
          toolCallCount: 7,
          toolCallBudget: 50,
          toolCalls: [
            {
              toolName: 'query_team_efficiency',
              args: { team: 'SEA', season: 2025 },
              source: 'local-extension',
              isError: false,
              resultText: 'SEA efficiency result',
            },
          ],
        },
        providerRequest: {
          endpoint: 'http://localhost:1234/v1/chat/completions',
        },
        providerResponse: {
          id: 'chatcmpl-failed-trace',
        },
      });

      const res = await app.request('/traces/' + traceId);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('Trace detail');
      expect(html).toContain('New Idea');
      expect(html).toContain('Tool calls used: 7 / 50');
      expect(html).toContain('query_team_efficiency');
      expect(html).toContain('chatcmpl-failed-trace');
    });

    it('article detail surfaces paused lead review state and artifact tab', async () => {
      repo.createArticle({ id: 'detail-lead-review', title: 'Lead Review Detail' });
      for (let s = 2; s <= 5; s++) {
        repo.advanceStage('detail-lead-review', s - 1, s, 'test');
      }
      repo.advanceStage('detail-lead-review', 5, 6, 'test');
      repo.updateArticleStatus('detail-lead-review', 'needs_lead_review');
      repo.artifacts.put('detail-lead-review', 'draft.md', '# Draft');
      repo.artifacts.put('detail-lead-review', 'editor-review.md', '# Editor Review\n\n## Verdict\nREVISE');
      repo.artifacts.put('detail-lead-review', 'lead-review.md', '# Lead Review Handoff\n\nEscalated after repeated blocker.');

      const res = await app.request('/articles/detail-lead-review');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Needs Lead review');
      expect(html).toContain('Lead review required: repeated editor blocker detected');
      expect(html).toContain('article-artifact-section');
      expect(html).toContain('article-artifact-tabs');
      expect(html).toContain('article-artifact-panel');
      expect(html).toContain('/htmx/articles/detail-lead-review/artifact/lead-review.md');
      expect(html).toContain('data-tab="lead-review.md"');
      expect(html).toContain('id="artifact-content-detail-lead-review"');
      expect(html).toMatch(/id="artifact-content-detail-lead-review"[\s\S]*hx-get="\/htmx\/articles\/detail-lead-review\/artifact\/lead-review\.md"/);
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

    it('POST /api/ideas persists the selected provider on the article', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Can the Chargers thrive without a star running back in 2026?',
          teams: ['lac'],
          depthLevel: 2,
          provider: 'copilot',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      const article = repo.getArticle(body.id);
      expect(article).not.toBeNull();
      expect(article!.llm_provider).toBe('copilot');
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

    it('POST /api/agents/refresh-all remains available and returns 503 without runner or memory', async () => {
      const res = await app.request('/api/agents/refresh-all', {
        method: 'POST',
      });
      expect(res.status).toBe(503);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('legacy memory store');
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

    it('GET /htmx/articles/:id/live-sidebar is retired with the removed article live sidebar surface', async () => {
      repo.createArticle({ id: 'live-usage-history', title: 'Live Usage History' });
      seedOlderCopilotUsage('live-usage-history');

      const res = await app.request('/htmx/articles/live-usage-history/live-sidebar');
      expect(res.status).toBe(404);
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

    it('POST /api/agents/refresh-all stays available without the removed agent pages', async () => {
      const refreshConfig = makeTestConfig({
        dbPath: join(tempDir, 'test.db'),
        articlesDir: join(tempDir, 'articles'),
      });
      const memoryStore = {
        store: vi.fn(),
        stats: () => [],
        knowledgeFreshness: () => new Map<string, string>(),
      } as any;
      const run = vi.fn(async () => ({ content: 'Updated knowledge brief' }));
      const refreshApp = createApp(repo, refreshConfig, {
        memory: memoryStore,
        actionContext: {
          repo,
          config: refreshConfig,
          engine: {} as any,
          auditor: {} as any,
          runner: {
            gateway: { listProviders: () => [] },
            listAgents: () => ['analytics'],
            run,
          } as any,
        },
      });

      const configRes = await refreshApp.request('/config');
      const configHtml = await configRes.text();
      expect(configHtml).toContain('responsive-table');
      expect(configHtml).toContain('/api/agents/refresh-all');
      expect(configHtml).not.toContain('href="/agents"');
      expect(configHtml).not.toContain('href="/memory"');
      expect(configHtml).not.toContain('href="/runs"');

      const res = await refreshApp.request('/api/agents/refresh-all', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, status: 'started', agentCount: 1 });
      expect(run).toHaveBeenCalledTimes(1);
      expect(memoryStore.store).toHaveBeenCalledTimes(1);
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
    it('does not render removed stage timeline classes', async () => {
      repo.createArticle({ id: 'timeline-test', title: 'Timeline Test' });
      repo.advanceStage('timeline-test', 1, 2, 'test');

      const res = await app.request('/articles/timeline-test');
      const html = await res.text();
      expect(html).not.toContain('stage-dot');
      expect(html).not.toContain('stage-connector');
      expect(html).toContain('Stage 2');
    });

    it('renders artifact tabs with htmx attributes', async () => {
      repo.createArticle({ id: 'tabs-test', title: 'Tabs Test' });
      repo.artifacts.put('tabs-test', 'idea.thinking.md', 'Persisted planning trace');

      const res = await app.request('/articles/tabs-test');
      const html = await res.text();
      expect(html).toContain('tab-bar');
      expect(html).toContain('tab-btn');
      expect(html).toContain('hx-get="/htmx/articles/tabs-test/artifact/idea.md"');
      expect(html).toContain('artifact-trace-badge');
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

    it('omits removed audit log section', async () => {
      repo.createArticle({ id: 'audit-test', title: 'Audit Test' });
      repo.advanceStage('audit-test', 1, 2, 'agent-x', 'test note');

      const res = await app.request('/articles/audit-test');
      const html = await res.text();
      expect(html).not.toContain('Audit Log');
      expect(html).not.toContain('audit-entry');
    });

    it('keeps metadata badges and edit affordance without sidebar metadata section', async () => {
      repo.createArticle({ id: 'meta-test', title: 'Meta Test', primary_team: 'seahawks' });

      const res = await app.request('/articles/meta-test');
      const html = await res.text();
      expect(html).toContain('id="article-meta"');
      expect(html).toContain('class="meta-title-row"');
      expect(html).toContain('title="Edit metadata"');
      expect(html).toContain('class="icon-button"');
      expect(html).toContain('hx-get="/htmx/articles/meta-test/edit-meta"');
      expect(html).not.toContain('Edit Article Metadata');
      expect(html).not.toContain('/context-config');
      expect(html).toContain('seahawks');
      expect(html).toContain('badge-depth');
    });

    it('does not surface legacy stage-run failure chrome on article detail', async () => {
      repo.createArticle({ id: 'no-runs-ui', title: 'No Runs UI' });
      repo.startStageRun({
        articleId: 'no-runs-ui',
        stage: 2,
        surface: 'dashboard',
        actor: 'tester',
        status: 'started',
        startedBy: 'tester',
      });

      const res = await app.request('/articles/no-runs-ui');
      const html = await res.text();
      expect(html).not.toContain('Last run (Stage');
      expect(html).not.toContain('stage-run-error');
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

    it('GET /htmx/articles/:id/artifact/:name allows lead-review artifacts', async () => {
      repo.createArticle({ id: 'art-lead-review', title: 'Lead Review Artifact' });
      repo.artifacts.put('art-lead-review', 'lead-review.md', '# Lead Review Handoff\n\nEscalated after repeated blocker.');

      const res = await app.request('/htmx/articles/art-lead-review/artifact/lead-review.md');

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Lead Review Handoff');
      expect(html).toContain('Escalated after repeated blocker.');
    });

    it('GET /htmx/articles/:id/artifact/:name prefers persisted thinking sidecars', async () => {
      repo.createArticle({ id: 'art-thinking', title: 'Thinking Artifact' });
      repo.artifacts.put('art-thinking', 'draft.md', '<think>inline trace</think>\n\n# Final Draft\n\nBody');
      repo.artifacts.put('art-thinking', 'draft.thinking.md', 'Persisted trace from sidecar');

      const res = await app.request('/htmx/articles/art-thinking/artifact/draft.md');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Persisted Thinking Trace');
      expect(html).toContain('Persisted trace from sidecar');
      expect(html).not.toContain('inline trace');
      expect(html).toContain('Final Draft');
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

    it('uses draft readiness for stage 7 publish actions instead of the stage guard failure', async () => {
      repo.createArticle({ id: 'stage7-publish', title: 'Stage 7 Publish' });
      for (let s = 2; s <= 7; s++) {
        repo.advanceStage('stage7-publish', s - 1, s, 'test');
      }
      repo.setDraftUrl('stage7-publish', 'https://test.substack.com/publish/post/12345');

      const res = await app.request('/articles/stage7-publish');
      const html = await res.text();

      expect(html).toContain('Open Publish Page');
      expect(html).not.toContain('Publish to Substack');
      expect(html).toContain('Substack draft saved. Open the Publish Page');
      expect(html).not.toContain('substack_url not set on article');
      expect(html).toContain('Open Draft ↗');
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
