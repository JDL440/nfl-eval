import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Repository } from '../../src/db/repository.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Repository', () => {
  let repo: Repository;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-lab-db-test-'));
    dbPath = join(tempDir, 'test-pipeline.db');
    repo = new Repository(dbPath);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Article CRUD ───────────────────────────────────────────────────────────

  describe('article CRUD', () => {
    it('creates and retrieves an article', () => {
      const article = repo.createArticle({
        id: 'test-article',
        title: 'Test Article',
        primary_team: 'seahawks',
      });
      expect(article.id).toBe('test-article');
      expect(article.current_stage).toBe(1);
      expect(article.status).toBe('proposed');
      expect(article.league).toBe('nfl');
      expect(article.primary_team).toBe('seahawks');
      expect(article.teams).toBe('["seahawks"]');

      const retrieved = repo.getArticle('test-article');
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Test Article');
    });

    it('creates article with custom league', () => {
      const article = repo.createArticle({
        id: 'nba-article',
        title: 'NBA Test',
        league: 'nba',
      });
      expect(article.league).toBe('nba');
    });

    it('creates article with custom depth level', () => {
      const article = repo.createArticle({
        id: 'deep-dive',
        title: 'Deep Dive',
        depth_level: 3,
      });
      expect(article.depth_level).toBe(3);
    });

    it('returns null for missing article', () => {
      expect(repo.getArticle('nonexistent')).toBeNull();
    });

    it('rejects duplicate article ids', () => {
      repo.createArticle({ id: 'dup', title: 'First' });
      expect(() => repo.createArticle({ id: 'dup', title: 'Second' })).toThrow('already exists');
    });

    it('getAllArticles returns all articles', () => {
      repo.createArticle({ id: 'a1', title: 'Article 1' });
      repo.createArticle({ id: 'a2', title: 'Article 2' });
      const all = repo.getAllArticles();
      expect(all).toHaveLength(2);
    });
  });

  // ── Stage transitions ──────────────────────────────────────────────────────

  describe('stage transitions', () => {
    it('advances stage with validation', () => {
      repo.createArticle({ id: 'adv-test', title: 'Advance Test' });
      repo.advanceStage('adv-test', 1, 2, 'test-agent');
      const article = repo.getArticle('adv-test');
      expect(article!.current_stage).toBe(2);
    });

    it('advances stage with status update', () => {
      repo.createArticle({ id: 'status-test', title: 'Status Test' });
      repo.advanceStage('status-test', 1, 2, 'agent', null, 'in_production');
      const article = repo.getArticle('status-test');
      expect(article!.status).toBe('in_production');
    });

    it('rejects stage mismatch', () => {
      repo.createArticle({ id: 'mismatch', title: 'Mismatch' });
      expect(() => repo.advanceStage('mismatch', 2, 3, 'agent')).toThrow('Stage mismatch');
    });

    it('rejects invalid stage numbers', () => {
      repo.createArticle({ id: 'invalid', title: 'Invalid' });
      expect(() => repo.advanceStage('invalid', 1, 9 as any, 'agent')).toThrow();
    });

    it('allows null from_stage for initial seed', () => {
      repo.createArticle({ id: 'seed', title: 'Seed' });
      repo.advanceStage('seed', null, 2, 'agent');
      expect(repo.getArticle('seed')!.current_stage).toBe(2);
    });

    it('rejects nonexistent article', () => {
      expect(() => repo.advanceStage('ghost', 1, 2, 'agent')).toThrow('not found');
    });

    it('advances with usage event', () => {
      repo.createArticle({ id: 'usage-adv', title: 'Usage Advance' });
      repo.advanceStage('usage-adv', 1, 2, 'agent', null, null, {
        surface: 'stage_transition',
        provider: 'local',
      });
      const events = repo.getUsageEvents('usage-adv');
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('stage_transition');
    });
  });

  // ── Editor reviews ─────────────────────────────────────────────────────────

  describe('editor reviews', () => {
    it('records and retrieves editor review', () => {
      repo.createArticle({ id: 'review-test', title: 'Review Test' });
      repo.recordEditorReview('review-test', 'APPROVED', 0, 2, 1);
      const reviews = repo.getEditorReviews('review-test');
      expect(reviews).toHaveLength(1);
      expect(reviews[0].verdict).toBe('APPROVED');
    });

    it('auto-increments review number', () => {
      repo.createArticle({ id: 'multi-review', title: 'Multi Review' });
      repo.recordEditorReview('multi-review', 'REVISE', 2, 1, 0);
      repo.recordEditorReview('multi-review', 'APPROVED', 0, 0, 0);
      const reviews = repo.getEditorReviews('multi-review');
      expect(reviews).toHaveLength(2);
      expect(reviews[0].review_number).toBe(2); // newest first
      expect(reviews[1].review_number).toBe(1);
    });

    it('rejects invalid verdict', () => {
      repo.createArticle({ id: 'bad-verdict', title: 'Bad Verdict' });
      expect(() => repo.recordEditorReview('bad-verdict', 'MAYBE' as any)).toThrow('Invalid verdict');
    });
  });

  // ── Publisher pass ─────────────────────────────────────────────────────────

  describe('publisher pass', () => {
    it('records publisher pass', () => {
      repo.createArticle({ id: 'pub-test', title: 'Pub Test' });
      repo.recordPublisherPass('pub-test', {
        title_final: 1, subtitle_final: 1, body_clean: 1,
        section_assigned: 1, tags_set: 1, url_slug_set: 1,
        cover_image_set: 1, paywall_set: 1, names_verified: 1,
        numbers_current: 1, no_stale_refs: 1,
      });
      // Should succeed without error
    });

    it('auto-advances from stage 6 to 7', () => {
      repo.createArticle({ id: 'auto-adv', title: 'Auto Advance' });
      repo.advanceStage('auto-adv', 1, 6, 'editor');
      repo.recordPublisherPass('auto-adv', { title_final: 1 });
      const article = repo.getArticle('auto-adv');
      expect(article!.current_stage).toBe(7);
    });

    it('rejects nonexistent article', () => {
      expect(() => repo.recordPublisherPass('ghost')).toThrow('not found');
    });
  });

  // ── Update checklist item ─────────────────────────────────────────────────

  describe('updateChecklistItem', () => {
    it('toggles a boolean checklist field', () => {
      repo.createArticle({ id: 'toggle-test', title: 'Toggle Test' });
      repo.recordPublisherPass('toggle-test', { title_final: 0 });

      repo.updateChecklistItem('toggle-test', 'title_final', 1);
      const pass = repo.getPublisherPass('toggle-test');
      expect(pass!.title_final).toBe(1);

      repo.updateChecklistItem('toggle-test', 'title_final', 0);
      const pass2 = repo.getPublisherPass('toggle-test');
      expect(pass2!.title_final).toBe(0);
    });

    it('sets and clears publish_datetime', () => {
      repo.createArticle({ id: 'dt-test', title: 'DateTime Test' });
      repo.recordPublisherPass('dt-test');

      const now = new Date().toISOString();
      repo.updateChecklistItem('dt-test', 'publish_datetime', now);
      const pass = repo.getPublisherPass('dt-test');
      expect(pass!.publish_datetime).toBe(now);

      repo.updateChecklistItem('dt-test', 'publish_datetime', null);
      const pass2 = repo.getPublisherPass('dt-test');
      expect(pass2!.publish_datetime).toBeNull();
    });

    it('creates publisher_pass row if missing', () => {
      repo.createArticle({ id: 'auto-create', title: 'Auto Create' });

      repo.updateChecklistItem('auto-create', 'body_clean', 1);
      const pass = repo.getPublisherPass('auto-create');
      expect(pass).not.toBeNull();
      expect(pass!.body_clean).toBe(1);
    });

    it('rejects invalid checklist key', () => {
      repo.createArticle({ id: 'bad-key', title: 'Bad Key' });
      expect(() => repo.updateChecklistItem('bad-key', 'fake_field', 1)).toThrow('Invalid checklist key');
    });

    it('rejects nonexistent article', () => {
      expect(() => repo.updateChecklistItem('ghost', 'title_final', 1)).toThrow('not found');
    });
  });

  // ── Publish confirmation ───────────────────────────────────────────────────

  describe('publish confirmation', () => {
    it('records publish and sets stage 8', () => {
      repo.createArticle({ id: 'publish-test', title: 'Publish Test' });
      repo.advanceStage('publish-test', 1, 7, 'agent');
      repo.recordPublish('publish-test', 'https://example.substack.com/p/test');
      const article = repo.getArticle('publish-test');
      expect(article!.current_stage).toBe(8);
      expect(article!.status).toBe('published');
      expect(article!.substack_url).toBe('https://example.substack.com/p/test');
      expect(article!.published_at).toBeTruthy();
    });

    it('rejects nonexistent article', () => {
      expect(() => repo.recordPublish('ghost', 'https://url')).toThrow('not found');
    });
  });

  // ── Draft URL management ───────────────────────────────────────────────────

  describe('draft URL management', () => {
    it('sets and gets draft URL', () => {
      repo.createArticle({ id: 'draft-test', title: 'Draft Test' });
      repo.setDraftUrl('draft-test', 'https://example.substack.com/publish/post/123');
      expect(repo.getDraftUrl('draft-test')).toBe('https://example.substack.com/publish/post/123');
    });

    it('returns null when no draft URL set', () => {
      repo.createArticle({ id: 'no-draft', title: 'No Draft' });
      expect(repo.getDraftUrl('no-draft')).toBeNull();
    });

    it('returns null for nonexistent article', () => {
      expect(repo.getDraftUrl('ghost')).toBeNull();
    });

    it('blocks draft URL update on published article', () => {
      repo.createArticle({ id: 'pub-block', title: 'Pub Block' });
      repo.recordPublish('pub-block', 'https://example.com/p/test');
      expect(() => repo.setDraftUrl('pub-block', 'https://new-url')).toThrow('already published');
    });
  });

  // ── assertNotPublished ─────────────────────────────────────────────────────

  describe('assertNotPublished', () => {
    it('passes for unpublished article', () => {
      repo.createArticle({ id: 'ok', title: 'OK' });
      expect(() => repo.assertNotPublished('ok')).not.toThrow();
    });

    it('throws for nonexistent article', () => {
      expect(() => repo.assertNotPublished('ghost')).toThrow('not found');
    });

    it('throws for published article', () => {
      repo.createArticle({ id: 'pub', title: 'Pub' });
      repo.recordPublish('pub', 'https://example.com/p/test');
      expect(() => repo.assertNotPublished('pub')).toThrow('already published');
    });
  });

  // ── Notes ──────────────────────────────────────────────────────────────────

  describe('notes', () => {
    it('records and retrieves notes', () => {
      repo.createArticle({ id: 'note-test', title: 'Note Test' });
      repo.recordNote('note-test', 'promotion', 'Check out this article!');
      const notes = repo.getNotesForArticle('note-test');
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('Check out this article!');
      expect(notes[0].note_type).toBe('promotion');
      expect(notes[0].target).toBe('prod');
    });

    it('records standalone note without article', () => {
      repo.recordNote(null, 'standalone', 'A standalone thought');
      const all = repo.getAllNotes();
      expect(all).toHaveLength(1);
      expect(all[0].article_id).toBeNull();
    });

    it('records note with all fields', () => {
      repo.createArticle({ id: 'full-note', title: 'Full Note' });
      repo.recordNote(
        'full-note', 'follow_up', 'Follow up content',
        'https://substack.com/note/123', 'stage', 'test-agent', '/images/test.png',
      );
      const notes = repo.getNotesForArticle('full-note');
      expect(notes[0].substack_note_url).toBe('https://substack.com/note/123');
      expect(notes[0].target).toBe('stage');
      expect(notes[0].created_by).toBe('test-agent');
      expect(notes[0].image_path).toBe('/images/test.png');
    });

    it('rejects invalid note type', () => {
      expect(() => repo.recordNote(null, 'bad' as any, 'content')).toThrow('Invalid note_type');
    });

    it('rejects invalid target', () => {
      expect(() => repo.recordNote(null, 'standalone', 'content', null, 'bad' as any)).toThrow('Invalid target');
    });

    it('rejects nonexistent linked article', () => {
      expect(() => repo.recordNote('ghost', 'promotion', 'content')).toThrow('not found');
    });
  });

  // ── Article runs ───────────────────────────────────────────────────────────

  describe('article runs', () => {
    it('starts and finishes article run', () => {
      repo.createArticle({ id: 'run-test', title: 'Run Test' });
      const runId = repo.startArticleRun('run-test', 'manual', 'test-user');
      expect(runId).toBeTruthy();
      repo.finishArticleRun(runId, 'completed');
    });

    it('starts with custom run id', () => {
      repo.createArticle({ id: 'custom-run', title: 'Custom Run' });
      const runId = repo.startArticleRun('custom-run', 'batch', 'bot', null, 'my-run-id');
      expect(runId).toBe('my-run-id');
    });

    it('rejects nonexistent article', () => {
      expect(() => repo.startArticleRun('ghost', 'manual', 'user')).toThrow('not found');
    });

    it('rejects invalid status', () => {
      repo.createArticle({ id: 'bad-status', title: 'Bad Status' });
      expect(() =>
        repo.startArticleRun('bad-status', 'manual', 'user', null, undefined, 'invalid' as any),
      ).toThrow('Invalid article run status');
    });
  });

  // ── Stage runs ─────────────────────────────────────────────────────────────

  describe('stage runs', () => {
    it('starts and finishes stage run', () => {
      repo.createArticle({ id: 'sr-test', title: 'Stage Run Test' });
      const stageRunId = repo.startStageRun({
        articleId: 'sr-test',
        stage: 1,
        surface: 'lead',
        actor: 'test-agent',
      });
      expect(stageRunId).toBeTruthy();
      repo.finishStageRun(stageRunId, 'completed', 'All done');
    });

    it('links stage run to article run', () => {
      repo.createArticle({ id: 'link-test', title: 'Link Test' });
      const runId = repo.startArticleRun('link-test', 'manual', 'user');
      const stageRunId = repo.startStageRun({
        articleId: 'link-test',
        stage: 1,
        surface: 'writer',
        actor: 'agent',
        runId,
      });
      const stageRuns = repo.getStageRuns('link-test');
      expect(stageRuns).toHaveLength(1);
      expect(stageRuns[0].run_id).toBe(runId);
    });

    it('rejects mismatched article run', () => {
      repo.createArticle({ id: 'article-a', title: 'A' });
      repo.createArticle({ id: 'article-b', title: 'B' });
      const runId = repo.startArticleRun('article-a', 'manual', 'user');
      expect(() =>
        repo.startStageRun({
          articleId: 'article-b',
          stage: 1,
          surface: 'writer',
          actor: 'agent',
          runId,
        }),
      ).toThrow("belongs to 'article-a'");
    });

    it('rejects nonexistent article run', () => {
      repo.createArticle({ id: 'no-run', title: 'No Run' });
      expect(() =>
        repo.startStageRun({
          articleId: 'no-run',
          stage: 1,
          surface: 'writer',
          actor: 'agent',
          runId: 'fake-run-id',
        }),
      ).toThrow('not found');
    });

    it('rejects invalid stage', () => {
      repo.createArticle({ id: 'bad-stage', title: 'Bad Stage' });
      expect(() =>
        repo.startStageRun({
          articleId: 'bad-stage',
          stage: 99,
          surface: 'writer',
          actor: 'agent',
        }),
      ).toThrow('must be an integer 1–8');
    });

    it('finishes with artifact path', () => {
      repo.createArticle({ id: 'artifact', title: 'Artifact' });
      const id = repo.startStageRun({
        articleId: 'artifact',
        stage: 5,
        surface: 'writer',
        actor: 'agent',
      });
      repo.finishStageRun(id, 'completed', null, 'content/articles/artifact/draft.md');
      const runs = repo.getStageRuns('artifact');
      expect(runs[0].artifact_path).toBe('content/articles/artifact/draft.md');
    });
  });

  // ── Usage events ───────────────────────────────────────────────────────────

  describe('usage events', () => {
    it('records and retrieves usage events', () => {
      repo.createArticle({ id: 'ue-test', title: 'Usage Test' });
      repo.recordUsageEvent({
        articleId: 'ue-test',
        stage: 5,
        surface: 'writer',
        provider: 'github_copilot',
        actor: 'writer-agent',
        eventType: 'completed',
        modelOrTool: 'claude-sonnet-4-20250514',
        promptTokens: 1000,
        outputTokens: 2000,
      });
      const events = repo.getUsageEvents('ue-test');
      expect(events).toHaveLength(1);
      expect(events[0].surface).toBe('writer');
      expect(events[0].prompt_tokens).toBe(1000);
    });

    it('rejects nonexistent article', () => {
      expect(() =>
        repo.recordUsageEvent({
          articleId: 'ghost',
          surface: 'writer',
        }),
      ).toThrow('not found');
    });

    it('rejects missing surface', () => {
      repo.createArticle({ id: 'no-surface', title: 'No Surface' });
      expect(() =>
        repo.recordUsageEvent({
          articleId: 'no-surface',
          surface: '',
        }),
      ).toThrow('surface is required');
    });
  });

  // ── Artifact paths ─────────────────────────────────────────────────────────

  describe('artifact paths', () => {
    it('sets discussion path', () => {
      repo.createArticle({ id: 'disc-path', title: 'Discussion Path' });
      repo.setDiscussionPath('disc-path', 'content/articles/disc-path/discussion.md');
      const article = repo.getArticle('disc-path');
      expect(article!.discussion_path).toBe('content/articles/disc-path/discussion.md');
    });

    it('sets article path', () => {
      repo.createArticle({ id: 'art-path', title: 'Article Path' });
      repo.setArticlePath('art-path', 'content/articles/art-path/draft.md');
      const article = repo.getArticle('art-path');
      expect(article!.article_path).toBe('content/articles/art-path/draft.md');
    });
  });

  // ── Repair ─────────────────────────────────────────────────────────────────

  describe('repairStringStage', () => {
    it('repairs stage to numeric value', () => {
      repo.createArticle({ id: 'repair-test', title: 'Repair Test' });
      repo.repairStringStage('repair-test', 3);
      const article = repo.getArticle('repair-test');
      expect(article!.current_stage).toBe(3);
    });

    it('rejects invalid numeric stage', () => {
      repo.createArticle({ id: 'bad-repair', title: 'Bad Repair' });
      expect(() => repo.repairStringStage('bad-repair', 10 as any)).toThrow('must be an integer 1–8');
    });

    it('rejects nonexistent article', () => {
      expect(() => repo.repairStringStage('ghost', 1)).toThrow('not found');
    });
  });

  // ── Backfill ───────────────────────────────────────────────────────────────

  describe('backfillArticle', () => {
    it('creates missing article row', () => {
      repo.backfillArticle('backfill-test', 'Backfill Test', 3, 'in_production');
      const article = repo.getArticle('backfill-test');
      expect(article).toBeDefined();
      expect(article!.current_stage).toBe(3);
      expect(article!.status).toBe('in_production');
    });

    it('rejects duplicate article', () => {
      repo.createArticle({ id: 'exists', title: 'Exists' });
      expect(() => repo.backfillArticle('exists', 'Dup')).toThrow('already exists');
    });

    it('rejects invalid stage', () => {
      expect(() => repo.backfillArticle('bad-stage', 'Bad', 0 as any)).toThrow('must be an integer 1–8');
    });

    it('rejects invalid status', () => {
      expect(() => repo.backfillArticle('bad-status', 'Bad', 1, 'invalid' as any)).toThrow('Invalid status');
    });
  });

  // ── Stage regression ──────────────────────────────────────────────────────

  describe('regressStage', () => {
    it('regresses stage and sets status to revision', () => {
      repo.createArticle({ id: 'reg-test', title: 'Regress Test' });
      repo.advanceStage('reg-test', 1, 2, 'agent');
      repo.advanceStage('reg-test', 2, 3, 'agent');

      repo.regressStage('reg-test', 3, 1, 'editor', 'Needs rework');
      const article = repo.getArticle('reg-test');
      expect(article!.current_stage).toBe(1);
      expect(article!.status).toBe('revision');
    });

    it('records regression in stage_transitions', () => {
      repo.createArticle({ id: 'reg-trans', title: 'Regress Trans' });
      repo.advanceStage('reg-trans', 1, 2, 'agent');
      repo.regressStage('reg-trans', 2, 1, 'editor', 'Fix it');

      const transitions = repo.getStageTransitions('reg-trans');
      const last = transitions[transitions.length - 1];
      expect(last.from_stage).toBe(2);
      expect(last.to_stage).toBe(1);
      expect(last.notes).toContain('Regression: Fix it');
    });

    it('rejects regression to same or higher stage', () => {
      repo.createArticle({ id: 'reg-same', title: 'Same Stage' });
      repo.advanceStage('reg-same', 1, 2, 'agent');
      expect(() => repo.regressStage('reg-same', 2, 2, 'editor', 'reason')).toThrow('Cannot regress');
      expect(() => repo.regressStage('reg-same', 2, 3, 'editor', 'reason')).toThrow('Cannot regress');
    });

    it('rejects regression for nonexistent article', () => {
      expect(() => repo.regressStage('ghost', 2, 1, 'editor', 'reason')).toThrow('not found');
    });

    it('rejects stage mismatch', () => {
      repo.createArticle({ id: 'reg-mismatch', title: 'Mismatch' });
      repo.advanceStage('reg-mismatch', 1, 2, 'agent');
      expect(() => repo.regressStage('reg-mismatch', 3, 1, 'editor', 'reason')).toThrow('Stage mismatch');
    });

    it('rejects invalid stage numbers', () => {
      repo.createArticle({ id: 'reg-inv', title: 'Invalid' });
      expect(() => repo.regressStage('reg-inv', 9 as any, 1, 'editor', 'reason')).toThrow('must be an integer 1–8');
    });
  });

  // ── Artifact cleanup on regression ──────────────────────────────────────

  describe('clearArtifactsAfterStage', () => {
    it('clears artifacts for stages above toStage', () => {
      repo.createArticle({ id: 'clear-art', title: 'Clear Artifacts' });
      repo.artifacts.put('clear-art', 'idea.md', 'idea content');
      repo.artifacts.put('clear-art', 'discussion-prompt.md', 'prompt content');
      repo.artifacts.put('clear-art', 'panel-composition.md', 'panel content');
      repo.artifacts.put('clear-art', 'discussion-summary.md', 'summary content');
      repo.artifacts.put('clear-art', 'draft.md', 'draft content');
      repo.artifacts.put('clear-art', 'editor-review.md', 'review content');

      const cleared = repo.clearArtifactsAfterStage('clear-art', 2);

      expect(cleared).toContain('panel-composition.md');
      expect(cleared).toContain('discussion-summary.md');
      expect(cleared).toContain('draft.md');
      expect(cleared).toContain('editor-review.md');
      expect(cleared).not.toContain('idea.md');
      expect(cleared).not.toContain('discussion-prompt.md');

      // Verify artifacts are actually deleted
      expect(repo.artifacts.get('clear-art', 'idea.md')).not.toBeNull();
      expect(repo.artifacts.get('clear-art', 'discussion-prompt.md')).not.toBeNull();
      expect(repo.artifacts.get('clear-art', 'panel-composition.md')).toBeNull();
      expect(repo.artifacts.get('clear-art', 'draft.md')).toBeNull();
    });

    it('returns empty array when no artifacts exist', () => {
      repo.createArticle({ id: 'clear-empty', title: 'No Artifacts' });
      const cleared = repo.clearArtifactsAfterStage('clear-empty', 1);
      expect(cleared).toEqual([]);
    });
  });

  describe('regressStage clears artifacts', () => {
    it('regression to Stage 2 clears Stage 3+ artifacts', () => {
      repo.createArticle({ id: 'reg-art', title: 'Regress Artifacts' });
      repo.advanceStage('reg-art', 1, 2, 'agent');
      repo.advanceStage('reg-art', 2, 3, 'agent');
      repo.advanceStage('reg-art', 3, 4, 'agent');
      repo.advanceStage('reg-art', 4, 5, 'agent');

      repo.artifacts.put('reg-art', 'idea.md', 'idea');
      repo.artifacts.put('reg-art', 'discussion-prompt.md', 'prompt');
      repo.artifacts.put('reg-art', 'panel-composition.md', 'panel');
      repo.artifacts.put('reg-art', 'discussion-summary.md', 'summary');
      repo.artifacts.put('reg-art', 'draft.md', 'draft');

      repo.regressStage('reg-art', 5, 2, 'editor', 'Back to prompt');

      // Stage 1-2 artifacts preserved
      expect(repo.artifacts.get('reg-art', 'idea.md')).toBe('idea');
      expect(repo.artifacts.get('reg-art', 'discussion-prompt.md')).toBe('prompt');

      // Stage 3+ artifacts cleared
      expect(repo.artifacts.get('reg-art', 'panel-composition.md')).toBeNull();
      expect(repo.artifacts.get('reg-art', 'discussion-summary.md')).toBeNull();
      expect(repo.artifacts.get('reg-art', 'draft.md')).toBeNull();
    });

    it('regression past Stage 6 clears publisher pass', () => {
      repo.createArticle({ id: 'reg-pub', title: 'Regress Publisher' });
      repo.advanceStage('reg-pub', 1, 2, 'agent');
      repo.advanceStage('reg-pub', 2, 3, 'agent');
      repo.advanceStage('reg-pub', 3, 4, 'agent');
      repo.advanceStage('reg-pub', 4, 5, 'agent');
      repo.advanceStage('reg-pub', 5, 6, 'agent');
      repo.recordPublisherPass('reg-pub');

      // recordPublisherPass auto-advances 6→7
      const afterPass = repo.getArticle('reg-pub');
      expect(afterPass!.current_stage).toBe(7);
      expect(repo.getPublisherPass('reg-pub')).not.toBeNull();

      repo.regressStage('reg-pub', 7, 4, 'editor', 'Redo draft');
      expect(repo.getPublisherPass('reg-pub')).toBeNull();
    });

    it('regression past Stage 5 clears editor reviews', () => {
      repo.createArticle({ id: 'reg-rev', title: 'Regress Reviews' });
      repo.advanceStage('reg-rev', 1, 2, 'agent');
      repo.advanceStage('reg-rev', 2, 3, 'agent');
      repo.advanceStage('reg-rev', 3, 4, 'agent');
      repo.advanceStage('reg-rev', 4, 5, 'agent');
      repo.recordEditorReview('reg-rev', 'APPROVED');

      const reviews = repo.getEditorReviews('reg-rev');
      expect(reviews.length).toBeGreaterThan(0);

      repo.regressStage('reg-rev', 5, 3, 'editor', 'Redo discussion');
      const afterReviews = repo.getEditorReviews('reg-rev');
      expect(afterReviews.length).toBe(0);
    });
  });
});
