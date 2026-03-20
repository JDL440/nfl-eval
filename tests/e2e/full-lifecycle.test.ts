/**
 * full-lifecycle.test.ts — Advances an article through all 8 stages via the
 * live HTTP server, exercising every guard and transition.
 *
 * Also tests negative paths: attempting advance when guards fail, edge cases
 * like draft word count, editor verdicts (REVISE/REJECT), and incomplete
 * publisher passes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/dashboard/server.js';
import { Repository } from '../../src/db/repository.js';
import { initDataDir, loadConfig } from '../../src/config/index.js';
import type { AppConfig } from '../../src/config/index.js';
import type { Article } from '../../src/types.js';

// ── Test infrastructure ──────────────────────────────────────────────────────

let tmpDir: string;
let config: AppConfig;
let repo: Repository;
let app: ReturnType<typeof createApp>;
const baseUrl = 'http://localhost:9999';

async function appFetch(path: string, init?: RequestInit): Promise<Response> {
  return app.fetch(new Request(new URL(path, baseUrl).toString(), init));
}

/** POST JSON helper */
async function postJson(path: string, body: unknown): Promise<Response> {
  return appFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** htmx POST (no body) */
async function htmxAdvance(slug: string): Promise<Response> {
  return appFetch(`/htmx/articles/${slug}/advance`, { method: 'POST' });
}

/** Get article from API */
async function getArticle(slug: string): Promise<Article> {
  const res = await appFetch(`/api/articles/${slug}`);
  return res.json() as Promise<Article>;
}

/** Write a file into the article's data directory */
function writeArtifact(slug: string, filename: string, content: string): void {
  repo.artifacts.put(slug, filename, content);
}

/** Generate a string with the given word count */
function wordsOf(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(() => {
  tmpDir = join(tmpdir(), `nfl-lab-lifecycle-${randomUUID()}`);
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

// ── Happy path: Stage 1 → 8 ─────────────────────────────────────────────────

describe('Full lifecycle: Stage 1 → 8', () => {
  const slug = 'lifecycle-happy-path';

  it('creates an idea at Stage 1', async () => {
    // Use /api/articles with known slug (POST /api/ideas now generates slugs server-side)
    const res = await postJson('/api/articles', {
      id: slug,
      title: 'Lifecycle Happy Path',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBe(slug);

    // Verify artifact in DB
    expect(repo.artifacts.exists(slug, 'idea.md')).toBe(true);
  });

  it('advances 1→2 (idea.md guard)', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stage 2');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(2);
  });

  it('cannot advance 2→3 without discussion-prompt.md', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('Discussion prompt has not been generated yet');
  });

  it('advances 2→3 after writing discussion-prompt.md', async () => {
    writeArtifact(slug, 'discussion-prompt.md', '# Discussion Prompt\n\nWhat are the key factors?');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 3');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(3);
  });

  it('cannot advance 3→4 without panel-composition.md', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('Panel composition has not been generated yet');
  });

  it('advances 3→4 after writing panel-composition.md', async () => {
    writeArtifact(slug, 'panel-composition.md', '# Panel\n\n- Analyst A\n- Analyst B');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 4');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(4);
  });

  it('cannot advance 4→5 without discussion-summary.md', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('Discussion summary has not been generated yet');
  });

  it('advances 4→5 after writing discussion-summary.md', async () => {
    writeArtifact(slug, 'discussion-summary.md', '# Summary\n\nThe panel concluded...');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 5');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(5);
  });

  it('cannot advance 5→6 without draft.md', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('Article draft has not been written yet');
  });

  it('cannot advance 5→6 with draft.md under 200 words', async () => {
    writeArtifact(slug, 'draft.md', wordsOf(100));

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('100 words');
    expect(html).toContain('minimum 200');
  });

  it('advances 5→6 after writing draft.md with 800+ words', async () => {
    writeArtifact(slug, 'draft.md', `# Draft Article\n\n${wordsOf(850)}`);

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 6');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(6);
  });

  it('cannot advance 6→7 without editor-review.md', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('No editor review has been submitted yet');
  });

  it('cannot advance 6→7 with REVISE verdict', async () => {
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: REVISE\n\nNeeds more data.');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('REVISE');
  });

  it('cannot advance 6→7 with REJECT verdict', async () => {
    // Overwrite with REJECT
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: REJECT\n\nNot suitable.');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('REJECT');
  });

  it('advances 6→7 after editor approves', async () => {
    // Overwrite with APPROVED
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: APPROVED\n\nGood to go.');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 7');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(7);
  });

  it('cannot advance 7→8 without publisher pass', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('No publisher pass record found');
  });

  it('cannot advance 7→8 with incomplete publisher pass', async () => {
    // Record a partial publisher pass (only some checks = 1)
    repo.recordPublisherPass(slug, {
      title_final: 1,
      subtitle_final: 1,
      body_clean: 0,  // intentionally failing
    });

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain('Publisher pass incomplete');
  });

  it('cannot advance 7→8 with all checks but no publish_datetime', async () => {
    repo.recordPublisherPass(slug, {
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
      publish_datetime: null,
    });

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('publish_datetime');
  });

  it('advances 7→8 with complete publisher pass', async () => {
    repo.recordPublisherPass(slug, {
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
      publish_datetime: '2026-03-20T12:00:00Z',
    });

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 8');

    const article = await getArticle(slug);
    expect(article.current_stage).toBe(8);
  });

  it('cannot advance beyond Stage 8', async () => {
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('No transition defined from stage 8');
  });

  it('records stage transitions for every advance', async () => {
    const transitions = repo.getStageTransitions(slug);
    // We advanced 1→2, 2→3, 3→4, 4→5, 5→6, 6→7, 7→8 = 7 transitions
    expect(transitions.length).toBeGreaterThanOrEqual(7);

    // Verify the to_stage values cover the full range 2..8
    const toStages = transitions.map((t) => t.to_stage).sort((a, b) => a - b);
    expect(toStages).toContain(2);
    expect(toStages).toContain(8);
  });
});

