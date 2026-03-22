import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateStatClaims,
  validateDraftClaims,
  buildValidationReport,
} from '../../src/pipeline/validators.js';
import { extractClaims } from '../../src/pipeline/claim-extractor.js';
import * as childProcess from 'node:child_process';

// ---------------------------------------------------------------------------
// Mock child_process.execFileSync (same pattern as roster-context.test.ts)
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

const PLAYER_STATS_DARNOLD = JSON.stringify({
  player_display_name: 'Sam Darnold',
  passing_yards: 3180,
  passing_tds: 21,
  rushing_tds: 2,
  interceptions: 14,
  completions: 280,
  attempts: 430,
  passing_epa: 0.11,
});

const PLAYER_STATS_WALKER = JSON.stringify({
  player_display_name: 'Kenneth Walker III',
  rushing_yards: 1020,
  rushing_tds: 8,
  rushing_epa: 0.05,
});

const DRAFT_DATA_JSN = JSON.stringify({
  player_name: 'Jaxon Smith-Njigba',
  round: 1,
  pick: 20,
  season: 2023,
  team: 'SEA',
});

const DRAFT_DATA_WALKER = JSON.stringify({
  player_name: 'Kenneth Walker III',
  round: 2,
  pick: 41,
  season: 2022,
  team: 'SEA',
});

