import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildTeamRosterContext,
  ensureRosterContext,
  getRosterArtifactAgeDays,
  validatePlayerMentions,
  bootstrapRosterKnowledge,
} from '../../src/pipeline/roster-context.js';
import * as childProcess from 'node:child_process';

// ---------------------------------------------------------------------------
// Mock child_process.execFileSync
// ---------------------------------------------------------------------------

vi.mock('node:child_process', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:child_process')>();
  return {
    ...orig,
    execFileSync: vi.fn(),
  };
});

const mockExecFileSync = vi.mocked(childProcess.execFileSync);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ROSTER_DATA = JSON.stringify([
  { full_name: 'Sam Darnold', position: 'QB', depth_chart_position: 'QB', status: 'ACT', status_label: 'Active', jersey_number: 14, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Drew Lock', position: 'QB', depth_chart_position: 'QB', status: 'ACT', status_label: 'Active', jersey_number: 2, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Jalen Milroe', position: 'QB', depth_chart_position: 'QB', status: 'INA', status_label: 'Inactive', jersey_number: 6, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Kenneth Walker III', position: 'RB', depth_chart_position: 'RB', status: 'ACT', status_label: 'Active', jersey_number: 9, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Jaxon Smith-Njigba', position: 'WR', depth_chart_position: 'WR', status: 'ACT', status_label: 'Active', jersey_number: 11, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Cooper Kupp', position: 'WR', depth_chart_position: 'WR', status: 'ACT', status_label: 'Active', jersey_number: 10, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'AJ Barner', position: 'TE', depth_chart_position: 'TE', status: 'ACT', status_label: 'Active', jersey_number: 88, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Devon Witherspoon', position: 'DB', depth_chart_position: 'CB', status: 'ACT', status_label: 'Active', jersey_number: 21, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Riq Woolen', position: 'DB', depth_chart_position: 'CB', status: 'ACT', status_label: 'Active', jersey_number: 27, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Leonard Williams', position: 'DL', depth_chart_position: 'DE', status: 'ACT', status_label: 'Active', jersey_number: 99, team: 'SEA', season: 2025, roster_week: 22 },
  { full_name: 'Jason Myers', position: 'K', depth_chart_position: 'K', status: 'ACT', status_label: 'Active', jersey_number: 5, team: 'SEA', season: 2025, roster_week: 22 },
]);

const OFFENSE_SNAPS = JSON.stringify([
  { player: 'Sam Darnold', position: 'QB', offense_snaps: 1026, offense_pct: 96.2 },
  { player: 'Kenneth Walker III', position: 'RB', offense_snaps: 498, offense_pct: 46.9 },
  { player: 'Jaxon Smith-Njigba', position: 'WR', offense_snaps: 829, offense_pct: 77.4 },
  { player: 'Cooper Kupp', position: 'WR', offense_snaps: 768, offense_pct: 75.6 },
  { player: 'AJ Barner', position: 'TE', offense_snaps: 827, offense_pct: 77.3 },
]);

const DEFENSE_SNAPS = JSON.stringify([
  { player: 'Devon Witherspoon', position: 'CB', defense_snaps: 900, defense_pct: 88.5 },
  { player: 'Riq Woolen', position: 'CB', defense_snaps: 750, defense_pct: 73.8 },
  { player: 'Leonard Williams', position: 'DE', defense_snaps: 700, defense_pct: 68.9 },
]);

/**
 * Helper: mock all 3 queries (roster, offense snaps, defense snaps).
 * Call order: query_rosters.py, query_snap_usage.py (offense), query_snap_usage.py (defense)
 */
