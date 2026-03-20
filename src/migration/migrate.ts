/**
 * migrate.ts — v1 → v2 data migration script.
 *
 * Moves v1 pipeline data (content/, .squad/) into the v2 $DATA_DIR structure.
 * Idempotent: safe to run multiple times without duplicating data.
 */

import {
  existsSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initDataDir } from '../config/index.js';
import { AgentMemory } from '../agents/memory.js';

// ── Public types ─────────────────────────────────────────────────────────────

export interface MigrationOptions {
  v1Root: string;
  dataDir: string;
  league?: string;
  dryRun?: boolean;
  skipArticles?: boolean;
  skipMemory?: boolean;
}

export interface MigrationReport {
  articlesCreated: number;
  articlesCopied: number;
  memoriesConverted: number;
  configsCopied: number;
  errors: string[];
  warnings: string[];
  dryRun: boolean;
}

// ── History.md parser ────────────────────────────────────────────────────────

interface ParsedMemoryEntry {
  content: string;
  category: 'learning' | 'decision';
  index: number;
}

/**
 * Parse a history.md file into individual memory entries.
 * Splits on `## ` or `### ` headings, treating each block as one entry.
 * Falls back to splitting on `---` horizontal rules if no headings found.
 */
export function parseHistoryMd(markdown: string): ParsedMemoryEntry[] {
  const entries: ParsedMemoryEntry[] = [];
  if (!markdown.trim()) return entries;

  // Try heading-based splitting first
  let blocks = splitOnPattern(markdown, /^#{2,3}\s+/m);

  // Fallback: split on horizontal rules
  if (blocks.length <= 1) {
    blocks = splitOnPattern(markdown, /^---+\s*$/m);
  }

  // If still a single block, treat the whole file as one entry
  if (blocks.length <= 1 && markdown.trim().length > 0) {
    blocks = [markdown.trim()];
  }

  for (let i = 0; i < blocks.length; i++) {
    const content = blocks[i].trim();
    if (!content || content.length < 10) continue;

    const lc = content.toLowerCase();
    const isDecision =
      lc.includes('decision') ||
      lc.includes('decided') ||
      lc.includes('chose') ||
      lc.includes('chosen');

    entries.push({
      content,
      category: isDecision ? 'decision' : 'learning',
      index: i,
    });
  }

  return entries;
}

function splitOnPattern(text: string, pattern: RegExp): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (pattern.test(line) && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks.filter((b) => b.trim().length > 0);
}

// ── Migration steps ──────────────────────────────────────────────────────────

function copyPipelineDb(
  v1Root: string,
  dataDir: string,
  league: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const src = join(v1Root, 'content', 'pipeline.db');
  const dest = join(dataDir, 'pipeline.db');

  if (!existsSync(src)) {
    report.warnings.push('pipeline.db not found at ' + src);
    return;
  }

  if (!dryRun) {
    if (!existsSync(dest)) {
      copyFileSync(src, dest);
    }

    // Add league column if it doesn't exist
    const db = new DatabaseSync(dest);
    try {
      const cols = db.prepare('PRAGMA table_info(articles)').all() as unknown as Array<{ name: string }>;
      const hasLeague = cols.some((c) => c.name === 'league');
      if (!hasLeague) {
        db.exec(`ALTER TABLE articles ADD COLUMN league TEXT NOT NULL DEFAULT '${league}'`);
        report.articlesCreated++;
      }
      // Also drop and recreate the view to include league
      db.exec('DROP VIEW IF EXISTS pipeline_board');
      db.exec(`
        CREATE VIEW IF NOT EXISTS pipeline_board AS
        SELECT
          a.id, a.title, a.primary_team,
          '${league}' as league,
          a.status, a.current_stage,
          CASE a.current_stage
            WHEN 1 THEN 'Idea Generation'
            WHEN 2 THEN 'Discussion Prompt'
            WHEN 3 THEN 'Panel Composition'
            WHEN 4 THEN 'Panel Discussion'
            WHEN 5 THEN 'Article Drafting'
            WHEN 6 THEN 'Editor Pass'
            WHEN 7 THEN 'Publisher Pass'
            WHEN 8 THEN 'Published'
            ELSE 'Unknown'
          END AS stage_name,
          a.discussion_path, a.article_path,
          a.depth_level,
          CASE a.depth_level
            WHEN 1 THEN 'Casual Fan'
            WHEN 2 THEN 'The Beat'
            WHEN 3 THEN 'Deep Dive'
            ELSE 'Unknown'
          END AS depth_name,
          a.target_publish_date, a.publish_window,
          a.time_sensitive, a.expires_at,
          a.published_at, a.updated_at
        FROM articles a
        ORDER BY
          CASE a.status
            WHEN 'in_production' THEN 1
            WHEN 'proposed'      THEN 2
            WHEN 'approved'      THEN 3
            WHEN 'published'     THEN 4
            WHEN 'archived'      THEN 5
            ELSE 6
          END,
          a.time_sensitive DESC,
          a.target_publish_date ASC NULLS LAST
      `);
    } catch (err) {
      report.errors.push(`pipeline.db migration error: ${(err as Error).message}`);
    } finally {
      db.close();
    }
  }

  report.configsCopied++;
}

function copyArticleDirs(
  v1Root: string,
  dataDir: string,
  league: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const srcDir = join(v1Root, 'content', 'articles');
  const destDir = join(dataDir, 'leagues', league, 'articles');

  if (!existsSync(srcDir)) {
    report.warnings.push('No content/articles directory found');
    return;
  }

  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dest = join(destDir, entry.name);
    if (existsSync(dest)) {
      report.warnings.push(`Article directory already exists, skipping: ${entry.name}`);
      continue;
    }
    if (!dryRun) {
      cpSync(join(srcDir, entry.name), dest, { recursive: true });
    }
    report.articlesCopied++;
  }
}

