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
import {
  getGlobalCache, DEFAULT_TTL,
  rosterCacheKey, snapsCacheKey, playerStatsCacheKey, teamEfficiencyCacheKey, pythonQueryCacheKey,
} from '../cache/index.js';
import { currentSeason, getPositionConfig, dataSourceName } from './league-helpers.js';

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

function findScriptDir(baseScriptsDir: string, league: string = 'nfl'): string {
  const candidates = [
    join(baseScriptsDir, league),
    baseScriptsDir,
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'query_snap_usage.py'))) return dir;
  }
  return baseScriptsDir;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function runPythonQuery(scriptName: string, args: string[], baseScriptsDir: string, league: string = 'nfl'): string | null {
  const scriptDir = findScriptDir(baseScriptsDir, league);
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
function queryRoster(team: string, season: number, scriptsDir: string, league: string = 'nfl'): RosterPlayer[] {
  const cache = getGlobalCache();
  const key = rosterCacheKey(team, season);
  return cache.getOrFetch<RosterPlayer[]>(key, () => {
    const raw = runPythonQuery('query_rosters.py', [
      '--team', team,
      '--season', String(season),
    ], scriptsDir, league);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RosterPlayer[];
    } catch {
      return null;
    }
  }, DEFAULT_TTL.roster) ?? [];
}

/** Query snap counts for supplementary usage data. */
function querySnaps(team: string, season: number, group: string, top: number, scriptsDir: string, league: string = 'nfl'): SnapPlayer[] {
  const cache = getGlobalCache();
  const key = snapsCacheKey(team, season, group, top);
  return cache.getOrFetch<SnapPlayer[]>(key, () => {
    const raw = runPythonQuery('query_snap_usage.py', [
      '--team', team,
      '--season', String(season),
      '--position-group', group,
      '--top', String(top),
    ], scriptsDir, league);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SnapPlayer[];
    } catch {
      return null;
    }
  }, DEFAULT_TTL.snapCounts) ?? [];
}

// ---------------------------------------------------------------------------
// Player stats + team efficiency — injected into roster context so panelists
// have real nflverse data instead of relying on (often wrong) LLM training data.
// ---------------------------------------------------------------------------

interface PlayerStats {
  player: string;
  position: string;
  team: string;
  season: number;
  completions?: number;
  attempts?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  passing_epa?: number;
  cpoe?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  rushing_epa?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  receptions?: number;
  targets?: number;
  receiving_epa?: number;
  position_rank?: number;
  [key: string]: unknown;
}

interface TeamEfficiency {
  team: string;
  season: number;
  offensive_epa_play?: number;
  defensive_epa_play?: number;
  pass_epa_play?: number;
  rush_epa_play?: number;
  total_yards?: number;
  turnovers_lost?: number;
  turnovers_gained?: number;
  sacks?: number;
  def_interceptions?: number;
  [key: string]: unknown;
}

/** Query player stats from nflverse — returns parsed object or null. */
function queryPlayerStats(player: string, season: number, scriptsDir: string, league: string = 'nfl'): PlayerStats | null {
  const cache = getGlobalCache();
  const key = playerStatsCacheKey(player, season);
  return cache.getOrFetch<PlayerStats>(key, () => {
    const raw = runPythonQuery('query_player_epa.py', [
      '--player', player,
      '--season', String(season),
    ], scriptsDir, league);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed[0] ?? null;
      return parsed as PlayerStats;
    } catch {
      return null;
    }
  }, DEFAULT_TTL.playerStats);
}

/** Query team efficiency metrics from nflverse. */
function queryTeamEfficiency(team: string, season: number, scriptsDir: string, league: string = 'nfl'): TeamEfficiency | null {
  const cache = getGlobalCache();
  const key = teamEfficiencyCacheKey(team, season);
  return cache.getOrFetch<TeamEfficiency>(key, () => {
    const raw = runPythonQuery('query_team_efficiency.py', [
      '--team', team,
      '--season', String(season),
    ], scriptsDir, league);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TeamEfficiency;
    } catch {
      return null;
    }
  }, DEFAULT_TTL.playerStats);
}

