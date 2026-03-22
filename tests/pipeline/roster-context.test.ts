import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTeamRosterContext, ensureRosterContext } from '../../src/pipeline/roster-context.js';
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
  { player: 'Boye Mafe', position: 'DE', defense_snaps: 700, defense_pct: 68.9 },
]);

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
    it('returns formatted roster context with offense and defense', () => {
      // Mock execFileSync to return offense then defense snap data
      mockExecFileSync
        .mockReturnValueOnce(OFFENSE_SNAPS as any)  // offense query
        .mockReturnValueOnce(DEFENSE_SNAPS as any);  // defense query

      const result = buildTeamRosterContext('SEA');

      expect(result).not.toBeNull();
      expect(result).toContain('Current SEA Roster Context');
      expect(result).toContain('Sam Darnold');
      expect(result).toContain('Jaxon Smith-Njigba');
      expect(result).toContain('Devon Witherspoon');
      expect(result).toContain('Riq Woolen');
      expect(result).toContain('ground truth');
      expect(result).toContain('Offensive Starters');
      expect(result).toContain('Defensive Starters');
    });

    it('groups players by position', () => {
      mockExecFileSync
        .mockReturnValueOnce(OFFENSE_SNAPS as any)
        .mockReturnValueOnce(DEFENSE_SNAPS as any);

      const result = buildTeamRosterContext('SEA')!;

      // QB should come before WR
      const qbIdx = result.indexOf('Sam Darnold');
      const wrIdx = result.indexOf('Jaxon Smith-Njigba');
      expect(qbIdx).toBeLessThan(wrIdx);
    });

    it('returns null when no data available', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('Script not found');
      });

      const result = buildTeamRosterContext('SEA');
      expect(result).toBeNull();
    });

    it('uppercases team abbreviation', () => {
      mockExecFileSync
        .mockReturnValueOnce(OFFENSE_SNAPS as any)
        .mockReturnValueOnce(DEFENSE_SNAPS as any);

      const result = buildTeamRosterContext('sea');

      expect(result).toContain('Current SEA Roster Context');
    });

    it('works with offense only (no defense data)', () => {
      mockExecFileSync
        .mockReturnValueOnce(OFFENSE_SNAPS as any)
        .mockImplementationOnce(() => { throw new Error('no data'); });

      const result = buildTeamRosterContext('SEA');

      expect(result).not.toBeNull();
      expect(result).toContain('Sam Darnold');
      expect(result).toContain('Offensive Starters');
      expect(result).not.toContain('Defensive Starters');
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
      expect(mockExecFileSync).not.toHaveBeenCalled(); // No Python query needed
    });

    it('builds and stores context when not cached', () => {
      const mockRepo = {
        artifacts: {
          get: vi.fn().mockReturnValue(null),
          put: vi.fn(),
        },
      };

      mockExecFileSync
        .mockReturnValueOnce(OFFENSE_SNAPS as any)
        .mockReturnValueOnce(DEFENSE_SNAPS as any);

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

      mockExecFileSync
        .mockReturnValueOnce(OFFENSE_SNAPS as any)
        .mockReturnValueOnce(DEFENSE_SNAPS as any);

      const result = ensureRosterContext(mockRepo, 'test-article', 'SEA', true);

      expect(result).toContain('Sam Darnold');
      // get should NOT be called when forceRefresh=true
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
});
