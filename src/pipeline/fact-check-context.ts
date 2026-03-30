/**
 * fact-check-context.ts — Build enriched fact-check context by querying
 * nflverse data against claims extracted from panel markdown.
 *
 * Follows the same architecture as roster-context.ts:
 *   - Uses Python scripts in content/data/ via execFileSync
 *   - Caches results through the global QueryCache
 *   - Builds a markdown artifact for downstream LLM consumption
 *   - Graceful degradation when data is unavailable
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getGlobalCache, DEFAULT_TTL,
  pythonQueryCacheKey, playerStatsCacheKey, draftHistoryCacheKey,
} from '../cache/index.js';
import type { ExtractedClaims, StatClaim, DraftClaim, PerformanceClaim } from './claim-extractor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FactCheckLookup {
  claim: string;
  nflverseData: string | null;
  source: string;
}

export interface FactCheckContext {
  statLookups: FactCheckLookup[];
  draftLookups: FactCheckLookup[];
  performanceLookups: FactCheckLookup[];
  raw: string;
}

// ---------------------------------------------------------------------------
// Script execution (mirrors roster-context.ts)
// ---------------------------------------------------------------------------

function findScriptDir(): string {
  const candidates = [
    join(process.cwd(), 'content', 'data'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'query_player_epa.py'))) return dir;
  }
  return join(process.cwd(), 'content', 'data');
}

function runPythonQuery(scriptName: string, args: string[]): string | null {
  const scriptDir = findScriptDir();
  const scriptPath = join(scriptDir, scriptName);

  if (!existsSync(scriptPath)) {
    return null;
  }

  try {
    const result = execFileSync('python', [scriptPath, ...args, '--format', 'json'], {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: scriptDir,
    });
    return result.trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Season helper (mirrors roster-context.ts)
// ---------------------------------------------------------------------------

function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
}

// ---------------------------------------------------------------------------
// Individual claim lookups
// ---------------------------------------------------------------------------

/** Look up player stats from nflverse. */
function lookupPlayerStats(player: string, season: number): string | null {
  const cache = getGlobalCache();
  const key = playerStatsCacheKey(player, season);
  // validators.ts shares this cache key but stores parsed objects;
  // we need a raw JSON string, so re-stringify if the cached value is an object.
  const cached = cache.get<unknown>(key);
  if (cached != null) {
    return typeof cached === 'string' ? cached : JSON.stringify(cached, null, 2);
  }
  const raw = runPythonQuery('query_player_epa.py', [
    '--player', player,
    '--season', String(season),
  ]);
  if (raw != null) {
    cache.set(key, raw, { ttlSeconds: DEFAULT_TTL.playerStats });
  }
  return raw;
}

