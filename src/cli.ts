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

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { loadConfig, initDataDir, seedKnowledge, refreshCorePromptDefaults } from './config/index.js';
import type { AppConfig } from './config/index.js';
import type {
  RetrospectiveDigestArticleEvidence,
  RetrospectiveDigestCandidate,
  RetrospectiveDigestCategory,
  RetrospectiveDigestFindingRow,
  RetrospectiveDigestPriorityCounts,
  RetrospectiveDigestReport,
  Stage,
} from './types.js';
import { VALID_STAGES } from './types.js';

// ── Usage ───────────────────────────────────────────────────────────────────

interface RetrospectiveDigestOptions {
  limit?: number;
  json?: boolean;
}

interface DigestGroup {
  key: string;
  role: string;
  findingType: string;
  normalizedText: string;
  text: string;
  articleCount: number;
  findingCount: number;
  priorityCounts: RetrospectiveDigestPriorityCounts;
  latestGeneratedAt: string;
  forceApprovedArticleCount: number;
  articles: RetrospectiveDigestArticleEvidence[];
}

function normalizeFindingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"`’‘“”]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findingHash(normalizedText: string): string {
  return createHash('sha1').update(normalizedText).digest('hex').slice(0, 12);
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function rankDigestGroup(a: DigestGroup, b: DigestGroup): number {
  return (
    b.articleCount - a.articleCount ||
    (b.priorityCounts.high ?? 0) - (a.priorityCounts.high ?? 0) ||
    (b.priorityCounts.medium ?? 0) - (a.priorityCounts.medium ?? 0) ||
    b.forceApprovedArticleCount - a.forceApprovedArticleCount ||
    b.latestGeneratedAt.localeCompare(a.latestGeneratedAt) ||
    b.findingCount - a.findingCount ||
    a.text.localeCompare(b.text)
  );
}

function toPriorityKey(priority: string | null): keyof RetrospectiveDigestPriorityCounts {
  switch ((priority ?? 'unknown').toLowerCase()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'unknown';
  }
}

function isLeadProcessImprovement(group: DigestGroup): boolean {
  return group.role === 'lead' && group.findingType === 'process_improvement';
}

function isRepeatedProcessImprovement(group: DigestGroup): boolean {
  return group.findingType === 'process_improvement' && group.articleCount >= 2;
}

function isRepeatedHighPriorityChurnOrIssue(group: DigestGroup): boolean {
  return (
    (group.findingType === 'churn_cause' || group.findingType === 'repeated_issue') &&
    group.articleCount >= 2 &&
    (group.priorityCounts.high ?? 0) > 0
  );
}

function shouldPromoteLearningUpdate(group: DigestGroup): boolean {
  const isWriterOrEditor = group.role === 'writer' || group.role === 'editor';
  if (!isWriterOrEditor) {
    return false;
  }

  return group.articleCount >= 3 || (group.priorityCounts.high ?? 0) > 0;
}

function buildProcessImprovementReasons(group: DigestGroup): string[] {
  const reasons: string[] = [];
  if (isLeadProcessImprovement(group)) {
    reasons.push('lead-authored process-improvement finding');
  }
  if (isRepeatedProcessImprovement(group)) {
    reasons.push('process-improvement finding repeated across 2+ articles');
  }
  if (isRepeatedHighPriorityChurnOrIssue(group)) {
    reasons.push('repeated high-priority churn/repeated-issue signal across 2+ articles');
  }
  return reasons;
}

function buildLearningUpdateReasons(group: DigestGroup): string[] {
  const reasons: string[] = [];
  if (group.articleCount >= 3) {
    reasons.push('writer/editor signal repeated across 3+ articles');
  }
  if (group.articleCount >= 2 && (group.priorityCounts.high ?? 0) > 0) {
    reasons.push('writer/editor signal repeated with high-priority evidence');
  } else if ((group.priorityCounts.high ?? 0) > 0) {
    reasons.push('high-priority writer/editor signal for manual learning review');
  }
  return reasons;
}

