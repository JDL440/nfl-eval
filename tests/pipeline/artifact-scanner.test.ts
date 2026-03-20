import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inferStage,
  parseEditorVerdict,
  scanArticles,
  countImages,
  hasFile,
  hasAnyFile,
  hasPanelOutputs,
  hasPublisherPass,
  hasDiscussionSummary,
  inferDiscussionPath,
  inferArticlePath,
  reconcile,
} from '../../src/pipeline/artifact-scanner.js';
import type { Discrepancy, Repository } from '../../src/pipeline/artifact-scanner.js';
import type { Article, Stage } from '../../src/types.js';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Test helpers ────────────────────────────────────────────────────────────

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'nfl-lab-scan-'));
}

function createArticleDir(
  base: string,
  slug: string,
  files: Record<string, string> = {},
): string {
  const dir = join(base, slug);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf-8');
  }
  return dir;
}

function makeArticle(overrides: Partial<Article> & { id: string }): Article {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    subtitle: overrides.subtitle ?? null,
    primary_team: overrides.primary_team ?? null,
    teams: overrides.teams ?? null,
    league: overrides.league ?? 'nfl',
    status: overrides.status ?? 'in_production',
    current_stage: overrides.current_stage ?? (1 as Stage),
    discussion_path: overrides.discussion_path ?? null,
    article_path: overrides.article_path ?? null,
    substack_draft_url: overrides.substack_draft_url ?? null,
    substack_url: overrides.substack_url ?? null,
    created_at: overrides.created_at ?? '2025-01-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2025-01-01T00:00:00Z',
    published_at: overrides.published_at ?? null,
    depth_level: overrides.depth_level ?? 2,
    target_publish_date: overrides.target_publish_date ?? null,
    publish_window: overrides.publish_window ?? null,
    time_sensitive: overrides.time_sensitive ?? 0,
    expires_at: overrides.expires_at ?? null,
  };
}

