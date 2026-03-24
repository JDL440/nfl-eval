import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Repository } from '../../src/db/repository.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  addConversationTurn,
  getArticleConversation,
  addRevisionSummary,
  getRevisionHistory,
  getRevisionCount,
  buildConversationContext,
  buildRevisionSummaryContext,
  buildEditorPreviousReviews,
  buildRevisionHistoryEntries,
  parseRevisionBlockerMetadata,
  getRevisionBlockerSignature,
  findConsecutiveRepeatedRevisionBlocker,
  MAX_EDITOR_PREVIOUS_REVIEWS,
  type ConversationTurn,
  type RevisionSummary,
} from '../../src/pipeline/conversation.js';

describe('conversation', () => {
  let repo: Repository;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-conv-test-'));
    const dbPath = join(tempDir, 'test-pipeline.db');
    repo = new Repository(dbPath);
    repo.createArticle({ id: 'test-article', title: 'Test Article' });
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── addConversationTurn ─────────────────────────────────────────────────

  describe('addConversationTurn', () => {
    it('adds a turn and returns sequential turn number', () => {
      const turn1 = addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Draft content here');
      expect(turn1).toBe(1);

      const turn2 = addConversationTurn(repo, 'test-article', 6, 'editor', 'assistant', 'Editor feedback');
      expect(turn2).toBe(2);

      const turn3 = addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Revised draft');
      expect(turn3).toBe(3);
    });

    it('maintains separate turn sequences per article', () => {
      repo.createArticle({ id: 'other-article', title: 'Other' });

      const t1 = addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Draft A');
      const t2 = addConversationTurn(repo, 'other-article', 5, 'writer', 'assistant', 'Draft B');

      expect(t1).toBe(1);
      expect(t2).toBe(1);
    });

    it('estimates token count', () => {
      addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'a'.repeat(400));
      const turns = getArticleConversation(repo, 'test-article');
      expect(turns[0].token_count).toBe(100);
    });
  });

  // ── getArticleConversation ──────────────────────────────────────────────

  describe('getArticleConversation', () => {
    beforeEach(() => {
      addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'First draft');
      addConversationTurn(repo, 'test-article', 6, 'editor', 'assistant', 'Needs work');
      addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Revised draft');
      addConversationTurn(repo, 'test-article', 6, 'editor', 'assistant', 'Approved');
      addConversationTurn(repo, 'test-article', 7, 'publisher', 'assistant', 'Ready to publish');
    });

    it('returns all turns in order', () => {
      const turns = getArticleConversation(repo, 'test-article');
      expect(turns).toHaveLength(5);
      expect(turns[0].agent_name).toBe('writer');
      expect(turns[4].agent_name).toBe('publisher');
      expect(turns[0].turn_number).toBe(1);
      expect(turns[4].turn_number).toBe(5);
    });

    it('filters by sinceStage', () => {
      const turns = getArticleConversation(repo, 'test-article', { sinceStage: 6 });
      expect(turns).toHaveLength(3);
      expect(turns.every(t => t.stage >= 6)).toBe(true);
    });

    it('filters by agentName', () => {
      const turns = getArticleConversation(repo, 'test-article', { agentName: 'editor' });
      expect(turns).toHaveLength(2);
      expect(turns.every(t => t.agent_name === 'editor')).toBe(true);
    });

    it('respects limit', () => {
      const turns = getArticleConversation(repo, 'test-article', { limit: 2 });
      expect(turns).toHaveLength(2);
      expect(turns[0].turn_number).toBe(1);
    });

    it('prefers newest turns when newestFirst is set', () => {
      const turns = getArticleConversation(repo, 'test-article', { limit: 2, newestFirst: true });
      expect(turns).toHaveLength(2);
      expect(turns.map(turn => turn.turn_number)).toEqual([5, 4]);
    });

    it('combines filters', () => {
      const turns = getArticleConversation(repo, 'test-article', { agentName: 'editor', sinceStage: 6 });
      expect(turns).toHaveLength(2);
    });

    it('returns empty array for unknown article', () => {
      const turns = getArticleConversation(repo, 'nonexistent');
      expect(turns).toHaveLength(0);
    });
  });

  // ── addRevisionSummary ──────────────────────────────────────────────────

  describe('addRevisionSummary', () => {
    it('records a revision with key issues', () => {
      addRevisionSummary(
        repo, 'test-article', 1, 6, 4, 'editor', 'REVISE',
        ['EPA numbers wrong', 'Contract data stale'],
        'Fix the EPA and contract data',
      );

      const history = getRevisionHistory(repo, 'test-article');
      expect(history).toHaveLength(1);
      expect(history[0].iteration).toBe(1);
      expect(history[0].outcome).toBe('REVISE');
      expect(history[0].feedback_summary).toBe('Fix the EPA and contract data');
      expect(JSON.parse(history[0].key_issues!)).toEqual(['EPA numbers wrong', 'Contract data stale']);
    });

    it('records structured blocker metadata without breaking free-text fields', () => {
      addRevisionSummary(
        repo,
        'test-article',
        1,
        6,
        4,
        'editor',
        'REVISE',
        ['Missing TLDR'],
        'Restore the TLDR before the next pass.',
        {
          blockerType: 'structure',
          blockerIds: ['missing-tldr'],
        },
      );

      const history = getRevisionHistory(repo, 'test-article');
      expect(history).toHaveLength(1);
      expect(history[0].feedback_summary).toBe('Restore the TLDR before the next pass.');
      expect(JSON.parse(history[0].key_issues!)).toEqual(['Missing TLDR']);
      expect(history[0].blocker_type).toBe('structure');
      expect(JSON.parse(history[0].blocker_ids!)).toEqual(['missing-tldr']);
    });

    it('records revision without optional fields', () => {
      addRevisionSummary(repo, 'test-article', 1, 6, 4, 'editor', 'REVISE');

      const history = getRevisionHistory(repo, 'test-article');
      expect(history).toHaveLength(1);
      expect(history[0].key_issues).toBeNull();
      expect(history[0].feedback_summary).toBeNull();
      expect(history[0].blocker_type).toBeNull();
      expect(history[0].blocker_ids).toBeNull();
    });
  });

  describe('parseRevisionBlockerMetadata', () => {
    it('returns parsed blocker metadata when JSON is valid', () => {
      expect(
        parseRevisionBlockerMetadata('evidence', JSON.stringify(['missing-source', 'stale-stat'])),
      ).toEqual({
        blockerType: 'evidence',
        blockerIds: ['missing-source', 'stale-stat'],
      });
    });

    it('returns null when blocker metadata is absent', () => {
      expect(parseRevisionBlockerMetadata(null, null)).toBeNull();
    });

    it('returns null for malformed blocker id JSON', () => {
      expect(parseRevisionBlockerMetadata('structure', '{not-json')).toBeNull();
    });
  });

  describe('getRevisionBlockerSignature', () => {
    it('normalizes blocker ids into a deterministic fingerprint', () => {
      expect(
        getRevisionBlockerSignature('Evidence', JSON.stringify([' stale-stat ', 'missing-source', 'stale-stat'])),
      ).toEqual({
        blockerType: 'evidence',
        blockerIds: ['missing-source', 'stale-stat'],
        fingerprint: 'evidence::missing-source|stale-stat',
      });
    });

    it('returns null when structured blocker metadata is absent', () => {
      expect(getRevisionBlockerSignature(null, null)).toBeNull();
    });
  });

  describe('findConsecutiveRepeatedRevisionBlocker', () => {
    it('detects an exact repeat across the last two editor revise summaries', () => {
      const repeated = findConsecutiveRepeatedRevisionBlocker([
        {
          id: 1,
          article_id: 'test',
          iteration: 1,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: null,
          feedback_summary: 'First pass',
          blocker_type: 'evidence',
          blocker_ids: JSON.stringify(['missing-source', 'stale-stat']),
          created_at: '2026-03-24 00:00:00',
        },
        {
          id: 2,
          article_id: 'test',
          iteration: 2,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: null,
          feedback_summary: 'Second pass',
          blocker_type: 'Evidence',
          blocker_ids: JSON.stringify([' stale-stat ', 'missing-source']),
          created_at: '2026-03-24 00:10:00',
        },
      ]);

      expect(repeated?.signature.fingerprint).toBe('evidence::missing-source|stale-stat');
      expect(repeated?.previous.iteration).toBe(1);
      expect(repeated?.current.iteration).toBe(2);
    });

    it('ignores non-repeated or unstructured revision summaries', () => {
      const revisions: RevisionSummary[] = [
        {
          id: 1,
          article_id: 'test',
          iteration: 1,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: null,
          feedback_summary: 'First pass',
          blocker_type: 'structure',
          blocker_ids: JSON.stringify(['missing-tldr']),
          created_at: '2026-03-24 00:00:00',
        },
        {
          id: 2,
          article_id: 'test',
          iteration: 2,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: null,
          feedback_summary: 'Second pass',
          blocker_type: null,
          blocker_ids: null,
          created_at: '2026-03-24 00:10:00',
        },
      ];

      expect(findConsecutiveRepeatedRevisionBlocker(revisions)).toBeNull();
    });
  });

  // ── getRevisionCount ────────────────────────────────────────────────────

  describe('getRevisionCount', () => {
    it('returns 0 for article with no revisions', () => {
      expect(getRevisionCount(repo, 'test-article')).toBe(0);
    });

    it('returns the max iteration number', () => {
      addRevisionSummary(repo, 'test-article', 1, 6, 4, 'editor', 'REVISE');
      addRevisionSummary(repo, 'test-article', 2, 6, 4, 'editor', 'REVISE');
      addRevisionSummary(repo, 'test-article', 3, 6, 4, 'editor', 'APPROVE');

      expect(getRevisionCount(repo, 'test-article')).toBe(3);
    });
  });

  // ── buildConversationContext ─────────────────────────────────────────────

  describe('buildConversationContext', () => {
    it('returns empty string for no data', () => {
      expect(buildConversationContext([], [])).toBe('');
    });

    it('formats revision summaries', () => {
      const revisions: RevisionSummary[] = [{
        id: 1,
        article_id: 'test',
        iteration: 1,
        from_stage: 6,
        to_stage: 4,
        agent_name: 'editor',
        outcome: 'REVISE',
        key_issues: JSON.stringify(['EPA wrong']),
        feedback_summary: 'Fix EPA numbers',
        blocker_type: null,
        blocker_ids: null,
        created_at: '2025-01-01',
      }];

      const result = buildConversationContext([], revisions);
      expect(result).toContain('## Article Conversation History');
      expect(result).toContain('### Revision Summary');
      expect(result).toContain('Iteration 1');
      expect(result).toContain('Editor Pass → Panel Discussion');
      expect(result).toContain('Fix EPA numbers');
      expect(result).toContain('EPA wrong');
    });

    it('formats conversation turns', () => {
      const turns: ConversationTurn[] = [{
        id: 1,
        article_id: 'test',
        stage: 5,
        agent_name: 'writer',
        role: 'assistant',
        turn_number: 1,
        content: 'Here is the draft...',
        token_count: 100,
        created_at: '2025-01-01',
      }];

      const result = buildConversationContext(turns, []);
      expect(result).toContain('### Conversation Thread');
      expect(result).toContain('[writer]');
      expect(result).toContain('Article Drafting');
      expect(result).toContain('Here is the draft...');
    });

    it('truncates very long content', () => {
      const turns: ConversationTurn[] = [{
        id: 1,
        article_id: 'test',
        stage: 5,
        agent_name: 'writer',
        role: 'assistant',
        turn_number: 1,
        content: 'x'.repeat(3000),
        token_count: 750,
        created_at: '2025-01-01',
      }];

      const result = buildConversationContext(turns, []);
      expect(result).toContain('[... truncated ...]');
      expect(result.length).toBeLessThan(3000);
    });
  });

  // ── buildRevisionSummaryContext ──────────────────────────────────────────

  describe('buildRevisionSummaryContext', () => {
    it('returns empty string when there are no revisions', () => {
      expect(buildRevisionSummaryContext([])).toBe('');
    });

    it('formats a compact shared handoff without raw transcript turns', () => {
      const revisions: RevisionSummary[] = [{
        id: 1,
        article_id: 'test',
        iteration: 2,
        from_stage: 6,
        to_stage: 4,
        agent_name: 'editor',
        outcome: 'REVISE',
        key_issues: JSON.stringify(['Fix stale cap number', 'Tighten conclusion']),
        feedback_summary: 'Update the cap math and make the ending more decisive.',
        blocker_type: null,
        blocker_ids: null,
        created_at: '2025-01-01',
      }];

      const result = buildRevisionSummaryContext(revisions);
      expect(result).toContain('## Shared Revision Handoff');
      expect(result).toContain('Reference only.');
      expect(result).toContain('Iteration 2');
      expect(result).toContain('Fix stale cap number');
      expect(result).not.toContain('Conversation Thread');
      expect(result).not.toContain('[writer]');
    });

  });

  // ── buildRevisionHistoryEntries ───────────────────────────────────────────

  describe('buildRevisionHistoryEntries', () => {
    it('matches revision summaries to the writer and editor turns for each loop', () => {
      const turns: ConversationTurn[] = [
        {
          id: 1,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 1,
          content: '# First Draft\n\nOpening angle.',
          token_count: 20,
          created_at: '2025-01-01 00:00:01',
        },
        {
          id: 2,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 2,
          content: 'Need a stronger lead.\n\n## Verdict\nREVISE',
          token_count: 20,
          created_at: '2025-01-01 00:00:02',
        },
        {
          id: 3,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 3,
          content: '# Revised Draft\n\nStronger lead.',
          token_count: 20,
          created_at: '2025-01-01 00:00:03',
        },
        {
          id: 4,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 4,
          content: 'Fix the cap math.\n\n## Verdict\nREVISE',
          token_count: 20,
          created_at: '2025-01-01 00:00:04',
        },
      ];
      const revisions: RevisionSummary[] = [
        {
          id: 1,
          article_id: 'test',
          iteration: 1,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: JSON.stringify(['Lead']),
          feedback_summary: 'Need a stronger lead.\n\n## Verdict\nREVISE',
          blocker_type: null,
          blocker_ids: null,
          created_at: '2025-01-01 00:00:02',
        },
        {
          id: 2,
          article_id: 'test',
          iteration: 2,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: JSON.stringify(['Cap math']),
          feedback_summary: 'Fix the cap math.\n\n## Verdict\nREVISE',
          blocker_type: null,
          blocker_ids: null,
          created_at: '2025-01-01 00:00:04',
        },
      ];

      const history = buildRevisionHistoryEntries(turns, revisions);

      expect(history).toHaveLength(2);
      expect(history[0].writerTurn?.turn_number).toBe(1);
      expect(history[0].editorTurn?.turn_number).toBe(2);
      expect(history[0].keyIssues).toEqual(['Lead']);
      expect(history[1].writerTurn?.turn_number).toBe(3);
      expect(history[1].editorTurn?.turn_number).toBe(4);
      expect(history[1].keyIssues).toEqual(['Cap math']);
    });

    it('uses feedback previews to skip unrelated editor turns', () => {
      const turns: ConversationTurn[] = [
        {
          id: 1,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 1,
          content: '# Draft\n\nAlpha',
          token_count: 20,
          created_at: '2025-01-01 00:00:01',
        },
        {
          id: 2,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 2,
          content: 'Looks good.\n\n## Verdict\nAPPROVED',
          token_count: 20,
          created_at: '2025-01-01 00:00:02',
        },
        {
          id: 3,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 3,
          content: '# Revised Draft\n\nBeta',
          token_count: 20,
          created_at: '2025-01-01 00:00:03',
        },
        {
          id: 4,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 4,
          content: 'Need fresher stats.\n\n## Verdict\nREVISE',
          token_count: 20,
          created_at: '2025-01-01 00:00:04',
        },
      ];
      const revisions: RevisionSummary[] = [{
        id: 1,
        article_id: 'test',
        iteration: 1,
        from_stage: 6,
        to_stage: 4,
        agent_name: 'editor',
        outcome: 'REVISE',
        key_issues: null,
        feedback_summary: 'Need fresher stats.\n\n## Verdict\nREVISE',
        blocker_type: null,
        blocker_ids: null,
        created_at: '2025-01-01 00:00:05',
      }];

      const history = buildRevisionHistoryEntries(turns, revisions);

      expect(history).toHaveLength(1);
      expect(history[0].writerTurn?.turn_number).toBe(3);
      expect(history[0].editorTurn?.turn_number).toBe(4);
    });
  });

  // ── buildEditorPreviousReviews ──────────────────────────────────────────

  describe('buildEditorPreviousReviews', () => {
    it('returns empty string for no reviews', () => {
      expect(buildEditorPreviousReviews([])).toBe('');
    });

    it('formats editor reviews with stage info', () => {
      const editorTurns: ConversationTurn[] = [{
        id: 1,
        article_id: 'test',
        stage: 6,
        agent_name: 'editor',
        role: 'assistant',
        turn_number: 2,
        content: 'The draft needs EPA corrections.',
        token_count: 20,
        created_at: '2025-01-01',
      }];

      const result = buildEditorPreviousReviews(editorTurns);
      expect(result).toContain('## Your Previous Reviews');
      expect(result).toContain('Review at Stage 6');
      expect(result).toContain('EPA corrections');
    });

    it('truncates long reviews', () => {
      const editorTurns: ConversationTurn[] = [{
        id: 1,
        article_id: 'test',
        stage: 6,
        agent_name: 'editor',
        role: 'assistant',
        turn_number: 2,
        content: 'y'.repeat(2000),
        token_count: 500,
        created_at: '2025-01-01',
      }];

      const result = buildEditorPreviousReviews(editorTurns);
      expect(result).toContain('[... truncated ...]');
    });

    it('caps to the newest reviews in deterministic order', () => {
      const editorTurns: ConversationTurn[] = Array.from(
        { length: MAX_EDITOR_PREVIOUS_REVIEWS + 2 },
        (_, index) => ({
          id: index + 1,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: index + 1,
          content: `review-${String(index + 1).padStart(2, '0')}`,
          token_count: 20,
          created_at: '2025-01-01',
        }),
      ).reverse();

      const result = buildEditorPreviousReviews(editorTurns);

      expect(result.match(/### Review at Stage 6/g)).toHaveLength(MAX_EDITOR_PREVIOUS_REVIEWS);
      expect(result).toContain(`review-${String(MAX_EDITOR_PREVIOUS_REVIEWS + 2).padStart(2, '0')}`);
      expect(result).toContain(`review-${String(MAX_EDITOR_PREVIOUS_REVIEWS + 1).padStart(2, '0')}`);
      expect(result).not.toContain('review-01');
      expect(result).not.toContain('review-02');
      expect(result.indexOf(`review-${String(MAX_EDITOR_PREVIOUS_REVIEWS + 2).padStart(2, '0')}`)).toBeLessThan(
        result.indexOf(`review-${String(MAX_EDITOR_PREVIOUS_REVIEWS + 1).padStart(2, '0')}`),
      );
    });
  });

  // ── Integration: full conversation flow ─────────────────────────────────

  describe('full conversation flow', () => {
    it('tracks a complete writer → editor → revision → writer cycle', () => {
      // Writer produces initial draft
      addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Initial draft content');

      // Editor reviews and requests revision
      addConversationTurn(repo, 'test-article', 6, 'editor', 'assistant', 'EPA is wrong. REVISE.');
      addRevisionSummary(repo, 'test-article', 1, 6, 4, 'editor', 'REVISE', ['EPA wrong'], 'Fix EPA');

      // Writer revises
      addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Revised draft with corrected EPA');

      // Editor approves
      addConversationTurn(repo, 'test-article', 6, 'editor', 'assistant', 'APPROVED');

      // Publisher sees full history
      const allTurns = getArticleConversation(repo, 'test-article');
      expect(allTurns).toHaveLength(4);

      const revisions = getRevisionHistory(repo, 'test-article');
      expect(revisions).toHaveLength(1);

      const context = buildConversationContext(allTurns, revisions);
      expect(context).toContain('Iteration 1');
      expect(context).toContain('[writer]');
      expect(context).toContain('[editor]');
      expect(context).toContain('Fix EPA');

      // Editor can see its own previous reviews
      const editorTurns = getArticleConversation(repo, 'test-article', { agentName: 'editor' });
      expect(editorTurns).toHaveLength(2);
      const editorContext = buildEditorPreviousReviews(editorTurns);
      expect(editorContext).toContain('EPA is wrong');
    });

    it('supports hybrid shared summaries without cross-role transcript bleed', () => {
      addConversationTurn(repo, 'test-article', 5, 'writer', 'assistant', 'Initial draft content');
      addConversationTurn(repo, 'test-article', 6, 'editor', 'assistant', 'EPA is wrong. REVISE.');
      addConversationTurn(repo, 'test-article', 7, 'publisher', 'assistant', 'Formatting pass complete.');
      addRevisionSummary(repo, 'test-article', 1, 6, 4, 'editor', 'REVISE', ['EPA wrong'], 'Fix EPA');

      const revisions = getRevisionHistory(repo, 'test-article');
      const sharedSummary = buildRevisionSummaryContext(revisions);
      expect(sharedSummary).toContain('Fix EPA');
      expect(sharedSummary).not.toContain('Initial draft content');
      expect(sharedSummary).not.toContain('Formatting pass complete.');

      const editorTurns = getArticleConversation(repo, 'test-article', { agentName: 'editor' });
      const editorContext = buildEditorPreviousReviews(editorTurns);
      expect(editorContext).toContain('EPA is wrong');
      expect(editorContext).not.toContain('Initial draft content');
      expect(editorContext).not.toContain('Formatting pass complete.');
    });
  });
});