function buildCandidateEvidence(group: DigestGroup) {
  return {
    articleCount: group.articleCount,
    findingCount: group.findingCount,
    priorityCounts: { ...group.priorityCounts },
    forceApprovedArticleCount: group.forceApprovedArticleCount,
    latestGeneratedAt: group.latestGeneratedAt,
    sampleArticles: [...group.articles]
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .slice(0, 3),
  };
}

function buildCandidate(
  group: DigestGroup,
  kind: RetrospectiveDigestCandidate['kind'],
  promotionReasons: string[],
): RetrospectiveDigestCandidate {
  return {
    key: group.key,
    kind,
    role: group.role,
    findingType: group.findingType,
    normalizedText: group.normalizedText,
    text: group.text,
    promotionReasons,
    evidence: buildCandidateEvidence(group),
  };
}

function buildRetrospectiveDigest(rows: RetrospectiveDigestFindingRow[], retrospectiveLimit: number): RetrospectiveDigestReport {
  const articleIds = new Set<string>();
  const retrospectiveIds = new Set<number>();
  const grouped = new Map<string, DigestGroup>();

  for (const row of rows) {
    articleIds.add(row.article_id);
    retrospectiveIds.add(row.retrospective_id);

    const normalizedText = normalizeFindingText(row.finding_text);
    if (!normalizedText) continue;

    const key = `${row.role}|${row.finding_type}|${findingHash(normalizedText)}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        key,
        role: row.role,
        findingType: row.finding_type,
        normalizedText,
        text: row.finding_text.trim(),
        articleCount: 0,
        findingCount: 0,
        priorityCounts: { high: 0, medium: 0, low: 0, unknown: 0 },
        latestGeneratedAt: row.generated_at,
        forceApprovedArticleCount: 0,
        articles: [],
      };
      grouped.set(key, group);
    }

    group.findingCount += 1;
    if (row.generated_at > group.latestGeneratedAt) {
      group.latestGeneratedAt = row.generated_at;
      group.text = row.finding_text.trim();
    }

    const priorityKey = toPriorityKey(row.priority);
    group.priorityCounts[priorityKey] += 1;

    const existingArticle = group.articles.find((article) => article.articleId === row.article_id);
    const forceApprovedAfterMaxRevisions = row.force_approved_after_max_revisions === 1;
    if (existingArticle == null) {
      group.articles.push({
        articleId: row.article_id,
        title: row.article_title,
        generatedAt: row.generated_at,
        revisionCount: row.revision_count,
        priority: row.priority,
        forceApprovedAfterMaxRevisions,
      });
      group.articleCount += 1;
      if (forceApprovedAfterMaxRevisions) {
        group.forceApprovedArticleCount += 1;
      }
    } else if (row.generated_at > existingArticle.generatedAt) {
      if (existingArticle.forceApprovedAfterMaxRevisions !== forceApprovedAfterMaxRevisions) {
        group.forceApprovedArticleCount += forceApprovedAfterMaxRevisions ? 1 : -1;
      }
      existingArticle.generatedAt = row.generated_at;
      existingArticle.priority = row.priority;
      existingArticle.revisionCount = row.revision_count;
      existingArticle.forceApprovedAfterMaxRevisions = forceApprovedAfterMaxRevisions;
    }
  }

  const allGroups = [...grouped.values()].sort(rankDigestGroup);
  const processImprovements = allGroups
    .map((group) => {
      const reasons = buildProcessImprovementReasons(group);
      return reasons.length > 0 ? buildCandidate(group, 'process_improvement', reasons) : null;
    })
    .filter((candidate): candidate is RetrospectiveDigestCandidate => candidate != null)
    .slice(0, 5);

  const promotedProcessKeys = new Set(processImprovements.map((candidate) => candidate.key));
  const learningUpdates = allGroups
    .filter((group) => !promotedProcessKeys.has(group.key))
    .map((group) => {
      if (!shouldPromoteLearningUpdate(group)) {
        return null;
      }
      const reasons = buildLearningUpdateReasons(group);
      return reasons.length > 0 ? buildCandidate(group, 'learning_update', reasons) : null;
    })
    .filter((candidate): candidate is RetrospectiveDigestCandidate => candidate != null)
    .slice(0, 5);

  const categoryMap = new Map<string, RetrospectiveDigestCategory>();
  for (const group of allGroups) {
    const key = `${group.role}|${group.findingType}`;
    let category = categoryMap.get(key);
    if (!category) {
      category = {
        role: group.role,
        findingType: group.findingType,
        items: [],
      };
      categoryMap.set(key, category);
    }

    if (category.items.length < 3) {
      category.items.push(buildCandidate(group, 'learning_update', []));
    }
  }

  const categories = [...categoryMap.values()].sort((a, b) =>
    `${a.role}|${a.findingType}`.localeCompare(`${b.role}|${b.findingType}`),
  );

  return {
    generatedAt: new Date().toISOString(),
    retrospectiveLimit,
    totals: {
      retrospectives: retrospectiveIds.size,
      findings: rows.length,
      groupedFindings: allGroups.length,
      articles: articleIds.size,
    },
    candidates: {
      processImprovements,
      learningUpdates,
    },
    categories,
  };
}

function formatPriorityCounts(priorityCounts: RetrospectiveDigestPriorityCounts): string {
  const segments = (['high', 'medium', 'low'] as const)
    .filter((key) => (priorityCounts[key] ?? 0) > 0)
    .map((key) => `${key}:${priorityCounts[key]}`);
  if ((priorityCounts.unknown ?? 0) > 0 || segments.length === 0) {
    segments.push(`unknown:${priorityCounts.unknown ?? 0}`);
  }
  return segments.join(', ');
}

function formatEvidence(candidate: Pick<RetrospectiveDigestCandidate, 'evidence'>): string {
  const { evidence } = candidate;
  const sampleArticles = evidence.sampleArticles.map((article) => `${article.title} (r${article.revisionCount})`);
  const forceApproved =
    evidence.forceApprovedArticleCount > 0
      ? `; force-approved articles ${evidence.forceApprovedArticleCount}`
      : '';

  return `${evidence.articleCount} article${evidence.articleCount === 1 ? '' : 's'}; findings ${evidence.findingCount}; priorities ${formatPriorityCounts(evidence.priorityCounts)}${forceApproved}; recent ${sampleArticles.join(', ')}`;
}

function renderCandidateSection(title: string, candidates: RetrospectiveDigestCandidate[]): string[] {
  const lines = [`## ${title}`];
  if (candidates.length === 0) {
    lines.push('- None met the v1 promotion thresholds.');
    lines.push('');
    return lines;
  }

  candidates.forEach((candidate, index) => {
    lines.push(`${index + 1}. [${titleCase(candidate.role)} / ${titleCase(candidate.findingType)}] ${candidate.text}`);
    if (candidate.promotionReasons.length > 0) {
      lines.push(`   - Why promoted: ${candidate.promotionReasons.join('; ')}`);
    }
    lines.push(`   - Evidence: ${formatEvidence(candidate)}`);
    lines.push(`   - Latest signal: ${candidate.evidence.latestGeneratedAt}`);
  });
  lines.push('');
  return lines;
}

function renderRetrospectiveDigestMarkdown(report: RetrospectiveDigestReport): string {
  const lines = [
    '# Retrospective Digest',
    '',
    `Generated: ${report.generatedAt}`,
    `Scope: latest ${report.retrospectiveLimit} retrospectives (${report.totals.retrospectives} retrospectives, ${report.totals.findings} findings, ${report.totals.articles} articles)`,
    '',
    ...renderCandidateSection('Issue-ready Process Improvement Candidates', report.candidates.processImprovements),
    ...renderCandidateSection('Learning Update Candidates', report.candidates.learningUpdates),
    '## Role + Finding Type Groups',
    '',
  ];

  if (report.categories.length === 0) {
    lines.push('- No structured retrospective findings found.');
    return lines.join('\n');
  }

  for (const category of report.categories) {
    lines.push(`### ${titleCase(category.role)} / ${titleCase(category.findingType)}`);
    for (const item of category.items) {
      lines.push(`- ${item.text}`);
      lines.push(`  - Evidence: ${formatEvidence(item)}`);
      lines.push(`  - Latest signal: ${item.evidence.latestGeneratedAt}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function parseRetrospectiveDigestOptions(argv: string[]): RetrospectiveDigestOptions | null {
  const json = argv.includes('--json');
  const limitIdx = argv.indexOf('--limit');

  if (limitIdx >= 0) {
    const raw = argv[limitIdx + 1];
    const limit = raw != null ? parseInt(raw, 10) : Number.NaN;
    if (!Number.isInteger(limit) || limit < 1) {
      console.error('Usage: tsx src/cli.ts retrospective-digest [--limit <count>] [--json]');
      process.exitCode = 1;
      return null;
    }
    return { limit, json };
  }

  return { json };
}

export function printUsage(): void {
  const text = `
NFL Lab v2 — Content Intelligence Platform

Usage: tsx src/cli.ts <command> [options]

Commands:
  serve, dashboard    Start the dashboard HTTP server (default)
  init                Initialize the data directory structure
  refresh-prompts     Refresh core runtime prompts from cleaned defaults
  migrate             Run v1 → v2 data migration
  status              Print pipeline summary table
  advance <id>        Advance a single article to its next stage
  batch [stage]       Batch-advance eligible articles (optionally at a stage)
  retrospective-digest [--limit N] [--json]
                      Summarize structured retrospectives for manual review
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
  const refreshed = refreshCorePromptDefaults(config.dataDir, config.league);
  console.log(`Data directory initialized: ${config.dataDir} (league: ${config.league})`);
  if (seeded.charters || seeded.skills || seeded.memory) {
    console.log(`  Seeded: ${seeded.charters} charters, ${seeded.skills} skills, ${seeded.memory} memory entries`);
  }
  console.log(`  Refreshed core prompts: ${refreshed.charters} charters, ${refreshed.skills} skills`);
}

export async function handleRefreshPrompts(): Promise<void> {
  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const refreshed = refreshCorePromptDefaults(config.dataDir, config.league);
  console.log(`Core runtime prompts refreshed: ${config.dataDir} (league: ${config.league})`);
  console.log(`  Updated: ${refreshed.charters} charters, ${refreshed.skills} skills`);
  if (refreshed.updated.length > 0) {
    console.log(`  Files  : ${refreshed.updated.join(', ')}`);
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
  console.log(`  Prompts refreshed: ${report.promptsRefreshed.charters} charters, ${report.promptsRefreshed.skills} skills`);
  if (report.promptsRefreshed.updated.length > 0) {
    console.log(`  Prompt files     : ${report.promptsRefreshed.updated.join(', ')}`);
  }
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

export async function handleRetrospectiveDigest(options: RetrospectiveDigestOptions = {}): Promise<void> {
  const limit = options.limit ?? 25;
  const config = loadConfig();
  initDataDir(config.dataDir, config.league);
  const { Repository } = await import('./db/repository.js');

  const repo = new Repository(config.dbPath);
  try {
    const rows = repo.listRetrospectiveDigestFindings(limit);
    const report = buildRetrospectiveDigest(rows, limit);
    const output = options.json
      ? JSON.stringify(report, null, 2)
      : renderRetrospectiveDigestMarkdown(report);
    console.log(output);
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
  await startMCPServer({ config, repo, engine });
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

    case 'refresh-prompts':
      await handleRefreshPrompts();
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

    case 'retrospective-digest':
    case 'retro-digest': {
      const options = parseRetrospectiveDigestOptions(argv.slice(3));
      if (options != null) {
        await handleRetrospectiveDigest(options);
      }
      break;
    }

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
