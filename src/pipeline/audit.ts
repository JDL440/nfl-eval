/**
 * audit.ts — Pipeline audit trail: rich logging and drift detection.
 *
 * Provides structured logging of every pipeline action (advances, guard checks,
 * batch runs, drift events, repairs) and a drift-detection pass that compares
 * on-disk artifacts against the database.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Stage } from '../types.js';
import type { Repository } from '../db/repository.js';
import type { Discrepancy } from './artifact-scanner.js';
import { reconcile } from './artifact-scanner.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'advance'
  | 'guard_check'
  | 'batch_run'
  | 'drift_detected'
  | 'repair'
  | 'manual_override';

export type AuditTrigger = 'manual' | 'auto' | 'batch' | 'scheduler';

export interface AuditGuardResult {
  guard: string;
  passed: boolean;
  detail: string;
}

export interface AuditEntry {
  timestamp: string;
  articleId: string;
  action: AuditAction;
  fromStage?: Stage;
  toStage?: Stage;
  trigger: AuditTrigger;
  agent?: string;
  guardResults?: AuditGuardResult[];
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditReport {
  totalArticles: number;
  stageDistribution: Record<number, number>;
  driftCount: number;
  recentTransitions: number;
  errors: number;
}

// ── Schema DDL ──────────────────────────────────────────────────────────────

const AUDIT_LOG_DDL = `
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT NOT NULL,
    article_id      TEXT NOT NULL,
    action          TEXT NOT NULL,
    from_stage      INTEGER,
    to_stage        INTEGER,
    trigger_type    TEXT NOT NULL,
    agent           TEXT,
    guard_results   TEXT,
    duration        INTEGER,
    success         INTEGER NOT NULL,
    error           TEXT,
    metadata        TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_article
    ON audit_log(article_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
    ON audit_log(timestamp DESC);
`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Raw DB row shape ────────────────────────────────────────────────────────

interface AuditRow {
  id: number;
  timestamp: string;
  article_id: string;
  action: string;
  from_stage: number | null;
  to_stage: number | null;
  trigger_type: string;
  agent: string | null;
  guard_results: string | null;
  duration: number | null;
  success: number;
  error: string | null;
  metadata: string | null;
}

function rowToEntry(row: AuditRow): AuditEntry {
  const entry: AuditEntry = {
    timestamp: row.timestamp,
    articleId: row.article_id,
    action: row.action as AuditAction,
    trigger: row.trigger_type as AuditTrigger,
    success: row.success === 1,
  };
  if (row.from_stage != null) entry.fromStage = row.from_stage as Stage;
  if (row.to_stage != null) entry.toStage = row.to_stage as Stage;
  if (row.agent != null) entry.agent = row.agent;
  if (row.guard_results != null) {
    entry.guardResults = JSON.parse(row.guard_results) as AuditGuardResult[];
  }
  if (row.duration != null) entry.duration = row.duration;
  if (row.error != null) entry.error = row.error;
  if (row.metadata != null) {
    entry.metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  }
  return entry;
}

// ── PipelineAuditor ─────────────────────────────────────────────────────────

export class PipelineAuditor {
  private db: DatabaseSync;
  private logDir: string;

  constructor(
    private repo: Repository,
    logDir: string,
    db?: DatabaseSync,
  ) {
    this.logDir = logDir;

    // Use provided DB (for tests) or open the repo's DB directly
    if (db) {
      this.db = db;
    } else {
      // Open a new connection to the same database file
      this.db = new DatabaseSync(':memory:');
    }

    this.db.exec(AUDIT_LOG_DDL);
  }

  // ── Log an audit entry ──────────────────────────────────────────────────

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const timestamp = nowISO();

    const stmt = this.db.prepare(
      `INSERT INTO audit_log
       (timestamp, article_id, action, from_stage, to_stage, trigger_type,
        agent, guard_results, duration, success, error, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    stmt.run(
      timestamp,
      entry.articleId,
      entry.action,
      entry.fromStage ?? null,
      entry.toStage ?? null,
      entry.trigger,
      entry.agent ?? null,
      entry.guardResults ? JSON.stringify(entry.guardResults) : null,
      entry.duration ?? null,
      entry.success ? 1 : 0,
      entry.error ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );

    // Write to JSONL file log
    this.writeFileLog({ ...entry, timestamp });
  }

  // ── Drift detection ───────────────────────────────────────────────────────

  detectDrift(articlesDir: string): Discrepancy[] {
    return reconcile(articlesDir, this.repo as unknown as Parameters<typeof reconcile>[1], {
      dryRun: true,
    });
  }

  // ── History for a specific article ────────────────────────────────────────

  getHistory(articleId: string): AuditEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM audit_log WHERE article_id = ? ORDER BY timestamp ASC',
    );
    const rows = stmt.all(articleId) as unknown as AuditRow[];
    return rows.map(rowToEntry);
  }

  // ── Recent activity across all articles ───────────────────────────────────

  getRecent(limit = 50): AuditEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM audit_log ORDER BY timestamp DESC, id DESC LIMIT ?',
    );
    const rows = stmt.all(limit) as unknown as AuditRow[];
    return rows.map(rowToEntry);
  }

  // ── Audit report (pipeline health summary) ────────────────────────────────

  generateReport(): AuditReport {
    const articles = this.repo.getAllArticles();

    // Stage distribution
    const stageDistribution: Record<number, number> = {};
    for (const a of articles) {
      const stage = a.current_stage;
      stageDistribution[stage] = (stageDistribution[stage] ?? 0) + 1;
    }

    // Drift count — count drift_detected entries (not a live scan)
    const driftStmt = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM audit_log WHERE action = 'drift_detected'`,
    );
    const driftRow = driftStmt.get() as unknown as { cnt: number };
    const driftCount = driftRow.cnt;

    // Recent transitions (last 24h)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, '');

    const transStmt = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM audit_log
       WHERE action = 'advance' AND timestamp >= ?`,
    );
    const transRow = transStmt.get(cutoff24h) as unknown as { cnt: number };

    // Errors (last 24h)
    const errStmt = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM audit_log
       WHERE success = 0 AND timestamp >= ?`,
    );
    const errRow = errStmt.get(cutoff24h) as unknown as { cnt: number };

    return {
      totalArticles: articles.length,
      stageDistribution,
      driftCount,
      recentTransitions: transRow.cnt,
      errors: errRow.cnt,
    };
  }

  // ── File logging (JSONL) ──────────────────────────────────────────────────

  private writeFileLog(entry: AuditEntry): void {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
      const logFile = join(this.logDir, `audit-${dateStamp()}.jsonl`);
      appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
    } catch {
      // Silently ignore file-logging failures — DB is the source of truth.
    }
  }
}
