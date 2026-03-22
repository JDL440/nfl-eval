/**
 * roster-context.ts — Builds a concise current-roster context string for a
 * team by querying nflverse snap count and player stat data.
 *
 * This injects *ground-truth* roster data into agent prompts so LLMs don't
 * rely on potentially stale training data for player-team assignments.
 *
 * Called at key pipeline stages: idea→prompt, factcheck, editor review.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnapPlayer {
  player: string;
  position: string;
  offense_snaps?: number;
  offense_pct?: number;
  defense_snaps?: number;
  defense_pct?: number;
}

interface PlayerStat {
  player_display_name?: string;
  player_name?: string;
  position?: string;
  completions?: number;
  attempts?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  targets?: number;
}

// ---------------------------------------------------------------------------
// Script paths (relative to repo root)
// ---------------------------------------------------------------------------

// Fallback: use cwd-based approach for CJS compatibility
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

function queryPlayerStats(player: string, season: number): PlayerStat | null {
  const raw = runPythonQuery('query_player_epa.py', [
    '--player', player,
    '--season', String(season),
  ]);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Could be array or object depending on script
    return Array.isArray(parsed) ? parsed[0] ?? null : parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/** Current NFL season — offseason articles reference the previous season's data. */
function currentSeason(): number {
  const now = new Date();
  // NFL season spans Sep-Feb. If we're in Jan-Aug, use previous year's season.
  return now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
}

/**
 * Build a concise roster context string for a team.
 * Returns null if data isn't available (graceful degradation).
 */
export function buildTeamRosterContext(team: string): string | null {
  const season = currentSeason();
  const teamUpper = team.toUpperCase();

  // Fetch offensive and defensive starters by snap counts
  const offense = querySnaps(teamUpper, season, 'offense', 15);
  const defense = querySnaps(teamUpper, season, 'defense', 15);

  if (offense.length === 0 && defense.length === 0) {
    return null; // No data available
  }

  const parts: string[] = [];
  parts.push(`## Current ${teamUpper} Roster Context (${season} Season Data)`);
  parts.push('');
  parts.push('> ⚠️ USE THIS DATA as ground truth for player-team assignments.');
  parts.push('> Do NOT rely on training data — rosters change frequently via trades, cuts, and signings.');
  parts.push('');

  // Offense
  if (offense.length > 0) {
    parts.push('### Offensive Starters (by snap count)');
    // Group by position
    const byPos = new Map<string, SnapPlayer[]>();
    for (const p of offense) {
      const pos = p.position || 'UNK';
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos)!.push(p);
    }

    const posOrder = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'OL', 'FB'];
    for (const pos of posOrder) {
      const players = byPos.get(pos);
      if (!players) continue;
      const lines = players.map(p =>
        `- **${p.player}** (${pos}) — ${p.offense_pct?.toFixed(0) ?? '?'}% snaps`
      );
      parts.push(...lines);
    }
    // Any remaining positions
    for (const [pos, players] of byPos) {
      if (posOrder.includes(pos)) continue;
      const lines = players.map(p =>
        `- **${p.player}** (${pos}) — ${p.offense_pct?.toFixed(0) ?? '?'}% snaps`
      );
      parts.push(...lines);
    }
    parts.push('');
  }

  // Defense
  if (defense.length > 0) {
    parts.push('### Defensive Starters (by snap count)');
    const byPos = new Map<string, SnapPlayer[]>();
    for (const p of defense) {
      const pos = p.position || 'UNK';
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos)!.push(p);
    }

    const posOrder = ['DE', 'DT', 'OLB', 'ILB', 'LB', 'CB', 'SS', 'FS', 'S', 'DB'];
    for (const pos of posOrder) {
      const players = byPos.get(pos);
      if (!players) continue;
      const lines = players.map(p =>
        `- **${p.player}** (${pos}) — ${p.defense_pct?.toFixed(0) ?? '?'}% snaps`
      );
      parts.push(...lines);
    }
    for (const [pos, players] of byPos) {
      if (posOrder.includes(pos)) continue;
      const lines = players.map(p =>
        `- **${p.player}** (${pos}) — ${p.defense_pct?.toFixed(0) ?? '?'}% snaps`
      );
      parts.push(...lines);
    }
    parts.push('');
  }

  parts.push(`*Data source: nflverse ${season} season. Snap counts reflect actual game participation.*`);

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
