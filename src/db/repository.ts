/**
 * repository.ts — TypeScript port of content/pipeline_state.py
 *
 * Single source of truth for all pipeline.db reads and writes.
 * Uses the built-in `node:sqlite` module (Node 22+).
 */

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  Article,
  ArticleRetrospective,
  ArticleRetrospectiveFinding,
  ArticleRun,
  LlmTrace,
  LlmTraceStatus,
  ArticleStatus,
  EditorReview,
  EditorVerdict,
  Note,
  NoteTarget,
  NoteType,
  PublisherPass,
  RetrospectiveDigestFindingRow,
  RunStatus,
  Stage,
  StageRunDetail,
  StageRun,
  StageTransition,
  UsageEvent,
  UsageEventType,
} from '../types.js';
import type { RevisionSummary } from '../pipeline/conversation.js';

import {
  VALID_STAGES,
  VALID_STATUSES,
  VALID_VERDICTS,
  VALID_RUN_STATUSES,
  VALID_USAGE_EVENT_TYPES,
  VALID_NOTE_TYPES,
  VALID_NOTE_TARGETS,
} from '../types.js';

import { ArtifactStore } from './artifact-store.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function newRunId(): string {
  return randomUUID();
}

function validateStage(stage: number, label = 'stage'): asserts stage is Stage {
  if (!Number.isInteger(stage) || !(VALID_STAGES as readonly number[]).includes(stage)) {
    throw new Error(`${label} must be an integer 1–8, got ${JSON.stringify(stage)}`);
  }
}

