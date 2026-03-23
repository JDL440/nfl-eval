/**
 * conversation.ts — Per-article conversation persistence and handoff shaping.
 *
 * All agents working on the same article share one stored conversation thread,
 * but runtime prompt injection should prefer compact role-aware handoff summaries
 * over the raw shared transcript.
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

export interface RevisionHistoryEntry {
  revision: RevisionSummary;
  writerTurn: ConversationTurn | null;
  editorTurn: ConversationTurn | null;
  keyIssues: string[];
}

export interface GetConversationOptions {
  sinceStage?: number;
  agentName?: string;
  limit?: number;
}

export interface BuildConversationContextOptions {
  activeAgent?: 'writer' | 'editor' | 'publisher' | string;
  localHistoryLimit?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function summarizeText(text: string, maxLength = 280): string {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/^#+\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trimEnd() + '…';
}

function parseKeyIssues(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function extractVerdictFromContent(content: string): 'APPROVED' | 'REVISE' | 'REJECT' | null {
  const verdictBlock = content.match(/##\s*Verdict\s+([A-Z]+)/i);
  if (!verdictBlock) return null;
  const verdict = verdictBlock[1].toUpperCase();
  return verdict === 'APPROVED' || verdict === 'REVISE' || verdict === 'REJECT'
    ? verdict
    : null;
}

function normalizeRevisionOutcome(outcome: string): 'APPROVED' | 'REVISE' | 'REJECT' | null {
  const verdict = outcome.toUpperCase();
  if (verdict === 'APPROVE') return 'APPROVED';
  return verdict === 'APPROVED' || verdict === 'REVISE' || verdict === 'REJECT'
    ? verdict
    : null;
}

function findLatestTurn(turns: ConversationTurn[], agentName: string): ConversationTurn | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i].agent_name === agentName) return turns[i];
  }
  return null;
}

function buildAgentLocalHistory(
  heading: string,
  turns: ConversationTurn[],
  maxLength: number,
): string {
  if (turns.length === 0) return '';

  const parts: string[] = [heading];
  for (const turn of turns) {
    const stageLabel = STAGE_LABELS[turn.stage] ?? `Stage ${turn.stage}`;
    parts.push(
      `### ${stageLabel} (turn ${turn.turn_number})\n${summarizeText(turn.content, maxLength)}`,
    );
  }

  return parts.join('\n\n');
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

/**
 * Join revision summaries with the writer/editor turns that produced each loop.
 * This powers dashboard history views without adding new persistence tables.
 */
