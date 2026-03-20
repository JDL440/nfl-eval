import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { Repository } from '../../src/db/repository.js';
import type { Stage } from '../../src/types.js';
import {
  PipelineEngine,
  TRANSITION_MAP,
  requireIdea,
  requirePrompt,
  requirePanelComposition,
  requireDiscussionSummary,
  requireDraft,
  requireEditorApproval,
  requirePublisherPass,
  requireSubstackUrl,
} from '../../src/pipeline/engine.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function longText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
}

// ── Guard function unit tests ───────────────────────────────────────────────

describe('Guard functions', () => {
  let repo: Repository;
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `nfl-guard-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    repo = new Repository(dbPath);
  });

  afterEach(() => {
    repo.close();
    try { unlinkSync(dbPath); } catch {}
  });

  // ── requireIdea ───────────────────────────────────────────────────────────

  describe('requireIdea', () => {
    it('fails when idea.md does not exist', () => {
      const result = requireIdea(repo.artifacts, 'no-idea');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not been written');
    });

    it('fails when idea.md is empty', () => {
      repo.createArticle({ id: 'empty-idea', title: 'Test' });
      repo.artifacts.put('empty-idea', 'idea.md', '  ');
      const result = requireIdea(repo.artifacts, 'empty-idea');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('fails when idea.md is whitespace only', () => {
      repo.createArticle({ id: 'ws-idea', title: 'Test' });
      repo.artifacts.put('ws-idea', 'idea.md', '   \n  \t  ');
      const result = requireIdea(repo.artifacts, 'ws-idea');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('passes when idea.md has content', () => {
      repo.createArticle({ id: 'good-idea', title: 'Test' });
      repo.artifacts.put('good-idea', 'idea.md', '# Seahawks Draft Analysis\nGreat topic.');
      const result = requireIdea(repo.artifacts, 'good-idea');
      expect(result.passed).toBe(true);
    });
  });

  // ── requirePrompt ─────────────────────────────────────────────────────────

  describe('requirePrompt', () => {
    it('fails when discussion-prompt.md does not exist', () => {
      const result = requirePrompt(repo.artifacts, 'no-prompt');
      expect(result.passed).toBe(false);
    });

    it('passes when discussion-prompt.md exists', () => {
      repo.createArticle({ id: 'has-prompt', title: 'Test' });
      repo.artifacts.put('has-prompt', 'discussion-prompt.md', 'prompt content');
      const result = requirePrompt(repo.artifacts, 'has-prompt');
      expect(result.passed).toBe(true);
    });
  });

  // ── requirePanelComposition ───────────────────────────────────────────────

  describe('requirePanelComposition', () => {
    it('fails when panel-composition.md does not exist', () => {
      const result = requirePanelComposition(repo.artifacts, 'no-panel');
      expect(result.passed).toBe(false);
    });

    it('passes when panel-composition.md exists', () => {
      repo.createArticle({ id: 'has-panel', title: 'Test' });
      repo.artifacts.put('has-panel', 'panel-composition.md', 'panel info');
      const result = requirePanelComposition(repo.artifacts, 'has-panel');
      expect(result.passed).toBe(true);
    });
  });

  // ── requireDiscussionSummary ──────────────────────────────────────────────

  describe('requireDiscussionSummary', () => {
    it('fails when discussion-summary.md does not exist', () => {
      const result = requireDiscussionSummary(repo.artifacts, 'no-summary');
      expect(result.passed).toBe(false);
    });

    it('passes when discussion-summary.md exists', () => {
      repo.createArticle({ id: 'has-summary', title: 'Test' });
      repo.artifacts.put('has-summary', 'discussion-summary.md', 'summary content');
      const result = requireDiscussionSummary(repo.artifacts, 'has-summary');
      expect(result.passed).toBe(true);
    });
  });

  // ── requireDraft ──────────────────────────────────────────────────────────

  describe('requireDraft', () => {
    it('fails when draft.md does not exist', () => {
      const result = requireDraft(repo.artifacts, 'no-draft');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not been written');
    });

    it('fails when draft.md has fewer than 800 words', () => {
      repo.createArticle({ id: 'short-draft', title: 'Test' });
      repo.artifacts.put('short-draft', 'draft.md', longText(500));
      const result = requireDraft(repo.artifacts, 'short-draft');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('500 words');
    });

    it('passes when draft.md has 800+ words', () => {
      repo.createArticle({ id: 'good-draft', title: 'Test' });
      repo.artifacts.put('good-draft', 'draft.md', longText(1000));
      const result = requireDraft(repo.artifacts, 'good-draft');
      expect(result.passed).toBe(true);
    });

    it('passes at exactly 800 words', () => {
      repo.createArticle({ id: 'exact-draft', title: 'Test' });
      repo.artifacts.put('exact-draft', 'draft.md', longText(800));
      const result = requireDraft(repo.artifacts, 'exact-draft');
      expect(result.passed).toBe(true);
    });
  });

  // ── requireEditorApproval ─────────────────────────────────────────────────

  describe('requireEditorApproval', () => {
    it('fails when no editor-review file exists', () => {
      const result = requireEditorApproval(repo.artifacts, 'no-editor');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('No editor review');
    });

    it('fails when verdict is REVISE', () => {
      repo.createArticle({ id: 'revise', title: 'Test' });
      repo.artifacts.put('revise', 'editor-review.md', '## Verdict: REVISE\nNeeds work.');
      const result = requireEditorApproval(repo.artifacts, 'revise');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('REVISE');
    });

    it('fails when verdict is REJECT', () => {
      repo.createArticle({ id: 'reject', title: 'Test' });
      repo.artifacts.put('reject', 'editor-review.md', '## Verdict: REJECT\nNot publishable.');
      const result = requireEditorApproval(repo.artifacts, 'reject');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('REJECT');
    });

    it('passes when verdict is APPROVED', () => {
      repo.createArticle({ id: 'approved', title: 'Test' });
      repo.artifacts.put('approved', 'editor-review.md', '## Verdict: APPROVED\nLooks great.');
      const result = requireEditorApproval(repo.artifacts, 'approved');
      expect(result.passed).toBe(true);
    });

    it('uses the latest review file when multiple exist', () => {
      repo.createArticle({ id: 'multi-review', title: 'Test' });
      repo.artifacts.put('multi-review', 'editor-review.md', '## Verdict: REVISE\nFirst pass.');
      repo.artifacts.put('multi-review', 'editor-review-2.md', '## Verdict: APPROVED\nSecond pass.');
      const result = requireEditorApproval(repo.artifacts, 'multi-review');
      expect(result.passed).toBe(true);
    });
  });

  // ── requirePublisherPass ──────────────────────────────────────────────────

  describe('requirePublisherPass', () => {
    beforeEach(() => {
      repo.createArticle({ id: 'test-pub', title: 'Test' });
    });

    it('fails when no publisher pass record exists', () => {
      const result = requirePublisherPass(repo, 'test-pub');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('No publisher pass');
    });

    it('fails when publisher pass has incomplete checks', () => {
      repo.recordPublisherPass('test-pub', {
        title_final: 1,
        subtitle_final: 1,
        body_clean: 0,   // incomplete
      });
      const result = requirePublisherPass(repo, 'test-pub');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('body_clean');
    });

    it('fails when publish_datetime is null', () => {
      repo.recordPublisherPass('test-pub', {
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
      const result = requirePublisherPass(repo, 'test-pub');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('publish_datetime');
    });

    it('passes when all checks are complete', () => {
      repo.recordPublisherPass('test-pub', {
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
        publish_datetime: '2025-07-01 12:00:00',
      });
      const result = requirePublisherPass(repo, 'test-pub');
      expect(result.passed).toBe(true);
    });
  });

  // ── requireSubstackUrl ────────────────────────────────────────────────────

  describe('requireSubstackUrl', () => {

    it('fails when article does not exist', () => {
      const result = requireSubstackUrl(repo, 'nonexistent');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('fails when substack_url is null', () => {
      repo.createArticle({ id: 'no-url', title: 'Test' });
      const result = requireSubstackUrl(repo, 'no-url');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('substack_url');
    });

    it('passes when substack_url is set', () => {
      repo.createArticle({ id: 'has-url', title: 'Test' });
      // Advance to stage 7 and publish to set the URL
      repo.advanceStage('has-url', 1, 2, 'test');
      repo.advanceStage('has-url', 2, 3, 'test');
      repo.advanceStage('has-url', 3, 4, 'test');
      repo.advanceStage('has-url', 4, 5, 'test');
      repo.advanceStage('has-url', 5, 6, 'test');
      repo.advanceStage('has-url', 6, 7, 'test');
      repo.recordPublish('has-url', 'https://example.substack.com/p/test', 'test');
      const result = requireSubstackUrl(repo, 'has-url');
      expect(result.passed).toBe(true);
    });
  });
});

// ── Transition map tests ────────────────────────────────────────────────────

describe('TRANSITION_MAP', () => {
  it('has 7 transitions (stages 1→2 through 7→8)', () => {
    expect(TRANSITION_MAP).toHaveLength(7);
  });

  it('covers all consecutive stage pairs', () => {
    const pairs = TRANSITION_MAP.map((t) => [t.from, t.to]);
    expect(pairs).toEqual([
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
    ]);
  });
});

// ── PipelineEngine tests ────────────────────────────────────────────────────

describe('PipelineEngine', () => {
  let repo: Repository;
  let dbPath: string;
  let engine: PipelineEngine;

  beforeEach(() => {
    dbPath = join(tmpdir(), `nfl-engine-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    repo = new Repository(dbPath);
    engine = new PipelineEngine(repo);
  });

  afterEach(() => {
    repo.close();
    try { unlinkSync(dbPath); } catch {}
  });

  // ── canAdvance ────────────────────────────────────────────────────────────

  describe('canAdvance', () => {
    it('allows 1→2 when idea.md exists', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'idea.md', '# Great Idea');
      const check = engine.canAdvance('test-article', 1 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(2);
    });

    it('blocks 1→2 when idea.md missing', () => {
      const check = engine.canAdvance('test-article', 1 as Stage);
      expect(check.allowed).toBe(false);
      expect(check.nextStage).toBe(2);
    });

    it('allows 2→3 when discussion-prompt.md exists', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'discussion-prompt.md', 'prompt');
      const check = engine.canAdvance('test-article', 2 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(3);
    });

    it('allows 3→4 when panel-composition.md exists', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'panel-composition.md', 'panel');
      const check = engine.canAdvance('test-article', 3 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(4);
    });

    it('allows 4→5 when discussion-summary.md exists', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'discussion-summary.md', 'summary');
      const check = engine.canAdvance('test-article', 4 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(5);
    });

    it('allows 5→6 when draft.md has 800+ words', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'draft.md', longText(900));
      const check = engine.canAdvance('test-article', 5 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(6);
    });

    it('blocks 5→6 when draft.md has < 800 words', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'draft.md', longText(200));
      const check = engine.canAdvance('test-article', 5 as Stage);
      expect(check.allowed).toBe(false);
    });

    it('allows 6→7 when editor approved', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'editor-review.md', '## Verdict: APPROVED\nLGTM.');
      const check = engine.canAdvance('test-article', 6 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(7);
    });

    it('blocks 6→7 when editor verdict is REVISE', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.artifacts.put('test-article', 'editor-review.md', '## Verdict: REVISE\nNeeds work.');
      const check = engine.canAdvance('test-article', 6 as Stage);
      expect(check.allowed).toBe(false);
    });

    it('allows 7→8 when publisher pass complete', () => {
      repo.createArticle({ id: 'test-article', title: 'Test' });
      repo.recordPublisherPass('test-article', {
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
        publish_datetime: '2025-07-01 12:00:00',
      });
      const check = engine.canAdvance('test-article', 7 as Stage);
      expect(check.allowed).toBe(true);
      expect(check.nextStage).toBe(8);
    });

    it('rejects advance from stage 8 (no transition)', () => {
      const check = engine.canAdvance('test-article', 8 as Stage);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('No transition');
    });
  });

  // ── Invalid transitions ───────────────────────────────────────────────────

  describe('invalid transitions', () => {
    it('cannot skip stages (no 1→3 transition)', () => {
      // canAdvance only checks fromStage, so stage 1 always maps to 2
      const check = engine.canAdvance('test', 1 as Stage);
      expect(check.nextStage).toBe(2);
      // There's no way to get to 3 from 1 without going through 2
    });

    it('cannot go backwards (stage 8 has no forward transition)', () => {
      const check = engine.canAdvance('test', 8 as Stage);
      expect(check.allowed).toBe(false);
    });
  });

  // ── advance (integration with Repository) ─────────────────────────────────

  describe('advance', () => {
    it('advances article from stage 1 to 2', () => {
      repo.createArticle({ id: 'adv-test', title: 'Advance Test' });
      repo.artifacts.put('adv-test', 'idea.md', '# Idea');

      const newStage = engine.advance('adv-test', 1 as Stage, 'test-agent');
      expect(newStage).toBe(2);

      const article = repo.getArticle('adv-test');
      expect(article!.current_stage).toBe(2);
    });

    it('advances through multiple stages sequentially', () => {
      repo.createArticle({ id: 'multi', title: 'Multi' });
      repo.artifacts.put('multi', 'idea.md', '# Idea content');
      repo.artifacts.put('multi', 'discussion-prompt.md', 'prompt');
      repo.artifacts.put('multi', 'panel-composition.md', 'panel');
      repo.artifacts.put('multi', 'discussion-summary.md', 'summary');
      repo.artifacts.put('multi', 'draft.md', longText(1000));
      repo.artifacts.put('multi', 'editor-review.md', '## Verdict: APPROVED');

      expect(engine.advance('multi', 1 as Stage)).toBe(2);
      expect(engine.advance('multi', 2 as Stage)).toBe(3);
      expect(engine.advance('multi', 3 as Stage)).toBe(4);
      expect(engine.advance('multi', 4 as Stage)).toBe(5);
      expect(engine.advance('multi', 5 as Stage)).toBe(6);
      expect(engine.advance('multi', 6 as Stage)).toBe(7);

      const article = repo.getArticle('multi');
      expect(article!.current_stage).toBe(7);
    });

    it('throws when guard fails', () => {
      repo.createArticle({ id: 'fail-test', title: 'Fail' });

      expect(() => engine.advance('fail-test', 1 as Stage)).toThrow(
        /Cannot advance.*Idea/,
      );
    });

    it('throws when repository rejects stale fromStage', () => {
      repo.createArticle({ id: 'stale', title: 'Stale' });
      repo.artifacts.put('stale', 'idea.md', '# Idea');

      // Advance to stage 2 first
      engine.advance('stale', 1 as Stage);

      // Now try to advance from stage 1 again — repo should reject
      expect(() => engine.advance('stale', 1 as Stage)).toThrow(/[Ss]tage mismatch/);
    });

    it('uses default agent name when not provided', () => {
      repo.createArticle({ id: 'def-agent', title: 'Default' });
      repo.artifacts.put('def-agent', 'idea.md', '# Content');

      engine.advance('def-agent', 1 as Stage);
      const article = repo.getArticle('def-agent');
      expect(article!.current_stage).toBe(2);
    });
  });

  // ── getAvailableActions ───────────────────────────────────────────────────

  describe('getAvailableActions', () => {
    it('returns matching actions when guard passes', () => {
      repo.createArticle({ id: 'actions-test', title: 'Actions' });
      repo.artifacts.put('actions-test', 'idea.md', '# Idea');

      const actions = engine.getAvailableActions('actions-test');
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('generatePrompt');
    });

    it('returns empty when guard fails', () => {
      repo.createArticle({ id: 'no-actions', title: 'No Actions' });

      const actions = engine.getAvailableActions('no-actions');
      expect(actions).toHaveLength(0);
    });

    it('returns empty for nonexistent article', () => {
      const actions = engine.getAvailableActions('nonexistent');
      expect(actions).toHaveLength(0);
    });

    it('returns empty at stage 8 (published)', () => {
      repo.createArticle({ id: 'published', title: 'Published' });
      repo.advanceStage('published', 1, 2, 'test');
      repo.advanceStage('published', 2, 3, 'test');
      repo.advanceStage('published', 3, 4, 'test');
      repo.advanceStage('published', 4, 5, 'test');
      repo.advanceStage('published', 5, 6, 'test');
      repo.advanceStage('published', 6, 7, 'test');
      repo.advanceStage('published', 7, 8, 'test');

      const actions = engine.getAvailableActions('published');
      expect(actions).toHaveLength(0);
    });
  });

  // ── validateArticle ───────────────────────────────────────────────────────

  describe('validateArticle', () => {
    it('returns validation items up to current stage', () => {
      repo.createArticle({ id: 'val-test', title: 'Validate' });
      repo.advanceStage('val-test', 1, 3, 'test');
      repo.artifacts.put('val-test', 'idea.md', '# Idea');
      repo.artifacts.put('val-test', 'discussion-prompt.md', 'prompt');
      repo.artifacts.put('val-test', 'panel-composition.md', 'panel');

      const report = engine.validateArticle('val-test');
      expect(report.articleId).toBe('val-test');
      expect(report.currentStage).toBe(3);
      // Should include guards for stages 1, 2, 3 (from fields)
      expect(report.items).toHaveLength(3);
      expect(report.items[0].action).toBe('generatePrompt');
      expect(report.items[0].result.passed).toBe(true);
      expect(report.items[1].action).toBe('composePanel');
      expect(report.items[1].result.passed).toBe(true);
      expect(report.items[2].action).toBe('runDiscussion');
      expect(report.items[2].result.passed).toBe(true);
    });

    it('shows failures in validation report', () => {
      repo.createArticle({ id: 'val-fail', title: 'Fail' });
      repo.advanceStage('val-fail', 1, 3, 'test');
      repo.artifacts.put('val-fail', 'idea.md', '# Idea');
      // missing discussion-prompt.md

      const report = engine.validateArticle('val-fail');
      expect(report.items[0].result.passed).toBe(true);  // idea exists
      expect(report.items[1].result.passed).toBe(false);  // prompt missing
    });

    it('throws for nonexistent article', () => {
      expect(() => engine.validateArticle('ghost')).toThrow(/not found/);
    });

    it('returns only stage 1 guard for a stage 1 article', () => {
      repo.createArticle({ id: 'stage1', title: 'Stage 1' });

      const report = engine.validateArticle('stage1');
      expect(report.items).toHaveLength(1);
      expect(report.items[0].stage).toBe(1);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles missing article directory gracefully in canAdvance', () => {
      const check = engine.canAdvance('nonexistent-dir', 1 as Stage);
      expect(check.allowed).toBe(false);
    });

    it('partial publisher pass reports specific failing checks', () => {
      repo.createArticle({ id: 'partial-pub', title: 'Partial' });
      repo.recordPublisherPass('partial-pub', {
        title_final: 1,
        subtitle_final: 1,
        body_clean: 1,
        section_assigned: 0,
        tags_set: 0,
        url_slug_set: 1,
        cover_image_set: 1,
        paywall_set: 1,
        email_send: 1,
        names_verified: 1,
        numbers_current: 1,
        no_stale_refs: 1,
        publish_datetime: '2025-07-01 12:00:00',
      });

      const check = engine.canAdvance('partial-pub', 7 as Stage);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('section_assigned');
      expect(check.reason).toContain('tags_set');
    });

    it('empty draft file fails word count check', () => {
      const result = requireDraft(repo.artifacts, 'empty-draft');
      expect(result.passed).toBe(false);
    });
  });

  // ── regress ───────────────────────────────────────────────────────────────

  describe('regress', () => {
    it('regresses article to a previous stage', () => {
      repo.createArticle({ id: 'regress-ok', title: 'Regress OK' });
      repo.artifacts.put('regress-ok', 'idea.md', '# Idea');
      engine.advance('regress-ok', 1 as Stage);
      // Now at stage 2 — regress back to 1
      engine.regress('regress-ok', 2 as Stage, 1 as Stage, 'editor', 'Needs rework');
      const article = repo.getArticle('regress-ok');
      expect(article!.current_stage).toBe(1);
      expect(article!.status).toBe('revision');
    });

    it('throws when target stage is not less than current', () => {
      repo.createArticle({ id: 'regress-fail', title: 'Fail' });
      repo.artifacts.put('regress-fail', 'idea.md', '# Idea');
      engine.advance('regress-fail', 1 as Stage);
      expect(() => engine.regress('regress-fail', 2 as Stage, 2 as Stage, 'editor', 'bad'))
        .toThrow('Cannot regress');
      expect(() => engine.regress('regress-fail', 2 as Stage, 3 as Stage, 'editor', 'bad'))
        .toThrow('Cannot regress');
    });

    it('throws for nonexistent article', () => {
      expect(() => engine.regress('ghost', 2 as Stage, 1 as Stage, 'editor', 'nope'))
        .toThrow('not found');
    });
  });
});
