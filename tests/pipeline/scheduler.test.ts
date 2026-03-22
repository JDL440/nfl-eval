import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { Repository } from '../../src/db/repository.js';
import type { Stage } from '../../src/types.js';
import { STAGE_NAMES, VALID_STAGES } from '../../src/types.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { PipelineScheduler } from '../../src/pipeline/scheduler.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function longText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('PipelineScheduler', () => {
  let dbPath: string;
  let repo: Repository;
  let engine: PipelineEngine;
  let scheduler: PipelineScheduler;

  beforeEach(() => {
    dbPath = join(tmpdir(), `nfl-sched-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    repo = new Repository(dbPath);
    engine = new PipelineEngine(repo);
    scheduler = new PipelineScheduler(engine, repo);
  });

  afterEach(() => {
    repo.close();
    try { unlinkSync(dbPath); } catch {}
  });

  // ── findReady ─────────────────────────────────────────────────────────────

  describe('findReady', () => {
    it('returns articles that can advance', () => {
      repo.createArticle({ id: 'art-a', title: 'Article A' });
      repo.artifacts.put('art-a', 'idea.md', '# Great Idea');

      repo.createArticle({ id: 'art-b', title: 'Article B' });
      // art-b has no idea.md — should NOT be ready

      const ready = scheduler.findReady();
      expect(ready).toHaveLength(1);
      expect(ready[0].articleId).toBe('art-a');
      expect(ready[0].currentStage).toBe(1);
      expect(ready[0].nextStage).toBe(2);
      expect(ready[0].stageName).toBe('Idea Generation');
      expect(ready[0].nextStageName).toBe('Discussion Prompt');
      expect(ready[0].reason).toContain('Idea');
    });

    it('returns empty array when no articles exist', () => {
      expect(scheduler.findReady()).toEqual([]);
    });

    it('skips stage-8 articles', () => {
      repo.createArticle({ id: 'published', title: 'Published' });
      // Manually advance to stage 7 through the engine
      repo.artifacts.put('published', 'idea.md', '# Idea');
      engine.advance('published', 1 as Stage);
      repo.artifacts.put('published', 'discussion-prompt.md', 'prompt');
      engine.advance('published', 2 as Stage);
      repo.artifacts.put('published', 'panel-composition.md', 'panel');
      engine.advance('published', 3 as Stage);
      repo.artifacts.put('published', 'discussion-summary.md', 'summary');
      engine.advance('published', 4 as Stage);
      repo.artifacts.put('published', 'draft.md', longText(900));
      engine.advance('published', 5 as Stage);
      repo.artifacts.put('published', 'editor-review.md', '## Verdict: APPROVED\nLGTM.');
      engine.advance('published', 6 as Stage);
      repo.artifacts.put('published', 'publisher-pass.md', '# Publisher Pass\nAll good.');
      // Stage 7→8 uses recordPublish (the real publish path), not engine.advance
      repo.recordPublish('published', 'https://example.substack.com/p/published', 'test');

      const ready = scheduler.findReady();
      expect(ready).toHaveLength(0);
    });
  });

  // ── findReadyAtStage ──────────────────────────────────────────────────────

  describe('findReadyAtStage', () => {
    it('filters by stage', () => {
      // art-a at stage 1, ready
      repo.createArticle({ id: 'art-a', title: 'Article A' });
      repo.artifacts.put('art-a', 'idea.md', '# Idea A');

      // art-b at stage 2, ready
      repo.createArticle({ id: 'art-b', title: 'Article B' });
      repo.artifacts.put('art-b', 'idea.md', '# Idea B');
      engine.advance('art-b', 1 as Stage);
      repo.artifacts.put('art-b', 'discussion-prompt.md', 'prompt');

      const stage1Ready = scheduler.findReadyAtStage(1 as Stage);
      expect(stage1Ready).toHaveLength(1);
      expect(stage1Ready[0].articleId).toBe('art-a');

      const stage2Ready = scheduler.findReadyAtStage(2 as Stage);
      expect(stage2Ready).toHaveLength(1);
      expect(stage2Ready[0].articleId).toBe('art-b');
    });

    it('returns empty when no articles at that stage are ready', () => {
      repo.createArticle({ id: 'art-a', title: 'Article A' });
      // no idea.md
      expect(scheduler.findReadyAtStage(1 as Stage)).toEqual([]);
    });
  });

  // ── advanceSingle ─────────────────────────────────────────────────────────

  describe('advanceSingle', () => {
    it('succeeds with valid article', async () => {
      repo.createArticle({ id: 'art-a', title: 'Article A' });
      repo.artifacts.put('art-a', 'idea.md', '# Good Idea');

      const result = await scheduler.advanceSingle('art-a', 'test-agent');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify stage actually changed
      const article = repo.getArticle('art-a');
      expect(article!.current_stage).toBe(2);
    });

    it('fails gracefully on guard failure', async () => {
      repo.createArticle({ id: 'art-a', title: 'Article A' });
      // no artifacts — should fail guard

      const result = await scheduler.advanceSingle('art-a');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails when article does not exist', async () => {
      const result = await scheduler.advanceSingle('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ── advanceBatch ──────────────────────────────────────────────────────────

  describe('advanceBatch', () => {
    it('processes multiple articles', async () => {
      repo.createArticle({ id: 'batch-a', title: 'Batch A' });
      repo.createArticle({ id: 'batch-b', title: 'Batch B' });
      repo.artifacts.put('batch-a', 'idea.md', '# A');
      repo.artifacts.put('batch-b', 'idea.md', '# B');

      const result = await scheduler.advanceBatch({ agent: 'batch-agent' });
      expect(result.attempted).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);

      // Verify both advanced
      expect(repo.getArticle('batch-a')!.current_stage).toBe(2);
      expect(repo.getArticle('batch-b')!.current_stage).toBe(2);
    });

    it('respects limit', async () => {
      repo.createArticle({ id: 'lim-a', title: 'Limit A' });
      repo.createArticle({ id: 'lim-b', title: 'Limit B' });
      repo.createArticle({ id: 'lim-c', title: 'Limit C' });
      repo.artifacts.put('lim-a', 'idea.md', '# A');
      repo.artifacts.put('lim-b', 'idea.md', '# B');
      repo.artifacts.put('lim-c', 'idea.md', '# C');

      const result = await scheduler.advanceBatch({ limit: 2 });
      expect(result.attempted).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.results).toHaveLength(2);
    });

    it('respects stage filter', async () => {
      // art-a at stage 1, ready
      repo.createArticle({ id: 'sf-a', title: 'Stage Filter A' });
      repo.artifacts.put('sf-a', 'idea.md', '# Idea');

      // art-b at stage 2, ready
      repo.createArticle({ id: 'sf-b', title: 'Stage Filter B' });
      repo.artifacts.put('sf-b', 'idea.md', '# Idea');
      engine.advance('sf-b', 1 as Stage);
      repo.artifacts.put('sf-b', 'discussion-prompt.md', 'prompt');

      const result = await scheduler.advanceBatch({ stage: 2 as Stage });
      expect(result.attempted).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.results[0].articleId).toBe('sf-b');
      expect(result.results[0].fromStage).toBe(2);
      expect(result.results[0].toStage).toBe(3);
    });

    it('returns empty result for empty pipeline', async () => {
      const result = await scheduler.advanceBatch();
      expect(result.attempted).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  // ── dryRun ────────────────────────────────────────────────────────────────

  describe('dryRun mode', () => {
    it('does not actually advance articles', async () => {
      const dryScheduler = new PipelineScheduler(engine, repo, { dryRun: true });

      repo.createArticle({ id: 'dry-a', title: 'Dry Run A' });
      repo.artifacts.put('dry-a', 'idea.md', '# Idea');

      // advanceSingle should report success but not mutate
      const single = await dryScheduler.advanceSingle('dry-a');
      expect(single.success).toBe(true);
      expect(repo.getArticle('dry-a')!.current_stage).toBe(1);

      // advanceBatch should also be dry
      const batch = await dryScheduler.advanceBatch();
      expect(batch.attempted).toBe(1);
      expect(batch.succeeded).toBe(1);
      expect(repo.getArticle('dry-a')!.current_stage).toBe(1);
    });
  });

  // ── summary ───────────────────────────────────────────────────────────────

  describe('summary', () => {
    it('returns correct counts per stage', () => {
      // Create 2 articles at stage 1, one ready
      repo.createArticle({ id: 'sum-a', title: 'Summary A' });
      repo.createArticle({ id: 'sum-b', title: 'Summary B' });
      repo.artifacts.put('sum-a', 'idea.md', '# Ready');
      // sum-b has no idea.md, not ready

      // Advance sum-a to stage 2
      // Actually just leave both at stage 1 for a clearer test
      const result = scheduler.summary();

      // Stage 1 should have 2 articles, 1 ready
      expect(result[1 as Stage].count).toBe(2);
      expect(result[1 as Stage].ready).toBe(1);
      expect(result[1 as Stage].name).toBe('Idea Generation');

      // Other stages should have 0
      expect(result[2 as Stage].count).toBe(0);
      expect(result[8 as Stage].count).toBe(0);
    });

    it('includes all stages in the result', () => {
      const result = scheduler.summary();
      for (const s of VALID_STAGES) {
        expect(result[s]).toBeDefined();
        expect(result[s].name).toBe(STAGE_NAMES[s]);
      }
    });

    it('returns zeros for an empty pipeline', () => {
      const result = scheduler.summary();
      for (const s of VALID_STAGES) {
        expect(result[s].count).toBe(0);
        expect(result[s].ready).toBe(0);
      }
    });
  });
});