// ── Editor review variants ───────────────────────────────────────────────────

describe('Editor review variants', () => {
  const baseSlug = 'editor-variant';

  function makeArticleAtStage6(suffix: string): string {
    const slug = `${baseSlug}-${suffix}`;
    repo.createArticle({ id: slug, title: `Editor Variant ${suffix}` });
    writeArtifact(slug, 'idea.md', '# Idea');
    // Advance directly in the DB to stage 6
    repo.advanceStage(slug, 1, 2, 'test');
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt');
    repo.advanceStage(slug, 2, 3, 'test');
    writeArtifact(slug, 'panel-composition.md', '# Panel');
    repo.advanceStage(slug, 3, 4, 'test');
    writeArtifact(slug, 'discussion-summary.md', '# Summary');
    repo.advanceStage(slug, 4, 5, 'test');
    writeArtifact(slug, 'draft.md', `# Draft\n\n${wordsOf(900)}`);
    repo.advanceStage(slug, 5, 6, 'test');
    return slug;
  }

  it('accepts numbered editor review file (editor-review-2.md)', async () => {
    const slug = makeArticleAtStage6('numbered');
    // Write a numbered review file
    writeArtifact(slug, 'editor-review-2.md', '## Verdict: APPROVED\n\nLooks great after revisions.');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 7');
  });

  it('uses latest numbered review when multiple exist', async () => {
    const slug = makeArticleAtStage6('multi-review');
    // First review: REVISE
    writeArtifact(slug, 'editor-review.md', '## Verdict: REVISE\n\nNeeds work.');
    // Second review (higher number): APPROVED
    writeArtifact(slug, 'editor-review-2.md', '## Verdict: APPROVED\n\nFixed everything.');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 7');
  });

  it('blocks when latest numbered review is REVISE', async () => {
    const slug = makeArticleAtStage6('revise-latest');
    // First review: APPROVED
    writeArtifact(slug, 'editor-review.md', '## Verdict: APPROVED');
    // Later review overrides with REVISE (higher number wins)
    writeArtifact(slug, 'editor-review-3.md', '## Verdict: REVISE\n\nActually needs more.');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('REVISE');
  });

  it('recognizes bold verdict format: **APPROVED**', async () => {
    const slug = makeArticleAtStage6('bold-verdict');
    writeArtifact(slug, 'editor-review.md', '# Review\n\nOverall assessment: **APPROVED**');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
  });

  it('recognizes emoji verdict format: ✅ APPROVED', async () => {
    const slug = makeArticleAtStage6('emoji-verdict');
    writeArtifact(slug, 'editor-review.md', '# Review\n\n✅ APPROVED');

    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
  });
});