/** Positions we query stats for (skill positions where stats matter most). */
const STAT_POSITIONS = new Set(['QB', 'RB', 'FB', 'WR', 'TE']);
const MIN_SNAP_PCT_FOR_STATS = 30;
const MAX_STAT_PLAYERS = 5;
const MAX_STATS_WALL_TIME_MS = 15_000; // bail after 15s to avoid blocking event loop

/** Build the "Key Player Statistics" section for high-snap offensive players. */
function buildKeyStatsSection(
  roster: RosterPlayer[],
  snapPct: Map<string, number>,
  team: string,
  season: number,
  scriptsDir: string,
  league: string = 'nfl',
): string | null {
  // Identify high-snap skill players
  const candidates = roster
    .filter(p => STAT_POSITIONS.has(p.position) && (snapPct.get(p.full_name) ?? 0) >= MIN_SNAP_PCT_FOR_STATS)
    .sort((a, b) => (snapPct.get(b.full_name) ?? 0) - (snapPct.get(a.full_name) ?? 0))
    .slice(0, MAX_STAT_PLAYERS);

  if (candidates.length === 0) return null;

  const sourceName = dataSourceName(league);
  const lines: string[] = [];
  lines.push(`### Key Player Statistics (${sourceName} verified)`);
  lines.push('');
  lines.push(`> ⚠️ These are ACTUAL stats from the ${sourceName} dataset. Use these numbers, not training data.`);
  lines.push(`> If a stat below contradicts a claim, the ${sourceName} data is correct.`);
  lines.push('');

  const wallStart = Date.now();
  for (const p of candidates) {
    if (Date.now() - wallStart > MAX_STATS_WALL_TIME_MS) break; // avoid blocking event loop
    let stats: PlayerStats | null;
    try {
      stats = queryPlayerStats(p.full_name, season, scriptsDir, league);
    } catch { continue; }
    if (!stats) continue;

    const statParts: string[] = [];
    if (stats.position === 'QB') {
      if (stats.completions != null && stats.attempts != null) {
        const pct = ((stats.completions / stats.attempts) * 100).toFixed(1);
        statParts.push(`${stats.completions}/${stats.attempts} (${pct}%)`);
      }
      if (stats.passing_yards != null) statParts.push(`${stats.passing_yards.toLocaleString()} pass yds`);
      if (stats.passing_tds != null) statParts.push(`${stats.passing_tds} TDs`);
      if (stats.interceptions != null) statParts.push(`**${stats.interceptions} INTs**`);
      if (stats.passing_epa != null) statParts.push(`${stats.passing_epa.toFixed(1)} pass EPA`);
    } else if (stats.position === 'RB' || stats.position === 'FB') {
      if (stats.rushing_yards != null) statParts.push(`${stats.rushing_yards.toLocaleString()} rush yds`);
      if (stats.rushing_tds != null) statParts.push(`${stats.rushing_tds} rush TDs`);
      if (stats.receptions != null) statParts.push(`${stats.receptions} rec`);
      if (stats.receiving_yards != null) statParts.push(`${stats.receiving_yards.toLocaleString()} rec yds`);
    } else {
      // WR / TE
      if (stats.receptions != null && stats.targets != null) statParts.push(`${stats.receptions}/${stats.targets} rec/tgt`);
      if (stats.receiving_yards != null) statParts.push(`${stats.receiving_yards.toLocaleString()} rec yds`);
      if (stats.receiving_tds != null) statParts.push(`${stats.receiving_tds} TDs`);
      if (stats.receiving_epa != null) statParts.push(`${stats.receiving_epa.toFixed(1)} rec EPA`);
    }
    if (stats.position_rank != null) statParts.push(`#${stats.position_rank} at ${stats.position}`);

    if (statParts.length > 0) {
      lines.push(`- **${p.full_name}** (${stats.position}): ${statParts.join(', ')}`);
    }
  }

  // Also add team efficiency (skip if already over time budget)
  if (Date.now() - wallStart < MAX_STATS_WALL_TIME_MS) {
    try {
      const teamStats = queryTeamEfficiency(team, season, scriptsDir, league);
      if (teamStats) {
        lines.push('');
        lines.push(`**${team} Team Totals:** `
          + [
            teamStats.total_yards != null ? `${teamStats.total_yards.toLocaleString()} total yds` : null,
            teamStats.turnovers_lost != null ? `**${teamStats.turnovers_lost} turnovers lost**` : null,
            teamStats.sacks != null ? `${teamStats.sacks} sacks allowed` : null,
            teamStats.pass_epa_play != null ? `${teamStats.pass_epa_play.toFixed(3)} pass EPA/play` : null,
            teamStats.rush_epa_play != null ? `${teamStats.rush_epa_play.toFixed(3)} rush EPA/play` : null,
          ].filter(Boolean).join(', '));
      }
    } catch { /* graceful degradation */ }
  }

  return lines.join('\n');
}

