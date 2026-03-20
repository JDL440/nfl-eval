/**
 * artifact-store.ts — DB-backed artifact storage.
 *
 * Replaces filesystem reads/writes for pipeline artifacts.
 * Single source of truth: artifacts table in pipeline.db.
 */

import { DatabaseSync } from 'node:sqlite';

export interface Artifact {
  article_id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export class ArtifactStore {
  constructor(private db: DatabaseSync) {}

  /** Get artifact content. Returns null if not found. */
  get(articleId: string, name: string): string | null {
    const stmt = this.db.prepare(
      'SELECT content FROM artifacts WHERE article_id = ? AND name = ?',
    );
    const row = stmt.get(articleId, name) as { content: string } | undefined;
    return row?.content ?? null;
  }

  /** Check if artifact exists and is non-empty. */
  exists(articleId: string, name: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM artifacts WHERE article_id = ? AND name = ? AND length(content) > 0',
    );
    return stmt.get(articleId, name) != null;
  }

  /** Write or update an artifact. */
  put(articleId: string, name: string, content: string): void {
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    const stmt = this.db.prepare(
      `INSERT INTO artifacts (article_id, name, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(article_id, name)
       DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    );
    stmt.run(articleId, name, content, now, now);
  }

  /** Delete an artifact. */
  delete(articleId: string, name: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM artifacts WHERE article_id = ? AND name = ?',
    );
    stmt.run(articleId, name);
  }

  /** List all artifacts for an article. */
  list(articleId: string): Artifact[] {
    const stmt = this.db.prepare(
      'SELECT * FROM artifacts WHERE article_id = ? ORDER BY name',
    );
    return stmt.all(articleId) as unknown as Artifact[];
  }

  /** Get word count of an artifact. Returns 0 if not found. */
  wordCount(articleId: string, name: string): number {
    const content = this.get(articleId, name);
    if (!content) return 0;
    return content.split(/\s+/).filter(Boolean).length;
  }
}