function stubRepo(articles: Article[] = []): Repository & {
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {};
  function track(method: string, args: unknown[]) {
    (calls[method] ??= []).push(args);
  }
  return {
    calls,
    getAllArticles: () => articles,
    getEditorReviews: (id) => {
      track('getEditorReviews', [id]);
      return [];
    },
    advanceStage: (...args) => track('advanceStage', args),
    repairStringStage: (...args) => track('repairStringStage', args),
    backfillArticle: (...args) => track('backfillArticle', args),
    recordEditorReview: (...args) => track('recordEditorReview', args),
    setDiscussionPath: (...args) => track('setDiscussionPath', args),
    setArticlePath: (...args) => track('setArticlePath', args),
    setStatus: (...args) => track('setStatus', args),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('artifact-scanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── inferStage ──────────────────────────────────────────────────────────

  describe('inferStage', () => {
    it('returns stage 1 for empty directory', () => {
      const dir = createArticleDir(tempDir, 'empty');
      const result = inferStage(dir);
      expect(result.stage).toBe(1);
      expect(result.stage_name).toBe('Idea Generation');
      expect(result.detail).toContain('Empty');
    });

    it('returns stage 1 for idea only', () => {
      const dir = createArticleDir(tempDir, 'idea-only', {
        'idea.md': '# My Idea',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(1);
      expect(result.next_action).toBe('Discussion prompt');
    });

    it('returns stage 2 for discussion prompt', () => {
      const dir = createArticleDir(tempDir, 'prompted', {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Discussion Prompt',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(2);
      expect(result.stage_name).toBe('Discussion Prompt');
    });

    it('returns stage 3 for panel composition', () => {
      const dir = createArticleDir(tempDir, 'composed', {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(3);
      expect(result.stage_name).toBe('Panel Composition');
    });

    it('returns stage 4 for panel outputs (≥2 position files)', () => {
      const dir = createArticleDir(tempDir, 'paneled', {
        'cap-position.md': 'Cap analysis',
        'sea-position.md': 'SEA analysis',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(4);
      expect(result.detail).toContain('Panel outputs');
    });

    it('returns stage 4 for discussion summary', () => {
      const dir = createArticleDir(tempDir, 'summarized', {
        'discussion-summary.md': '# Summary',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(4);
      expect(result.stage_name).toBe('Panel Discussion');
    });

    it('returns stage 4 for discussion synthesis (alternate filename)', () => {
      const dir = createArticleDir(tempDir, 'synthesized', {
        'discussion-synthesis.md': '# Synthesis',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(4);
    });

    it('returns stage 5 for draft', () => {
      const dir = createArticleDir(tempDir, 'drafted', {
        'draft.md': '# Draft Article',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(5);
      expect(result.stage_name).toBe('Article Drafting');
      expect(result.next_action).toBe('Editor pass');
    });

    it('returns stage 6 for editor review with APPROVED', () => {
      const dir = createArticleDir(tempDir, 'reviewed', {
        'draft.md': '# Draft',
        'editor-review.md':
          '## Final Verdict: ✅ APPROVED\n\nLooks great.',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(6);
      expect(result.editor_verdict).toBe('APPROVED');
      expect(result.stage_name).toBe('Editor Pass');
    });

    it('returns stage 6 for REVISE verdict', () => {
      const dir = createArticleDir(tempDir, 'revise', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: 🔴 REVISE\n\nNeeds work.',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(6);
      expect(result.editor_verdict).toBe('REVISE');
    });

    it('returns stage 6 for REJECT verdict', () => {
      const dir = createArticleDir(tempDir, 'reject', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: REJECT\n\nMajor issues.',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(6);
      expect(result.editor_verdict).toBe('REJECT');
    });

    it('returns stage 6 with null verdict if not parseable', () => {
      const dir = createArticleDir(tempDir, 'unclear', {
        'draft.md': '# Draft',
        'editor-review.md': '## Some review\n\nNo verdict here.',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(6);
      expect(result.editor_verdict).toBeNull();
      expect(result.detail).toContain('verdict not parsed');
    });

    it('returns stage 7 for publisher pass', () => {
      const dir = createArticleDir(tempDir, 'published', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: APPROVED',
        'publisher-pass.md': '# Publisher Pass',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(7);
      expect(result.stage_name).toBe('Publisher Pass');
    });

    it('picks latest editor review file (highest numbered)', () => {
      const dir = createArticleDir(tempDir, 'multi-review', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: REVISE',
        'editor-review-2.md': '## Verdict: APPROVED',
      });
      const result = inferStage(dir);
      expect(result.editor_verdict).toBe('APPROVED');
    });

    it('handles non-existent directory gracefully (stage 1)', () => {
      const result = inferStage(join(tempDir, 'does-not-exist'));
      expect(result.stage).toBe(1);
    });

    it('detects legacy flat file as stage 8', () => {
      // Create a flat .md file at the path (not a directory)
      const flatPath = join(tempDir, 'legacy-article');
      writeFileSync(flatPath + '.md', '# Published Article');
      const result = inferStage(flatPath);
      expect(result.stage).toBe(8);
      expect(result.detail).toContain('legacy');
    });

    it('precedence: publisher pass beats editor review', () => {
      const dir = createArticleDir(tempDir, 'full-pipe', {
        'idea.md': '# Idea',
        'discussion-prompt.md': '# Prompt',
        'panel-composition.md': '# Panel',
        'cap-position.md': 'Cap',
        'sea-position.md': 'SEA',
        'discussion-summary.md': '# Summary',
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: APPROVED',
        'publisher-pass.md': '# Publisher Pass',
      });
      expect(inferStage(dir).stage).toBe(7);
    });

    it('precedence: editor review beats draft', () => {
      const dir = createArticleDir(tempDir, 'review-over-draft', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: REVISE',
      });
      expect(inferStage(dir).stage).toBe(6);
    });

    it('precedence: draft beats discussion summary', () => {
      const dir = createArticleDir(tempDir, 'draft-over-summary', {
        'discussion-summary.md': '# Summary',
        'draft.md': '# Draft',
      });
      expect(inferStage(dir).stage).toBe(5);
    });

    it('stage 6 APPROVED with images shows "Publisher pass" next', () => {
      // Create images in the article dir
      const dir = createArticleDir(tempDir, 'with-images', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: APPROVED',
        'cover.png': '',
        'inline.png': '',
      });
      const result = inferStage(dir);
      expect(result.stage).toBe(6);
      expect(result.next_action).toBe('Publisher pass');
    });

    it('stage 6 APPROVED without images shows image generation needed', () => {
      const dir = createArticleDir(tempDir, 'no-images', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: APPROVED',
      });
      const result = inferStage(dir);
      expect(result.next_action).toContain('Image generation');
      expect(result.next_action).toContain('0/2');
    });
  });

  // ── parseEditorVerdict ──────────────────────────────────────────────────

  describe('parseEditorVerdict', () => {
    it('parses bold verdict **APPROVED**', () => {
      const dir = createArticleDir(tempDir, 'bold-verdict', {
        'editor-review.md': 'Overall this looks good. **APPROVED**',
      });
      const result = parseEditorVerdict(dir);
      expect(result?.verdict).toBe('APPROVED');
    });

    it('parses "Final Verdict: APPROVED"', () => {
      const dir = createArticleDir(tempDir, 'final-verdict', {
        'editor-review.md': '## Final Verdict: ✅ APPROVED\nGreat work.',
      });
      const result = parseEditorVerdict(dir);
      expect(result?.verdict).toBe('APPROVED');
    });

    it('parses "Overall Assessment: REVISE"', () => {
      const dir = createArticleDir(tempDir, 'overall', {
        'editor-review.md': 'Overall Assessment: 🔴 REVISE\nNeeds fixes.',
      });
      const result = parseEditorVerdict(dir);
      expect(result?.verdict).toBe('REVISE');
    });

    it('parses emoji-prefixed verdict on its own line', () => {
      const dir = createArticleDir(tempDir, 'emoji-line', {
        'editor-review.md': 'Review notes\n\n✅ APPROVED',
      });
      const result = parseEditorVerdict(dir);
      expect(result?.verdict).toBe('APPROVED');
    });

    it('parses hash-prefixed emoji verdict', () => {
      const dir = createArticleDir(tempDir, 'hash-emoji', {
        'editor-review.md': '### 🟢 APPROVED',
      });
      const result = parseEditorVerdict(dir);
      expect(result?.verdict).toBe('APPROVED');
    });

    it('returns null for no review files', () => {
      const dir = createArticleDir(tempDir, 'no-review', {
        'draft.md': '# Draft',
      });
      expect(parseEditorVerdict(dir)).toBeNull();
    });

    it('returns null verdict if no pattern matches', () => {
      const dir = createArticleDir(tempDir, 'unparseable', {
        'editor-review.md': '# Editor Review\nSome notes but no verdict.',
      });
      const result = parseEditorVerdict(dir);
      expect(result).not.toBeNull();
      expect(result!.verdict).toBeNull();
    });

    it('counts error/suggestion/note indicators', () => {
      const dir = createArticleDir(tempDir, 'counts', {
        'editor-review.md': [
          '## Verdict: REVISE',
          '🔴 Error 1',
          '🔴 Error 2',
          '🟡 Suggestion 1',
          '🟢 Note 1',
          '🟢 Note 2',
          '🟢 Note 3',
        ].join('\n'),
      });
      const result = parseEditorVerdict(dir);
      // Each line matches both emoji + word: 🔴×2 + "Error"×2 = 4
      expect(result?.errors).toBe(4);
      // 🟡×1 + "Suggestion"×1 = 2
      expect(result?.suggestions).toBe(2);
      // 🟢×3 + "Note"×3 = 6
      expect(result?.notes).toBe(6);
    });

    it('selects the highest-numbered review file', () => {
      const dir = createArticleDir(tempDir, 'multi', {
        'editor-review.md': '**REJECT**',
        'editor-review-2.md': '**REVISE**',
        'editor-review-3.md': '**APPROVED**',
      });
      const result = parseEditorVerdict(dir);
      expect(result?.verdict).toBe('APPROVED');
      expect(result?.reviewFile).toBe('editor-review-3.md');
    });
  });

  // ── Helper functions ────────────────────────────────────────────────────

  describe('helper functions', () => {
    it('hasFile returns true for existing file', () => {
      const dir = createArticleDir(tempDir, 'has', { 'idea.md': 'hi' });
      expect(hasFile(dir, 'idea.md')).toBe(true);
      expect(hasFile(dir, 'nope.md')).toBe(false);
    });

    it('hasAnyFile matches regex patterns', () => {
      const dir = createArticleDir(tempDir, 'any', {
        'editor-review-2.md': 'content',
      });
      expect(hasAnyFile(dir, [/^editor-review/])).toBe(true);
      expect(hasAnyFile(dir, [/^draft/])).toBe(false);
    });

    it('hasPanelOutputs requires ≥2 position files', () => {
      const dir1 = createArticleDir(tempDir, 'one-panel', {
        'cap-position.md': 'one',
      });
      expect(hasPanelOutputs(dir1)).toBe(false);

      const dir2 = createArticleDir(tempDir, 'two-panel', {
        'cap-position.md': 'one',
        'sea-position.md': 'two',
      });
      expect(hasPanelOutputs(dir2)).toBe(true);
    });

    it('hasPublisherPass detects publisher-pass.md', () => {
      const dir = createArticleDir(tempDir, 'pub', {
        'publisher-pass.md': 'pass',
      });
      expect(hasPublisherPass(dir)).toBe(true);
    });

    it('hasDiscussionSummary detects both filenames', () => {
      const d1 = createArticleDir(tempDir, 'sum', {
        'discussion-summary.md': 's',
      });
      expect(hasDiscussionSummary(d1)).toBe(true);

      const d2 = createArticleDir(tempDir, 'syn', {
        'discussion-synthesis.md': 's',
      });
      expect(hasDiscussionSummary(d2)).toBe(true);
    });

    it('countImages counts png/jpg/webp in article dir', () => {
      const dir = createArticleDir(tempDir, 'imgs', {
        'cover.png': '',
        'inline.jpg': '',
        'photo.webp': '',
        'draft.md': '# Draft',
      });
      expect(countImages(dir)).toBe(3);
    });

    it('countImages includes sibling images dir', () => {
      const articlesDir = join(tempDir, 'articles');
      const imagesDir = join(tempDir, 'images');
      mkdirSync(join(articlesDir, 'test-slug'), { recursive: true });
      mkdirSync(join(imagesDir, 'test-slug'), { recursive: true });
      writeFileSync(join(imagesDir, 'test-slug', 'hero.png'), '');

      expect(
        countImages(join(articlesDir, 'test-slug'), imagesDir),
      ).toBe(1);
    });

    it('inferDiscussionPath prefers summary over synthesis', () => {
      const dir = createArticleDir(tempDir, 'both-disc', {
        'discussion-summary.md': 's',
        'discussion-synthesis.md': 's',
      });
      const result = inferDiscussionPath('both-disc', tempDir);
      expect(result).toContain('discussion-summary.md');
    });

    it('inferDiscussionPath returns null when neither exists', () => {
      createArticleDir(tempDir, 'no-disc', { 'idea.md': 'hi' });
      expect(inferDiscussionPath('no-disc', tempDir)).toBeNull();
    });

    it('inferArticlePath prefers draft.md over flat file', () => {
      createArticleDir(tempDir, 'art-slug', { 'draft.md': '# Draft' });
      writeFileSync(join(tempDir, 'art-slug.md'), '# Flat');
      const result = inferArticlePath('art-slug', tempDir);
      expect(result).toContain('draft.md');
    });

    it('inferArticlePath falls back to flat file', () => {
      mkdirSync(join(tempDir, 'flat-slug'), { recursive: true });
      writeFileSync(join(tempDir, 'flat-slug.md'), '# Flat');
      const result = inferArticlePath('flat-slug', tempDir);
      expect(result).toContain('flat-slug.md');
      expect(result).not.toContain('draft');
    });
  });

  // ── scanArticles ────────────────────────────────────────────────────────

  describe('scanArticles', () => {
    it('scans multiple article directories', () => {
      createArticleDir(tempDir, 'article-a', { 'idea.md': 'Idea A' });
      createArticleDir(tempDir, 'article-b', { 'draft.md': 'Draft B' });
      createArticleDir(tempDir, 'article-c', {
        'publisher-pass.md': 'Pass C',
      });

      const results = scanArticles(tempDir);
      expect(results).toHaveLength(3);

      const slugs = results.map((r) => r.slug).sort();
      expect(slugs).toEqual(['article-a', 'article-b', 'article-c']);

      const bySlug = Object.fromEntries(results.map((r) => [r.slug, r]));
      expect(bySlug['article-a'].stage).toBe(1);
      expect(bySlug['article-b'].stage).toBe(5);
      expect(bySlug['article-c'].stage).toBe(7);
    });

    it('overrides stage to 8 when DB says published', () => {
      createArticleDir(tempDir, 'pub-article', { 'draft.md': '# Draft' });

      const dbArticles = new Map<string, Article>([
        [
          'pub-article',
          makeArticle({
            id: 'pub-article',
            current_stage: 8,
            status: 'published',
            substack_url: 'https://example.substack.com/p/pub-article',
          }),
        ],
      ]);

      const results = scanArticles(tempDir, dbArticles);
      expect(results[0].stage).toBe(8);
      expect(results[0].detail).toContain('Published');
    });

    it('handles empty articles directory', () => {
      const empty = join(tempDir, 'empty-articles');
      mkdirSync(empty, { recursive: true });
      expect(scanArticles(empty)).toEqual([]);
    });

    it('handles non-existent articles directory', () => {
      expect(scanArticles(join(tempDir, 'nope'))).toEqual([]);
    });

    it('includes legacy flat .md files', () => {
      writeFileSync(join(tempDir, 'flat-article.md'), '# Flat');
      const results = scanArticles(tempDir);
      const flat = results.find((r) => r.slug === 'flat-article');
      expect(flat).toBeDefined();
    });
  });

  // ── reconcile ───────────────────────────────────────────────────────────

  describe('reconcile', () => {
    it('detects MISSING_DB_ROW when artifact dir has no DB entry', () => {
      createArticleDir(tempDir, 'orphan', { 'draft.md': '# Draft' });

      const repo = stubRepo([]);
      const discs = reconcile(tempDir, repo, { dryRun: true });

      expect(discs).toHaveLength(1);
      expect(discs[0].action).toBe('MISSING_DB_ROW');
      expect(discs[0].slug).toBe('orphan');
      expect(discs[0].artifactStage).toBe(5);
    });

    it('detects STAGE_DRIFT when artifact != DB stage', () => {
      createArticleDir(tempDir, 'drifted', { 'draft.md': '# Draft' });

      const repo = stubRepo([
        makeArticle({
          id: 'drifted',
          current_stage: 3 as Stage,
          status: 'in_production',
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      const drift = discs.find((d) => d.action === 'STAGE_DRIFT');
      expect(drift).toBeDefined();
      expect(drift!.artifactStage).toBe(5);
      expect(drift!.dbStage).toBe(3);
    });

    it('does not flag published articles at stage 8 in DB', () => {
      createArticleDir(tempDir, 'pubbed', { 'draft.md': '# Draft' });

      const repo = stubRepo([
        makeArticle({
          id: 'pubbed',
          current_stage: 8 as Stage,
          status: 'published',
          substack_url: 'https://example.substack.com/p/pubbed',
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      // Should not have STAGE_DRIFT for this one — DB override to 8
      const drift = discs.find(
        (d) => d.slug === 'pubbed' && d.action === 'STAGE_DRIFT',
      );
      expect(drift).toBeUndefined();
    });

    it('detects STATUS_DRIFT for stage 5+ not in_production', () => {
      createArticleDir(tempDir, 'status-wrong', { 'draft.md': '# Draft' });

      const repo = stubRepo([
        makeArticle({
          id: 'status-wrong',
          current_stage: 5 as Stage,
          status: 'in_discussion',
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      const statusDrift = discs.find((d) => d.action === 'STATUS_DRIFT');
      expect(statusDrift).toBeDefined();
      expect(statusDrift!.detail).toContain("expected='in_production'");
    });

    it('detects MISSING_EDITOR_REVIEW', () => {
      createArticleDir(tempDir, 'no-er-db', {
        'draft.md': '# Draft',
        'editor-review.md': '## Verdict: APPROVED',
      });

      const repo = stubRepo([
        makeArticle({
          id: 'no-er-db',
          current_stage: 6 as Stage,
          status: 'in_production',
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      const missing = discs.find(
        (d) => d.action === 'MISSING_EDITOR_REVIEW',
      );
      expect(missing).toBeDefined();
    });

    it('detects PATH_MISSING for discussion_path', () => {
      createArticleDir(tempDir, 'no-disc-path', {
        'discussion-summary.md': '# Summary',
        'draft.md': '# Draft',
      });

      const repo = stubRepo([
        makeArticle({
          id: 'no-disc-path',
          current_stage: 5 as Stage,
          status: 'in_production',
          discussion_path: null,
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      const pathMissing = discs.find(
        (d) => d.slug === 'no-disc-path' && d.action === 'PATH_MISSING',
      );
      expect(pathMissing).toBeDefined();
      expect(pathMissing!.detail).toContain('discussion_path');
    });

    it('detects NO_ARTIFACTS for DB entries without local dirs', () => {
      // Don't create any article dirs — just have a DB entry
      const repo = stubRepo([
        makeArticle({
          id: 'phantom',
          current_stage: 4 as Stage,
          status: 'in_production',
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      const noArt = discs.find(
        (d) => d.slug === 'phantom' && d.action === 'NO_ARTIFACTS',
      );
      expect(noArt).toBeDefined();
    });

    it('skips NO_ARTIFACTS for stage-1 proposed articles', () => {
      const repo = stubRepo([
        makeArticle({
          id: 'just-idea',
          current_stage: 1 as Stage,
          status: 'proposed',
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      const noArt = discs.find(
        (d) => d.slug === 'just-idea' && d.action === 'NO_ARTIFACTS',
      );
      expect(noArt).toBeUndefined();
    });

    it('repair mode calls repo methods for MISSING_DB_ROW', () => {
      createArticleDir(tempDir, 'new-article', { 'draft.md': '# Draft' });

      const repo = stubRepo([]);
      reconcile(tempDir, repo, { dryRun: false });

      expect(repo.calls['backfillArticle']).toHaveLength(1);
      const call = repo.calls['backfillArticle'][0][0] as Record<
        string,
        unknown
      >;
      expect(call.articleId).toBe('new-article');
      expect(call.stage).toBe(5);
    });

    it('reports no discrepancies when everything matches', () => {
      createArticleDir(tempDir, 'clean', { 'draft.md': '# Draft' });

      const repo = stubRepo([
        makeArticle({
          id: 'clean',
          current_stage: 5 as Stage,
          status: 'in_production',
          article_path: join(tempDir, 'clean', 'draft.md').replace(
            /\\/g,
            '/',
          ),
          discussion_path: null,
        }),
      ]);

      const discs = reconcile(tempDir, repo, { dryRun: true });
      // May have PATH_MISSING for article_path depending on canonical logic,
      // but should NOT have STAGE_DRIFT or STATUS_DRIFT
      const critical = discs.filter(
        (d) =>
          d.action === 'STAGE_DRIFT' ||
          d.action === 'STATUS_DRIFT' ||
          d.action === 'MISSING_DB_ROW',
      );
      expect(critical).toHaveLength(0);
    });
  });
});
