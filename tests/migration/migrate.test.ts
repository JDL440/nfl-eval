import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { migrate, parseHistoryMd } from '../../src/migration/migrate.js';
import { AgentMemory } from '../../src/agents/memory.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createV1Structure(root: string): void {
  // content/pipeline.db — minimal v1 database
  mkdirSync(join(root, 'content', 'articles', 'test-article'), { recursive: true });
  mkdirSync(join(root, 'content', 'images', 'test-article'), { recursive: true });
  writeFileSync(join(root, 'content', 'articles', 'test-article', 'draft.md'), '# Test Article\n');
  writeFileSync(join(root, 'content', 'images', 'test-article', 'cover.png'), 'fake-png');

  // Create v1 pipeline.db without league column
  const dbPath = join(root, 'content', 'pipeline.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      subtitle        TEXT,
      primary_team    TEXT,
      teams           TEXT,
      status          TEXT NOT NULL DEFAULT 'proposed',
      current_stage   INTEGER NOT NULL DEFAULT 1,
      discussion_path TEXT,
      article_path    TEXT,
      substack_draft_url TEXT,
      substack_url    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      published_at    TEXT,
      depth_level     INTEGER NOT NULL DEFAULT 2,
      target_publish_date TEXT,
      publish_window  TEXT,
      time_sensitive  INTEGER NOT NULL DEFAULT 0,
      expires_at      TEXT
    )
  `);
  db.exec(`INSERT INTO articles (id, title, primary_team) VALUES ('test-article', 'Test Article', 'seahawks')`);
  db.close();

  // .squad configs
  mkdirSync(join(root, '.squad', 'config'), { recursive: true });
  writeFileSync(join(root, '.squad', 'config', 'models.json'), JSON.stringify({ default: 'gpt-4' }));

  // .squad/agents/writer
  mkdirSync(join(root, '.squad', 'agents', 'writer'), { recursive: true });
  writeFileSync(join(root, '.squad', 'agents', 'writer', 'charter.md'), '# Writer Charter\n');
  writeFileSync(
    join(root, '.squad', 'agents', 'writer', 'history.md'),
    [
      '## Session 2025-06-01',
      'Learned to always cite EPA per play.',
      '',
      '## Session 2025-06-15',
      'Decided to use bullet lists for readability.',
      '',
      '## Session 2025-07-01',
      'Improved headline structure for engagement.',
    ].join('\n'),
  );

  // .squad/agents/editor
  mkdirSync(join(root, '.squad', 'agents', 'editor'), { recursive: true });
  writeFileSync(join(root, '.squad', 'agents', 'editor', 'charter.md'), '# Editor Charter\n');

  // .squad/skills/data-analysis
  mkdirSync(join(root, '.squad', 'skills', 'data-analysis'), { recursive: true });
  writeFileSync(join(root, '.squad', 'skills', 'data-analysis', 'SKILL.md'), '# Data Analysis\n');
}

describe('parseHistoryMd', () => {
  it('parses heading-based entries', () => {
    const md = [
      '## Session 1',
      'Learned something important.',
      '',
      '## Session 2',
      'Made a decision about formatting.',
    ].join('\n');

    const entries = parseHistoryMd(md);
    expect(entries).toHaveLength(2);
    expect(entries[0].category).toBe('learning');
    expect(entries[1].category).toBe('decision');
  });

  it('parses horizontal-rule-based entries', () => {
    const md = [
      'First learning entry about EPA.',
      '---',
      'Second entry decided to use markdown tables.',
    ].join('\n');

    const entries = parseHistoryMd(md);
    expect(entries).toHaveLength(2);
    expect(entries[0].category).toBe('learning');
    expect(entries[1].category).toBe('decision');
  });

  it('returns empty for empty input', () => {
    expect(parseHistoryMd('')).toHaveLength(0);
    expect(parseHistoryMd('   ')).toHaveLength(0);
  });

  it('treats short fragments as non-entries', () => {
    const md = '## Title\nhi\n## Another\nThis is a valid entry with enough content.';
    const entries = parseHistoryMd(md);
    // 'hi' is < 10 chars, should be skipped
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some((e) => e.content.includes('valid entry'))).toBe(true);
  });

  it('detects decision category from keywords', () => {
    const md = [
      '## Entry 1',
      'We chose to prioritize engagement metrics.',
      '',
      '## Entry 2',
      'Standard learning about structure.',
    ].join('\n');
    const entries = parseHistoryMd(md);
    expect(entries[0].category).toBe('decision');
    expect(entries[1].category).toBe('learning');
  });
});

describe('migrate', () => {
  let v1Root: string;
  let dataDir: string;

  beforeEach(() => {
    v1Root = mkdtempSync(join(tmpdir(), 'nfl-v1-'));
    dataDir = mkdtempSync(join(tmpdir(), 'nfl-v2-data-'));
  });

  afterEach(() => {
    rmSync(v1Root, { recursive: true, force: true });
    rmSync(dataDir, { recursive: true, force: true });
  });

  // ── Dry run ─────────────────────────────────────────────────────────────────

  it('dry run reports actions without executing', async () => {
    createV1Structure(v1Root);

    const report = await migrate({
      v1Root,
      dataDir,
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.articlesCopied).toBeGreaterThan(0);
    expect(report.memoriesConverted).toBeGreaterThan(0);
    expect(report.configsCopied).toBeGreaterThan(0);
    expect(report.errors).toHaveLength(0);

    // Nothing should have been created in dataDir
    const destArticles = join(dataDir, 'leagues', 'nfl', 'articles', 'test-article');
    expect(existsSync(destArticles)).toBe(false);
    const destDb = join(dataDir, 'pipeline.db');
    expect(existsSync(destDb)).toBe(false);
  });

  // ── Pipeline.db migration ──────────────────────────────────────────────────

  it('pipeline.db gets league column added', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);

    const destDb = join(dataDir, 'pipeline.db');
    expect(existsSync(destDb)).toBe(true);

    const db = new DatabaseSync(destDb);
    const cols = db.prepare('PRAGMA table_info(articles)').all() as unknown as Array<{ name: string }>;
    expect(cols.some((c) => c.name === 'league')).toBe(true);

    // Verify existing row got the default league value
    const row = db.prepare('SELECT league FROM articles WHERE id = ?').get('test-article') as unknown as { league: string };
    expect(row.league).toBe('nfl');

    db.close();
  });

  it('backfills legacy article editorial columns during migration', async () => {
    createV1Structure(v1Root);
    const legacyDb = new DatabaseSync(join(v1Root, 'content', 'pipeline.db'));
    legacyDb.exec(`UPDATE articles SET depth_level = 4 WHERE id = 'test-article'`);
    legacyDb.close();

    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);

    const db = new DatabaseSync(join(dataDir, 'pipeline.db'));
    const row = db.prepare(`
      SELECT preset_id, reader_profile, article_form, panel_shape, analytics_mode
      FROM articles
      WHERE id = ?
    `).get('test-article') as unknown as {
      preset_id: string;
      reader_profile: string;
      article_form: string;
      panel_shape: string;
      analytics_mode: string;
    };
    expect(row).toEqual({
      preset_id: 'narrative_feature',
      reader_profile: 'engaged',
      article_form: 'feature',
      panel_shape: 'auto',
      analytics_mode: 'normal',
    });
    db.close();
  });

  it('recreates pipeline_board with the current schema contract', async () => {
    createV1Structure(v1Root);
    const legacyDb = new DatabaseSync(join(v1Root, 'content', 'pipeline.db'));
    legacyDb.exec(`UPDATE articles SET depth_level = 4 WHERE id = 'test-article'`);
    legacyDb.exec(`
      CREATE VIEW pipeline_board AS
      SELECT
        id,
        title,
        primary_team,
        status,
        current_stage,
        depth_level,
        CASE depth_level
          WHEN 1 THEN 'Casual Fan'
          WHEN 2 THEN 'The Beat'
          WHEN 3 THEN 'Deep Dive'
          WHEN 4 THEN 'Deep Dive'
          ELSE 'Unknown'
        END AS depth_name,
        updated_at
      FROM articles
    `);
    legacyDb.close();

    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);

    const db = new DatabaseSync(join(dataDir, 'pipeline.db'));
    const viewCols = db.prepare('PRAGMA table_info(pipeline_board)').all() as unknown as Array<{ name: string }>;
    expect(viewCols.map((col) => col.name)).toEqual(expect.arrayContaining([
      'league',
      'preset_id',
      'reader_profile',
      'article_form',
      'panel_shape',
      'analytics_mode',
      'depth_name',
    ]));
    expect(viewCols.some((col) => col.name === 'panel_constraints_json')).toBe(false);

    const row = db.prepare(`
      SELECT league, preset_id, article_form, depth_name
      FROM pipeline_board
      WHERE id = ?
    `).get('test-article') as unknown as {
      league: string;
      preset_id: string;
      article_form: string;
      depth_name: string;
    };
    expect(row).toEqual({
      league: 'nfl',
      preset_id: 'narrative_feature',
      article_form: 'feature',
      depth_name: 'Feature',
    });
    db.close();
  });

  // ── Article directories ────────────────────────────────────────────────────

  it('article directories are copied to correct location', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);

    const destArticle = join(dataDir, 'leagues', 'nfl', 'articles', 'test-article');
    expect(existsSync(destArticle)).toBe(true);
    expect(existsSync(join(destArticle, 'draft.md'))).toBe(true);

    const destImage = join(dataDir, 'leagues', 'nfl', 'images', 'test-article');
    expect(existsSync(destImage)).toBe(true);
    expect(existsSync(join(destImage, 'cover.png'))).toBe(true);
  });

  // ── Charter files ──────────────────────────────────────────────────────────

  it('charter files are copied', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);
    const writerCharter = join(dataDir, 'agents', 'charters', 'nfl', 'writer.md');
    const editorCharter = join(dataDir, 'agents', 'charters', 'nfl', 'editor.md');
    expect(existsSync(writerCharter)).toBe(true);
    expect(existsSync(editorCharter)).toBe(true);
    expect(readFileSync(writerCharter, 'utf-8')).not.toBe('# Writer Charter\n');
    expect(existsSync(join(dataDir, 'agents', 'charters', 'nfl', 'lead.md'))).toBe(true);
  });

  // ── Skill files ────────────────────────────────────────────────────────────

  it('skill files are copied', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir });

    const skillFile = join(dataDir, 'agents', 'skills', 'data-analysis.md');
    expect(existsSync(skillFile)).toBe(true);
    expect(existsSync(join(dataDir, 'agents', 'skills', 'article-lifecycle.md'))).toBe(true);
    expect(report.configsCopied).toBeGreaterThanOrEqual(1);
  });

  it('refreshes only the allowlisted core prompts after migration', async () => {
    createV1Structure(v1Root);
    mkdirSync(join(v1Root, '.squad', 'agents', 'lead'), { recursive: true });
    writeFileSync(join(v1Root, '.squad', 'agents', 'lead', 'charter.md'), '# Legacy lead prompt\n');
    mkdirSync(join(v1Root, '.squad', 'skills', 'substack-article'), { recursive: true });
    writeFileSync(join(v1Root, '.squad', 'skills', 'substack-article', 'SKILL.md'), '# Legacy substack skill\n');

    const report = await migrate({ v1Root, dataDir });

    expect(report.promptsRefreshed.updated).toEqual(expect.arrayContaining([
      'charter:lead',
      'charter:writer',
      'charter:editor',
      'skill:article-discussion',
      'skill:article-lifecycle',
      'skill:idea-generation',
      'skill:substack-article',
    ]));
    expect(readFileSync(join(dataDir, 'agents', 'charters', 'nfl', 'lead.md'), 'utf-8')).not.toBe('# Legacy lead prompt\n');
    expect(readFileSync(join(dataDir, 'agents', 'skills', 'substack-article.md'), 'utf-8')).not.toBe('# Legacy substack skill\n');
    expect(readFileSync(join(dataDir, 'agents', 'skills', 'data-analysis.md'), 'utf-8')).toBe('# Data Analysis\n');
  });

  // ── History.md conversion ──────────────────────────────────────────────────

  it('history.md conversion creates memory entries', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);
    expect(report.memoriesConverted).toBe(3); // 3 sessions in writer history.md

    // Verify memories in the database
    const memDbPath = join(dataDir, 'agents', 'memory.db');
    expect(existsSync(memDbPath)).toBe(true);

    const mem = new AgentMemory(memDbPath);
    const writerMems = mem.recall('writer', { limit: 10, includeExpired: true });
    expect(writerMems.length).toBe(3);
    expect(writerMems.some((m) => m.content.includes('EPA per play'))).toBe(true);
    expect(writerMems.some((m) => m.category === 'decision')).toBe(true);
    expect(writerMems.every((m) => m.sourceSession === 'v1-migration')).toBe(true);
    expect(writerMems.every((m) => m.expiresAt !== null)).toBe(true);
    mem.close();
  });

  // ── Missing v1 files ──────────────────────────────────────────────────────

  it('handles missing v1 files gracefully', async () => {
    // v1Root exists but has no content
    const report = await migrate({ v1Root, dataDir });

    expect(report.errors).toHaveLength(0);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.articlesCopied).toBe(0);
    expect(report.memoriesConverted).toBe(0);
  });

  // ── Idempotent ─────────────────────────────────────────────────────────────

  it('running twice does not duplicate', async () => {
    createV1Structure(v1Root);

    const report1 = await migrate({ v1Root, dataDir });
    expect(report1.errors).toHaveLength(0);

    const report2 = await migrate({ v1Root, dataDir });
    expect(report2.errors).toHaveLength(0);

    // Second run should not copy articles again
    expect(report2.articlesCopied).toBe(0);

    // Memories should not be duplicated
    const memDbPath = join(dataDir, 'agents', 'memory.db');
    const mem = new AgentMemory(memDbPath);
    const writerMems = mem.recall('writer', { limit: 100, includeExpired: true });
    expect(writerMems.length).toBe(3); // Still only 3, not 6
    mem.close();
  });

  // ── Skip flags ─────────────────────────────────────────────────────────────

  it('respects skipArticles flag', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir, skipArticles: true });

    expect(report.articlesCopied).toBe(0);
    const destArticle = join(dataDir, 'leagues', 'nfl', 'articles', 'test-article');
    expect(existsSync(destArticle)).toBe(false);
  });

  it('respects skipMemory flag', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir, skipMemory: true });

    expect(report.memoriesConverted).toBe(0);
  });

  // ── Custom league ──────────────────────────────────────────────────────────

  it('supports custom league parameter', async () => {
    createV1Structure(v1Root);

    const report = await migrate({ v1Root, dataDir, league: 'nba' });

    expect(report.errors).toHaveLength(0);

    // Articles should be under leagues/nba/
    const destArticle = join(dataDir, 'leagues', 'nba', 'articles', 'test-article');
    expect(existsSync(destArticle)).toBe(true);

    // DB should have league = 'nba'
    const db = new DatabaseSync(join(dataDir, 'pipeline.db'));
    const row = db.prepare('SELECT league FROM articles WHERE id = ?').get('test-article') as unknown as { league: string };
    expect(row.league).toBe('nba');
    db.close();
  });
});
