/**
 * roster-context.ts — Builds a concise current-roster context string for a
 * team by querying the **official nflverse roster** (primary) supplemented
 * with snap count data for usage context.
 *
 * The official roster includes all players (starters, backups, IR, practice
 * squad) — unlike snap counts which only show who actually played.  This
 * catches backup QBs, recent signings, and traded-away players that snap
 * counts alone would miss.
 *
 * Called at key pipeline stages: idea→prompt, factcheck, editor review.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RosterPlayer {
  full_name: string;
  position: string;
  depth_chart_position?: string;
  status: string;
  status_label?: string;
  jersey_number?: number;
  years_exp?: number;
  team: string;
  season: number;
  roster_week?: number;
}

interface SnapPlayer {
  player: string;
  position: string;
  offense_snaps?: number;
  offense_pct?: number;
  defense_snaps?: number;
  defense_pct?: number;
}

// ---------------------------------------------------------------------------
// Script paths (relative to repo root)
// ---------------------------------------------------------------------------

function findScriptDir(): string {
  const candidates = [
    join(process.cwd(), 'content', 'data'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'query_snap_usage.py'))) return dir;
  }
  return join(process.cwd(), 'content', 'data');
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

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

/** Query the official nflverse roster for a team. */
function queryRoster(team: string, season: number): RosterPlayer[] {
  const raw = runPythonQuery('query_rosters.py', [
    '--team', team,
    '--season', String(season),
  ]);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RosterPlayer[];
  } catch {
    return [];
  }
}