function validateStatus<T extends string>(value: string, allowed: readonly T[], label: string): asserts value is T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${label} '${value}', expected one of ${JSON.stringify(allowed)}`);
  }
}

function normalizeMetadataJson(metadata: unknown): string | null {
  if (metadata == null) return null;
  if (typeof metadata === 'string') return metadata;
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => stable(item));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right));
      return Object.fromEntries(entries.map(([key, nested]) => [key, stable(nested)]));
    }
    return value;
  };
  return JSON.stringify(stable(metadata));
}

// ── Publisher pass checklist defaults ─────────────────────────────────────────

interface PublisherChecklist {
  title_final?: number;
  subtitle_final?: number;
  body_clean?: number;
  section_assigned?: number;
  tags_set?: number;
  url_slug_set?: number;
  cover_image_set?: number;
  paywall_set?: number;
  publish_datetime?: string | null;
  email_send?: number;
  names_verified?: number;
  numbers_current?: number;
  no_stale_refs?: number;
}

// ── Usage event params ───────────────────────────────────────────────────────

interface UsageEventParams {
  articleId: string;
  stage?: number | null;
  surface: string;
  provider?: string | null;
  actor?: string | null;
  eventType?: UsageEventType;
  modelOrTool?: string | null;
  modelTier?: string | null;
  precedenceRank?: number | null;
  requestCount?: number | null;
  quantity?: number | null;
  unit?: string | null;
  promptTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  premiumRequests?: number | null;
  imageCount?: number | null;
  costUsdEstimate?: number | null;
  metadata?: unknown;
  runId?: string | null;
  stageRunId?: string | null;
}

interface CreateLlmTraceParams {
  runId?: string | null;
  stageRunId?: string | null;
  articleId?: string | null;
  stage?: number | null;
  surface?: string | null;
  agentName: string;
  requestedModel?: string | null;
  stageKey?: string | null;
  taskFamily?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  responseFormat?: string | null;
  systemPrompt?: string | null;
  userMessage?: string | null;
  messages?: unknown;
  contextParts?: unknown;
  skills?: unknown;
  memories?: unknown;
  articleContext?: unknown;
  conversationContext?: string | null;
  rosterContext?: string | null;
  metadata?: unknown;
  providerMode?: string | null;
  providerSessionId?: string | null;
  workingDirectory?: string | null;
  incrementalPrompt?: string | null;
  providerRequest?: unknown;
  providerResponse?: unknown;
}

interface CompleteLlmTraceParams {
  provider?: string | null;
  model?: string | null;
  outputText?: string | null;
  thinkingText?: string | null;
  finishReason?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  metadata?: unknown;
  providerMode?: string | null;
  providerSessionId?: string | null;
  workingDirectory?: string | null;
  incrementalPrompt?: string | null;
  providerRequest?: unknown;
  providerResponse?: unknown;
}

interface FailLlmTraceParams {
  provider?: string | null;
  model?: string | null;
  errorMessage: string;
  latencyMs?: number | null;
  metadata?: unknown;
  providerMode?: string | null;
  providerSessionId?: string | null;
  workingDirectory?: string | null;
  incrementalPrompt?: string | null;
  providerRequest?: unknown;
  providerResponse?: unknown;
}

interface AttachLlmTraceParams {
  runId?: string | null;
  stageRunId?: string | null;
  articleId: string;
  stage?: number | null;
  surface?: string | null;
}

interface ArticleRetrospectiveFindingInput {
  role: string;
  findingType: string;
  findingText: string;
  sourceIteration?: number | null;
  priority?: string | null;
}

interface SaveArticleRetrospectiveParams {
  articleId: string;
  completionStage: number;
  revisionCount: number;
  forceApprovedAfterMaxRevisions: boolean;
  participantRoles: string[];
  overallSummary: string;
  artifactName?: string | null;
  findings: ArticleRetrospectiveFindingInput[];
}

export interface DashboardSessionRecord {
  session_id: string;
  username: string;
  created_at: string;
  expires_at: string;
}

// ── Repository ───────────────────────────────────────────────────────────────

export class Repository {
  private db: DatabaseSync;
  public readonly artifacts: ArtifactStore;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.initSchema();
    this.artifacts = new ArtifactStore(this.db);
  }

  /** Run schema.sql to create all tables. */
  private initSchema(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const sql = readFileSync(schemaPath, 'utf-8');
    this.db.exec(sql);
    this.ensureArticleColumns();
    this.ensureRevisionSummaryColumns();
    this.ensureLlmTraceColumns();
  }

  private ensureArticleColumns(): void {
    const columns = this.db.prepare('PRAGMA table_info(articles)').all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('llm_provider')) {
      this.db.exec('ALTER TABLE articles ADD COLUMN llm_provider TEXT');
    }
  }

  private ensureRevisionSummaryColumns(): void {
    const columns = this.db.prepare('PRAGMA table_info(revision_summaries)').all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('blocker_type')) {
      this.db.exec('ALTER TABLE revision_summaries ADD COLUMN blocker_type TEXT');
    }

    if (!columnNames.has('blocker_ids')) {
      this.db.exec('ALTER TABLE revision_summaries ADD COLUMN blocker_ids TEXT');
    }
  }

  private ensureLlmTraceColumns(): void {
    const columns = this.db.prepare('PRAGMA table_info(llm_traces)').all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('metadata_json')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN metadata_json TEXT');
    }
    if (!columnNames.has('provider_mode')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN provider_mode TEXT');
    }
    if (!columnNames.has('provider_session_id')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN provider_session_id TEXT');
    }
    if (!columnNames.has('working_directory')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN working_directory TEXT');
    }
    if (!columnNames.has('incremental_prompt')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN incremental_prompt TEXT');
    }
    if (!columnNames.has('provider_request_json')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN provider_request_json TEXT');
    }
    if (!columnNames.has('provider_response_json')) {
      this.db.exec('ALTER TABLE llm_traces ADD COLUMN provider_response_json TEXT');
    }
  }

  /** Expose the underlying database for extension modules (conversation, etc.). */
  getDb(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  getArticle(articleId: string): Article | null {
    const stmt = this.db.prepare('SELECT * FROM articles WHERE id = ?');
    const row = stmt.get(articleId) as unknown as Article | undefined;
    return row ?? null;
  }

  getAllArticles(): Article[] {
    const stmt = this.db.prepare(
      'SELECT * FROM articles ORDER BY current_stage DESC, updated_at DESC',
    );
    return stmt.all() as unknown as Article[];
  }

  getEditorReviews(articleId: string): EditorReview[] {
    const stmt = this.db.prepare(
      'SELECT * FROM editor_reviews WHERE article_id = ? ORDER BY review_number DESC',
    );
    return stmt.all(articleId) as unknown as EditorReview[];
  }

  getRevisionSummaries(articleId: string): RevisionSummary[] {
    const stmt = this.db.prepare(
      'SELECT * FROM revision_summaries WHERE article_id = ? ORDER BY iteration ASC',
    );
    return stmt.all(articleId) as unknown as RevisionSummary[];
  }

  getRevisionSummaryCount(articleId: string): number {
    const stmt = this.db.prepare(
      'SELECT COALESCE(MAX(iteration), 0) AS count FROM revision_summaries WHERE article_id = ?',
    );
    const row = stmt.get(articleId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  getUsageEvents(articleId: string, limit?: number): UsageEvent[] {
    if (limit == null) {
      const stmt = this.db.prepare(
        'SELECT * FROM usage_events WHERE article_id = ? ORDER BY created_at DESC, id DESC',
      );
      return stmt.all(articleId) as unknown as UsageEvent[];
    }

    const stmt = this.db.prepare(
      'SELECT * FROM usage_events WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    );
    return stmt.all(articleId, limit) as unknown as UsageEvent[];
  }

  getStageRuns(articleId: string, limit = 100): StageRun[] {
    const stmt = this.db.prepare(
      'SELECT * FROM stage_runs WHERE article_id = ? ORDER BY started_at DESC LIMIT ?',
    );
    return stmt.all(articleId, limit) as unknown as StageRun[];
  }

  getStageRunDetail(stageRunId: string): StageRunDetail | null {
    const stmt = this.db.prepare(
      `SELECT sr.*, (
         SELECT COUNT(*)
         FROM llm_traces lt
         WHERE lt.stage_run_id = sr.id
       ) AS trace_count
       FROM stage_runs sr
       WHERE sr.id = ?`,
    );
    const row = stmt.get(stageRunId) as StageRunDetail | undefined;
    return row ?? null;
  }

  getArticleLlmTraces(articleId: string, limit = 25): LlmTrace[] {
    if (limit <= 0) {
      const stmt = this.db.prepare(
        'SELECT * FROM llm_traces WHERE article_id = ? ORDER BY started_at DESC, id DESC',
      );
      return stmt.all(articleId) as unknown as LlmTrace[];
    }
    const stmt = this.db.prepare(
      'SELECT * FROM llm_traces WHERE article_id = ? ORDER BY started_at DESC, id DESC LIMIT ?',
    );
    return stmt.all(articleId, limit) as unknown as LlmTrace[];
  }

  getStageRunLlmTraces(stageRunId: string): LlmTrace[] {
    const stmt = this.db.prepare(
      'SELECT * FROM llm_traces WHERE stage_run_id = ? ORDER BY started_at ASC, id ASC',
    );
    return stmt.all(stageRunId) as unknown as LlmTrace[];
  }

  getLlmTrace(traceId: string): LlmTrace | null {
    const stmt = this.db.prepare('SELECT * FROM llm_traces WHERE id = ?');
    const row = stmt.get(traceId) as LlmTrace | undefined;
    return row ?? null;
  }

  getStageTransitions(articleId: string): StageTransition[] {
    const stmt = this.db.prepare(
      'SELECT * FROM stage_transitions WHERE article_id = ? ORDER BY transitioned_at ASC',
    );
    return stmt.all(articleId) as unknown as StageTransition[];
  }

  listArticles(filters?: { stage?: number; status?: string; team?: string; depthLevel?: number; search?: string; limit?: number; excludeArchived?: boolean }): Article[] {
    let sql = 'SELECT * FROM articles';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (filters?.excludeArchived) {
      conditions.push("status != 'archived'");
    }
    if (filters?.stage != null) {
      conditions.push('current_stage = ?');
      params.push(filters.stage);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.team) {
      conditions.push('primary_team = ?');
      params.push(filters.team);
    }
    if (filters?.depthLevel != null) {
      conditions.push('depth_level = ?');
      params.push(filters.depthLevel);
    }
    if (filters?.search) {
      conditions.push('title LIKE ?');
      params.push(`%${filters.search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as unknown as Article[];
  }

  getDistinctTeams(): string[] {
    const stmt = this.db.prepare('SELECT DISTINCT primary_team FROM articles WHERE primary_team IS NOT NULL ORDER BY primary_team');
    return (stmt.all() as { primary_team: string }[]).map(r => r.primary_team);
  }

  createDashboardSession(sessionId: string, username: string, expiresAt: string): DashboardSessionRecord {
    this.deleteExpiredDashboardSessions();
    const stmt = this.db.prepare(
      `INSERT INTO dashboard_sessions (session_id, username, expires_at)
       VALUES (?, ?, ?)`,
    );
    stmt.run(sessionId, username, expiresAt);
    return this.getDashboardSession(sessionId)!;
  }

  getDashboardSession(sessionId: string): DashboardSessionRecord | null {
    const stmt = this.db.prepare(
      'SELECT session_id, username, created_at, expires_at FROM dashboard_sessions WHERE session_id = ?',
    );
    const row = stmt.get(sessionId) as DashboardSessionRecord | undefined;
    if (!row) return null;
    if (row.expires_at <= nowISO()) {
      this.deleteDashboardSession(sessionId);
      return null;
    }
    return row;
  }

  deleteDashboardSession(sessionId: string): void {
    this.db.prepare('DELETE FROM dashboard_sessions WHERE session_id = ?').run(sessionId);
  }

  deleteExpiredDashboardSessions(referenceTime = nowISO()): number {
    const result = this.db.prepare(
      'DELETE FROM dashboard_sessions WHERE expires_at <= ?',
    ).run(referenceTime);
    return Number(result.changes ?? 0);
  }

  // ── Draft URL management ───────────────────────────────────────────────────

  getDraftUrl(articleId: string): string | null {
    const stmt = this.db.prepare(
      'SELECT substack_draft_url FROM articles WHERE id = ?',
    );
    const row = stmt.get(articleId) as { substack_draft_url: string | null } | undefined;
    return row?.substack_draft_url ?? null;
  }

  setDraftUrl(articleId: string, draftUrl: string): void {
    this.assertNotPublished(articleId);
    const stmt = this.db.prepare(
      'UPDATE articles SET substack_draft_url = ?, updated_at = ? WHERE id = ?',
    );
    stmt.run(draftUrl, nowISO(), articleId);
  }

  assertNotPublished(articleId: string): void {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }
    if (article.current_stage === 8 || article.status === 'published') {
      throw new Error(
        `Article '${articleId}' is already published ` +
        `(stage=${article.current_stage}, status=${article.status}). ` +
        `Cannot update a published article through the draft-update path.`,
      );
    }
  }

  updateArticle(
    articleId: string,
    updates: { title?: string; subtitle?: string | null; depth_level?: number; teams?: string[]; llm_provider?: string | null },
  ): Article {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }

    const setParts: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.title != null) {
      const title = String(updates.title).trim();
      if (!title) throw new Error('title cannot be empty');
      setParts.push('title = ?');
      params.push(title);
    }

    if (updates.subtitle !== undefined) {
      const subtitle = updates.subtitle == null ? null : String(updates.subtitle).trim();
      setParts.push('subtitle = ?');
      params.push(subtitle || null);
    }

    if (updates.depth_level != null) {
      const depth = updates.depth_level;
      if (!Number.isInteger(depth) || depth < 1 || depth > 4) {
        throw new Error(`depth_level must be an integer 1–4, got ${JSON.stringify(depth)}`);
      }
      setParts.push('depth_level = ?');
      params.push(depth);
    }

    if (updates.teams !== undefined) {
      const teams = Array.isArray(updates.teams)
        ? updates.teams.map(t => String(t).trim()).filter(Boolean)
        : [];
      const unique = [...new Set(teams)];
      setParts.push('teams = ?');
      params.push(unique.length > 0 ? JSON.stringify(unique) : null);
    }

    if (updates.llm_provider !== undefined) {
      const provider = updates.llm_provider == null ? null : String(updates.llm_provider).trim();
      setParts.push('llm_provider = ?');
      params.push(provider || null);
    }

    if (setParts.length === 0) return article;

    const now = nowISO();
    const sql = `UPDATE articles SET ${setParts.join(', ')}, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...params, now, articleId);

    return this.getArticle(articleId)!;
  }

  updateArticleStatus(articleId: string, status: ArticleStatus): Article {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found`);
    }

    validateStatus(status, VALID_STATUSES, 'status');
    this.db.prepare(
      'UPDATE articles SET status = ?, updated_at = ? WHERE id = ?',
    ).run(status, nowISO(), articleId);

    return this.getArticle(articleId)!;
  }

  // ── Article runs ───────────────────────────────────────────────────────────

  startArticleRun(
    articleId: string,
    trigger: string,
    initiatedBy: string,
    notes: string | null = null,
    runId?: string,
    status: RunStatus = 'started',
  ): string {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }
    validateStatus(status, VALID_RUN_STATUSES, 'article run status');

    const id = runId ?? newRunId();
    const stmt = this.db.prepare(
      `INSERT INTO article_runs (id, article_id, trigger, initiated_by, status, notes, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(id, articleId, trigger, initiatedBy, status, notes, nowISO());
    return id;
  }

  finishArticleRun(
    runId: string,
    status: RunStatus = 'completed',
    notes: string | null = null,
  ): void {
    validateStatus(status, VALID_RUN_STATUSES, 'article run status');
    const stmt = this.db.prepare(
      'UPDATE article_runs SET status = ?, notes = ?, completed_at = ? WHERE id = ?',
    );
    stmt.run(status, notes, nowISO(), runId);
  }

  // ── Stage runs ─────────────────────────────────────────────────────────────

  startStageRun(params: {
    articleId: string;
    stage: number;
    surface: string;
    actor: string;
    runId?: string | null;
    requestedModel?: string | null;
    requestedModelTier?: string | null;
    precedenceRank?: number | null;
    outputBudgetTokens?: number | null;
    notes?: string | null;
    stageRunId?: string;
    status?: RunStatus;
  }): string {
    const {
      articleId, stage, surface, actor,
      runId = null,
      requestedModel = null,
      requestedModelTier = null,
      precedenceRank = null,
      outputBudgetTokens = null,
      notes = null,
      stageRunId,
      status = 'started',
    } = params;

    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }
    validateStage(stage);
    validateStatus(status, VALID_RUN_STATUSES, 'stage run status');

    if (runId != null) {
      const runStmt = this.db.prepare('SELECT article_id FROM article_runs WHERE id = ?');
      const runRow = runStmt.get(runId) as { article_id: string } | undefined;
      if (runRow == null) {
        throw new Error(`Article run '${runId}' not found`);
      }
      if (runRow.article_id !== articleId) {
        throw new Error(
          `Article run '${runId}' belongs to '${runRow.article_id}', not '${articleId}'`,
        );
      }
    }

    const id = stageRunId ?? newRunId();
    const stmt = this.db.prepare(
      `INSERT INTO stage_runs
       (id, run_id, article_id, stage, surface, actor, requested_model,
        requested_model_tier, precedence_rank, output_budget_tokens, status,
        notes, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(
      id, runId, articleId, stage, surface, actor, requestedModel,
      requestedModelTier, precedenceRank, outputBudgetTokens, status,
      notes, nowISO(),
    );
    return id;
  }

  finishStageRun(
    stageRunId: string,
    status: RunStatus = 'completed',
    notes: string | null = null,
    artifactPath: string | null = null,
  ): void {
    validateStatus(status, VALID_RUN_STATUSES, 'stage run status');
    const stmt = this.db.prepare(
      `UPDATE stage_runs
       SET status = ?, notes = ?, artifact_path = COALESCE(?, artifact_path), completed_at = ?
       WHERE id = ?`,
    );
    stmt.run(status, notes, artifactPath, nowISO(), stageRunId);
  }

  // ── Startup recovery ────────────────────────────────────────────────────────

  /**
   * Recover from unclean shutdown: mark orphaned stage_runs and article_runs
   * as 'interrupted', and reset articles stuck in transient 'revision' status
   * with no active runs. Returns summary of recovered items.
   */
  recoverOrphanedRuns(): { stageRuns: number; articleRuns: number; articles: string[] } {
    const now = nowISO();

    // 1. Mark orphaned stage_runs (started but never finished)
    const stageResult = this.db.prepare(
      `UPDATE stage_runs SET status = 'interrupted', notes = 'Server restarted before completion', completed_at = ?
       WHERE status = 'started'`,
    ).run(now);

    // 2. Mark orphaned article_runs
    const articleRunResult = this.db.prepare(
      `UPDATE article_runs SET status = 'interrupted', completed_at = ?
       WHERE status = 'started'`,
    ).run(now);

    // 3. Find articles stuck in 'revision' or 'in_production' with no active runs
    const stuckArticles = this.db.prepare(
      `SELECT DISTINCT a.id FROM articles a
       WHERE a.status IN ('revision', 'in_production')
       AND NOT EXISTS (
         SELECT 1 FROM stage_runs sr
         WHERE sr.article_id = a.id AND sr.status = 'started'
       )`,
    ).all() as Array<{ id: string }>;

    // Reset stuck articles to 'active' equivalent based on their stage
    const resetStmt = this.db.prepare(
      `UPDATE articles SET status = 'approved', updated_at = ? WHERE id = ?`,
    );
    for (const row of stuckArticles) {
      resetStmt.run(now, row.id);
    }

    return {
      stageRuns: Number(stageResult.changes),
      articleRuns: Number(articleRunResult.changes),
      articles: stuckArticles.map(r => r.id),
    };
  }

  // ── Usage events ───────────────────────────────────────────────────────────

  private insertUsageEvent(p: UsageEventParams): void {
    if (!p.surface) {
      throw new Error('surface is required for usage events');
    }
    if (p.stage != null) {
      validateStage(p.stage);
    }
    const eventType = p.eventType ?? 'completed';
    validateStatus(eventType, VALID_USAGE_EVENT_TYPES, 'usage event type');

    const metadataJson = normalizeMetadataJson(p.metadata);
    const stmt = this.db.prepare(
      `INSERT INTO usage_events
       (run_id, stage_run_id, article_id, stage, surface, provider, actor, event_type,
        model_or_tool, model_tier, precedence_rank, request_count, quantity, unit,
        prompt_tokens, output_tokens, cached_tokens, premium_requests, image_count,
        cost_usd_estimate, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(
      p.runId ?? null,
      p.stageRunId ?? null,
      p.articleId,
      p.stage ?? null,
      p.surface,
      p.provider ?? null,
      p.actor ?? null,
      eventType,
      p.modelOrTool ?? null,
      p.modelTier ?? null,
      p.precedenceRank ?? null,
      p.requestCount ?? null,
      p.quantity ?? null,
      p.unit ?? null,
      p.promptTokens ?? null,
      p.outputTokens ?? null,
      p.cachedTokens ?? null,
      p.premiumRequests ?? null,
      p.imageCount ?? null,
      p.costUsdEstimate ?? null,
      metadataJson,
      nowISO(),
    );
  }

  recordUsageEvent(params: UsageEventParams): void {
    const article = this.getArticle(params.articleId);
    if (article == null) {
      throw new Error(`Article '${params.articleId}' not found in pipeline.db`);
    }
    this.insertUsageEvent(params);
  }

  startLlmTrace(params: CreateLlmTraceParams): string {
    if (params.articleId != null) {
      const article = this.getArticle(params.articleId);
      if (article == null) {
        throw new Error(`Article '${params.articleId}' not found in pipeline.db`);
      }
    }
    if (params.stage != null) {
      validateStage(params.stage);
    }

    const id = newRunId();
    const stmt = this.db.prepare(
      `INSERT INTO llm_traces
        (id, run_id, stage_run_id, article_id, stage, surface, agent_name, requested_model,
         stage_key, task_family, temperature, max_tokens, response_format, status,
         system_prompt, user_message, messages_json, context_parts_json, skills_json,
         memories_json, article_context_json, conversation_context, roster_context, metadata_json, provider_mode,
         provider_session_id, working_directory, incremental_prompt, provider_request_json,
         provider_response_json, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    );
    stmt.run(
      id,
      params.runId ?? null,
      params.stageRunId ?? null,
      params.articleId ?? null,
      params.stage ?? null,
      params.surface ?? null,
      params.agentName,
      params.requestedModel ?? null,
      params.stageKey ?? null,
      params.taskFamily ?? null,
      params.temperature ?? null,
      params.maxTokens ?? null,
      params.responseFormat ?? null,
      'started',
      params.systemPrompt ?? null,
      params.userMessage ?? null,
      normalizeMetadataJson(params.messages),
      normalizeMetadataJson(params.contextParts),
      normalizeMetadataJson(params.skills),
      normalizeMetadataJson(params.memories),
      normalizeMetadataJson(params.articleContext),
      params.conversationContext ?? null,
      params.rosterContext ?? null,
      normalizeMetadataJson(params.metadata),
      params.providerMode ?? null,
      params.providerSessionId ?? null,
      params.workingDirectory ?? null,
      params.incrementalPrompt ?? null,
      normalizeMetadataJson(params.providerRequest),
      normalizeMetadataJson(params.providerResponse),
      nowISO(),
    );
    return id;
  }

  completeLlmTrace(traceId: string, params: CompleteLlmTraceParams): void {
    const stmt = this.db.prepare(
      `UPDATE llm_traces
       SET provider = ?,
           model = ?,
           output_text = ?,
           thinking_text = ?,
           finish_reason = ?,
           prompt_tokens = ?,
           completion_tokens = ?,
           total_tokens = ?,
           metadata_json = COALESCE(?, metadata_json),
           provider_mode = COALESCE(?, provider_mode),
           provider_session_id = COALESCE(?, provider_session_id),
           working_directory = COALESCE(?, working_directory),
           incremental_prompt = COALESCE(?, incremental_prompt),
           provider_request_json = COALESCE(?, provider_request_json),
           provider_response_json = COALESCE(?, provider_response_json),
           latency_ms = ?,
           status = 'completed',
           completed_at = ?
        WHERE id = ?`,
    );
    stmt.run(
      params.provider ?? null,
      params.model ?? null,
      params.outputText ?? null,
      params.thinkingText ?? null,
      params.finishReason ?? null,
      params.promptTokens ?? null,
      params.completionTokens ?? null,
      params.totalTokens ?? null,
      normalizeMetadataJson(params.metadata),
      params.providerMode ?? null,
      params.providerSessionId ?? null,
      params.workingDirectory ?? null,
      params.incrementalPrompt ?? null,
      normalizeMetadataJson(params.providerRequest),
      normalizeMetadataJson(params.providerResponse),
      params.latencyMs ?? null,
      nowISO(),
      traceId,
    );
  }

  failLlmTrace(traceId: string, params: FailLlmTraceParams): void {
    const stmt = this.db.prepare(
      `UPDATE llm_traces
       SET provider = COALESCE(?, provider),
            model = COALESCE(?, model),
            error_message = ?,
            metadata_json = COALESCE(?, metadata_json),
            provider_mode = COALESCE(?, provider_mode),
            provider_session_id = COALESCE(?, provider_session_id),
            working_directory = COALESCE(?, working_directory),
            incremental_prompt = COALESCE(?, incremental_prompt),
            provider_request_json = COALESCE(?, provider_request_json),
            provider_response_json = COALESCE(?, provider_response_json),
            latency_ms = ?,
            status = 'failed',
            completed_at = ?
        WHERE id = ?`,
    );
    stmt.run(
      params.provider ?? null,
      params.model ?? null,
      params.errorMessage,
      normalizeMetadataJson(params.metadata),
      params.providerMode ?? null,
      params.providerSessionId ?? null,
      params.workingDirectory ?? null,
      params.incrementalPrompt ?? null,
      normalizeMetadataJson(params.providerRequest),
      normalizeMetadataJson(params.providerResponse),
      params.latencyMs ?? null,
      nowISO(),
      traceId,
    );
  }

  attachLlmTrace(traceId: string, params: AttachLlmTraceParams): void {
    const article = this.getArticle(params.articleId);
    if (article == null) {
      throw new Error(`Article '${params.articleId}' not found in pipeline.db`);
    }
    if (params.stage != null) {
      validateStage(params.stage);
    }
    const stmt = this.db.prepare(
      `UPDATE llm_traces
       SET run_id = COALESCE(?, run_id),
           stage_run_id = COALESCE(?, stage_run_id),
           article_id = ?,
           stage = COALESCE(?, stage),
           surface = COALESCE(?, surface)
       WHERE id = ?`,
    );
    stmt.run(
      params.runId ?? null,
      params.stageRunId ?? null,
      params.articleId,
      params.stage ?? null,
      params.surface ?? null,
      traceId,
    );
  }

  // ── Stage transitions ──────────────────────────────────────────────────────

  advanceStage(
    articleId: string,
    fromStage: number | null,
    toStage: number,
    agent: string,
    notes: string | null = null,
    status?: ArticleStatus | null,
    usageEvent?: Record<string, unknown> | null,
  ): void {
    if (fromStage != null) {
      validateStage(fromStage, 'from_stage');
    }
    validateStage(toStage, 'to_stage');

    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }

    const dbStage = article.current_stage;
    if (fromStage != null && dbStage !== fromStage) {
      throw new Error(
        `Stage mismatch for '${articleId}': caller expects stage ${fromStage}, ` +
        `but DB has ${dbStage}. Refusing transition to avoid stale-stage corruption.`,
      );
    }

    const now = nowISO();

    const transStmt = this.db.prepare(
      `INSERT INTO stage_transitions
       (article_id, from_stage, to_stage, agent, notes, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    transStmt.run(articleId, fromStage, toStage, agent, notes, now);

    let updateSql = 'UPDATE articles SET current_stage = ?, updated_at = ?';
    const updateParams: (string | number | null)[] = [toStage, now];

    if (status) {
      validateStatus(status, VALID_STATUSES, 'status');
      updateSql += ', status = ?';
      updateParams.push(status);
    }

    updateSql += ' WHERE id = ?';
    updateParams.push(articleId);
    const updateStmt = this.db.prepare(updateSql);
    updateStmt.run(...updateParams);

    if (usageEvent != null) {
      const payload: UsageEventParams = {
        articleId: (usageEvent['articleId'] as string) ?? articleId,
        stage: (usageEvent['stage'] as number) ?? toStage,
        surface: (usageEvent['surface'] as string) ?? 'stage_transition',
        provider: (usageEvent['provider'] as string) ?? 'local',
        actor: (usageEvent['actor'] as string) ?? agent,
        eventType: (usageEvent['eventType'] as UsageEventType) ?? 'stage_transition',
        metadata: usageEvent['metadata'] ?? null,
      };
      this.insertUsageEvent(payload);
    }
  }

  // ── Stage regression ───────────────────────────────────────────────────────

  regressStage(
    articleId: string,
    fromStage: number,
    toStage: number,
    agent: string,
    reason: string,
  ): void {
    if (toStage >= fromStage) {
      throw new Error(`Cannot regress: target stage ${toStage} must be less than current stage ${fromStage}`);
    }
    validateStage(fromStage, 'from_stage');
    validateStage(toStage, 'to_stage');

    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found`);
    }
    if (article.current_stage !== fromStage) {
      throw new Error(
        `Stage mismatch for '${articleId}': caller expects stage ${fromStage}, but DB has ${article.current_stage}`,
      );
    }

    // Clear stale artifacts and related records before recording the transition
    this.clearArtifactsAfterStage(articleId, toStage);

    if (toStage < 6) {
      this.db.prepare('DELETE FROM publisher_pass WHERE article_id = ?').run(articleId);
    }
    if (toStage < 5) {
      this.db.prepare('DELETE FROM editor_reviews WHERE article_id = ?').run(articleId);
    }

    const now = nowISO();

    const transStmt = this.db.prepare(
      `INSERT INTO stage_transitions
       (article_id, from_stage, to_stage, agent, notes, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    transStmt.run(articleId, fromStage, toStage, agent, `Regression: ${reason}`, now);

    const updateStmt = this.db.prepare(
      'UPDATE articles SET current_stage = ?, status = ?, updated_at = ? WHERE id = ?',
    );
    updateStmt.run(toStage, 'revision', now, articleId);
  }

  /** Delete artifacts that belong to stages after toStage. */
  clearArtifactsAfterStage(articleId: string, toStage: number): string[] {
    // Pattern-based: artifact name → minimum stage it belongs to
    const ARTIFACT_PATTERNS: Array<{ pattern: RegExp; stage: number }> = [
      { pattern: /^idea\.md$/, stage: 1 },
      { pattern: /^discussion-prompt\.md$/, stage: 2 },
      { pattern: /^panel-composition\.md$/, stage: 3 },
      { pattern: /^panel-.*\.md$/, stage: 4 },           // individual panelist contributions
      { pattern: /^discussion-summary\.md$/, stage: 4 },
      { pattern: /^draft\.md$/, stage: 5 },
      { pattern: /^writer-factcheck\.md$/, stage: 5 },
      { pattern: /^editor-review(-\d+)?\.md$/, stage: 6 }, // numbered reviews too
      { pattern: /^lead-review\.md$/, stage: 6 },
      { pattern: /^publisher-pass\.md$/, stage: 7 },        // was missing!
      { pattern: /^images\.json$/, stage: 5 },              // image manifest
    ];

    const allArtifacts = this.artifacts.list(articleId);
    const cleared: string[] = [];

    for (const artifact of allArtifacts) {
      if (artifact.name === '_config.json') continue; // never delete config

      // Check thinking traces: X.thinking.md belongs to same stage as X.md
      const thinkingMatch = artifact.name.match(/^(.+)\.thinking\.md$/);
      if (thinkingMatch) {
        const parentName = `${thinkingMatch[1]}.md`;
        const parentPattern = ARTIFACT_PATTERNS.find(p => p.pattern.test(parentName));
        if (parentPattern && parentPattern.stage > toStage) {
          this.artifacts.delete(articleId, artifact.name);
          cleared.push(artifact.name);
        }
        continue;
      }

      // Check regular artifacts
      const matched = ARTIFACT_PATTERNS.find(p => p.pattern.test(artifact.name));
      if (matched && matched.stage > toStage) {
        this.artifacts.delete(articleId, artifact.name);
        cleared.push(artifact.name);
      }
    }

    return cleared;
  }

  // ── Artifact path updates ──────────────────────────────────────────────────

  setDiscussionPath(articleId: string, path: string): void {
    const stmt = this.db.prepare(
      'UPDATE articles SET discussion_path = ?, updated_at = ? WHERE id = ?',
    );
    stmt.run(path, nowISO(), articleId);
  }

  setArticlePath(articleId: string, path: string): void {
    const stmt = this.db.prepare(
      'UPDATE articles SET article_path = ?, updated_at = ? WHERE id = ?',
    );
    stmt.run(path, nowISO(), articleId);
  }

  // ── Editor review ──────────────────────────────────────────────────────────

  recordEditorReview(
    articleId: string,
    verdict: EditorVerdict,
    errors = 0,
    suggestions = 0,
    notes = 0,
    reviewNumber?: number,
  ): void {
    validateStatus(verdict, VALID_VERDICTS, 'verdict');

    if (reviewNumber == null) {
      const maxStmt = this.db.prepare(
        'SELECT MAX(review_number) as max_rn FROM editor_reviews WHERE article_id = ?',
      );
      const row = maxStmt.get(articleId) as { max_rn: number | null } | undefined;
      reviewNumber = ((row?.max_rn) ?? 0) + 1;
    }

    const stmt = this.db.prepare(
      `INSERT INTO editor_reviews
       (article_id, verdict, error_count, suggestion_count, note_count, review_number, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(articleId, verdict, errors, suggestions, notes, reviewNumber, nowISO());
  }

  // ── Publisher pass ─────────────────────────────────────────────────────────

  recordPublisherPass(articleId: string, checklist: PublisherChecklist = {}): void {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }

    const defaults: Required<PublisherChecklist> = {
      title_final: 0,
      subtitle_final: 0,
      body_clean: 0,
      section_assigned: 0,
      tags_set: 0,
      url_slug_set: 0,
      cover_image_set: 0,
      paywall_set: 0,
      publish_datetime: null,
      email_send: 1,
      names_verified: 0,
      numbers_current: 0,
      no_stale_refs: 0,
    };
    const merged = { ...defaults, ...checklist };

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO publisher_pass
       (article_id, title_final, subtitle_final, body_clean,
        section_assigned, tags_set, url_slug_set, cover_image_set,
        paywall_set, publish_datetime, email_send,
        names_verified, numbers_current, no_stale_refs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(
      articleId,
      merged.title_final,
      merged.subtitle_final,
      merged.body_clean,
      merged.section_assigned,
      merged.tags_set,
      merged.url_slug_set,
      merged.cover_image_set,
      merged.paywall_set,
      merged.publish_datetime,
      merged.email_send,
      merged.names_verified,
      merged.numbers_current,
      merged.no_stale_refs,
    );

  }

  getPublisherPass(articleId: string): PublisherPass | null {
    const stmt = this.db.prepare('SELECT * FROM publisher_pass WHERE article_id = ?');
    const row = stmt.get(articleId) as unknown as PublisherPass | undefined;
    return row ?? null;
  }

  saveArticleRetrospective(params: SaveArticleRetrospectiveParams): number {
    const article = this.getArticle(params.articleId);
    if (article == null) {
      throw new Error(`Article '${params.articleId}' not found in pipeline.db`);
    }

    const now = nowISO();
    const participantRoles = JSON.stringify([...params.participantRoles].sort());
    const artifactName = params.artifactName ?? null;

    this.db.prepare(
      `INSERT INTO article_retrospectives
       (article_id, completion_stage, revision_count, force_approved_after_max_revisions,
        participant_roles, overall_summary, artifact_name, generated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(article_id, completion_stage, revision_count)
       DO UPDATE SET
         force_approved_after_max_revisions = excluded.force_approved_after_max_revisions,
         participant_roles = excluded.participant_roles,
         overall_summary = excluded.overall_summary,
         artifact_name = excluded.artifact_name,
         updated_at = excluded.updated_at`,
    ).run(
      params.articleId,
      params.completionStage,
      params.revisionCount,
      params.forceApprovedAfterMaxRevisions ? 1 : 0,
      participantRoles,
      params.overallSummary,
      artifactName,
      now,
      now,
    );

    const row = this.db.prepare(
      `SELECT id
       FROM article_retrospectives
       WHERE article_id = ? AND completion_stage = ? AND revision_count = ?`,
    ).get(params.articleId, params.completionStage, params.revisionCount) as { id: number } | undefined;

    if (!row) {
      throw new Error(`Failed to load retrospective id for article '${params.articleId}'`);
    }

    this.db.prepare(
      'DELETE FROM article_retrospective_findings WHERE retrospective_id = ?',
    ).run(row.id);

    const insertFinding = this.db.prepare(
      `INSERT INTO article_retrospective_findings
       (retrospective_id, article_id, role, finding_type, finding_text, source_iteration, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const finding of params.findings) {
      insertFinding.run(
        row.id,
        params.articleId,
        finding.role,
        finding.findingType,
        finding.findingText,
        finding.sourceIteration ?? null,
        finding.priority ?? null,
      );
    }

    return row.id;
  }

  getArticleRetrospectives(articleId: string): ArticleRetrospective[] {
    return this.db.prepare(
      'SELECT * FROM article_retrospectives WHERE article_id = ? ORDER BY revision_count ASC, id ASC',
    ).all(articleId) as unknown as ArticleRetrospective[];
  }

  getRetrospectiveFindings(retrospectiveId: number): ArticleRetrospectiveFinding[] {
    return this.db.prepare(
      'SELECT * FROM article_retrospective_findings WHERE retrospective_id = ? ORDER BY id ASC',
    ).all(retrospectiveId) as unknown as ArticleRetrospectiveFinding[];
  }

  listRetrospectiveDigestFindings(limit = 25): RetrospectiveDigestFindingRow[] {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`Retrospective digest limit must be a positive integer, got ${JSON.stringify(limit)}`);
    }

    return this.db.prepare(
      `WITH selected_retrospectives AS (
         SELECT
           r.id,
           r.article_id,
           r.completion_stage,
           r.revision_count,
           r.force_approved_after_max_revisions,
           r.participant_roles,
           r.overall_summary,
           r.artifact_name,
           r.generated_at,
           r.updated_at,
           a.title AS article_title,
           a.primary_team AS article_primary_team,
           a.league AS article_league
         FROM article_retrospectives r
         JOIN articles a ON a.id = r.article_id
         ORDER BY r.generated_at DESC, r.id DESC
         LIMIT ?
       )
       SELECT
         selected_retrospectives.id AS retrospective_id,
         f.id AS finding_id,
         selected_retrospectives.article_id,
         selected_retrospectives.article_title,
         selected_retrospectives.article_primary_team,
         selected_retrospectives.article_league,
         selected_retrospectives.completion_stage,
         selected_retrospectives.revision_count,
         selected_retrospectives.force_approved_after_max_revisions,
         selected_retrospectives.participant_roles,
         selected_retrospectives.overall_summary,
         selected_retrospectives.artifact_name,
         selected_retrospectives.generated_at,
         selected_retrospectives.updated_at,
         f.role,
         f.finding_type,
         f.finding_text,
         f.source_iteration,
         f.priority
       FROM selected_retrospectives
       JOIN article_retrospective_findings f ON f.retrospective_id = selected_retrospectives.id
       ORDER BY selected_retrospectives.generated_at DESC, selected_retrospectives.id DESC, f.id ASC`,
    ).all(limit) as unknown as RetrospectiveDigestFindingRow[];
  }

  updateChecklistItem(articleId: string, key: string, value: number | string | null): void {
    const validKeys = [
      'title_final', 'subtitle_final', 'body_clean', 'section_assigned',
      'tags_set', 'url_slug_set', 'cover_image_set', 'paywall_set', 'email_send',
      'names_verified', 'numbers_current', 'no_stale_refs', 'publish_datetime',
    ];
    if (!validKeys.includes(key)) throw new Error(`Invalid checklist key: ${key}`);

    // Ensure publisher_pass row exists (create with defaults if needed)
    const existing = this.getPublisherPass(articleId);
    if (!existing) this.recordPublisherPass(articleId);

    const stmt = this.db.prepare(`UPDATE publisher_pass SET ${key} = ? WHERE article_id = ?`);
    stmt.run(value, articleId);
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  recordNote(
    articleId: string | null,
    noteType: NoteType,
    content: string,
    noteUrl: string | null = null,
    target: NoteTarget = 'prod',
    agent: string | null = null,
    imagePath: string | null = null,
  ): void {
    validateStatus(noteType, VALID_NOTE_TYPES, 'note_type');
    validateStatus(target, VALID_NOTE_TARGETS, 'target');

    if (articleId != null) {
      const article = this.getArticle(articleId);
      if (article == null) {
        throw new Error(`Article '${articleId}' not found in pipeline.db`);
      }
    }

    const stmt = this.db.prepare(
      `INSERT INTO notes
       (article_id, note_type, content, substack_note_url, target, created_by, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(articleId, noteType, content, noteUrl, target, agent, imagePath);
  }

  getNotesForArticle(articleId: string): Note[] {
    const stmt = this.db.prepare(
      'SELECT * FROM notes WHERE article_id = ? ORDER BY created_at DESC',
    );
    return stmt.all(articleId) as unknown as Note[];
  }

  getAllNotes(): Note[] {
    const stmt = this.db.prepare('SELECT * FROM notes ORDER BY created_at DESC');
    return stmt.all() as unknown as Note[];
  }

  // ── Publish confirmation ───────────────────────────────────────────────────

  recordPublish(articleId: string, substackUrl: string, agent = 'Joe'): void {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found`);
    }

    const fromStage = typeof article.current_stage === 'number' ? article.current_stage : null;
    const now = nowISO();

    const transStmt = this.db.prepare(
      `INSERT INTO stage_transitions
       (article_id, from_stage, to_stage, agent, notes, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    transStmt.run(articleId, fromStage, 8, agent, `Published at ${substackUrl}`, now);

    const upStmt = this.db.prepare(
      `UPDATE articles SET current_stage = 8, status = 'published',
       substack_url = ?, published_at = ?, updated_at = ? WHERE id = ?`,
    );
    upStmt.run(substackUrl, now, now, articleId);
  }

  // ── Repair: coerce string stage to numeric ─────────────────────────────────

  repairStringStage(articleId: string, correctNumericStage: number, agent = 'pipeline_state'): void {
    validateStage(correctNumericStage, 'correct_numeric_stage');
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found`);
    }

    const oldVal = article.current_stage;
    const now = nowISO();

    const transStmt = this.db.prepare(
      `INSERT INTO stage_transitions
       (article_id, from_stage, to_stage, agent, notes, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    transStmt.run(articleId, null, correctNumericStage, agent, `Repaired string stage '${oldVal}' → numeric ${correctNumericStage}`, now);

    const upStmt = this.db.prepare(
      'UPDATE articles SET current_stage = ?, updated_at = ? WHERE id = ?',
    );
    upStmt.run(correctNumericStage, now, articleId);
  }

  // ── Backfill: create missing article rows ──────────────────────────────────

  backfillArticle(
    articleId: string,
    title: string,
    stage: number = 1,
    status: ArticleStatus = 'proposed',
    agent = 'pipeline_state',
    discussionPath: string | null = null,
    articlePath: string | null = null,
  ): void {
    validateStage(stage, 'stage');
    validateStatus(status, VALID_STATUSES, 'status');

    const existing = this.getArticle(articleId);
    if (existing != null) {
      throw new Error(`Article '${articleId}' already exists in DB`);
    }

    const now = nowISO();

    const insertStmt = this.db.prepare(
      `INSERT INTO articles
       (id, title, status, current_stage, discussion_path, article_path, created_at, updated_at, depth_level, time_sensitive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertStmt.run(articleId, title, status, stage, discussionPath, articlePath, now, now, 2, 0);

    const transStmt = this.db.prepare(
      `INSERT INTO stage_transitions
       (article_id, from_stage, to_stage, agent, notes, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    transStmt.run(articleId, null, stage, agent, `Backfilled missing DB row at stage ${stage}`, now);
  }

  // ── Create article (v2 — new idea from dashboard) ──────────────────────────

  createArticle(params: {
    id: string;
    title: string;
    llm_provider?: string | null;
    primary_team?: string;
    league?: string;
    depth_level?: number;
  }): Article {
    const {
      id,
      title,
      llm_provider = null,
      primary_team = null,
      league = 'nfl',
      depth_level = 2,
    } = params;

    const existing = this.getArticle(id);
    if (existing != null) {
      throw new Error(`Article '${id}' already exists`);
    }

    const now = nowISO();
    const teams = primary_team ? JSON.stringify([primary_team]) : null;

    const stmt = this.db.prepare(
      `INSERT INTO articles
       (id, title, llm_provider, primary_team, teams, league, status, current_stage,
        created_at, updated_at, depth_level, time_sensitive)
       VALUES (?, ?, ?, ?, ?, ?, 'proposed', 1, ?, ?, ?, 0)`,
    );
    stmt.run(id, title, llm_provider, primary_team, teams, league, now, now, depth_level);

    const transStmt = this.db.prepare(
      `INSERT INTO stage_transitions
       (article_id, from_stage, to_stage, agent, notes, transitioned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    transStmt.run(id, null, 1, 'dashboard', 'New idea created', now);

    return this.getArticle(id)!;
  }

  // ── Pinned agents (article_panels) ────────────────────────────────────────

  /** Pin an expert agent to an article's panel. */
  pinAgent(articleId: string, agentName: string, role?: string): void {
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO article_panels (article_id, agent_name, role)
       VALUES (?, ?, ?)`,
    );
    stmt.run(articleId, agentName, role ?? null);
  }

  /** Get all pinned agents for an article. */
  getPinnedAgents(articleId: string): Array<{ agent_name: string; role: string | null }> {
    const stmt = this.db.prepare(
      'SELECT agent_name, role FROM article_panels WHERE article_id = ? ORDER BY id',
    );
    return stmt.all(articleId) as Array<{ agent_name: string; role: string | null }>;
  }

  /** Remove a pinned agent from an article. */
  unpinAgent(articleId: string, agentName: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM article_panels WHERE article_id = ? AND agent_name = ?',
    );
    stmt.run(articleId, agentName);
  }

  // ── Charter History ───────────────────────────────────────────────────────

  /** Save a snapshot of charter content before an edit. */
  insertCharterHistory(agentName: string, content: string): void {
    this.db.prepare(
      `INSERT INTO charter_history (agent_name, content) VALUES (?, ?)`,
    ).run(agentName, content);
  }

  /** Get charter edit history (JSON-friendly: id, edited_at, content_length). */
  getCharterHistorySummary(agentName: string, limit = 20): Array<{ id: number; edited_at: string; content_length: number }> {
    return this.db.prepare(
      `SELECT id, edited_at, length(content) as content_length FROM charter_history WHERE agent_name = ? ORDER BY edited_at DESC LIMIT ?`,
    ).all(agentName, limit) as Array<{ id: number; edited_at: string; content_length: number }>;
  }

  /** Get charter edit history with full content. */
  getCharterHistory(agentName: string, limit = 10): Array<{ id: number; edited_at: string; content: string }> {
    return this.db.prepare(
      `SELECT id, edited_at, content FROM charter_history WHERE agent_name = ? ORDER BY edited_at DESC LIMIT ?`,
    ).all(agentName, limit) as Array<{ id: number; edited_at: string; content: string }>;
  }

  // ── Archive / Delete ────────────────────────────────────────────────────────

  /** Soft-archive an article (works from any stage). */
  archiveArticle(articleId: string): Article {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }
    const stmt = this.db.prepare(
      'UPDATE articles SET status = ?, updated_at = ? WHERE id = ?',
    );
    stmt.run('archived', nowISO(), articleId);
    return this.getArticle(articleId)!;
  }

  /** Restore an archived article to a status matching its current stage. */
  unarchiveArticle(articleId: string): Article {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }
    if (article.status !== 'archived') {
      throw new Error(`Article '${articleId}' is not archived (status=${article.status})`);
    }

    const STATUS_BY_STAGE: Record<number, ArticleStatus> = {
      1: 'proposed',
      2: 'in_production',
      3: 'in_production',
      4: 'in_discussion',
      5: 'in_production',
      6: 'in_production',
      7: 'in_production',
      8: 'published',
    };
    const restored = STATUS_BY_STAGE[article.current_stage] ?? 'proposed';

    const stmt = this.db.prepare(
      'UPDATE articles SET status = ?, updated_at = ? WHERE id = ?',
    );
    stmt.run(restored, nowISO(), articleId);
    return this.getArticle(articleId)!;
  }

  /** Hard-delete an article and all related data (irreversible). */
  deleteArticle(articleId: string): { deleted: true } {
    const article = this.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found in pipeline.db`);
    }

    // Delete artifacts from the DB-backed store
    const allArtifacts = this.artifacts.list(articleId);
    for (const artifact of allArtifacts) {
      this.artifacts.delete(articleId, artifact.name);
    }

    // Delete from all related tables (no ON DELETE CASCADE in schema)
    this.db.prepare('DELETE FROM usage_events WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM stage_runs WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM article_runs WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM stage_transitions WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM editor_reviews WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM publisher_pass WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM article_panels WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM notes WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM discussion_prompts WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM articles WHERE id = ?').run(articleId);

    return { deleted: true };
  }
}