export function buildRevisionHistoryEntries(
  turns: ConversationTurn[],
  revisions: RevisionSummary[],
): RevisionHistoryEntry[] {
  let previousEditorTurnNumber = 0;

  return revisions.map((revision) => {
    const normalizedOutcome = normalizeRevisionOutcome(revision.outcome);
    const candidateEditorTurns = turns.filter(turn =>
      turn.agent_name === revision.agent_name
      && turn.turn_number > previousEditorTurnNumber,
    );
    const editorTurn = candidateEditorTurns.find(turn =>
      normalizedOutcome != null && extractVerdictFromContent(turn.content) === normalizedOutcome,
    ) ?? candidateEditorTurns[0] ?? null;

    const writerCandidates = turns.filter(turn =>
      turn.agent_name === 'writer'
      && turn.turn_number > previousEditorTurnNumber
      && turn.turn_number < (editorTurn?.turn_number ?? Number.POSITIVE_INFINITY),
    );
    const writerTurn = writerCandidates[writerCandidates.length - 1] ?? null;

    if (editorTurn) {
      previousEditorTurnNumber = editorTurn.turn_number;
    }

    return {
      revision,
      writerTurn,
      editorTurn,
      keyIssues: parseKeyIssues(revision.key_issues),
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

/**
 * Build a compact, role-aware conversation context block.
 * Designed for injection into the user message without exposing the full shared transcript.
 */
export function buildConversationContext(
  turns: ConversationTurn[],
  revisions: RevisionSummary[],
  options: BuildConversationContextOptions = {},
): string {
  if (turns.length === 0 && revisions.length === 0) return '';

  const activeAgent = options.activeAgent;
  const localHistoryLimit = options.localHistoryLimit ?? 2;
  const latestTurn = turns[turns.length - 1] ?? null;
  const latestRevision = revisions[revisions.length - 1] ?? null;
  const latestWriterTurn = findLatestTurn(turns, 'writer');
  const latestEditorTurn = findLatestTurn(turns, 'editor');
  const latestPublisherTurn = findLatestTurn(turns, 'publisher');
  const latestEditorVerdict = latestEditorTurn
    ? extractVerdictFromContent(latestEditorTurn.content)
    : null;

  let readiness = 'No downstream handoff recorded yet.';
  if (latestPublisherTurn) {
    readiness = 'Publisher pass has already been recorded.';
  } else if (latestEditorVerdict === 'APPROVED') {
    readiness = 'Editor approved the draft; ready for publisher pass.';
  } else if (latestEditorVerdict === 'REVISE') {
    readiness = 'Editor requested a revision before publish.';
  } else if (latestEditorVerdict === 'REJECT') {
    readiness = 'Editor rejected the draft; substantial rewrite or re-research is required.';
  } else if (latestEditorTurn) {
    readiness = 'Editor feedback exists, but the latest verdict was not parsed.';
  } else if (latestWriterTurn) {
    readiness = 'A draft exists and is ready for editor review.';
  }

  const latestIssues = latestRevision ? parseKeyIssues(latestRevision.key_issues) : [];
  const parts: string[] = ['## Shared Article Handoff'];
  const snapshotLines = [
    latestTurn
      ? `- Latest pipeline activity: ${latestTurn.agent_name} at ${STAGE_LABELS[latestTurn.stage] ?? `Stage ${latestTurn.stage}`}`
      : '- Latest pipeline activity: none recorded',
    `- Revision iterations recorded: ${revisions.length}`,
    latestRevision
      ? `- Latest revision loop: Iteration ${latestRevision.iteration} (${STAGE_LABELS[latestRevision.from_stage] ?? `Stage ${latestRevision.from_stage}`} → ${STAGE_LABELS[latestRevision.to_stage] ?? `Stage ${latestRevision.to_stage}`})`
      : '- Latest revision loop: none recorded',
    `- Publish readiness: ${readiness}`,
  ];
  parts.push('### Workflow Snapshot\n' + snapshotLines.join('\n'));

  const issueLines = latestIssues.length > 0
    ? latestIssues.map((issue) => `- ${issue}`)
    : [];
  if (latestRevision?.feedback_summary) {
    issueLines.push(`- ${summarizeText(latestRevision.feedback_summary, 240)}`);
  }
  if (issueLines.length === 0) {
    issueLines.push('- No structured must-fix items are currently recorded.');
  }
  parts.push('### Open Must-Fix Items\n' + issueLines.join('\n'));

  const handoffLines: string[] = [];
  if (latestWriterTurn) {
    handoffLines.push(`- Writer: ${summarizeText(latestWriterTurn.content)}`);
  }
  if (latestEditorTurn) {
    handoffLines.push(`- Editor: ${summarizeText(latestEditorTurn.content)}`);
  }
  if (latestPublisherTurn) {
    handoffLines.push(`- Publisher: ${summarizeText(latestPublisherTurn.content)}`);
  }
  if (handoffLines.length > 0) {
    parts.push('### Latest Role Handoffs\n' + handoffLines.join('\n'));
  }

  if (activeAgent === 'writer') {
    const writerTurns = turns.filter((turn) => turn.agent_name === 'writer').slice(-localHistoryLimit);
    const localHistory = buildAgentLocalHistory('## Your Previous Draft Continuity', writerTurns, 500);
    if (localHistory) parts.push(localHistory);
  } else if (activeAgent === 'editor') {
    const editorTurns = turns.filter((turn) => turn.agent_name === 'editor').slice(-localHistoryLimit);
    const localHistory = buildEditorPreviousReviews(editorTurns);
    if (localHistory) parts.push(localHistory);
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
    parts.push(
      `### Review at Stage ${turn.stage} (turn ${turn.turn_number})\n${summarizeText(turn.content, 500)}`,
    );
  }

  return parts.join('\n\n');
}
