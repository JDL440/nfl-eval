#!/usr/bin/env node
/**
 * cli.ts — Unified CLI entry point for the NFL Content Intelligence Platform v2.
 *
 * Commands:
 *   (no args / "serve")  → Start dashboard server
 *   "init"               → Initialize data directory
 *   "migrate"            → Run v1→v2 migration
 *   "status"             → Print pipeline summary to console
 *   "advance <id>"       → Advance single article
 *   "batch [stage]"      → Run batch advancement
 *   "mcp"                → Start MCP server (stdio)
 *   "help"               → Print usage
 */

import { join } from 'node:path';
import { loadConfig, initDataDir, seedKnowledge } from './config/index.js';
import type { AppConfig } from './config/index.js';
import type { Stage } from './types.js';
import { VALID_STAGES } from './types.js';

// ── Usage ───────────────────────────────────────────────────────────────────

export function printUsage(): void {
  const text = `
NFL Lab v2 — Content Intelligence Platform

Usage: tsx src/cli.ts <command> [options]

Commands:
  serve, dashboard    Start the dashboard HTTP server (default)
  init                Initialize the data directory structure
  migrate             Run v1 → v2 data migration
  status              Print pipeline summary table
  advance <id>        Advance a single article to its next stage
  batch [stage]       Batch-advance eligible articles (optionally at a stage)
  export <id> [dir]   Export article artifacts to a local directory
  mcp                 Start the MCP server over stdio
  help                Show this help message

Environment:
  NFL_DATA_DIR        Data directory (default: ~/.nfl-lab)
  NFL_PORT            Dashboard port (default: 3456)
  NFL_LEAGUE          League code (default: nfl)
`.trim();
  console.log(text);
}

// ── Command handlers ────────────────────────────────────────────────────────

export async function handleServe(overrides?: Partial<{ port: number }>): Promise<void> {
  const { startServer } = await import('./dashboard/server.js');
  await startServer(overrides);
}

export async function handleInit(): Promise<void> {
  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const seeded = seedKnowledge(config.dataDir, config.league);
  console.log(`Data directory initialized: ${config.dataDir} (league: ${config.league})`);
  if (seeded.charters || seeded.skills || seeded.memory) {
    console.log(`  Seeded: ${seeded.charters} charters, ${seeded.skills} skills, ${seeded.memory} memory entries`);
  }
}

export async function handleMigrate(): Promise<void> {
  const config = loadConfig();
  const { migrate } = await import('./migration/migrate.js');
  const report = await migrate({
    v1Root: process.cwd(),
    dataDir: config.dataDir,
  });

  console.log('Migration complete:');
  console.log(`  Articles created : ${report.articlesCreated}`);
  console.log(`  Articles copied  : ${report.articlesCopied}`);
  console.log(`  Memories imported: ${report.memoriesConverted}`);
  console.log(`  Configs copied   : ${report.configsCopied}`);
  if (report.warnings.length > 0) {
    console.log(`  Warnings (${report.warnings.length}):`);
    for (const w of report.warnings) {
      console.log(`    - ${w}`);
    }
  }
  if (report.errors.length > 0) {
    console.error(`  Errors (${report.errors.length}):`);
    for (const e of report.errors) {
      console.error(`    - ${e}`);
    }
    process.exitCode = 1;
  }
}

export async function handleStatus(): Promise<void> {
  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const { Repository } = await import('./db/repository.js');
  const { PipelineEngine } = await import('./pipeline/engine.js');
  const { PipelineScheduler } = await import('./pipeline/scheduler.js');

  const repo = new Repository(config.dbPath);
  try {
    const engine = new PipelineEngine(repo);
    const scheduler = new PipelineScheduler(engine, repo);
    const summary = scheduler.summary();

    console.log('');
    console.log('Pipeline Status');
    console.log('─'.repeat(52));
    console.log(
      'Stage'.padEnd(6) +
      'Name'.padEnd(22) +
      'Count'.padEnd(8) +
      'Ready'.padEnd(8),
    );
    console.log('─'.repeat(52));

    let total = 0;
    let totalReady = 0;
    for (const s of VALID_STAGES) {
      const row = summary[s];
      total += row.count;
      totalReady += row.ready;
      console.log(
        String(s).padEnd(6) +
        row.name.padEnd(22) +
        String(row.count).padEnd(8) +
        String(row.ready).padEnd(8),
      );
    }
    console.log('─'.repeat(52));
    console.log(
      ''.padEnd(6) +
      'Total'.padEnd(22) +
      String(total).padEnd(8) +
      String(totalReady).padEnd(8),
    );
    console.log('');
  } finally {
    repo.close();
  }
}

