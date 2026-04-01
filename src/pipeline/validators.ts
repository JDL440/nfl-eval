/**
 * validators.ts — Deterministic post-draft validation against nflverse data.
 *
 * Extends the validatePlayerMentions() pattern from roster-context.ts with
 * additional validators that cross-reference statistical and draft claims
 * in article text against actual nflverse data.
 *
 * Each validator returns an array of ValidationResult objects that can be
 * surfaced as pre-publish warnings alongside the existing roster validation.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getGlobalCache, DEFAULT_TTL,
  playerStatsCacheKey, draftHistoryCacheKey,
} from '../cache/index.js';
import type { ExtractedClaims } from './claim-extractor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  claim: string;
  verified: boolean;
  actual: string;
  source: string;
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

function currentSeason(league: string = 'nfl'): number {
  const now = new Date();
  switch (league) {
    case 'mlb':
      return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    default: // nfl
      return now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
  }
}

// ---------------------------------------------------------------------------
// Stat validation
// ---------------------------------------------------------------------------

interface PlayerStatData {
  player_display_name?: string;
  passing_yards?: number;
  rushing_yards?: number;
  receiving_yards?: number;
  completions?: number;
  attempts?: number;
  passing_epa?: number;
  rushing_epa?: number;
  receiving_epa?: number;
  passing_tds?: number;
  rushing_tds?: number;
  receiving_tds?: number;
  interceptions?: number;
  sacks?: number;
  targets?: number;
  receptions?: number;
  [key: string]: unknown;
}

function lookupPlayerStatsJson(player: string, season: number): PlayerStatData | null {
  const cache = getGlobalCache();
  const key = playerStatsCacheKey(player, season);
  return cache.getOrFetch<PlayerStatData>(key, () => {
    const raw = runPythonQuery('query_player_epa.py', [
      '--player', player,
      '--season', String(season),
    ]);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // The script may return an array or an object
      if (Array.isArray(parsed)) return parsed[0] ?? null;
      return parsed as PlayerStatData;
    } catch {
      return null;
    }
  }, DEFAULT_TTL.playerStats ?? 3600);
}

/** Map claim metrics to data-source stat field extractors, per league. */
function getMetricMap(league: string): Record<string, (d: PlayerStatData) => number | undefined> {
  switch (league) {
    case 'mlb':
      // TODO: Phase 3 — map to Statcast/FanGraphs fields
      return {};
    default: // nfl
      return {
        'passing_yards': d => d.passing_yards,
        'rushing_yards': d => d.rushing_yards,
        'receiving_yards': d => d.receiving_yards,
        'touchdowns': d => {
          const p = d.passing_tds ?? 0;
          const ru = d.rushing_tds ?? 0;
          const re = d.receiving_tds ?? 0;
          return p + ru + re;
        },
        'interceptions': d => d.interceptions,
        'sacks': d => d.sacks,
        'EPA': d => d.passing_epa ?? d.rushing_epa ?? d.receiving_epa,
        'completion_pct': d => {
          if (d.completions != null && d.attempts != null && d.attempts > 0) {
            return (d.completions / d.attempts) * 100;
          }
          return undefined;
        },
        'cpoe': d => d.passing_epa, // Approximate — CPOE isn't directly in basic stats
        'target_share': d => {
          // target_share is usually a team-relative metric, not available in basic player stats
          return undefined;
        },
        'passer_rating': d => {
          // Passer rating needs calculation — skip for now, flag as unverifiable
          return undefined;
        },
        'tackles': d => d.tackles as number | undefined,
        'success_rate': d => undefined, // Team-level metric
      };
  }
}

/**
 * Cross-reference statistical claims against league data source.
 * Returns a validation result for each claim where data is available.
 */