// ── JSON API advance path ────────────────────────────────────────────────────

describe('JSON API advance: full lifecycle', () => {
  const slug = 'api-lifecycle-test';

  it('advances through all stages via /api/articles/:id/advance', async () => {
    // Create idea via /api/articles with known slug
    const createRes = await postJson('/api/articles', {
      id: slug,
      title: 'API Lifecycle Test',
    });
    expect(createRes.status).toBe(201);
    expect((await createRes.json() as { id: string }).id).toBe(slug);

    // 1→2
    let res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 2 });
    expect(res.status).toBe(200);

    // Prepare + advance 2→3
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt');
    res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 3 });
    expect(res.status).toBe(200);

    // 3→4
    writeArtifact(slug, 'panel-composition.md', '# Panel');
    res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 4 });
    expect(res.status).toBe(200);

    // 4→5
    writeArtifact(slug, 'discussion-summary.md', '# Summary');
    res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 5 });
    expect(res.status).toBe(200);

    // 5→6
    writeArtifact(slug, 'draft.md', `# Draft\n\n${wordsOf(1000)}`);
    res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 6 });
    expect(res.status).toBe(200);

    // 6→7
    writeArtifact(slug, 'editor-review.md', '## Final Verdict: APPROVED');
    res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 7 });
    expect(res.status).toBe(200);

    // 7→8
    repo.recordPublisherPass(slug, {
      title_final: 1, subtitle_final: 1, body_clean: 1,
      section_assigned: 1, tags_set: 1, url_slug_set: 1,
      cover_image_set: 1, paywall_set: 1, email_send: 1,
      names_verified: 1, numbers_current: 1, no_stale_refs: 1,
      publish_datetime: '2026-03-20T14:00:00Z',
    });
    res = await postJson(`/api/articles/${slug}/advance`, { to_stage: 8 });
    expect(res.status).toBe(200);

    const final = await getArticle(slug);
    expect(final.current_stage).toBe(8);
  });
});

// ── Draft word count boundary ────────────────────────────────────────────────

describe('Draft word count boundary', () => {
  const slug = 'word-count-boundary';

  beforeAll(() => {
    repo.createArticle({ id: slug, title: 'Word Count Boundary' });
    writeArtifact(slug, 'idea.md', '# Idea');
    repo.advanceStage(slug, 1, 2, 'test');
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt');
    repo.advanceStage(slug, 2, 3, 'test');
    writeArtifact(slug, 'panel-composition.md', '# Panel');
    repo.advanceStage(slug, 3, 4, 'test');
    writeArtifact(slug, 'discussion-summary.md', '# Summary');
    repo.advanceStage(slug, 4, 5, 'test');
  });

  it('rejects 199 words', async () => {
    writeArtifact(slug, 'draft.md', wordsOf(199));
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(422);
    expect(await res.text()).toContain('199 words');
  });

  it('accepts exactly 200 words', async () => {
    writeArtifact(slug, 'draft.md', wordsOf(200));
    const res = await htmxAdvance(slug);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Stage 6');
  });
});

// ── Publisher pass: individual check failures ────────────────────────────────

