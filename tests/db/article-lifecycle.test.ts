import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Repository } from '../../src/db/repository.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Article lifecycle (archive / delete)', () => {
  let repo: Repository;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-lab-lifecycle-test-'));
    dbPath = join(tempDir, 'test-pipeline.db');
    repo = new Repository(dbPath);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Archive ─────────────────────────────────────────────────────────────────

  describe('archiveArticle', () => {
    it('sets status to archived', () => {
      repo.createArticle({ id: 'arch-1', title: 'Archive Me' });
      const updated = repo.archiveArticle('arch-1');
      expect(updated.status).toBe('archived');
    });

    it('works from any stage', () => {
      repo.createArticle({ id: 'arch-s3', title: 'Stage 3' });
      repo.advanceStage('arch-s3', 1, 2, 'agent');
      repo.advanceStage('arch-s3', 2, 3, 'agent');
      const updated = repo.archiveArticle('arch-s3');
      expect(updated.status).toBe('archived');
      expect(updated.current_stage).toBe(3);
    });

    it('throws for missing article', () => {
      expect(() => repo.archiveArticle('nonexistent')).toThrow('not found');
    });
  });

  // ── Unarchive ───────────────────────────────────────────────────────────────

  describe('unarchiveArticle', () => {
    it('restores status based on current stage', () => {
      repo.createArticle({ id: 'ua-1', title: 'Unarchive Me' });
      repo.archiveArticle('ua-1');
      const restored = repo.unarchiveArticle('ua-1');
      expect(restored.status).toBe('proposed'); // stage 1 → proposed
    });

    it('restores in_production for mid-pipeline stages', () => {
      repo.createArticle({ id: 'ua-mid', title: 'Mid Pipeline' });
      repo.advanceStage('ua-mid', 1, 2, 'agent');
      repo.archiveArticle('ua-mid');
      const restored = repo.unarchiveArticle('ua-mid');
      expect(restored.status).toBe('in_production');
    });

    it('throws for non-archived article', () => {
      repo.createArticle({ id: 'ua-err', title: 'Not Archived' });
      expect(() => repo.unarchiveArticle('ua-err')).toThrow('not archived');
    });

    it('throws for missing article', () => {
      expect(() => repo.unarchiveArticle('nonexistent')).toThrow('not found');
    });
  });

  // ── Archive → Unarchive round-trip ──────────────────────────────────────────

  describe('archive → unarchive round-trip', () => {
    it('returns article to a usable status', () => {
      repo.createArticle({ id: 'rt-1', title: 'Round Trip' });
      repo.advanceStage('rt-1', 1, 2, 'agent');

      expect(repo.getArticle('rt-1')!.status).not.toBe('archived');

      repo.archiveArticle('rt-1');
      expect(repo.getArticle('rt-1')!.status).toBe('archived');

      repo.unarchiveArticle('rt-1');
      const final = repo.getArticle('rt-1')!;
      expect(final.status).not.toBe('archived');
      expect(final.status).toBe('in_production');
      expect(final.current_stage).toBe(2);
    });
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  describe('deleteArticle', () => {
    it('removes article from database', () => {
      repo.createArticle({ id: 'del-1', title: 'Delete Me' });
      const result = repo.deleteArticle('del-1');
      expect(result).toEqual({ deleted: true });
      expect(repo.getArticle('del-1')).toBeNull();
    });

    it('removes all related data', () => {
      repo.createArticle({ id: 'del-rel', title: 'Related Data' });

      // Create related records
      const runId = repo.startArticleRun('del-rel', 'test', 'agent');
      repo.finishArticleRun(runId, 'completed');

      repo.startStageRun({
        articleId: 'del-rel',
        stage: 1,
        surface: 'test',
        actor: 'test-agent',
      });

      repo.advanceStage('del-rel', 1, 2, 'agent');

      // Verify related data exists
      expect(repo.getStageTransitions('del-rel').length).toBeGreaterThan(0);

      repo.deleteArticle('del-rel');
      expect(repo.getArticle('del-rel')).toBeNull();
      expect(repo.getStageTransitions('del-rel')).toHaveLength(0);
    });

    it('cleans up artifact files', () => {
      repo.createArticle({ id: 'del-art', title: 'With Artifacts' });
      repo.artifacts.put('del-art', 'idea.md', '# Test idea');
      repo.artifacts.put('del-art', 'draft.md', '# Test draft');

      // Verify artifacts exist
      expect(repo.artifacts.list('del-art')).toHaveLength(2);

      repo.deleteArticle('del-art');

      // Artifacts should be gone
      expect(repo.artifacts.list('del-art')).toHaveLength(0);
    });

    it('throws for missing article', () => {
      expect(() => repo.deleteArticle('nonexistent')).toThrow('not found');
    });
  });

  // ── listArticles filtering ──────────────────────────────────────────────────

  describe('listArticles excludeArchived', () => {
    it('excludes archived articles when excludeArchived is true', () => {
      repo.createArticle({ id: 'vis-1', title: 'Visible' });
      repo.createArticle({ id: 'hid-1', title: 'Hidden' });
      repo.archiveArticle('hid-1');

      const all = repo.listArticles();
      expect(all).toHaveLength(2);

      const filtered = repo.listArticles({ excludeArchived: true });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('vis-1');
    });
  });
});
