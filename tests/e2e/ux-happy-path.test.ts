import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/dashboard/server.js';
import { Repository } from '../../src/db/repository.js';
import { initDataDir, loadConfig } from '../../src/config/index.js';
import type { AppConfig } from '../../src/config/index.js';

/* ── shared state across sequential steps ── */
let tmpDir: string;
let config: AppConfig;
let repo: Repository;
let app: ReturnType<typeof createApp>;
let articleId: string;
let articleTitle: string;

const baseUrl = 'http://localhost:9876';

/* ── helpers ── */

async function appFetch(path: string, init?: RequestInit) {
  return app.fetch(new Request(new URL(path, baseUrl).toString(), init));
}

async function postJson(path: string, body: unknown) {
  return appFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function htmxPost(path: string, formData?: Record<string, string>) {
  const body = formData
    ? new URLSearchParams(formData).toString()
    : undefined;
  return appFetch(path, {
    method: 'POST',
    headers: {
      'HX-Request': 'true',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
}

function wordsOf(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
}

/* ── test suite ── */

describe('UX Happy Path — full user journey', () => {
  beforeAll(() => {
    tmpDir = join(tmpdir(), `nfl-lab-ux-e2e-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });
    process.env.NFL_DATA_DIR = tmpDir;
    initDataDir(tmpDir);
    config = loadConfig({ dataDir: tmpDir });
    repo = new Repository(config.dbPath);
    app = createApp(repo, config);
  });

  afterAll(() => {
    repo.close();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    delete process.env.NFL_DATA_DIR;
  });

  /* ─── 1. Home page ─────────────────────────────────────── */
  it('1. loads home page with empty dashboard', async () => {
    const res = await appFetch('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Dashboard');
    expect(html).toContain('Pipeline');
  });

  /* ─── 2. New idea form ─────────────────────────────────── */
  it('2. loads new idea form page', async () => {
    const res = await appFetch('/ideas/new');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('New Article Idea');
    expect(html).toContain('prompt');
  });

  /* ─── 3. Submit new idea ───────────────────────────────── */
  it('3. creates article at Stage 1 with idea.md artifact', async () => {
    const res = await postJson('/api/ideas', {
      prompt: 'Can the Seahawks secondary hold up against elite quarterbacks this season?',
      teams: ['SEA'],
      depthLevel: 2,
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as { id: string; title: string; stage: number };
    expect(body.id).toBeTruthy();
    expect(body.title).toBeTruthy();
    expect(body.stage).toBe(1);

    articleId = body.id;
    articleTitle = body.title;

    // DB: article exists at stage 1
    const article = repo.getArticle(articleId);
    expect(article).not.toBeNull();
    expect(article!.current_stage).toBe(1);

    // DB: idea.md artifact created
    expect(repo.artifacts.exists(articleId, 'idea.md')).toBe(true);
    const content = repo.artifacts.get(articleId, 'idea.md');
    expect(content).toBeTruthy();
  });

  /* ─── 4. Article detail page ───────────────────────────── */
  it('4. renders article detail page at Stage 1', async () => {
    const res = await appFetch(`/articles/${articleId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(articleTitle);
    expect(html).toContain('Stage 1');
  });

  /* ─── 5. Advance 1→2, write discussion-prompt.md ───────── */
  it('5. advances 1→2 via HTMX and writes discussion-prompt.md', async () => {
    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 2');

    expect(repo.getArticle(articleId)!.current_stage).toBe(2);

    // Prepare artifact for next advance (2→3 guard)
    repo.artifacts.put(
      articleId,
      'discussion-prompt.md',
      '# Discussion Prompt\n\nHow does the Seahawks secondary match up against top-tier passing attacks?',
    );
    expect(repo.artifacts.exists(articleId, 'discussion-prompt.md')).toBe(true);
  });

  /* ─── 6. Advance 2→3, write panel-composition.md ───────── */
  it('6. advances 2→3 via HTMX and writes panel-composition.md', async () => {
    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 3');

    expect(repo.getArticle(articleId)!.current_stage).toBe(3);

    // Prepare artifact for next advance (3→4 guard)
    repo.artifacts.put(
      articleId,
      'panel-composition.md',
      '# Panel Composition\n\n## Agents\n- Coverage Analyst\n- Defensive Coordinator\n- Stats Guru',
    );
    expect(repo.artifacts.exists(articleId, 'panel-composition.md')).toBe(true);
  });

  /* ─── 7. Write discussion-summary.md, advance 3→4 ─────── */
  it('7. writes discussion-summary.md and advances 3→4', async () => {
    repo.artifacts.put(
      articleId,
      'discussion-summary.md',
      '# Discussion Summary\n\nThe panel concluded the secondary has elite potential but faces challenges against deep threats.',
    );

    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 4');

    expect(repo.getArticle(articleId)!.current_stage).toBe(4);
  });

  /* ─── 8. Write 250-word draft.md, advance 4→5 ─────────── */
  it('8. writes 250-word draft.md and advances 4→5', async () => {
    repo.artifacts.put(
      articleId,
      'draft.md',
      `# Seahawks Secondary Analysis\n\n${wordsOf(250)}`,
    );

    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 5');

    expect(repo.getArticle(articleId)!.current_stage).toBe(5);
  });

  /* ─── 9. Write editor-review.md (APPROVED), advance 5→6 ── */
  it('9. writes editor-review.md with APPROVED verdict and advances 5→6', async () => {
    repo.artifacts.put(
      articleId,
      'editor-review.md',
      '# Editor Review\n\n## Final Verdict: APPROVED\n\nStrong analysis with solid data sourcing.',
    );

    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 6');

    expect(repo.getArticle(articleId)!.current_stage).toBe(6);
  });

  /* ─── 10. Advance 6→7, then record publisher pass ─────── */
  it('10. advances 6→7 and records publisher pass', async () => {
    // Advance first (guard: editor-review.md APPROVED — satisfied by step 9)
    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 7');
    expect(repo.getArticle(articleId)!.current_stage).toBe(7);

    // Record publisher pass now (for publish page / checklist tests)
    repo.recordPublisherPass(articleId, {
      title_final: 1,
      subtitle_final: 1,
      body_clean: 1,
      section_assigned: 1,
      tags_set: 1,
      url_slug_set: 1,
      cover_image_set: 1,
      paywall_set: 1,
      email_send: 1,
      names_verified: 1,
      numbers_current: 1,
      no_stale_refs: 1,
      publish_datetime: new Date().toISOString(),
    });
  });

  /* ─── 11. Verify Stage 7 (ready to publish) ───────────── */
  it('11. article is at Stage 7 — ready to publish', async () => {
    const article = repo.getArticle(articleId);
    expect(article).not.toBeNull();
    expect(article!.current_stage).toBe(7);
  });

  /* ─── 12. Publish page ────────────────────────────────── */
  it('12. loads publish page with preview and checklist', async () => {
    const res = await appFetch(`/articles/${articleId}/publish`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Draft preview rendered
    expect(html).toContain('word0');
    // Checklist visible with completed items
    expect(html).toContain('checklist');
    expect(html).toContain('✅');
  });

  /* ─── 13. Toggle a checklist item ─────────────────────── */
  it('13. toggles checklist item via HTMX POST and verifies persistence', async () => {
    // Toggle title_final OFF (was 1 → becomes 0)
    const res = await htmxPost(`/htmx/articles/${articleId}/checklist/title_final`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('⬜');

    const pass = repo.getPublisherPass(articleId);
    expect(pass).not.toBeNull();
    expect((pass as unknown as Record<string, unknown>).title_final).toBe(0);

    // Toggle title_final back ON (0 → 1)
    const res2 = await htmxPost(`/htmx/articles/${articleId}/checklist/title_final`);
    expect(res2.status).toBe(200);
    expect(await res2.text()).toContain('✅');
  });

  /* ─── 14. Article detail at Stage 7 with all artifacts ── */
  it('14. article detail shows Stage 7 with all artifacts', async () => {
    const res = await appFetch(`/articles/${articleId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stage 7');
    expect(html).toContain(articleTitle);

    // Every artifact exists in the DB
    for (const name of [
      'idea.md',
      'discussion-prompt.md',
      'panel-composition.md',
      'discussion-summary.md',
      'draft.md',
      'editor-review.md',
    ]) {
      expect(repo.artifacts.exists(articleId, name)).toBe(true);
    }
  });

  /* ─── 15. Regress to Stage 4 ──────────────────────────── */
  it('15. sends article back to Stage 4 via HTMX regress', async () => {
    const res = await htmxPost(`/htmx/articles/${articleId}/regress`, {
      to_stage: '4',
      reason: 'Testing regression',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 4');

    const article = repo.getArticle(articleId);
    expect(article!.current_stage).toBe(4);
    expect(article!.status).toBe('revision');
  });

  /* ─── 16. Stale artifacts are gone ────────────────────── */
  it('16. stale artifacts are cleared after regression', async () => {
    // Cleared (stages > 4)
    expect(repo.artifacts.exists(articleId, 'draft.md')).toBe(false);
    expect(repo.artifacts.exists(articleId, 'editor-review.md')).toBe(false);

    // Kept (stages ≤ 4)
    expect(repo.artifacts.exists(articleId, 'idea.md')).toBe(true);
    expect(repo.artifacts.exists(articleId, 'discussion-prompt.md')).toBe(true);
    expect(repo.artifacts.exists(articleId, 'panel-composition.md')).toBe(true);
    expect(repo.artifacts.exists(articleId, 'discussion-summary.md')).toBe(true);

    // Publisher pass deleted (toStage 4 < 6)
    expect(repo.getPublisherPass(articleId)).toBeNull();
  });

  /* ─── 17. Re-write draft.md + editor-review, advance 4→5 */
  it('17. re-writes draft.md and editor-review.md, advances 4→5', async () => {
    repo.artifacts.put(
      articleId,
      'draft.md',
      `# Revised Seahawks Secondary Analysis\n\n${wordsOf(260)}`,
    );
    repo.artifacts.put(
      articleId,
      'editor-review.md',
      '# Editor Review v2\n\n## Final Verdict: APPROVED\n\nRevised draft meets all quality standards.',
    );

    const res = await htmxPost(`/htmx/articles/${articleId}/advance`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 5');

    expect(repo.getArticle(articleId)!.current_stage).toBe(5);
  });

  /* ─── 18. Auto-advance 5→6→7 ──────────────────────────── */
  it('18. auto-advances from Stage 5 through remaining stages to 7', async () => {
    const res = await htmxPost(`/htmx/articles/${articleId}/auto-advance`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Auto-advanced');
    expect(html).toContain('Stage 7');

    expect(repo.getArticle(articleId)!.current_stage).toBe(7);
  });

  /* ─── 19. Final state ─────────────────────────────────── */
  it('19. final state — Stage 7 with all artifacts present', async () => {
    const article = repo.getArticle(articleId);
    expect(article).not.toBeNull();
    expect(article!.current_stage).toBe(7);

    for (const name of [
      'idea.md',
      'discussion-prompt.md',
      'panel-composition.md',
      'discussion-summary.md',
      'draft.md',
      'editor-review.md',
    ]) {
      expect(repo.artifacts.exists(articleId, name)).toBe(true);
    }

    // Detail page renders correctly at Stage 7
    const res = await appFetch(`/articles/${articleId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stage 7');
    expect(html).toContain(articleTitle);
  });
});