export async function handleAdvance(articleId: string | undefined): Promise<void> {
  if (!articleId) {
    console.error('Usage: tsx src/cli.ts advance <article-id>');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const { Repository } = await import('./db/repository.js');
  const { PipelineEngine } = await import('./pipeline/engine.js');
  const { PipelineScheduler } = await import('./pipeline/scheduler.js');

  const repo = new Repository(config.dbPath);
  try {
    const engine = new PipelineEngine(repo);
    const scheduler = new PipelineScheduler(engine, repo);
    const result = await scheduler.advanceSingle(articleId, 'cli');

    if (result.success) {
      const article = repo.getArticle(articleId);
      console.log(`Advanced '${articleId}' → stage ${article?.current_stage ?? '?'}`);
    } else {
      console.error(`Failed to advance '${articleId}': ${result.error}`);
      process.exitCode = 1;
    }
  } finally {
    repo.close();
  }
}

export async function handleBatch(stageArg: string | undefined): Promise<void> {
  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const { Repository } = await import('./db/repository.js');
  const { PipelineEngine } = await import('./pipeline/engine.js');
  const { PipelineScheduler } = await import('./pipeline/scheduler.js');

  const repo = new Repository(config.dbPath);
  try {
    const engine = new PipelineEngine(repo);
    const scheduler = new PipelineScheduler(engine, repo);

    const stage= stageArg != null ? (parseInt(stageArg, 10) as Stage) : undefined;
    const result = await scheduler.advanceBatch({
      stage,
      agent: 'cli-batch',
    });

    console.log(`Batch complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`);
    for (const r of result.results) {
      const icon = r.success ? '✓' : '✗';
      console.log(`  ${icon} ${r.articleId}: ${r.fromStage} → ${r.toStage}${r.error ? ` (${r.error})` : ''}`);
    }
  } finally {
    repo.close();
  }
}

export function handleExport(articleId: string | undefined, outputDir: string | undefined): void {
  if (!articleId) {
    console.error('Usage: tsx src/cli.ts export <article-id> [output-dir]');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const { exportArticle } = require('./cli/export.js') as typeof import('./cli/export.js');

  const dir = outputDir ?? `./${articleId}`;
  const result = exportArticle({ articleId, outputDir: dir, dbPath: config.dbPath });

  console.log(`Exported ${result.exported.length} files to ${dir}`);
  for (const f of result.exported) {
    console.log(`  ✅ ${f}`);
  }
  if (result.skipped.length > 0) {
    console.log(`Skipped ${result.skipped.length} (not yet created):`);
    for (const f of result.skipped) {
      console.log(`  ⏭️  ${f}`);
    }
  }
}

export async function handleMcp(): Promise<void> {
  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const { Repository } = await import('./db/repository.js');
  const { PipelineEngine } = await import('./pipeline/engine.js');
  const { startMCPServer } = await import('./mcp/server.js');

  const repo = new Repository(config.dbPath);
  const engine = new PipelineEngine(repo);
  await startMCPServer(config, repo, engine);
}

// ── Main dispatcher ─────────────────────────────────────────────────────────

export async function run(argv: string[] = process.argv): Promise<void> {
  const command = argv[2] ?? 'serve';

  switch (command) {
    case 'serve':
    case 'dashboard': {
      const portIdx = argv.indexOf('--port');
      const portOverride = portIdx >= 0 && argv[portIdx + 1] ? parseInt(argv[portIdx + 1], 10) : undefined;
      await handleServe(portOverride ? { port: portOverride } : undefined);
      break;
    }

    case 'init':
      await handleInit();
      break;

    case 'migrate':
      await handleMigrate();
      break;

    case 'status':
      await handleStatus();
      break;

    case 'advance':
      await handleAdvance(argv[3]);
      break;

    case 'batch':
      await handleBatch(argv[3]);
      break;

    case 'export':
      handleExport(argv[3], argv[4]);
      break;

    case 'mcp':
      await handleMcp();
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      console.error(`Unknown command: ${command}\n`);
      printUsage();
      process.exitCode = 1;
      break;
  }
}

// ── Direct execution ────────────────────────────────────────────────────────

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