function mockAllThreeQueries(
  roster: string = ROSTER_DATA,
  offense: string = OFFENSE_SNAPS,
  defense: string = DEFENSE_SNAPS,
) {
  mockExecFileSync
    .mockReturnValueOnce(roster as any)   // query_rosters.py
    .mockReturnValueOnce(offense as any)   // query_snap_usage.py offense
    .mockReturnValueOnce(defense as any);  // query_snap_usage.py defense
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('roster-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildTeamRosterContext', () => {
    it('returns formatted roster context with official roster + snap data', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('SEA');

      expect(result).not.toBeNull();
      expect(result).toContain('Official Roster');
      expect(result).toContain('Sam Darnold');
      expect(result).toContain('Jaxon Smith-Njigba');
      expect(result).toContain('Devon Witherspoon');
      expect(result).toContain('Riq Woolen');
      expect(result).toContain('best available reference');
    });

    it('includes backup players that have zero snaps', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('SEA')!;

      // Drew Lock is a backup QB — no snap data but on official roster
      expect(result).toContain('Drew Lock');
      // Jalen Milroe is inactive — should show status
      expect(result).toContain('Jalen Milroe');
      expect(result).toContain('Inactive');
    });

    it('annotates starters with snap percentages', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('SEA')!;

      expect(result).toContain('96% snaps');  // Sam Darnold
      expect(result).toContain('77% snaps');  // JSN
    });

    it('includes special teams players', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('SEA')!;

      expect(result).toContain('Jason Myers');
      expect(result).toContain('Special Teams');
    });

    it('shows data freshness caveat', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('SEA')!;

      expect(result).toContain('recent transactions');
      expect(result).toContain('24-48');
      expect(result).not.toContain('ground truth');
    });

    it('returns null when no data available', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('Script not found');
      });

      const result = buildTeamRosterContext('SEA');
      expect(result).toBeNull();
    });

    it('uppercases team abbreviation', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('sea');

      expect(result).toContain('Current SEA Official Roster');
    });

    it('falls back to snap-only format when roster query fails', () => {
      // Roster query fails, but snap queries succeed
      mockExecFileSync
        .mockImplementationOnce(() => { throw new Error('no roster data'); })  // roster fails
        .mockReturnValueOnce(OFFENSE_SNAPS as any)   // offense snaps
        .mockReturnValueOnce(DEFENSE_SNAPS as any);   // defense snaps

      const result = buildTeamRosterContext('SEA');

      expect(result).not.toBeNull();
      expect(result).toContain('Sam Darnold');
      expect(result).toContain('Offensive Starters');
      expect(result).toContain('snap-count data only');
      // Should NOT contain "Official Roster" header
      expect(result).not.toContain('Official Roster');
    });

    it('groups by position in expected order', () => {
      mockAllThreeQueries();

      const result = buildTeamRosterContext('SEA')!;

      // QB should come before WR in offense
      const qbIdx = result.indexOf('Sam Darnold');
      const wrIdx = result.indexOf('Jaxon Smith-Njigba');
      expect(qbIdx).toBeLessThan(wrIdx);
    });
  });

  describe('ensureRosterContext', () => {
    it('returns cached artifact if available', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue('cached roster data'),
          put: vi.fn(),
        },
      };

      const result = ensureRosterContext(mockRepo, 'test-article', 'SEA');

      expect(result).toBe('cached roster data');
      expect(mockRepo.artifacts.get).toHaveBeenCalledWith('test-article', 'roster-context.md');
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('builds and stores context when not cached', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue(null),
          put: vi.fn(),
        },
      };

      mockAllThreeQueries();

      const result = ensureRosterContext(mockRepo, 'test-article', 'SEA');

      expect(result).toContain('Sam Darnold');
      expect(mockRepo.artifacts.put).toHaveBeenCalledWith(
        'test-article',
        'roster-context.md',
        expect.stringContaining('Sam Darnold'),
      );
    });

    it('force-refreshes even when cached', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue('old data'),
          put: vi.fn(),
        },
      };

      mockAllThreeQueries();

      const result = ensureRosterContext(mockRepo, 'test-article', 'SEA', true);

      expect(result).toContain('Sam Darnold');
      expect(mockRepo.artifacts.get).not.toHaveBeenCalled();
    });

    it('returns null when data unavailable', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue(null),
          put: vi.fn(),
        },
      };

      mockExecFileSync.mockImplementation(() => {
        throw new Error('Script not found');
      });

      const result = ensureRosterContext(mockRepo, 'test-article', 'SEA');

      expect(result).toBeNull();
      expect(mockRepo.artifacts.put).not.toHaveBeenCalled();
    });
  });

  describe('getRosterArtifactAgeDays', () => {
    it('returns Infinity when artifact does not exist', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue(null),
        },
      };
      expect(getRosterArtifactAgeDays(mockRepo, 'test')).toBe(Infinity);
    });

    it('returns 0 when artifact exists but no getMeta', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue('some roster data'),
        },
      };
      expect(getRosterArtifactAgeDays(mockRepo, 'test')).toBe(0);
    });

    it('uses getMeta for actual age when available', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
      const mockRepo = {
        artifacts: {
          get: vi.fn(),
          getMeta: vi.fn().mockReturnValue({ updated_at: twoDaysAgo }),
        },
      };
      const age = getRosterArtifactAgeDays(mockRepo, 'test');
      expect(age).toBeGreaterThan(1.9);
      expect(age).toBeLessThan(2.1);
    });
  });

  describe('validatePlayerMentions', () => {
    it('confirms players found on team roster', () => {
      // Mock: roster query returns SEA roster, then no further lookups needed
      mockAllThreeQueries(); // Pre-warm for buildTeamRosterContext if needed
      mockExecFileSync.mockReturnValueOnce(ROSTER_DATA as any); // validatePlayerMentions roster query

      const text = 'The **Sam Darnold** era begins. **Kenneth Walker III** leads the backfield.';
      const results = validatePlayerMentions(text, 'SEA');

      const confirmed = results.filter(r => r.status === 'confirmed');
      expect(confirmed.length).toBe(2);
      expect(confirmed.map(r => r.name)).toContain('Sam Darnold');
      expect(confirmed.map(r => r.name)).toContain('Kenneth Walker III');
    });

    it('flags player on wrong team', () => {
      // Roster for SEA doesn't include Geno Smith
      mockExecFileSync.mockReturnValueOnce(ROSTER_DATA as any); // validatePlayerMentions roster query
      // queryPlayerTeam lookup finds Geno on LV
      mockExecFileSync.mockReturnValueOnce(JSON.stringify([
        { full_name: 'Geno Smith', position: 'QB', team: 'LV', season: 2025 },
      ]) as any);

      const text = '**Geno Smith** under center gives the Seahawks...';
      const results = validatePlayerMentions(text, 'SEA');

      const wrongTeam = results.find(r => r.name === 'Geno Smith');
      expect(wrongTeam).toBeDefined();
      expect(wrongTeam!.status).toBe('wrong_team');
      expect(wrongTeam!.rosterTeam).toBe('LV');
    });

    it('flags not-found player as not_found', () => {
      mockExecFileSync.mockReturnValueOnce(ROSTER_DATA as any); // roster
      mockExecFileSync.mockReturnValueOnce(JSON.stringify([]) as any); // player lookup empty

      const text = '**John Fictitious** makes an impact.';
      const results = validatePlayerMentions(text, 'SEA');

      const notFound = results.find(r => r.name === 'John Fictitious');
      expect(notFound).toBeDefined();
      expect(notFound!.status).toBe('not_found');
    });

    it('returns empty when no roster data available', () => {
      mockExecFileSync.mockImplementation(() => { throw new Error('no data'); });

      const results = validatePlayerMentions('**Some Player** does things.', 'SEA');
      expect(results).toEqual([]);
    });

    it('detects position-annotated player names', () => {
      mockExecFileSync.mockReturnValueOnce(ROSTER_DATA as any); // roster

      const text = 'Sam Darnold (QB) is the starter.';
      const results = validatePlayerMentions(text, 'SEA');

      expect(results.some(r => r.name === 'Sam Darnold' && r.status === 'confirmed')).toBe(true);
    });
  });

  describe('bootstrapRosterKnowledge', () => {
    it('stores roster summaries for each team and agent', () => {
      // Mock enough data for one team
      mockAllThreeQueries();

      const storeFn = vi.fn().mockReturnValue(1);
      const mockMemory = { store: storeFn };

      const count = bootstrapRosterKnowledge(mockMemory, ['SEA'], ['lead', 'analytics']);

      expect(count).toBe(1);
      expect(storeFn).toHaveBeenCalledTimes(2); // one per agent
      expect(storeFn).toHaveBeenCalledWith(expect.objectContaining({
        category: 'domain_knowledge',
        sourceSession: 'roster_bootstrap',
      }));
    });

    it('returns 0 when no data available', () => {
      mockExecFileSync.mockImplementation(() => { throw new Error('no data'); });

      const mockMemory = { store: vi.fn() };
      const count = bootstrapRosterKnowledge(mockMemory, ['SEA']);
      expect(count).toBe(0);
      expect(mockMemory.store).not.toHaveBeenCalled();
    });
  });
});