/**
 * Build a concise roster context string for a team.
 * Returns null if data isn't available (graceful degradation).
 *
 * Uses the official nflverse roster (primary) + snap counts (supplementary).
 */
export function buildTeamRosterContext(team: string, league: string = 'nfl', scriptsDir: string = join(process.cwd(), 'content', 'data')): string | null {
  const season = currentSeason(league);
  const teamUpper = team.toUpperCase();

  // Primary: official roster
  const roster = queryRoster(teamUpper, season, scriptsDir, league);

  // Supplementary: snap counts for usage context
  const offSnaps = querySnaps(teamUpper, season, 'offense', 20, scriptsDir, league);
  const defSnaps = querySnaps(teamUpper, season, 'defense', 20, scriptsDir, league);

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
    return buildSnapOnlyContext(teamUpper, season, offSnaps, defSnaps, league);
  }

  const rosterWeek = roster[0]?.roster_week ?? '?';
  const parts: string[] = [];
  parts.push(`## Current ${teamUpper} Official Roster (${season} Season, Week ${rosterWeek})`);
  parts.push('');
  const sourceName = dataSourceName(league);
  parts.push('> ⚠️ USE THIS DATA as the best available reference for player-team assignments.');
  parts.push('> Do NOT rely on training data — rosters change frequently via trades, cuts, and signings.');
  parts.push(`> NOTE: This data updates daily from ${sourceName}. Very recent transactions (last 24-48 hours)`);
  parts.push('> may not yet be reflected. If a player is missing but has been publicly reported as signed/traded');
  parts.push('> to this team, note the discrepancy but do not treat it as an error.');
  parts.push('');

  // Group by position
  const byPos = new Map<string, RosterPlayer[]>();
  for (const p of roster) {
    const pos = p.position || 'UNK';
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push(p);
  }

  // Render position groups from league config
  const posConfig = getPositionConfig(league);
  const allGroupedPositions = new Set<string>();
  for (const group of posConfig.groups) {
    const matchedPositions = group.positions.filter(p => byPos.has(p));
    if (matchedPositions.length > 0) {
      parts.push(`### ${group.name}`);
      for (const pos of matchedPositions) {
        const players = byPos.get(pos)!;
        for (const p of players) {
          parts.push(formatRosterLine(p, snapPct));
        }
      }
      parts.push('');
    }
    for (const pos of group.positions) allGroupedPositions.add(pos);
  }

  // Any remaining positions not in the predefined groups
  const otherPositions = [...byPos.keys()].filter(p => !allGroupedPositions.has(p));
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

  // Key player statistics — verified data to prevent LLM fabrication
  try {
    const statsSection = buildKeyStatsSection(roster, snapPct, teamUpper, season, scriptsDir, league);
    if (statsSection) {
      parts.push('');
      parts.push(statsSection);
      parts.push('');
    }
  } catch {
    // Graceful degradation — roster context still useful without stats
  }

  parts.push(`*Data source: ${sourceName} official roster (week ${rosterWeek}) + snap counts + player stats (${season} season).*`);
  parts.push('*Updates daily. Very recent signings, trades, or cuts (last 24-48h) may not appear yet.*');

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
  league: string = 'nfl',
): string {
  const sourceName = dataSourceName(league);
  const parts: string[] = [];
  parts.push(`## Current ${teamUpper} Roster Context (${season} Season Data)`);
  parts.push('');
  parts.push('> ⚠️ USE THIS DATA as the best available reference for player-team assignments.');
  parts.push('> Do NOT rely on training data — rosters change frequently via trades, cuts, and signings.');
  parts.push('> Note: This is snap-count data only — backups with 0 snaps may not appear.');
  parts.push('> Data updates daily; very recent transactions may not yet be reflected.');
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

  parts.push(`*Data source: ${sourceName} ${season} season snap counts only (official roster unavailable).*`);
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
  league: string = 'nfl',
  scriptsDir: string = join(process.cwd(), 'content', 'data'),
): string | null {
  const ARTIFACT_NAME = 'roster-context.md';

  // Check for cached version unless force-refreshing
  if (!forceRefresh) {
    const cached = repo.artifacts.get(articleId, ARTIFACT_NAME);
    if (cached) return cached;
  }

  const context = buildTeamRosterContext(team, league, scriptsDir);
  if (context) {
    repo.artifacts.put(articleId, ARTIFACT_NAME, context);
  }
  return context;
}

