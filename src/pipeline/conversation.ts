/**
 * conversation.ts — Per-article conversation context and revision history.
 *
 * All agents working on the same article share one conversation thread.
 * Each entry is tagged with the agent name and pipeline stage.
 */

import type { Repository } from '../db/repository.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  id: number;
  article_id: string;
  stage: number;
  agent_name: string;
  role: string;
  turn_number: number;
  content: string;
  token_count: number | null;
  created_at: string;
}

export interface RevisionSummary {
  id: number;
  article_id: string;
  iteration: number;
  from_stage: number;
  to_stage: number;
  agent_name: string;
  outcome: string;
  key_issues: string | null;
  feedback_summary: string | null;
  created_at: string;
}

export interface GetConversationOptions {
  sinceStage?: number;
  agentName?: string;
  limit?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Conversation functions ──────────────────────────────────────────────────

/**
 * Add a conversation turn for an article. Returns the assigned turn_number.
 * All agents share the same article thread — turns are globally ordered.
 */
export function addConversationTurn(
  repo: Repository,
  articleId: string,
  stage: number,
  agentName: string,
  role: string,
  content: string,
): number {
  const db = repo.getDb();

  // Next turn number for this article
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(turn_number), 0) AS max_turn FROM article_conversations WHERE article_id = ?',
  ).get(articleId) as { max_turn: number };
  const turnNumber = maxRow.max_turn + 1;

  const tokenCount = estimateTokens(content);

  db.prepare(
    `INSERT INTO article_conversations
     (article_id, stage, agent_name, role, turn_number, content, token_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(articleId, stage, agentName, role, turnNumber, content, tokenCount);

  return turnNumber;
}

/**
 * Retrieve the conversation history for an article.
 * Supports filtering by stage, agent, and limiting results.
 */
export function getArticleConversation(
  repo: Repository,
  articleId: string,
  options?: GetConversationOptions,
): ConversationTurn[] {
  const db = repo.getDb();
  const conditions = ['article_id = ?'];
  const params: (string | number)[] = [articleId];

  if (options?.sinceStage != null) {
    conditions.push('stage >= ?');
    params.push(options.sinceStage);
  }
  if (options?.agentName) {
    conditions.push('agent_name = ?');
    params.push(options.agentName);
  }

  let sql = `SELECT * FROM article_conversations WHERE ${conditions.join(' AND ')} ORDER BY turn_number ASC`;

  if (options?.limit != null) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(sql).all(...params) as unknown as ConversationTurn[];
}

// ── Revision summary functions ──────────────────────────────────────────────

/**
 * Record a revision summary when an editor triggers a revision cycle.
 */
export function addRevisionSummary(
  repo: Repository,
  articleId: string,
  iteration: number,
  fromStage: number,
  toStage: number,
  agentName: string,
  outcome: string,
  keyIssues?: string[] | null,
  feedbackSummary?: string | null,
): void {
  const db = repo.getDb();
  db.prepare(
    `INSERT INTO revision_summaries
     (article_id, iteration, from_stage, to_stage, agent_name, outcome, key_issues, feedback_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    articleId,
    iteration,
    fromStage,
    toStage,
    agentName,
    outcome,
    keyIssues ? JSON.stringify(keyIssues) : null,
    feedbackSummary ?? null,
  );
}

/**
 * Get all revision summaries for an article, ordered by iteration.
 */
export function getRevisionHistory(
  repo: Repository,
  articleId: string,
): RevisionSummary[] {
  const db = repo.getDb();
  return db.prepare(
    'SELECT * FROM revision_summaries WHERE article_id = ? ORDER BY iteration ASC',
  ).all(articleId) as unknown as RevisionSummary[];
}

/**
 * Get the number of revision iterations for an article.
 */
export function getRevisionCount(
  repo: Repository,
  articleId: string,
): number {
  const db = repo.getDb();
  const row = db.prepare(
    'SELECT COALESCE(MAX(iteration), 0) AS count FROM revision_summaries WHERE article_id = ?',
  ).get(articleId) as { count: number };
  return row.count;
}

// ── Context formatting ──────────────────────────────────────────────────────

/** Stage name lookup for formatting. */
const STAGE_LABELS: Record<number, string> = {
  1: 'Idea Generation',
  2: 'Discussion Prompt',
  3: 'Panel Composition',
  4: 'Panel Discussion',
  5: 'Article Drafting',
  6: 'Editor Pass',
  7: 'Publisher Pass',
  8: 'Published',
};

/**
 * Build a formatted markdown context block from conversation history.
 * Designed for injection into the user message (works with all LLM providers).
 */
export function buildConversationContext(
  turns: ConversationTurn[],
  revisions: RevisionSummary[],
): string {
  if (turns.length === 0 && revisions.length === 0) return '';

  const parts: string[] = ['## Article Conversation History'];

  // Revision summary section
  if (revisions.length > 0) {
    parts.push('### Revision Summary');
    for (const rev of revisions) {
      const fromLabel = STAGE_LABELS[rev.from_stage] ?? `Stage ${rev.from_stage}`;
      const toLabel = STAGE_LABELS[rev.to_stage] ?? `Stage ${rev.to_stage}`;
      parts.push(`**Iteration ${rev.iteration}** (${fromLabel} → ${toLabel}): ${rev.outcome}`);
      if (rev.feedback_summary) {
        parts.push(`> ${rev.feedback_summary}`);
      }
      if (rev.key_issues) {
        try {
          const issues = JSON.parse(rev.key_issues) as string[];
          if (issues.length > 0) {
            parts.push('Key issues: ' + issues.map(i => `• ${i}`).join(' '));
          }
        } catch { /* ignore parse errors */ }
      }
    }
    parts.push('');
  }

  // Conversation turns section
  if (turns.length > 0) {
    parts.push('### Conversation Thread');
    for (const turn of turns) {
      const stageLabel = STAGE_LABELS[turn.stage] ?? `Stage ${turn.stage}`;
      // Truncate very long content to keep context manageable
      const preview = turn.content.length > 2000
        ? turn.content.slice(0, 2000) + '\n[... truncated ...]'
        : turn.content;
      parts.push(`**[${turn.agent_name}]** (${stageLabel}, turn ${turn.turn_number}):\n${preview}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Build a "your previous reviews" context block for the editor.
 * Shows only the editor's own prior reviews so it knows what it already flagged.
 */
export function buildEditorPreviousReviews(
  editorTurns: ConversationTurn[],
): string {
  if (editorTurns.length === 0) return '';

  const parts: string[] = ['## Your Previous Reviews'];
  for (const turn of editorTurns) {
    const preview = turn.content.length > 1500
      ? turn.content.slice(0, 1500) + '\n[... truncated ...]'
      : turn.content;
    parts.push(`### Review at Stage ${turn.stage} (turn ${turn.turn_number})\n${preview}`);
  }

  return parts.join('\n\n');
}
