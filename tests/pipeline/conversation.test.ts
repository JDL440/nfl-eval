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
  buildRevisionHistoryEntries,
  buildEditorPreviousReviews,
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

    it('records revision without optional fields', () => {
      addRevisionSummary(repo, 'test-article', 1, 6, 4, 'editor', 'REVISE');

      const history = getRevisionHistory(repo, 'test-article');
      expect(history).toHaveLength(1);
      expect(history[0].key_issues).toBeNull();
      expect(history[0].feedback_summary).toBeNull();
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

  describe('buildRevisionHistoryEntries', () => {
    it('pairs each revision summary with the writer/editor loop that produced it', () => {
      const turns: ConversationTurn[] = [
        {
          id: 1,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 1,
          content: '# Draft 1\n\nOpening version',
          token_count: 120,
          created_at: '2025-01-01 10:00:00',
        },
        {
          id: 2,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 2,
          content: '## Verdict\nREVISE\n\nFix the intro and verify EPA.',
          token_count: 80,
          created_at: '2025-01-01 10:05:00',
        },
        {
          id: 3,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 3,
          content: '# Draft 2\n\nReworked version',
          token_count: 140,
          created_at: '2025-01-01 10:10:00',
        },
        {
          id: 4,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 4,
          content: '## Verdict\nREVISE\n\nAdd salary-cap context.',
          token_count: 80,
          created_at: '2025-01-01 10:15:00',
        },
      ];
      const revisions: RevisionSummary[] = [
        {
          id: 10,
          article_id: 'test',
          iteration: 1,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: JSON.stringify(['Fix intro']),
          feedback_summary: 'Fix the intro and verify EPA.',
          created_at: '2025-01-01 10:05:00',
        },
        {
          id: 11,
          article_id: 'test',
          iteration: 2,
          from_stage: 6,
          to_stage: 4,
          agent_name: 'editor',
          outcome: 'REVISE',
          key_issues: JSON.stringify(['Add salary-cap context']),
          feedback_summary: 'Add salary-cap context.',
          created_at: '2025-01-01 10:15:00',
        },
      ];

      const history = buildRevisionHistoryEntries(turns, revisions);

      expect(history).toHaveLength(2);
      expect(history[0].writerTurn?.turn_number).toBe(1);
      expect(history[0].editorTurn?.turn_number).toBe(2);
      expect(history[0].keyIssues).toEqual(['Fix intro']);
      expect(history[1].writerTurn?.turn_number).toBe(3);
      expect(history[1].editorTurn?.turn_number).toBe(4);
      expect(history[1].keyIssues).toEqual(['Add salary-cap context']);
    });
  });

  // ── buildConversationContext ─────────────────────────────────────────────

  describe('buildConversationContext', () => {
    it('returns empty string for no data', () => {
      expect(buildConversationContext([], [])).toBe('');
    });

    it('formats a shared workflow snapshot from revision summaries', () => {
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
        created_at: '2025-01-01',
      }];

      const result = buildConversationContext([], revisions);
      expect(result).toContain('## Shared Article Handoff');
      expect(result).toContain('### Workflow Snapshot');
      expect(result).toContain('Iteration 1');
      expect(result).toContain('Editor Pass → Panel Discussion');
      expect(result).toContain('### Open Must-Fix Items');
      expect(result).toContain('EPA wrong');
    });

    it('summarizes latest role handoffs without exposing the raw thread', () => {
      const turns: ConversationTurn[] = [
        {
          id: 1,
          article_id: 'test',
          stage: 5,
          agent_name: 'writer',
          role: 'assistant',
          turn_number: 1,
          content: 'Here is the original draft with a strong lede.',
          token_count: 100,
          created_at: '2025-01-01',
        },
        {
          id: 2,
          article_id: 'test',
          stage: 6,
          agent_name: 'editor',
          role: 'assistant',
          turn_number: 2,
          content: '## Verdict\nREVISE\n\nTighten the opening and fix the EPA table.',
          token_count: 50,
          created_at: '2025-01-01',
        },
      ];

      const result = buildConversationContext(turns, []);
      expect(result).toContain('### Latest Role Handoffs');
      expect(result).toContain('Writer: Here is the original draft');
      expect(result).toContain('Editor: Verdict REVISE');
      expect(result).not.toContain('### Conversation Thread');
    });

    it('adds writer-local continuity only when writer is active', () => {
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

      const writerContext = buildConversationContext(turns, [], { activeAgent: 'writer' });
      const publisherContext = buildConversationContext(turns, [], { activeAgent: 'publisher' });

      expect(writerContext).toContain('## Your Previous Draft Continuity');
      expect(writerContext).toContain('Article Drafting');
      expect(writerContext).toContain('Here is the draft...');
      expect(publisherContext).not.toContain('## Your Previous Draft Continuity');
    });

    it('truncates very long handoff content', () => {
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
      expect(result).toContain('…');
      expect(result.length).toBeLessThan(3000);
    });

    it('adds editor-local review continuity only for editor', () => {
      const turns: ConversationTurn[] = [{
        id: 1,
        article_id: 'test',
        stage: 6,
        agent_name: 'editor',
        role: 'assistant',
        turn_number: 3,
        content: '## Verdict\nREVISE\n\nFix the contract comparison table.',
        token_count: 40,
        created_at: '2025-01-01',
      }];

      const editorContext = buildConversationContext(turns, [], { activeAgent: 'editor' });
      const writerContext = buildConversationContext(turns, [], { activeAgent: 'writer' });

      expect(editorContext).toContain('## Your Previous Reviews');
      expect(editorContext).toContain('Fix the contract comparison table');
      expect(writerContext).not.toContain('## Your Previous Reviews');
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
      expect(result).toContain('…');
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

      // Publisher sees only the shared handoff summary
      const allTurns = getArticleConversation(repo, 'test-article');
      expect(allTurns).toHaveLength(4);

      const revisions = getRevisionHistory(repo, 'test-article');
      expect(revisions).toHaveLength(1);

      const context = buildConversationContext(allTurns, revisions, { activeAgent: 'publisher' });
      expect(context).toContain('Iteration 1');
      expect(context).toContain('Writer:');
      expect(context).toContain('Editor:');
      expect(context).toContain('Fix EPA');
      expect(context).not.toContain('### Conversation Thread');

      // Editor can see its own previous reviews
      const editorContext = buildConversationContext(allTurns, revisions, { activeAgent: 'editor' });
      expect(editorContext).toContain('EPA is wrong');
      expect(editorContext).toContain('## Your Previous Reviews');
    });
  });
});