export function validateStatClaims(claims: ExtractedClaims, league: string = 'nfl'): ValidationResult[] {
  const season = currentSeason(league);
  const dataSource = league === 'nfl' ? 'nflverse' : league;
  const metricMap = getMetricMap(league);
  const results: ValidationResult[] = [];

  for (const claim of claims.statClaims) {
    const stats = lookupPlayerStatsJson(claim.player, season);
    if (!stats) {
      results.push({
        claim: `${claim.player}: ${claim.metric} = ${claim.value}`,
        verified: false,
        actual: `No ${dataSource} data found`,
        source: 'query_player_epa.py',
      });
      continue;
    }

    const extractor = metricMap[claim.metric];
    if (!extractor) {
      results.push({
        claim: `${claim.player}: ${claim.metric} = ${claim.value}`,
        verified: false,
        actual: `Metric '${claim.metric}' not available for deterministic check`,
        source: 'query_player_epa.py',
      });
      continue;
    }

    const actualValue = extractor(stats);
    if (actualValue === undefined) {
      results.push({
        claim: `${claim.player}: ${claim.metric} = ${claim.value}`,
        verified: false,
        actual: 'Metric not available in player data',
        source: 'query_player_epa.py',
      });
      continue;
    }

    const claimedNumeric = parseFloat(claim.value.replace(/,/g, ''));
    const tolerance = Math.abs(actualValue) * 0.1 || 5; // 10% tolerance or ±5
    const isClose = Math.abs(claimedNumeric - actualValue) <= tolerance;

    results.push({
      claim: `${claim.player}: ${claim.metric} = ${claim.value}`,
      verified: isClose,
      actual: `${dataSource}: ${actualValue}`,
      source: 'query_player_epa.py',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Draft validation
// ---------------------------------------------------------------------------

interface DraftData {
  player_name?: string;
  pfr_player_name?: string;
  round?: number;
  pick?: number;
  season?: number;
  team?: string;
  [key: string]: unknown;
}

function lookupDraftData(player: string): DraftData | null {
  const cache = getGlobalCache();
  const key = draftHistoryCacheKey([player.toLowerCase()]);
  return cache.getOrFetch<DraftData>(key, () => {
    const raw = runPythonQuery('query_draft_value.py', [
      '--player', player,
    ]);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed[0] ?? null;
      return parsed as DraftData;
    } catch {
      return null;
    }
  }, DEFAULT_TTL.draftHistory);
}

/**
 * Verify draft claims (pick number, round, year) against draft history data.
 */
export function validateDraftClaims(claims: ExtractedClaims, league: string = 'nfl'): ValidationResult[] {
  const dataSource = league === 'nfl' ? 'nflverse' : league;
  const results: ValidationResult[] = [];

  for (const claim of claims.draftClaims) {
    const draft = lookupDraftData(claim.player);
    if (!draft) {
      results.push({
        claim: claim.raw,
        verified: false,
        actual: `No draft data found in ${dataSource}`,
        source: 'query_draft_value.py',
      });
      continue;
    }

    const mismatches: string[] = [];

    if (claim.round != null && draft.round != null && claim.round !== draft.round) {
      mismatches.push(`round: claimed ${claim.round}, actual ${draft.round}`);
    }
    if (claim.pick != null && draft.pick != null && claim.pick !== draft.pick) {
      mismatches.push(`pick: claimed ${claim.pick}, actual ${draft.pick}`);
    }
    if (claim.year != null && draft.season != null && claim.year !== draft.season) {
      mismatches.push(`year: claimed ${claim.year}, actual ${draft.season}`);
    }

    const actualParts: string[] = [];
    if (draft.round) actualParts.push(`round ${draft.round}`);
    if (draft.pick) actualParts.push(`pick ${draft.pick}`);
    if (draft.season) actualParts.push(`${draft.season} draft`);
    if (draft.team) actualParts.push(`by ${draft.team}`);

    results.push({
      claim: claim.raw,
      verified: mismatches.length === 0,
      actual: mismatches.length > 0
        ? `MISMATCH: ${mismatches.join('; ')} (${dataSource}: ${actualParts.join(', ')})`
        : `Confirmed: ${actualParts.join(', ')}`,
      source: 'query_draft_value.py',
    });
  }

  return results;
}

/**
 * Build a markdown validation report from stat and draft validation results.
 */
export function buildValidationReport(
  statResults: ValidationResult[],
  draftResults: ValidationResult[],
  league: string = 'nfl',
): string {
  const dataSource = league === 'nfl' ? 'nflverse' : league;
  const lines: string[] = ['## Pre-Publish Fact Validation', ''];

  const allResults = [...statResults, ...draftResults];
  const verified = allResults.filter(r => r.verified);
  const flagged = allResults.filter(r => !r.verified);

  if (flagged.length > 0) {
    lines.push('### ⚠️ Flagged Claims');
    for (const r of flagged) {
      const icon = r.actual.includes('MISMATCH') ? '🔴' : '⚠️';
      lines.push(`- ${icon} **${r.claim}** — ${r.actual} *(${r.source})*`);
    }
    lines.push('');
  }

  if (verified.length > 0) {
    lines.push('### ✅ Verified Claims');
    for (const r of verified) {
      lines.push(`- ✅ **${r.claim}** — ${r.actual}`);
    }
    lines.push('');
  }

  if (allResults.length === 0) {
    lines.push('*No verifiable statistical or draft claims found in the article.*');
    lines.push('');
  }

  lines.push(`*${verified.length}/${allResults.length} claims verified against ${dataSource} data.*`);

  return lines.join('\n');
}
