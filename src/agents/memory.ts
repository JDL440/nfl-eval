/**
 * memory.ts — Structured agent memory storage.
 *
 * Replaces per-agent history.md files with a single SQLite database
 * for learnings, decisions, preferences, domain knowledge, and error patterns.
 * Uses the built-in `node:sqlite` module (Node 22+).
 */

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: number;
  agentName: string;
  category: 'learning' | 'decision' | 'preference' | 'domain_knowledge' | 'error_pattern';
  content: string;
  sourceSession: string | null;
  createdAt: string;
  expiresAt: string | null;
  relevanceScore: number;
  accessCount: number;
}

export type MemoryCategory = MemoryEntry['category'];

interface StoreParams {
  agentName: string;
  category: MemoryCategory;
  content: string;
  sourceSession?: string;
  expiresAt?: string;
  relevanceScore?: number;
}

interface RecallOptions {
  category?: MemoryCategory;
  limit?: number;
  minRelevance?: number;
  includeExpired?: boolean;
}

interface GlobalRecallOptions {
  category?: MemoryCategory;
  limit?: number;
  search?: string;
}

interface PruneOptions {
  maxAge?: number;
  minRelevance?: number;
}

interface AgentStats {
  agentName: string;
  count: number;
  avgRelevance: number;
}

// ── Row shape from SQLite ────────────────────────────────────────────────────

interface MemoryRow {
  id: number;
  agent_name: string;
  category: string;
  content: string;
  source_session: string | null;
  created_at: string;
  expires_at: string | null;
  relevance_score: number;
  access_count: number;
}

function rowToEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    agentName: row.agent_name,
    category: row.category as MemoryCategory,
    content: row.content,
    sourceSession: row.source_session,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    relevanceScore: row.relevance_score,
    accessCount: row.access_count,
  };
}

// ── AgentMemory ──────────────────────────────────────────────────────────────

export class AgentMemory {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    const schemaPath = join(__dirname, 'memory-schema.sql');
    const sql = readFileSync(schemaPath, 'utf-8');
    this.db.exec(sql);
  }

  /** Store a new memory. Returns the new row id. */
  store(entry: StoreParams): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (agent_name, category, content, source_session, expires_at, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.agentName,
      entry.category,
      entry.content,
      entry.sourceSession ?? null,
      entry.expiresAt ?? null,
      entry.relevanceScore ?? 1.0,
    );
    return Number(result.lastInsertRowid);
  }

  /** Recall memories for a specific agent. */
  recall(agentName: string, options?: RecallOptions): MemoryEntry[] {
    const limit = options?.limit ?? 20;
    const minRelevance = options?.minRelevance ?? 0.0;
    const includeExpired = options?.includeExpired ?? false;

    const clauses: string[] = ['agent_name = ?'];
    const params: SQLInputValue[] = [agentName];

    if (options?.category) {
      clauses.push('category = ?');
      params.push(options.category);
    }

    clauses.push('relevance_score >= ?');
    params.push(minRelevance);

    if (!includeExpired) {
      clauses.push('(expires_at IS NULL OR expires_at >= datetime(\'now\'))');
    }

    const sql = `
      SELECT * FROM agent_memory
      WHERE ${clauses.join(' AND ')}
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT ?
    `;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as unknown as MemoryRow[];
    return rows.map(rowToEntry);
  }

  /** Recall across all agents. */
  recallGlobal(options?: GlobalRecallOptions): MemoryEntry[] {
    const limit = options?.limit ?? 20;
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];

    if (options?.category) {
      clauses.push('category = ?');
      params.push(options.category);
    }

    if (options?.search) {
      clauses.push('content LIKE ?');
      params.push(`%${options.search}%`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM agent_memory
      ${where}
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT ?
    `;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as unknown as MemoryRow[];
    return rows.map(rowToEntry);
  }

  /** Boost relevance when a memory is accessed/useful. */
  touch(id: number, boost?: number): void {
    const b = boost ?? 0.1;
    const stmt = this.db.prepare(`
      UPDATE agent_memory
      SET relevance_score = MIN(relevance_score + ?, 2.0),
          access_count = access_count + 1
      WHERE id = ?
    `);
    stmt.run(b, id);
  }

  /** Decay old memories by reducing relevance by a multiplicative factor. Returns count affected. */
  decay(agentName: string, factor?: number): number {
    const f = factor ?? 0.95;
    const stmt = this.db.prepare(`
      UPDATE agent_memory
      SET relevance_score = relevance_score * ?
      WHERE agent_name = ?
    `);
    const result = stmt.run(f, agentName);
    return Number(result.changes);
  }

  /** Prune expired or low-relevance memories. Returns count deleted. */
  prune(options?: PruneOptions): number {
    const maxAge = options?.maxAge ?? 90;
    const minRelevance = options?.minRelevance ?? 0.1;

    const stmt = this.db.prepare(`
      DELETE FROM agent_memory
      WHERE (expires_at IS NOT NULL AND expires_at < datetime('now'))
         OR relevance_score < ?
         OR created_at < datetime('now', ? || ' days')
    `);
    const result = stmt.run(minRelevance, `-${maxAge}`);
    return Number(result.changes);
  }

  /** Get memory stats per agent. */
  stats(): AgentStats[] {
    const stmt = this.db.prepare(`
      SELECT agent_name, COUNT(*) as count, AVG(relevance_score) as avg_relevance
      FROM agent_memory
      GROUP BY agent_name
      ORDER BY count DESC
    `);
    const rows = stmt.all() as unknown as Array<{ agent_name: string; count: number; avg_relevance: number }>;
    return rows.map((r) => ({
      agentName: r.agent_name,
      count: Number(r.count),
      avgRelevance: r.avg_relevance,
    }));
  }

  close(): void {
    this.db.close();
  }
}
