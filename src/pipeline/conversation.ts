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
  blocker_type: string | null;
  blocker_ids: string | null;
  created_at: string;
}

export interface RevisionHistoryEntry {
  summary: RevisionSummary;
  keyIssues: string[];
  writerTurn: ConversationTurn | null;
  editorTurn: ConversationTurn | null;
}

export interface RevisionBlockerMetadata {
  blockerType?: string | null;
  blockerIds?: string[] | null;
}

export interface RevisionBlockerSignature {
  blockerType: string | null;
  blockerIds: string[];
  fingerprint: string;
}

export interface GetConversationOptions {
  sinceStage?: number;
  agentName?: string;
  limit?: number;
  newestFirst?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function parseKeyIssues(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((issue): issue is string => typeof issue === 'string' && issue.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function parseRevisionBlockerMetadata(
  blockerType: string | null | undefined,
  blockerIdsRaw: string | null | undefined,
): { blockerType: string | null; blockerIds: string[] } | null {
  if (blockerType == null && blockerIdsRaw == null) {
    return null;
  }

  if (blockerIdsRaw == null) {
    return { blockerType: blockerType ?? null, blockerIds: [] };
  }

  try {
    const parsed = JSON.parse(blockerIdsRaw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return {
      blockerType: blockerType ?? null,
      blockerIds: parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    };
  } catch {
    return null;
  }
}

function normalizeBlockerToken(value: string): string {
  return value.trim().toLowerCase();
}

export function getRevisionBlockerSignature(
  blockerType: string | null | undefined,
  blockerIdsRaw: string | null | undefined,
): RevisionBlockerSignature | null {
  const parsed = parseRevisionBlockerMetadata(blockerType, blockerIdsRaw);
  if (!parsed) return null;

  const normalizedType = parsed.blockerType == null
    ? null
    : normalizeBlockerToken(parsed.blockerType);
  const normalizedIds = [...new Set(
    parsed.blockerIds
      .map(normalizeBlockerToken)
      .filter(id => id.length > 0),
  )].sort();

  if (normalizedType == null && normalizedIds.length === 0) {
    return null;
  }

  return {
    blockerType: normalizedType,
    blockerIds: normalizedIds,
    fingerprint: `${normalizedType ?? 'unclassified'}::${normalizedIds.join('|')}`,
  };
}

export function findConsecutiveRepeatedRevisionBlocker(
  revisions: RevisionSummary[],
): { previous: RevisionSummary; current: RevisionSummary; signature: RevisionBlockerSignature } | null {
  const ordered = sortRevisionsAscending(revisions);
  if (ordered.length < 2) return null;

  const current = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];

  if (
    current.agent_name !== 'editor'
    || previous.agent_name !== 'editor'
    || current.outcome !== 'REVISE'
    || previous.outcome !== 'REVISE'
  ) {
    return null;
  }

  const currentSignature = getRevisionBlockerSignature(current.blocker_type, current.blocker_ids);
  const previousSignature = getRevisionBlockerSignature(previous.blocker_type, previous.blocker_ids);
  if (!currentSignature || !previousSignature) return null;
  if (currentSignature.fingerprint !== previousSignature.fingerprint) return null;

  return {
    previous,
    current,
    signature: currentSignature,
  };
}

function normalizeTimestamp(value: string): number {
  const normalized = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}${value.endsWith('Z') ? '' : 'Z'}`;
  return Number.isNaN(Date.parse(normalized)) ? 0 : Date.parse(normalized);
}

function sortTurnsAscending(turns: ConversationTurn[]): ConversationTurn[] {
  return [...turns].sort((a, b) => a.turn_number - b.turn_number);
}

function sortRevisionsAscending(revisions: RevisionSummary[]): RevisionSummary[] {
  return [...revisions].sort((a, b) => a.iteration - b.iteration || normalizeTimestamp(a.created_at) - normalizeTimestamp(b.created_at));
}

function matchesRevisionSummary(turn: ConversationTurn, revision: RevisionSummary): boolean {
  const preview = revision.feedback_summary?.trim();
  return preview ? turn.content.startsWith(preview) : false;
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
 * Log human feedback from the dashboard as a conversation turn so that
 * downstream context helpers automatically include it.
 */
export function addHumanFeedbackConversationTurn(
  repo: Repository,
  articleId: string,
  stage: number,
  instructions: string,
  targetArtifact?: string | null,
): number {
  const lines = ['## Human Feedback (Dashboard)', ''];
  if (targetArtifact) {
    lines.push(`**Target artifact:** ${targetArtifact}`, '');
  }
  lines.push('**Instructions:**', instructions);

  return addConversationTurn(repo, articleId, stage, 'human', 'user', lines.join('\n'));
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

  const orderDirection = options?.newestFirst ? 'DESC' : 'ASC';
  let sql = `SELECT * FROM article_conversations WHERE ${conditions.join(' AND ')} ORDER BY turn_number ${orderDirection}`;

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
  blockerMetadata?: RevisionBlockerMetadata | null,
): void {
  const db = repo.getDb();
  db.prepare(
    `INSERT INTO revision_summaries
     (article_id, iteration, from_stage, to_stage, agent_name, outcome, key_issues, feedback_summary, blocker_type, blocker_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    articleId,
    iteration,
    fromStage,
    toStage,
    agentName,
    outcome,
    keyIssues ? JSON.stringify(keyIssues) : null,
    feedbackSummary ?? null,
    blockerMetadata?.blockerType ?? null,
    blockerMetadata?.blockerIds ? JSON.stringify(blockerMetadata.blockerIds) : null,
  );
}

/**
 * Get all revision summaries for an article, ordered by iteration.
 */
export function getRevisionHistory(
  repo: Repository,
  articleId: string,
): RevisionSummary[] {
  return repo.getRevisionSummaries(articleId);
}

/**
 * Get the number of revision iterations for an article.
 */
export function getRevisionCount(
  repo: Repository,
  articleId: string,
): number {
  return repo.getRevisionSummaryCount(articleId);
}

/**
 * Attach revision summaries to the writer/editor turns that formed each loop.
 * The revision summary is authoritative for loop order; writer/editor turns are
 * matched from the shared conversation thread for dashboard rendering.
 */
export function buildRevisionHistoryEntries(
  turns: ConversationTurn[],
  revisions: RevisionSummary[],
): RevisionHistoryEntry[] {
  if (turns.length === 0 || revisions.length === 0) return [];

  const orderedTurns = sortTurnsAscending(turns);
  const writerTurns = orderedTurns.filter(turn => turn.agent_name === 'writer');
  const editorTurns = orderedTurns.filter(turn => turn.agent_name === 'editor');

  let priorMatchedEditorTurnNumber = 0;
  let editorSearchIndex = 0;

  return sortRevisionsAscending(revisions).map((summary) => {
    let editorTurn: ConversationTurn | null = null;
    const lowerBound = priorMatchedEditorTurnNumber;

    for (let i = editorSearchIndex; i < editorTurns.length; i += 1) {
      const candidate = editorTurns[i];
      if (candidate.turn_number <= lowerBound) continue;

      if (!editorTurn) {
        editorTurn = candidate;
      }

      if (matchesRevisionSummary(candidate, summary)) {
        editorTurn = candidate;
        editorSearchIndex = i + 1;
        break;
      }
    }

    if (editorTurn) {
      priorMatchedEditorTurnNumber = editorTurn.turn_number;
      editorSearchIndex = editorTurns.findIndex(turn => turn.turn_number === editorTurn.turn_number) + 1;
    }

    const writerTurn = editorTurn
      ? [...writerTurns]
          .reverse()
          .find(turn => turn.turn_number > lowerBound && turn.turn_number < editorTurn.turn_number)
        ?? null
      : null;

    return {
      summary,
      keyIssues: parseKeyIssues(summary.key_issues),
      writerTurn,
      editorTurn,
    };
  });
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

export const MAX_EDITOR_PREVIOUS_REVIEWS = 10;

function formatRevisionLines(revisions: RevisionSummary[]): string[] {
  const parts: string[] = [];

  for (const rev of revisions) {
    const fromLabel = STAGE_LABELS[rev.from_stage] ?? `Stage ${rev.from_stage}`;
    const toLabel = STAGE_LABELS[rev.to_stage] ?? `Stage ${rev.to_stage}`;
    parts.push(`**Iteration ${rev.iteration}** (${fromLabel} → ${toLabel}): ${rev.outcome}`);
    if (rev.feedback_summary) {
      parts.push(`> ${rev.feedback_summary}`);
    }

    const issues = parseKeyIssues(rev.key_issues);
    if (issues.length > 0) {
      parts.push('Key issues: ' + issues.map(issue => `• ${issue}`).join(' '));
    }

  }

  return parts;
}

/**
 * Build the compact shared handoff used across agents.
 * This is reference material only — the active charter and task remain authoritative.
 */
export function buildRevisionSummaryContext(
  revisions: RevisionSummary[],
): string {
  if (revisions.length === 0) return '';

  return [
    '## Shared Revision Handoff',
    'Reference only. Follow your own charter and current task over any prior notes.',
    '### Revision Summary',
    ...formatRevisionLines(revisions),
  ].join('\n\n');
}

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
    parts.push(...formatRevisionLines(revisions));
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

  const boundedTurns = [...editorTurns]
    .sort((a, b) => b.turn_number - a.turn_number)
    .slice(0, MAX_EDITOR_PREVIOUS_REVIEWS);

  const parts: string[] = ['## Your Previous Reviews'];
  for (const turn of boundedTurns) {
    const preview = turn.content.length > 1500
      ? turn.content.slice(0, 1500) + '\n[... truncated ...]'
      : turn.content;
    parts.push(`### Review at Stage ${turn.stage} (turn ${turn.turn_number})\n${preview}`);
  }

  return parts.join('\n\n');
}