/** Query snap counts for supplementary usage data. */
function querySnaps(team: string, season: number, group: string, top: number): SnapPlayer[] {
  const raw = runPythonQuery('query_snap_usage.py', [
    '--team', team,
    '--season', String(season),
    '--position-group', group,
    '--top', String(top),
  ]);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SnapPlayer[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/** Current NFL season — offseason articles reference the previous season's data. */
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
}

/** Position display order */
const OFF_POS_ORDER = ['QB', 'RB', 'FB', 'WR', 'TE', 'T', 'G', 'C', 'OL'];
const DEF_POS_ORDER = ['DE', 'DT', 'NT', 'DL', 'OLB', 'ILB', 'MLB', 'LB', 'CB', 'SS', 'FS', 'S', 'DB'];
const ST_POS_ORDER = ['K', 'P', 'LS'];

function isOffensivePos(pos: string): boolean {
  return OFF_POS_ORDER.includes(pos);
}
function isDefensivePos(pos: string): boolean {
  return DEF_POS_ORDER.includes(pos);
}

/**
 * Build a concise roster context string for a team.
 * Returns null if data isn't available (graceful degradation).
 *
 * Uses the official nflverse roster (primary) + snap counts (supplementary).
 */
export function buildTeamRosterContext(team: string): string | null {
  const season = currentSeason();
  const teamUpper = team.toUpperCase();

  // Primary: official roster
  const roster = queryRoster(teamUpper, season);

  // Supplementary: snap counts for usage context
  const offSnaps = querySnaps(teamUpper, season, 'offense', 20);
  const defSnaps = querySnaps(teamUpper, season, 'defense', 20);

  // Build snap lookup: player name → pct
  const snapPct = new Map<string, number>();
  for (const s of offSnaps) {
    if (s.offense_pct != null) snapPct.set(s.player, s.offense_pct);
  }
  for (const s of defSnaps) {
    if (s.defense_pct != null) snapPct.set(s.player, s.defense_pct);
  }

  // Fall back to snap-only if roster query unavailable
  if (roster.length === 0 && offSnaps.length === 0 && defSnaps.length === 0) {
    return null;
  }

  // If official roster is empty but snap data exists, use legacy snap-only format
  if (roster.length === 0) {
    return buildSnapOnlyContext(teamUpper, season, offSnaps, defSnaps);
  }

  const rosterWeek = roster[0]?.roster_week ?? '?';
  const parts: string[] = [];
  parts.push(`## Current ${teamUpper} Official Roster (${season} Season, Week ${rosterWeek})`);
  parts.push('');
  parts.push('> ⚠️ USE THIS DATA as ground truth for player-team assignments.');
  parts.push('> Do NOT rely on training data — rosters change frequently via trades, cuts, and signings.');
  parts.push('> Players NOT listed here are NOT on this team.');
  parts.push('');

  // Group by position
  const byPos = new Map<string, RosterPlayer[]>();
  for (const p of roster) {
    const pos = p.position || 'UNK';
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push(p);
  }

  // Offense
  const offPositions = OFF_POS_ORDER.filter(p => byPos.has(p));
  if (offPositions.length > 0) {
    parts.push('### Offense');
    for (const pos of offPositions) {
      const players = byPos.get(pos)!;
      for (const p of players) {
        parts.push(formatRosterLine(p, snapPct));
      }
    }
    parts.push('');
  }

  // Defense
  const defPositions = DEF_POS_ORDER.filter(p => byPos.has(p));
  if (defPositions.length > 0) {
    parts.push('### Defense');
    for (const pos of defPositions) {
      const players = byPos.get(pos)!;
      for (const p of players) {
        parts.push(formatRosterLine(p, snapPct));
      }
    }
    parts.push('');
  }

  // Special teams
  const stPositions = ST_POS_ORDER.filter(p => byPos.has(p));
  if (stPositions.length > 0) {
    parts.push('### Special Teams');
    for (const pos of stPositions) {
      const players = byPos.get(pos)!;
      for (const p of players) {
        parts.push(formatRosterLine(p, snapPct));
      }
    }
    parts.push('');
  }

  // Any remaining positions not in the predefined orders
  const allKnown = new Set([...OFF_POS_ORDER, ...DEF_POS_ORDER, ...ST_POS_ORDER]);
  const otherPositions = [...byPos.keys()].filter(p => !allKnown.has(p));
  if (otherPositions.length > 0) {
    parts.push('### Other');
    for (const pos of otherPositions) {
      const players = byPos.get(pos)!;
      for (const p of players) {
        parts.push(formatRosterLine(p, snapPct));
      }
    }
    parts.push('');
  }

  parts.push(`*Data source: nflverse official roster (week ${rosterWeek}) + snap counts (${season} season).*`);
  parts.push('*Official roster is authoritative for who is on the team. Snap %% shows game usage.*');

  return parts.join('\n');
}

/** Format a single roster line with optional snap context. */
function formatRosterLine(p: RosterPlayer, snapPct: Map<string, number>): string {
  const pos = p.depth_chart_position || p.position || '?';
  const status = p.status === 'ACT' ? '' : ` [${p.status_label || p.status}]`;
  const pct = snapPct.get(p.full_name);
  const snapInfo = pct != null ? ` — ${pct.toFixed(0)}% snaps` : '';
  return `- **${p.full_name}** (${pos})${status}${snapInfo}`;
}

/** Legacy fallback: build context from snap counts only when roster is unavailable. */
function buildSnapOnlyContext(
  teamUpper: string, season: number,
  offense: SnapPlayer[], defense: SnapPlayer[],
): string {
  const parts: string[] = [];
  parts.push(`## Current ${teamUpper} Roster Context (${season} Season Data)`);
  parts.push('');
  parts.push('> ⚠️ USE THIS DATA as ground truth for player-team assignments.');
  parts.push('> Do NOT rely on training data — rosters change frequently via trades, cuts, and signings.');
  parts.push('> Note: This is snap-count data only — backups with 0 snaps may not appear.');
  parts.push('');

  if (offense.length > 0) {
    parts.push('### Offensive Starters (by snap count)');
    for (const p of offense) {
      parts.push(`- **${p.player}** (${p.position}) — ${p.offense_pct?.toFixed(0) ?? '?'}% snaps`);
    }
    parts.push('');
  }

  if (defense.length > 0) {
    parts.push('### Defensive Starters (by snap count)');
    for (const p of defense) {
      parts.push(`- **${p.player}** (${p.position}) — ${p.defense_pct?.toFixed(0) ?? '?'}% snaps`);
    }
    parts.push('');
  }

  parts.push(`*Data source: nflverse ${season} season snap counts only (official roster unavailable).*`);
  return parts.join('\n');
}

/**
 * Build roster context and store it as an artifact for reuse.
 * Returns the context string, or null if data unavailable.
 */
export function ensureRosterContext(
  repo: { artifacts: { get(id: string, name: string): string | null; put(id: string, name: string, content: string): void } },
  articleId: string,
  team: string,
  forceRefresh = false,
): string | null {
  const ARTIFACT_NAME = 'roster-context.md';

  // Check for cached version unless force-refreshing
  if (!forceRefresh) {
    const cached = repo.artifacts.get(articleId, ARTIFACT_NAME);
    if (cached) return cached;
  }

  const context = buildTeamRosterContext(team);
  if (context) {
    repo.artifacts.put(articleId, ARTIFACT_NAME, context);
  }
  return context;
}
