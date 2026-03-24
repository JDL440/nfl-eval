/**
 * live-server.test.ts — End-to-end tests against the actual HTTP server.
 *
 * Starts the Hono dashboard on a random port, exercises the full lifecycle
 * via HTTP requests: create idea → verify idea.md → advance → verify stage.
 * Uses a temporary $DATA_DIR so tests are isolated from real data.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/dashboard/server.js';
import { Repository } from '../../src/db/repository.js';
import { initDataDir, loadConfig } from '../../src/config/index.js';
import type { AppConfig } from '../../src/config/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;
let config: AppConfig;
let repo: Repository;
let app: ReturnType<typeof createApp>;
let baseUrl: string;

/** Fetch wrapper that calls the Hono app directly (no network needed). */
async function appFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, baseUrl);
  return app.fetch(new Request(url.toString(), init));
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(() => {
  tmpDir = join(tmpdir(), `nfl-lab-e2e-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Set env so loadConfig picks up our temp dir
  process.env.NFL_DATA_DIR = tmpDir;
  process.env.NFL_PORT = '0'; // unused — we call app.fetch directly

  initDataDir(tmpDir);
  config = loadConfig({ dataDir: tmpDir });
  repo = new Repository(config.dbPath);
  app = createApp(repo, config);
  baseUrl = 'http://localhost:3456'; // only used for URL construction
});

afterAll(() => {
  repo.close();
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  delete process.env.NFL_DATA_DIR;
  delete process.env.NFL_PORT;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Live Server E2E', () => {
  it('supports end-to-end login before accessing protected routes', async () => {
    const authApp = createApp(repo, {
      ...config,
      dashboardAuth: {
        mode: 'local',
        username: 'joe',
        password: 'secret-pass',
        sessionCookieName: 'live_server_auth',
        sessionTtlHours: 12,
        secureCookies: false,
      },
    });

    const unauthenticated = await authApp.fetch(new Request('http://localhost:3456/'));
    expect(unauthenticated.status).toBe(302);
    expect(unauthenticated.headers.get('location')).toBe('/login?returnTo=%2F');

    const loginRes = await authApp.fetch(new Request('http://localhost:3456/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: 'joe',
        password: 'secret-pass',
        returnTo: '/',
      }).toString(),
    }));
    const sessionCookie = loginRes.headers.get('set-cookie')?.split(';', 1)[0];
    expect(sessionCookie).toBeTruthy();

    const homeRes = await authApp.fetch(new Request('http://localhost:3456/', {
      headers: { Cookie: sessionCookie! },
    }));
    expect(homeRes.status).toBe(200);
    expect(await homeRes.text()).toContain('NFL Lab');
  });

  // ── Home page ───────────────────────────────────────────────────────────

  it('GET / returns 200 with dashboard HTML', async () => {
    const res = await appFetch('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('NFL Lab');
    expect(html).toContain('Ready to Publish');
  });

  // ── Idea creation: JSON API ─────────────────────────────────────────────

  it('POST /api/ideas creates article + idea.md', async () => {
    const res = await appFetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Can Jalen Hurts sustain his MVP pace? An in-depth look at Hurts passing and rushing efficiency in 2025.',
        teams: ['PHI'],
        depthLevel: 2,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; title: string; stage: number };
    expect(body.id).toBeTruthy();
    expect(body.stage).toBe(1);

    // Verify idea.md was stored in DB artifact store
    const content = repo.artifacts.get(body.id, 'idea.md');
    expect(content).not.toBeNull();
    expect(content).toContain('Hurts');
  });

  // ── Idea creation: raw article API ──────────────────────────────────────

  it('POST /api/articles creates article + idea.md', async () => {
    const res = await appFetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-raw-article',
        title: 'Test Raw Article Creation',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBe('test-raw-article');

    expect(repo.artifacts.exists('test-raw-article', 'idea.md')).toBe(true);
  });

  // ── Idea creation: htmx form (legacy — removed) ─────────────────────────
  // POST /htmx/ideas was removed; tests below use the API flow instead.

  // ── Advance: verify 1→2 works after idea creation ──────────────────────

  it('POST /htmx/articles/:id/advance succeeds after idea creation', async () => {
    // Create an idea first via API
    const createRes = await appFetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Advance Test Article For Pipeline: Testing that the advance endpoint works correctly with proper idea.md creation.',
        teams: ['KC'],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { id: string };

    // Advance via htmx endpoint
    const advanceRes = await appFetch(`/htmx/articles/${created.id}/advance`, {
      method: 'POST',
    });

    expect(advanceRes.status).toBe(200);
    const html = await advanceRes.text();
    expect(html).toContain('Advanced to Stage 2');

    // Verify DB was updated
    const article = repo.getArticle(created.id);
    expect(article?.current_stage).toBe(2);
  });

  // ── Advance: verify failure for non-existent article ────────────────────

  it('POST /htmx/articles/:id/advance returns 404 for unknown article', async () => {
    const res = await appFetch('/htmx/articles/does-not-exist/advance', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  // ── API advance ────────────────────────────────────────────────────────

  it('POST /api/articles/:id/advance works for stage 1→2', async () => {
    const createRes = await appFetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'API Advance Test Article Pipeline: Testing the JSON API advance endpoint with proper stage transition.',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { id: string; stage: number };

    const advanceRes = await appFetch(`/api/articles/${created.id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_stage: 2 }),
    });

    expect(advanceRes.status).toBe(200);
    const body = await advanceRes.json() as { current_stage: number };
    expect(body.current_stage).toBe(2);
  });

  // ── Article detail page ────────────────────────────────────────────────

  it('GET /articles/:id renders article detail page', async () => {
    // Use the test-raw-article created above via /api/articles
    const res = await appFetch('/articles/test-raw-article');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Test Raw Article');
    expect(html).toContain('Stage');
  });

  it('GET /articles/:id returns 404 for unknown article', async () => {
    const res = await appFetch('/articles/nonexistent-slug');
    expect(res.status).toBe(404);
  });

  // ── API listing ────────────────────────────────────────────────────────

  it('GET /api/articles returns all created articles', async () => {
    const res = await appFetch('/api/articles');
    expect(res.status).toBe(200);
    const body = await res.json() as { articles: unknown[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(3); // at least 3 from tests above
  });

  // ── Idea form page ────────────────────────────────────────────────────

  it('GET /ideas/new returns the full idea form', async () => {
    const res = await appFetch('/ideas/new');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Create Article');
    expect(html).toContain('prompt');
    expect(html).toContain('team-grid');
  });

  // ── Validation errors ──────────────────────────────────────────────────

  it('POST /api/ideas rejects missing prompt', async () => {
    const res = await appFetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/ideas rejects empty body', async () => {
    const res = await appFetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ── Duplicate article ──────────────────────────────────────────────────

  it('POST /api/articles rejects duplicate id', async () => {
    // First creation should succeed
    const res1 = await appFetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'dup-test', title: 'Dup Test' }),
    });
    expect(res1.status).toBe(201);

    // Second should fail
    const res2 = await appFetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'dup-test', title: 'Dup Test Again' }),
    });
    expect(res2.status).toBe(400);
  });

  // ── htmx partials ─────────────────────────────────────────────────────

  it('GET /htmx/ready-to-publish returns HTML partial', async () => {
    const res = await appFetch('/htmx/ready-to-publish');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(typeof html).toBe('string');
  });

  it('GET /htmx/recent-ideas returns HTML partial', async () => {
    const res = await appFetch('/htmx/recent-ideas');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(typeof html).toBe('string');
  });

  it('GET /htmx/pipeline-summary returns HTML partial', async () => {
    const res = await appFetch('/htmx/pipeline-summary');
    expect(res.status).toBe(200);
  });

  it('GET /htmx/published returns HTML partial', async () => {
    const res = await appFetch('/htmx/published');
    expect(res.status).toBe(200);
  });
});
