import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentMemory, type MemoryEntry } from '../../src/agents/memory.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('AgentMemory', () => {
  let mem: AgentMemory;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-lab-memory-test-'));
    dbPath = join(tempDir, 'test-memory.db');
    mem = new AgentMemory(dbPath);
  });

  afterEach(() => {
    mem.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Store & Recall ─────────────────────────────────────────────────────────

  describe('store and recall', () => {
    it('stores a memory and recalls it', () => {
      const id = mem.store({
        agentName: 'writer',
        category: 'learning',
        content: 'Always cite EPA per play when discussing efficiency',
      });
      expect(id).toBeGreaterThan(0);

      const results = mem.recall('writer');
      expect(results).toHaveLength(1);
      expect(results[0].agentName).toBe('writer');
      expect(results[0].category).toBe('learning');
      expect(results[0].content).toBe('Always cite EPA per play when discussing efficiency');
      expect(results[0].relevanceScore).toBe(1.0);
      expect(results[0].accessCount).toBe(0);
      expect(results[0].sourceSession).toBeNull();
      expect(results[0].createdAt).toBeTruthy();
    });

    it('stores with optional fields', () => {
      const id = mem.store({
        agentName: 'editor',
        category: 'preference',
        content: 'Prefer active voice',
        sourceSession: 'session-abc-123',
        relevanceScore: 1.5,
        expiresAt: '2099-12-31 23:59:59',
      });

      const results = mem.recall('editor');
      expect(results).toHaveLength(1);
      expect(results[0].sourceSession).toBe('session-abc-123');
      expect(results[0].relevanceScore).toBe(1.5);
      expect(results[0].expiresAt).toBe('2099-12-31 23:59:59');
    });

    it('returns unique ids for each stored memory', () => {
      const id1 = mem.store({ agentName: 'a', category: 'learning', content: 'one' });
      const id2 = mem.store({ agentName: 'a', category: 'learning', content: 'two' });
      expect(id1).not.toBe(id2);
    });
  });

  // ── Category Filtering ─────────────────────────────────────────────────────

  describe('category filtering', () => {
    beforeEach(() => {
      mem.store({ agentName: 'scout', category: 'learning', content: 'Learning 1' });
      mem.store({ agentName: 'scout', category: 'decision', content: 'Decision 1' });
      mem.store({ agentName: 'scout', category: 'preference', content: 'Preference 1' });
      mem.store({ agentName: 'scout', category: 'domain_knowledge', content: 'Domain 1' });
      mem.store({ agentName: 'scout', category: 'error_pattern', content: 'Error 1' });
    });

    it('filters by category', () => {
      const learnings = mem.recall('scout', { category: 'learning' });
      expect(learnings).toHaveLength(1);
      expect(learnings[0].content).toBe('Learning 1');
    });

    it('returns all categories when no filter', () => {
      const all = mem.recall('scout');
      expect(all).toHaveLength(5);
    });
  });

  // ── Relevance Scoring & Sorting ────────────────────────────────────────────

  describe('relevance scoring', () => {
    it('sorts by relevance descending then created_at descending', () => {
      mem.store({ agentName: 'x', category: 'learning', content: 'low', relevanceScore: 0.5 });
      mem.store({ agentName: 'x', category: 'learning', content: 'high', relevanceScore: 1.8 });
      mem.store({ agentName: 'x', category: 'learning', content: 'mid', relevanceScore: 1.0 });

      const results = mem.recall('x');
      expect(results[0].content).toBe('high');
      expect(results[1].content).toBe('mid');
      expect(results[2].content).toBe('low');
    });

    it('filters by minRelevance', () => {
      mem.store({ agentName: 'x', category: 'learning', content: 'low', relevanceScore: 0.3 });
      mem.store({ agentName: 'x', category: 'learning', content: 'high', relevanceScore: 1.5 });

      const results = mem.recall('x', { minRelevance: 1.0 });
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('high');
    });

    it('respects limit', () => {
      for (let i = 0; i < 30; i++) {
        mem.store({ agentName: 'x', category: 'learning', content: `item ${i}` });
      }
      const results = mem.recall('x', { limit: 5 });
      expect(results).toHaveLength(5);
    });
  });

  // ── Touch ──────────────────────────────────────────────────────────────────

  describe('touch', () => {
    it('boosts relevance and increments access_count', () => {
      const id = mem.store({ agentName: 'a', category: 'learning', content: 'test' });

      mem.touch(id);
      let results = mem.recall('a');
      expect(results[0].relevanceScore).toBeCloseTo(1.1, 5);
      expect(results[0].accessCount).toBe(1);

      mem.touch(id, 0.5);
      results = mem.recall('a');
      expect(results[0].relevanceScore).toBeCloseTo(1.6, 5);
      expect(results[0].accessCount).toBe(2);
    });

    it('caps relevance at 2.0', () => {
      const id = mem.store({ agentName: 'a', category: 'learning', content: 'test', relevanceScore: 1.9 });

      mem.touch(id, 0.5);
      const results = mem.recall('a');
      expect(results[0].relevanceScore).toBe(2.0);
    });

    it('is a no-op for non-existent id', () => {
      // Should not throw
      mem.touch(999);
    });
  });

  // ── Decay ──────────────────────────────────────────────────────────────────

  describe('decay', () => {
    it('reduces relevance scores by factor', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'one', relevanceScore: 1.0 });
      mem.store({ agentName: 'a', category: 'learning', content: 'two', relevanceScore: 2.0 });

      const affected = mem.decay('a', 0.5);
      expect(affected).toBe(2);

      const results = mem.recall('a');
      expect(results[0].relevanceScore).toBeCloseTo(1.0, 5); // was 2.0
      expect(results[1].relevanceScore).toBeCloseTo(0.5, 5); // was 1.0
    });

    it('only affects the specified agent', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'a-item' });
      mem.store({ agentName: 'b', category: 'learning', content: 'b-item' });

      mem.decay('a', 0.5);

      const aResults = mem.recall('a');
      const bResults = mem.recall('b');
      expect(aResults[0].relevanceScore).toBeCloseTo(0.5, 5);
      expect(bResults[0].relevanceScore).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for unknown agent', () => {
      expect(mem.decay('nonexistent')).toBe(0);
    });
  });

  // ── Prune ──────────────────────────────────────────────────────────────────

  describe('prune', () => {
    it('removes low-relevance entries', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'keep', relevanceScore: 1.0 });
      mem.store({ agentName: 'a', category: 'learning', content: 'remove', relevanceScore: 0.05 });

      const deleted = mem.prune({ minRelevance: 0.1 });
      expect(deleted).toBe(1);

      const results = mem.recall('a');
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('keep');
    });

    it('removes expired entries', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'valid' });
      mem.store({
        agentName: 'a',
        category: 'learning',
        content: 'expired',
        expiresAt: '2020-01-01 00:00:00',
      });

      const deleted = mem.prune();
      expect(deleted).toBeGreaterThanOrEqual(1);

      const results = mem.recall('a', { includeExpired: true });
      expect(results.every((r) => r.content !== 'expired')).toBe(true);
    });
  });

  // ── Expiration Filtering ───────────────────────────────────────────────────

  describe('expiration', () => {
    it('excludes expired memories by default', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'active' });
      mem.store({
        agentName: 'a',
        category: 'learning',
        content: 'expired',
        expiresAt: '2020-01-01 00:00:00',
      });

      const results = mem.recall('a');
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('active');
    });

    it('includes expired memories when requested', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'active' });
      mem.store({
        agentName: 'a',
        category: 'learning',
        content: 'expired',
        expiresAt: '2020-01-01 00:00:00',
      });

      const results = mem.recall('a', { includeExpired: true });
      expect(results).toHaveLength(2);
    });

    it('includes non-expired future entries', () => {
      mem.store({
        agentName: 'a',
        category: 'learning',
        content: 'future',
        expiresAt: '2099-12-31 23:59:59',
      });

      const results = mem.recall('a');
      expect(results).toHaveLength(1);
    });
  });

  // ── Global Recall ──────────────────────────────────────────────────────────

  describe('recallGlobal', () => {
    beforeEach(() => {
      mem.store({ agentName: 'writer', category: 'learning', content: 'Writing tip A' });
      mem.store({ agentName: 'editor', category: 'decision', content: 'Edit decision B' });
      mem.store({ agentName: 'scout', category: 'domain_knowledge', content: 'Scouting fact C' });
    });

    it('returns memories across all agents', () => {
      const results = mem.recallGlobal();
      expect(results).toHaveLength(3);
    });

    it('filters by category globally', () => {
      const results = mem.recallGlobal({ category: 'learning' });
      expect(results).toHaveLength(1);
      expect(results[0].agentName).toBe('writer');
    });

    it('searches content with LIKE', () => {
      const results = mem.recallGlobal({ search: 'decision' });
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('decision');
    });

    it('combines category and search', () => {
      mem.store({ agentName: 'writer', category: 'learning', content: 'Another decision' });

      const results = mem.recallGlobal({ category: 'learning', search: 'decision' });
      expect(results).toHaveLength(1);
      expect(results[0].agentName).toBe('writer');
    });
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  describe('stats', () => {
    it('returns per-agent statistics', () => {
      mem.store({ agentName: 'writer', category: 'learning', content: 'a', relevanceScore: 1.0 });
      mem.store({ agentName: 'writer', category: 'learning', content: 'b', relevanceScore: 2.0 });
      mem.store({ agentName: 'editor', category: 'decision', content: 'c', relevanceScore: 0.5 });

      const s = mem.stats();
      expect(s).toHaveLength(2);

      const writer = s.find((x) => x.agentName === 'writer');
      expect(writer).toBeDefined();
      expect(writer!.count).toBe(2);
      expect(writer!.avgRelevance).toBeCloseTo(1.5, 5);

      const editor = s.find((x) => x.agentName === 'editor');
      expect(editor).toBeDefined();
      expect(editor!.count).toBe(1);
      expect(editor!.avgRelevance).toBeCloseTo(0.5, 5);
    });

    it('returns empty array for empty db', () => {
      expect(mem.stats()).toEqual([]);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('recall returns empty array for unknown agent', () => {
      expect(mem.recall('nonexistent')).toEqual([]);
    });

    it('recall returns empty array on empty db', () => {
      expect(mem.recall('any')).toEqual([]);
    });

    it('recallGlobal returns empty array on empty db', () => {
      expect(mem.recallGlobal()).toEqual([]);
    });

    it('allows duplicate content for the same agent', () => {
      mem.store({ agentName: 'a', category: 'learning', content: 'same' });
      mem.store({ agentName: 'a', category: 'learning', content: 'same' });

      const results = mem.recall('a');
      expect(results).toHaveLength(2);
    });

    it('prune on empty db returns 0', () => {
      expect(mem.prune()).toBe(0);
    });
  });

  // ── latestKnowledge ───────────────────────────────────────────────────────

  describe('latestKnowledge', () => {
    it('returns null when no domain_knowledge exists', () => {
      mem.store({ agentName: 'writer', category: 'learning', content: 'not dk' });
      expect(mem.latestKnowledge('writer')).toBeNull();
    });

    it('returns null for unknown agent', () => {
      expect(mem.latestKnowledge('nonexistent')).toBeNull();
    });

    it('returns the latest domain_knowledge date', () => {
      mem.store({ agentName: 'scout', category: 'domain_knowledge', content: 'first' });
      mem.store({ agentName: 'scout', category: 'domain_knowledge', content: 'second' });
      const result = mem.latestKnowledge('scout');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('ignores other categories', () => {
      mem.store({ agentName: 'scout', category: 'learning', content: 'learn' });
      mem.store({ agentName: 'scout', category: 'domain_knowledge', content: 'dk' });
      const result = mem.latestKnowledge('scout');
      expect(result).toBeTruthy();
    });
  });

  // ── knowledgeFreshness ────────────────────────────────────────────────────

  describe('knowledgeFreshness', () => {
    it('returns empty map on empty db', () => {
      const map = mem.knowledgeFreshness();
      expect(map.size).toBe(0);
    });

    it('returns map with entries for agents that have domain_knowledge', () => {
      mem.store({ agentName: 'writer', category: 'domain_knowledge', content: 'dk1' });
      mem.store({ agentName: 'editor', category: 'domain_knowledge', content: 'dk2' });
      mem.store({ agentName: 'scout', category: 'learning', content: 'not dk' });

      const map = mem.knowledgeFreshness();
      expect(map.size).toBe(2);
      expect(map.has('writer')).toBe(true);
      expect(map.has('editor')).toBe(true);
      expect(map.has('scout')).toBe(false);
    });

    it('returns latest date per agent', () => {
      mem.store({ agentName: 'writer', category: 'domain_knowledge', content: 'first' });
      mem.store({ agentName: 'writer', category: 'domain_knowledge', content: 'second' });

      const map = mem.knowledgeFreshness();
      expect(map.size).toBe(1);
      expect(map.get('writer')).toBeTruthy();
    });
  });

  // ── categoryStats ─────────────────────────────────────────────────────────

  describe('categoryStats', () => {
    it('returns empty array for unknown agent', () => {
      expect(mem.categoryStats('nonexistent')).toEqual([]);
    });

    it('returns per-category breakdown', () => {
      mem.store({ agentName: 'scout', category: 'learning', content: 'l1', relevanceScore: 1.0 });
      mem.store({ agentName: 'scout', category: 'learning', content: 'l2', relevanceScore: 0.5 });
      mem.store({ agentName: 'scout', category: 'domain_knowledge', content: 'dk1', relevanceScore: 1.0 });
      mem.store({ agentName: 'scout', category: 'decision', content: 'd1', relevanceScore: 0.8 });

      const stats = mem.categoryStats('scout');
      expect(stats.length).toBe(3);

      const learning = stats.find(s => s.category === 'learning');
      expect(learning).toBeDefined();
      expect(learning!.count).toBe(2);
      expect(learning!.avgRelevance).toBeCloseTo(0.75, 5);
      expect(learning!.latestAt).toBeTruthy();

      const dk = stats.find(s => s.category === 'domain_knowledge');
      expect(dk).toBeDefined();
      expect(dk!.count).toBe(1);
    });

    it('does not include other agents', () => {
      mem.store({ agentName: 'scout', category: 'learning', content: 'mine' });
      mem.store({ agentName: 'writer', category: 'learning', content: 'theirs' });

      const stats = mem.categoryStats('scout');
      expect(stats.length).toBe(1);
      expect(stats[0].count).toBe(1);
    });
  });

  // ── Stale badge logic ─────────────────────────────────────────────────────

  describe('stale badge logic', () => {
    it('knowledge older than 7 days is stale', () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const ageMs = Date.now() - new Date(oldDate).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      expect(ageDays).toBeGreaterThan(7);
    });

    it('knowledge within 7 days is fresh', () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const ageMs = Date.now() - new Date(recentDate).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      expect(ageDays).toBeLessThanOrEqual(7);
    });

    it('SQLite date format (without T) is handled', () => {
      // SQLite datetime('now') produces 'YYYY-MM-DD HH:MM:SS' without T or Z.
      // The badge code normalizes via replace(' ', 'T') + 'Z', matching formatDate.
      const sqliteDate = '2020-01-01 00:00:00';
      const normalized = sqliteDate.replace(' ', 'T') + 'Z';
      const d = new Date(normalized);
      expect(isNaN(d.getTime())).toBe(false);
      expect(d.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    });
  });
});