// ---------------------------------------------------------------------------
// Artifact age utility
// ---------------------------------------------------------------------------

/**
 * Return the age in days of a roster-context.md artifact, or Infinity if
 * not present. Used by the scheduler to decide whether to force-refresh.
 */
export function getRosterArtifactAgeDays(
  repo: { artifacts: { getMeta?(id: string, name: string): { updated_at: string } | null; get(id: string, name: string): string | null } },
  articleId: string,
): number {
  // Try metadata-based age first (requires getMeta support)
  if (typeof (repo.artifacts as any).getMeta === 'function') {
    const meta = (repo.artifacts as any).getMeta(articleId, 'roster-context.md') as { updated_at: string } | null;
    if (meta?.updated_at) {
      return (Date.now() - new Date(meta.updated_at).getTime()) / 86_400_000;
    }
  }
  // Fallback: if artifact exists at all, assume 0 (we can't determine age)
  const exists = repo.artifacts.get(articleId, 'roster-context.md');
  return exists ? 0 : Infinity;
}

// ---------------------------------------------------------------------------
// Pre-publish validation — deterministic player mention scan
// ---------------------------------------------------------------------------

export interface PlayerMention {
  name: string;
  status: 'confirmed' | 'wrong_team' | 'not_found';
  rosterTeam?: string;
  detail?: string;
}

/**
 * Scan article text for player names and cross-reference against roster data.
 * Returns warnings for unrecognized or wrong-team mentions.
 *
 * Uses a lightweight approach: extracts bold names (**Name**) and names in
 * "Player Name (POS)" patterns, then checks against the roster.
 */
export function validatePlayerMentions(
  articleText: string,
  team: string,
  league: string = 'nfl',
  scriptsDir: string = join(process.cwd(), 'content', 'data'),
): PlayerMention[] {
  const season = currentSeason(league);
  const teamUpper = team.toUpperCase();

  // Get roster for the target team
  const roster = queryRoster(teamUpper, season, scriptsDir, league);
  if (roster.length === 0) return []; // Can't validate without data

  const teamNames = new Set(roster.map(p => p.full_name.toLowerCase()));

  // Extract candidate player names from the article
  const candidates = extractPlayerNames(articleText);
  if (candidates.size === 0) return [];

  const results: PlayerMention[] = [];

  for (const name of candidates) {
    const lower = name.toLowerCase();

    if (teamNames.has(lower)) {
      results.push({ name, status: 'confirmed' });
      continue;
    }

    // Check if this player is on a DIFFERENT team (strong signal of error)
    const allTeams = queryPlayerTeam(name, season, scriptsDir, league);
    if (allTeams) {
      results.push({
        name,
        status: 'wrong_team',
        rosterTeam: allTeams,
        detail: `Listed on ${allTeams}, not ${teamUpper}`,
      });
    } else {
      const sourceName = dataSourceName(league);
      results.push({
        name,
        status: 'not_found',
        detail: `Not found in ${sourceName} roster data`,
      });
    }
  }

  return results;
}

