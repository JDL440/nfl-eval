/**
 * agents.test.ts — Tests for the agent charter and skill viewer pages.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';
import { classifyCharter, extractIdentity } from '../../src/dashboard/views/agents.js';

function makeTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    dataDir: '/tmp/test',
    league: 'nfl',
    leagueConfig: {
      name: 'NFL Lab',
      panelName: 'Test Panel',
      dataSource: 'nflverse',
      positions: [],
      substackConfig: {
        labName: 'NFL Lab',
        subscribeCaption: 'Test',
        footerPatterns: [],
      },
    },
    dbPath: '/tmp/test/pipeline.db',
    articlesDir: '/tmp/test/articles',
    imagesDir: '/tmp/test/images',
    chartersDir: '/tmp/test/charters',
    skillsDir: '/tmp/test/skills',
    memoryDbPath: '/tmp/test/memory.db',
    logsDir: '/tmp/test/logs',
    port: 3456,
    env: 'development',
    ...overrides,
  };
}

describe('Agent Charter & Skill Viewer', () => {
  let repo: Repository;
  let tempDir: string;
  let chartersDir: string;
  let skillsDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-agents-test-'));
    const dbPath = join(tempDir, 'test.db');
    const articlesDir = join(tempDir, 'articles');
    chartersDir = join(tempDir, 'charters');
    skillsDir = join(tempDir, 'skills');
    mkdirSync(articlesDir, { recursive: true });
    mkdirSync(chartersDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });

    // Seed charter files
    writeFileSync(
      join(chartersDir, 'sea.md'),
      '# Seattle Seahawks Expert\n\n> The 12th man whisperer.\n\n## Responsibilities\n- Track roster\n- Analyze cap\n\n## Boundaries\n- No gambling advice\n',
    );
    writeFileSync(
      join(chartersDir, 'analytics.md'),
      '# Analytics — NFL Advanced Analytics Expert\n\n> The numbers engine.\n\n## Responsibilities\n- Own advanced analytics\n- Build comparison models\n- Draft pick value\n\n## Boundaries\n- No fabricated stats\n- No personal opinions\n',
    );
    mkdirSync(join(chartersDir, 'draft-board'), { recursive: true });
    writeFileSync(
      join(chartersDir, 'draft-board', 'charter.md'),
      '# Draft Board Specialist\n\n> Builds the big board.\n\n## Responsibilities\n- Rank prospects\n- Track archetypes\n',
    );

    // Seed skill files
    writeFileSync(
      join(skillsDir, 'fact-checking.md'),
      '# Fact-Checking Skill\n\nVerify claims against authoritative sources.\n\n## Steps\n- Cross-reference data\n- Flag unverified claims\n',
    );

    repo = new Repository(dbPath);
    app = createApp(repo, makeTestConfig({ dbPath, articlesDir, chartersDir, skillsDir }));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Listing page ──────────────────────────────────────────────────────────

  describe('GET /agents', () => {
    it('returns 200 with charter list', async () => {
      const res = await app.request('/agents');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Agent Charters');
      expect(html).toContain('sea');
      expect(html).toContain('analytics');
      expect(html).toContain('draft-board');
    });

    it('shows correct counts', async () => {
      const res = await app.request('/agents');
      const html = await res.text();
      expect(html).toContain('Charters (3)');
      expect(html).toContain('Skills (1)');
    });

    it('classifies team vs specialist charters', async () => {
      const res = await app.request('/agents');
      const html = await res.text();
      expect(html).toContain('Team Experts (1)');
      expect(html).toContain('Specialists (2)');
    });

    it('shows skill files', async () => {
      const res = await app.request('/agents');
      const html = await res.text();
      expect(html).toContain('fact-checking');
    });
  });

  // ── Charter detail ────────────────────────────────────────────────────────

  describe('GET /agents/:name', () => {
    it('returns charter content for existing charter', async () => {
      const res = await app.request('/agents/sea');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Seattle Seahawks Expert');
      expect(html).toContain('Track roster');
      expect(html).toContain('Back to Agents');
    });

    it('shows metadata badges', async () => {
      const res = await app.request('/agents/analytics');
      const html = await res.text();
      expect(html).toContain('3 responsibilities');
      expect(html).toContain('2 boundaries');
    });

    it('loads charter content from charter subdirectories', async () => {
      const res = await app.request('/agents/draft-board');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Draft Board Specialist');
      expect(html).toContain('Rank prospects');
    });

    it('returns 404 for nonexistent charter', async () => {
      const res = await app.request('/agents/nonexistent');
      expect(res.status).toBe(404);
      const html = await res.text();
      expect(html).toContain('Charter not found');
    });
  });

  // ── Skill detail ──────────────────────────────────────────────────────────

  describe('GET /agents/skills/:name', () => {
    it('returns skill content for existing skill', async () => {
      const res = await app.request('/agents/skills/fact-checking');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Fact-Checking Skill');
      expect(html).toContain('Cross-reference data');
      expect(html).toContain('Back to Agents');
    });

    it('returns 404 for nonexistent skill', async () => {
      const res = await app.request('/agents/skills/nonexistent');
      expect(res.status).toBe(404);
      const html = await res.text();
      expect(html).toContain('Skill not found');
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  describe('Navigation', () => {
    it('home page includes Agents nav link', async () => {
      const res = await app.request('/');
      const html = await res.text();
      expect(html).toContain('href="/agents"');
      expect(html).toContain('Agents');
    });
  });

  // ── Charter History ───────────────────────────────────────────────────────

  describe('Charter History', () => {
    it('records history when charter content changes', async () => {
      // First save — changes from original seed content
      const res1 = await app.request('/api/agents/sea', {
        method: 'PUT',
        body: new URLSearchParams({ content: '# Updated Charter\n\nNew content.' }),
      });
      expect(res1.status).toBe(200);

      // Verify history was recorded
      const historyRes = await app.request('/api/agents/sea/history');
      expect(historyRes.status).toBe(200);
      const rows = await historyRes.json() as Array<{ id: number; content_length: number }>;
      expect(rows.length).toBe(1);
      expect(rows[0].content_length).toBeGreaterThan(0);
    });

    it('does not record history when content is unchanged', async () => {
      // Read current content
      const original = '# Seattle Seahawks Expert\n\n> The 12th man whisperer.\n\n## Responsibilities\n- Track roster\n- Analyze cap\n\n## Boundaries\n- No gambling advice\n';

      // Save same content (whitespace-trimmed match)
      const res = await app.request('/api/agents/sea', {
        method: 'PUT',
        body: new URLSearchParams({ content: original }),
      });
      expect(res.status).toBe(200);

      // History should be empty
      const historyRes = await app.request('/api/agents/sea/history');
      const rows = await historyRes.json() as Array<{ id: number }>;
      expect(rows.length).toBe(0);
    });

    it('returns empty history via HTMX endpoint', async () => {
      const res = await app.request('/htmx/agents/sea/history');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No edit history');
    });

    it('returns history entries via HTMX after edits', async () => {
      // Make an edit
      await app.request('/api/agents/sea', {
        method: 'PUT',
        body: new URLSearchParams({ content: '# Changed\n' }),
      });

      const res = await app.request('/htmx/agents/sea/history');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('charter-history');
      expect(html).toContain('history-entry');
    });
  });

  // ── Unit tests for helpers ────────────────────────────────────────────────

  describe('classifyCharter', () => {
    it('classifies team abbreviations', () => {
      expect(classifyCharter('sea.md')).toBe('team');
      expect(classifyCharter('buf.md')).toBe('team');
      expect(classifyCharter('kc.md')).toBe('team');
    });

    it('classifies specialists', () => {
      expect(classifyCharter('analytics.md')).toBe('specialist');
      expect(classifyCharter('cap.md')).toBe('specialist');
      expect(classifyCharter('draft.md')).toBe('specialist');
    });
  });

  describe('extractIdentity', () => {
    it('extracts blockquote identity line', () => {
      const content = '# Title\n\n> The numbers engine.\n\n## Responsibilities\n';
      expect(extractIdentity(content)).toBe('The numbers engine.');
    });

    it('extracts first non-heading line', () => {
      const content = '# Title\nFirst paragraph line.\n';
      expect(extractIdentity(content)).toBe('First paragraph line.');
    });

    it('returns empty for heading-only content', () => {
      expect(extractIdentity('# Title\n')).toBe('');
    });
  });
});