describe('Publisher pass check granularity', () => {
  const slug = 'publisher-checks';

  beforeAll(() => {
    repo.createArticle({ id: slug, title: 'Publisher Checks' });
    writeArtifact(slug, 'idea.md', '# Idea');
    repo.advanceStage(slug, 1, 2, 'test');
    writeArtifact(slug, 'discussion-prompt.md', '# Prompt');
    repo.advanceStage(slug, 2, 3, 'test');
    writeArtifact(slug, 'panel-composition.md', '# Panel');
    repo.advanceStage(slug, 3, 4, 'test');
    writeArtifact(slug, 'discussion-summary.md', '# Summary');
    repo.advanceStage(slug, 4, 5, 'test');
    writeArtifact(slug, 'draft.md', `# Draft\n\n${wordsOf(850)}`);
    repo.advanceStage(slug, 5, 6, 'test');
    writeArtifact(slug, 'editor-review.md', '## Verdict: APPROVED');
    repo.advanceStage(slug, 6, 7, 'test');
  });

  const checkFields = [
    'title_final', 'subtitle_final', 'body_clean', 'section_assigned',
    'tags_set', 'url_slug_set', 'cover_image_set', 'paywall_set',
    'email_send', 'names_verified', 'numbers_current', 'no_stale_refs',
  ] as const;

  for (const field of checkFields) {
    it(`reports failure when ${field} = 0`, async () => {
      const allPassing: Record<string, number | string | null> = {
        title_final: 1, subtitle_final: 1, body_clean: 1,
        section_assigned: 1, tags_set: 1, url_slug_set: 1,
        cover_image_set: 1, paywall_set: 1, email_send: 1,
        names_verified: 1, numbers_current: 1, no_stale_refs: 1,
        publish_datetime: '2026-03-20T12:00:00Z',
      };
      allPassing[field] = 0;
      repo.recordPublisherPass(slug, allPassing as any);

      const res = await htmxAdvance(slug);
      expect(res.status).toBe(422);
      const html = await res.text();
      expect(html).toContain(field);
    });
  }
});

// ── Concurrent articles at different stages ──────────────────────────────────

describe('Multiple articles at different stages', () => {
  it('manages independent articles without cross-contamination', async () => {
    // Create two ideas via /api/articles with known slugs
    const res1 = await postJson('/api/articles', {
      id: 'article-alpha-independent',
      title: 'Article Alpha Independent',
    });
    const res2 = await postJson('/api/articles', {
      id: 'article-beta-independent',
      title: 'Article Beta Independent',
    });
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const alpha = (await res1.json() as { id: string }).id;
    const beta = (await res2.json() as { id: string }).id;

    // Advance alpha to stage 2
    let res = await htmxAdvance(alpha);
    expect(res.status).toBe(200);

    // Beta should still be at stage 1
    let betaArticle = await getArticle(beta);
    expect(betaArticle.current_stage).toBe(1);

    // Advance beta to stage 2
    res = await htmxAdvance(beta);
    expect(res.status).toBe(200);

    // Both at stage 2, add prompt only to alpha
    writeArtifact(alpha, 'discussion-prompt.md', '# Alpha prompt');
    res = await htmxAdvance(alpha);
    expect(res.status).toBe(200);

    // Alpha at 3, beta still at 2
    const alphaArticle = await getArticle(alpha);
    betaArticle = await getArticle(beta);
    expect(alphaArticle.current_stage).toBe(3);
    expect(betaArticle.current_stage).toBe(2);

    // Beta can't advance without its own prompt
    res = await htmxAdvance(beta);
    expect(res.status).toBe(422);
  });
});

// ── Article detail page shows correct state ──────────────────────────────────

describe('Article detail page reflects pipeline state', () => {
  it('shows current stage and available artifacts', async () => {
    // Use the happy-path article which should be at Stage 8
    const res = await appFetch('/articles/lifecycle-happy-path');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stage 8');
    expect(html).toContain('Published');
  });
});