/** Look up draft history for a player. */
function lookupDraftHistory(player: string): string | null {
  const cache = getGlobalCache();
  const key = draftHistoryCacheKey([player.toLowerCase()]);
  // validators.ts shares this cache key but stores parsed objects;
  // re-stringify if the cached value is an object.
  const cached = cache.get<unknown>(key);
  if (cached != null) {
    return typeof cached === 'string' ? cached : JSON.stringify(cached, null, 2);
  }
  const raw = runPythonQuery('query_draft_value.py', [
    '--player', player,
  ]);
  if (raw != null) {
    cache.set(key, raw, { ttlSeconds: DEFAULT_TTL.draftHistory });
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Build lookups for each claim type
// ---------------------------------------------------------------------------

function buildStatLookups(claims: StatClaim[], season: number): FactCheckLookup[] {
  const lookups: FactCheckLookup[] = [];
  const queriedPlayers = new Set<string>();

  for (const claim of claims) {
    if (queriedPlayers.has(claim.player)) continue;
    queriedPlayers.add(claim.player);

    const data = lookupPlayerStats(claim.player, season);
    lookups.push({
      claim: `${claim.player}: ${claim.metric} = ${claim.value}`,
      nflverseData: data,
      source: 'query_player_epa.py',
    });
  }

  return lookups;
}

function buildDraftLookups(claims: DraftClaim[]): FactCheckLookup[] {
  const lookups: FactCheckLookup[] = [];
  const queriedPlayers = new Set<string>();

  for (const claim of claims) {
    if (queriedPlayers.has(claim.player)) continue;
    queriedPlayers.add(claim.player);

    const data = lookupDraftHistory(claim.player);
    const claimParts = [`${claim.player}`];
    if (claim.round) claimParts.push(`round ${claim.round}`);
    if (claim.pick) claimParts.push(`pick ${claim.pick}`);
    if (claim.year) claimParts.push(`${claim.year} draft`);

    lookups.push({
      claim: claimParts.join(', '),
      nflverseData: data,
      source: 'query_draft_value.py',
    });
  }

  return lookups;
}

function buildPerformanceLookups(claims: PerformanceClaim[], season: number): FactCheckLookup[] {
  const lookups: FactCheckLookup[] = [];
  const queriedPlayers = new Set<string>();

  for (const claim of claims) {
    if (queriedPlayers.has(claim.player)) continue;
    queriedPlayers.add(claim.player);

    const data = lookupPlayerStats(claim.player, season);
    lookups.push({
      claim: claim.claim,
      nflverseData: data,
      source: 'query_player_epa.py',
    });
  }

  return lookups;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function formatLookupSection(title: string, lookups: FactCheckLookup[]): string {
  if (lookups.length === 0) return '';

  const lines: string[] = [`### ${title}`, ''];

  for (const lookup of lookups) {
    lines.push(`**Claim:** ${lookup.claim}`);
    if (lookup.nflverseData) {
      // Truncate very long JSON to keep context manageable
      const data = lookup.nflverseData.length > 2000
        ? lookup.nflverseData.slice(0, 2000) + '\n... (truncated)'
        : lookup.nflverseData;
      lines.push(`**nflverse data** (${lookup.source}):`);
      lines.push('```json');
      lines.push(data);
      lines.push('```');
    } else {
      lines.push(`*No data found in nflverse (${lookup.source})*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a fact-check context artifact from extracted claims.
 * Queries nflverse for each claim and produces a markdown document
 * with the actual data alongside each claim for LLM comparison.
 *
 * Returns null if no claims could be verified (graceful degradation).
 */
export function buildFactCheckContext(claims: ExtractedClaims): FactCheckContext | null {
  const season = currentSeason();

  const statLookups = buildStatLookups(claims.statClaims, season);
  const draftLookups = buildDraftLookups(claims.draftClaims);
  const performanceLookups = buildPerformanceLookups(claims.performanceClaims, season);

  const totalLookups = statLookups.length + draftLookups.length + performanceLookups.length;
  if (totalLookups === 0) {
    return null;
  }

  const hasAnyData = [...statLookups, ...draftLookups, ...performanceLookups]
    .some(l => l.nflverseData != null);

  const parts: string[] = [];
  parts.push('## Fact-Check Context — nflverse Verification Data');
  parts.push('');
  parts.push('> This data was queried from nflverse to verify claims in the panel discussion.');
  parts.push('> Compare each claim against the actual data below. Flag discrepancies.');
  parts.push('');

  const statSection = formatLookupSection('Statistical Claims', statLookups);
  const draftSection = formatLookupSection('Draft Claims', draftLookups);
  const perfSection = formatLookupSection('Performance/Ranking Claims', performanceLookups);

  if (statSection) parts.push(statSection);
  if (draftSection) parts.push(draftSection);
  if (perfSection) parts.push(perfSection);

  if (!hasAnyData) {
    parts.push('*No nflverse data could be retrieved for any claims. Fact-check will rely on LLM knowledge only.*');
  }

  parts.push('');
  parts.push(`*${totalLookups} claims checked against nflverse (${season} season data).*`);

  const raw = parts.join('\n');

  return { statLookups, draftLookups, performanceLookups, raw };
}

/**
 * Build fact-check context and store as an artifact.
 * Returns the context object, or null if no claims found / data unavailable.
 */
export function ensureFactCheckContext(
  repo: { artifacts: { get(id: string, name: string): string | null; put(id: string, name: string, content: string): void } },
  articleId: string,
  claims: ExtractedClaims,
  forceRefresh = false,
): FactCheckContext | null {
  const ARTIFACT_NAME = 'fact-check-context.md';

  if (!forceRefresh) {
    const cached = repo.artifacts.get(articleId, ARTIFACT_NAME);
    if (cached) {
      return { statLookups: [], draftLookups: [], performanceLookups: [], raw: cached };
    }
  }

  const context = buildFactCheckContext(claims);
  if (context) {
    repo.artifacts.put(articleId, ARTIFACT_NAME, context.raw);
  }
  return context;
}