function copyImages(
  v1Root: string,
  dataDir: string,
  league: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const srcDir = join(v1Root, 'content', 'images');
  const destDir = join(dataDir, 'leagues', league, 'images');

  if (!existsSync(srcDir)) {
    report.warnings.push('No content/images directory found');
    return;
  }

  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    if (existsSync(dest)) continue;
    if (!dryRun) {
      if (entry.isDirectory()) {
        cpSync(src, dest, { recursive: true });
      } else {
        copyFileSync(src, dest);
      }
    }
    report.articlesCopied++;
  }
}

function copyConfigs(
  v1Root: string,
  dataDir: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const src = join(v1Root, '.squad', 'config', 'models.json');
  const dest = join(dataDir, 'config', 'models.json');

  if (!existsSync(src)) {
    report.warnings.push('No .squad/config/models.json found');
    return;
  }

  if (existsSync(dest)) return;

  if (!dryRun) {
    copyFileSync(src, dest);
  }
  report.configsCopied++;
}

function copyCharters(
  v1Root: string,
  dataDir: string,
  league: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const agentsDir = join(v1Root, '.squad', 'agents');
  const destDir = join(dataDir, 'agents', 'charters', league);

  if (!existsSync(agentsDir)) {
    report.warnings.push('No .squad/agents directory found');
    return;
  }

  if (!dryRun) {
    mkdirSync(destDir, { recursive: true });
  }

  const entries = readdirSync(agentsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const charterSrc = join(agentsDir, entry.name, 'charter.md');
    if (!existsSync(charterSrc)) continue;

    const dest = join(destDir, `${entry.name}.md`);
    if (existsSync(dest)) continue;

    if (!dryRun) {
      copyFileSync(charterSrc, dest);
    }
    report.configsCopied++;
  }
}

function copySkills(
  v1Root: string,
  dataDir: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const skillsDir = join(v1Root, '.squad', 'skills');
  const destDir = join(dataDir, 'agents', 'skills');

  if (!existsSync(skillsDir)) {
    report.warnings.push('No .squad/skills directory found');
    return;
  }

  if (!dryRun) {
    mkdirSync(destDir, { recursive: true });
  }

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillSrc = join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillSrc)) continue;

    const dest = join(destDir, `${entry.name}.md`);
    if (existsSync(dest)) continue;

    if (!dryRun) {
      copyFileSync(skillSrc, dest);
    }
    report.configsCopied++;
  }
}