const DRAFT_DATA_WITHERSPOON = JSON.stringify({
  player_name: 'Devon Witherspoon',
  round: 1,
  pick: 5,
  season: 2023,
  team: 'SEA',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateStatClaims', () => {
    it('validates passing yards within tolerance', () => {
      const text = '**Sam Darnold** threw for 3,200 passing yards and 22 touchdowns.';
      const claims = extractClaims(text);

      // Mock: player stats query
      mockExecFileSync.mockReturnValueOnce(PLAYER_STATS_DARNOLD as any);
      // For the TD claim, same player already cached or re-queried
      mockExecFileSync.mockReturnValueOnce(PLAYER_STATS_DARNOLD as any);

      const results = validateStatClaims(claims);

      // Passing yards: claimed 3200, actual 3180 — within 10% tolerance
      const yardResult = results.find(r => r.claim.includes('passing_yards'));
      expect(yardResult).toBeDefined();
      expect(yardResult!.verified).toBe(true);
    });

    it('flags stats that exceed tolerance', () => {
      const text = '**Sam Darnold** threw for 5,000 passing yards this season.';
      const claims = extractClaims(text);

      mockExecFileSync.mockReturnValueOnce(PLAYER_STATS_DARNOLD as any);

      const results = validateStatClaims(claims);

      const yardResult = results.find(r => r.claim.includes('passing_yards'));
      expect(yardResult).toBeDefined();
      expect(yardResult!.verified).toBe(false);
      expect(yardResult!.actual).toContain('3180');
    });

    it('handles missing player data gracefully', () => {
      const text = '**Unknown Player** threw for 4,000 passing yards.';
      const claims = extractClaims(text);

      mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const results = validateStatClaims(claims);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].verified).toBe(false);
      expect(results[0].actual).toContain('No nflverse data');
    });

    it('validates rushing yards', () => {
      const text = '**Kenneth Walker III** rushed for 1,050 rushing yards.';
      const claims = extractClaims(text);

      mockExecFileSync.mockReturnValueOnce(PLAYER_STATS_WALKER as any);

      const results = validateStatClaims(claims);

      const rushResult = results.find(r => r.claim.includes('rushing_yards'));
      expect(rushResult).toBeDefined();
      // 1050 vs 1020: difference of 30, tolerance is 102 (10% of 1020) — should pass
      expect(rushResult!.verified).toBe(true);
    });
  });

  describe('validateDraftClaims', () => {
    it('verifies correct draft information', () => {
      const text = '**Jaxon Smith-Njigba** was selected in round 1 as the No. 20 overall pick in the 2023 draft.';
      const claims = extractClaims(text);

      mockExecFileSync.mockReturnValue(DRAFT_DATA_JSN as any);

      const results = validateDraftClaims(claims);

      expect(results.length).toBeGreaterThan(0);
      const jsnResult = results.find(r => r.claim.includes('Jaxon Smith-Njigba'));
      expect(jsnResult).toBeDefined();
      expect(jsnResult!.verified).toBe(true);
      expect(jsnResult!.actual).toContain('Confirmed');
    });

    it('flags incorrect round', () => {
      const text = '**Jaxon Smith-Njigba**, a 2nd-round pick who has outperformed expectations.';
      const claims = extractClaims(text);

      mockExecFileSync.mockReturnValue(DRAFT_DATA_JSN as any);

      const results = validateDraftClaims(claims);

      const jsnResult = results.find(r => r.claim.includes('Jaxon Smith-Njigba'));
      expect(jsnResult).toBeDefined();
      expect(jsnResult!.verified).toBe(false);
      expect(jsnResult!.actual).toContain('MISMATCH');
      expect(jsnResult!.actual).toContain('round');
    });

    it('flags incorrect pick number', () => {
      const text = '**Devon Witherspoon** was the No. 10 overall pick in the 2023 NFL Draft.';
      const claims = extractClaims(text);

      mockExecFileSync.mockReturnValue(DRAFT_DATA_WITHERSPOON as any);

      const results = validateDraftClaims(claims);

      const result = results.find(r => r.claim.includes('Devon Witherspoon'));
      expect(result).toBeDefined();
      expect(result!.verified).toBe(false);
      expect(result!.actual).toContain('MISMATCH');
      expect(result!.actual).toContain('pick');
    });

    it('handles missing draft data gracefully', () => {
      const text = '**Unknown Prospect** was a 1st-round pick in the 2024 NFL Draft.';
      const claims = extractClaims(text);

      mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const results = validateDraftClaims(claims);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].verified).toBe(false);
      expect(results[0].actual).toContain('No draft data');
    });

    it('verifies correct pick for Walker', () => {
      const text = '**Kenneth Walker III** was the No. 41 overall pick in the 2022 draft.';
      const claims = extractClaims(text);

      mockExecFileSync.mockReturnValue(DRAFT_DATA_WALKER as any);

      const results = validateDraftClaims(claims);

      const walkerResult = results.find(r => r.claim.includes('Kenneth Walker'));
      expect(walkerResult).toBeDefined();
      expect(walkerResult!.verified).toBe(true);
    });
  });

  describe('buildValidationReport', () => {
    it('builds a markdown report with flagged and verified sections', () => {
      const statResults = [
        { claim: 'Sam Darnold: passing_yards = 3,200', verified: true, actual: 'nflverse: 3180', source: 'query_player_epa.py' },
        { claim: 'Sam Darnold: touchdowns = 50', verified: false, actual: 'nflverse: 21', source: 'query_player_epa.py' },
      ];
      const draftResults = [
        { claim: 'JSN round 1, pick 20', verified: true, actual: 'Confirmed: round 1, pick 20, 2023 draft', source: 'query_draft_value.py' },
        { claim: 'Walker round 3', verified: false, actual: 'MISMATCH: round: claimed 3, actual 2', source: 'query_draft_value.py' },
      ];

      const report = buildValidationReport(statResults, draftResults);

      expect(report).toContain('Pre-Publish Fact Validation');
      expect(report).toContain('Flagged Claims');
      expect(report).toContain('Verified Claims');
      expect(report).toContain('🔴'); // MISMATCH gets 🔴
      expect(report).toContain('⚠️'); // Non-mismatch failures get ⚠️
      expect(report).toContain('✅');
      expect(report).toContain('2/4 claims verified');
    });

    it('handles all-verified case', () => {
      const results = [
        { claim: 'test', verified: true, actual: 'confirmed', source: 'test' },
      ];
      const report = buildValidationReport(results, []);

      expect(report).toContain('Verified Claims');
      expect(report).not.toContain('Flagged Claims');
      expect(report).toContain('1/1 claims verified');
    });

    it('handles no claims', () => {
      const report = buildValidationReport([], []);

      expect(report).toContain('No verifiable');
    });
  });
});