/** Extract player-like names from article text using common patterns. */
function extractPlayerNames(text: string): Set<string> {
  const names = new Set<string>();

  // Pattern 1: Bold names — **First Last** (also handles Jr., Sr., III, IV, etc.)
  const boldPattern = /\*\*([A-Z][a-z]+(?:\s+(?:[A-Z][a-z'-]+|[IVX]+|[JS]r\.?))+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Skip common non-player bold phrases
    if (name.length > 5 && name.length < 40 && !NON_PLAYER_PHRASES.has(name.toLowerCase())) {
      names.add(name);
    }
  }

  // Pattern 2: Name (POSITION) — e.g., "Sam Darnold (QB)", "Kenneth Walker III (RB)"
  const posPattern = /([A-Z][a-z]+(?:\s+(?:[A-Z][a-z'-]+|[IVX]+|[JS]r\.?))+)\s+\((?:QB|RB|WR|TE|OL|DL|LB|CB|S|K|P|DE|DT|OT|OG|C|SS|FS|NT|ILB|OLB|MLB|FB|LS)\)/g;
  while ((match = posPattern.exec(text)) !== null) {
    names.add(match[1].trim());
  }

  return names;
}

/** Look up which team a player is on (if any). Returns team abbreviation or null. */
function queryPlayerTeam(playerName: string, season: number, scriptsDir: string, league: string = 'nfl'): string | null {
  const cache = getGlobalCache();
  const key = pythonQueryCacheKey('query_rosters_player', [playerName.toLowerCase(), String(season)]);
  return cache.getOrFetch<string>(key, () => {
    const raw = runPythonQuery('query_rosters.py', [
      '--player', playerName,
      '--season', String(season),
    ], scriptsDir, league);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as RosterPlayer[];
      if (data.length > 0) return data[0].team;
      return null;
    } catch {
      return null;
    }
  }, DEFAULT_TTL.roster);
}

const NON_PLAYER_PHRASES = new Set([
  'super bowl', 'pro bowl', 'all pro', 'first team', 'second team',
  'free agent', 'trade deadline', 'salary cap', 'dead money',
  'snap count', 'game plan', 'red zone', 'third down',
  'play action', 'run defense', 'pass rush',
]);

// ---------------------------------------------------------------------------
// Knowledge bootstrap — store roster data as domain_knowledge entries
// ---------------------------------------------------------------------------

interface MemoryStore {
  store(entry: {
    agentName: string;
    category: 'domain_knowledge';
    content: string;
    sourceSession?: string;
    relevanceScore?: number;
  }): number;
}

/**
 * Bootstrap roster knowledge for specific teams into the agent memory system.
 * Stores a summary for each team as a domain_knowledge entry so agents have
 * roster grounding even before any article triggers a fetch.
 *
 * Returns the number of teams successfully bootstrapped.
 */
export function bootstrapRosterKnowledge(
  memory: MemoryStore,
  teams: string[],
  agentNames: string[] = ['lead'],
  league: string = 'nfl',
  scriptsDir: string = join(process.cwd(), 'content', 'data'),
): number {
  let count = 0;
  for (const team of teams) {
    const ctx = buildTeamRosterContext(team, league, scriptsDir);
    if (!ctx) continue;

    // Build a compact summary (first 20 players) to keep memory entries small
    const lines = ctx.split('\n').filter(l => l.startsWith('- **'));
    const summary = lines.slice(0, 25).join('\n');
    const content = `[${team.toUpperCase()} Roster] ${summary}\n\n(${lines.length} total players — see roster-context.md for full list)`;

    for (const agent of agentNames) {
      memory.store({
        agentName: agent,
        category: 'domain_knowledge',
        content,
        sourceSession: 'roster_bootstrap',
        relevanceScore: 0.8,
      });
    }
    count++;
  }
  return count;
}