function convertHistoryFiles(
  v1Root: string,
  dataDir: string,
  dryRun: boolean,
  report: MigrationReport,
): void {
  const agentsDir = join(v1Root, '.squad', 'agents');
  const memoryDbPath = join(dataDir, 'agents', 'memory.db');

  if (!existsSync(agentsDir)) {
    report.warnings.push('No .squad/agents directory found for history conversion');
    return;
  }

  let mem: AgentMemory | null = null;
  if (!dryRun) {
    mkdirSync(join(dataDir, 'agents'), { recursive: true });
    mem = new AgentMemory(memoryDbPath);
  }

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, '');

    const agentDirs = readdirSync(agentsDir, { withFileTypes: true });
    for (const entry of agentDirs) {
      if (!entry.isDirectory()) continue;
      const historyPath = join(agentsDir, entry.name, 'history.md');
      if (!existsSync(historyPath)) continue;

      const agentName = entry.name;
      const markdown = readFileSync(historyPath, 'utf-8');
      const parsed = parseHistoryMd(markdown);

      if (parsed.length === 0) continue;

      // Check for existing entries to maintain idempotency
      if (!dryRun && mem) {
        const existing = mem.recall(agentName, { limit: 1, includeExpired: true });
        if (existing.length > 0) {
          report.warnings.push(
            `Agent "${agentName}" already has memories, skipping history.md conversion`,
          );
          continue;
        }
      }

      for (const entry of parsed) {
        // Newer entries (higher index) get higher relevance
        const relevanceScore = 0.5 + (entry.index / Math.max(parsed.length, 1)) * 0.5;

        if (!dryRun && mem) {
          mem.store({
            agentName,
            category: entry.category,
            content: entry.content,
            sourceSession: 'v1-migration',
            expiresAt,
            relevanceScore,
          });
        }
        report.memoriesConverted++;
      }
    }
  } finally {
    mem?.close();
  }
}

// ── Main migration function ──────────────────────────────────────────────────

export async function migrate(options: MigrationOptions): Promise<MigrationReport> {
  const league = options.league ?? 'nfl';
  const dryRun = options.dryRun ?? false;

  const report: MigrationReport = {
    articlesCreated: 0,
    articlesCopied: 0,
    memoriesConverted: 0,
    configsCopied: 0,
    errors: [],
    warnings: [],
    dryRun,
  };

  // Step 1: Initialize data dir structure
  if (!dryRun) {
    initDataDir(options.dataDir);
  }

  // Step 2: Copy pipeline.db and add league column
  try {
    copyPipelineDb(options.v1Root, options.dataDir, league, dryRun, report);
  } catch (err) {
    report.errors.push(`Pipeline DB: ${(err as Error).message}`);
  }

  // Step 3: Copy article directories
  if (!options.skipArticles) {
    try {
      copyArticleDirs(options.v1Root, options.dataDir, league, dryRun, report);
    } catch (err) {
      report.errors.push(`Article dirs: ${(err as Error).message}`);
    }
  }

  // Step 4: Copy images
  if (!options.skipArticles) {
    try {
      copyImages(options.v1Root, options.dataDir, league, dryRun, report);
    } catch (err) {
      report.errors.push(`Images: ${(err as Error).message}`);
    }
  }

  // Step 5: Copy configs
  try {
    copyConfigs(options.v1Root, options.dataDir, dryRun, report);
  } catch (err) {
    report.errors.push(`Configs: ${(err as Error).message}`);
  }

  // Step 6: Copy charters
  try {
    copyCharters(options.v1Root, options.dataDir, league, dryRun, report);
  } catch (err) {
    report.errors.push(`Charters: ${(err as Error).message}`);
  }

  // Step 7: Copy skills
  try {
    copySkills(options.v1Root, options.dataDir, dryRun, report);
  } catch (err) {
    report.errors.push(`Skills: ${(err as Error).message}`);
  }

  // Step 8: Convert history.md files
  if (!options.skipMemory) {
    try {
      convertHistoryFiles(options.v1Root, options.dataDir, dryRun, report);
    } catch (err) {
      report.errors.push(`Memory conversion: ${(err as Error).message}`);
    }
  }

  return report;
}
