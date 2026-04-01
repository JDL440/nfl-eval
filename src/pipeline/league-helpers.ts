/**
 * league-helpers.ts — Shared league-aware utilities used across the pipeline.
 *
 * Centralizes season detection, position grouping, and data-source naming
 * so that roster-context, fact-check-context, and validators all share
 * identical logic instead of duplicating NFL-only heuristics.
 */

// ---------------------------------------------------------------------------
// Season detection
// ---------------------------------------------------------------------------

/**
 * Current season for a league. Offseason articles reference the previous season's data.
 * NFL: season starts September. MLB: season starts April. NBA: season starts October.
 */
export function currentSeason(league: string = 'nfl'): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  switch (league) {
    case 'mlb':
      return month < 2 ? year - 1 : year; // Before March = previous season
    case 'nba':
      return month < 9 ? year - 1 : year; // Before October = previous season
    default: // nfl
      return month < 7 ? year - 1 : year; // Before August = previous season
  }
}

// ---------------------------------------------------------------------------
// Position grouping
// ---------------------------------------------------------------------------

export interface LeaguePositionConfig {
  groups: { name: string; positions: string[] }[];
}

export function getPositionConfig(league: string = 'nfl'): LeaguePositionConfig {
  switch (league) {
    case 'mlb':
      return {
        groups: [
          { name: 'Rotation', positions: ['SP'] },
          { name: 'Bullpen', positions: ['RP', 'CL'] },
          { name: 'Lineup', positions: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] },
        ],
      };
    case 'nba':
      return {
        groups: [
          { name: 'Backcourt', positions: ['PG', 'SG'] },
          { name: 'Frontcourt', positions: ['SF', 'PF', 'C'] },
        ],
      };
    default: // nfl
      return {
        groups: [
          { name: 'Offense', positions: ['QB', 'RB', 'FB', 'WR', 'TE', 'T', 'G', 'C', 'OL'] },
          { name: 'Defense', positions: ['DE', 'DT', 'NT', 'DL', 'OLB', 'ILB', 'MLB', 'LB', 'CB', 'SS', 'FS', 'S', 'DB'] },
          { name: 'Special Teams', positions: ['K', 'P', 'LS'] },
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Data source naming
// ---------------------------------------------------------------------------

export function dataSourceName(league: string = 'nfl'): string {
  switch (league) {
    case 'mlb': return 'Statcast';
    case 'nba': return 'NBA.com/stats';
    default: return 'nflverse';
  }
}
