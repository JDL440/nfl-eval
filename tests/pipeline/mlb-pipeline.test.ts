import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/index.js';
import { getLeagueDataTool } from '../../src/pipeline/actions.js';
import { getClaimConfig, extractClaims } from '../../src/pipeline/claim-extractor.js';
import { currentSeason, dataSourceName, getPositionConfig } from '../../src/pipeline/league-helpers.js';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

describe('MLB Pipeline Integration', () => {
  const config = loadConfig({ league: 'mlb' });

  describe('Config integration', () => {
    it('MLB config loads with all required fields', () => {
      expect(config.league).toBe('mlb');
      expect(config.leagueConfig.name).toBe('MLB Lab');
      expect(config.leagueConfig.panelName).toContain('MLB Lab Expert Panel');
      expect(config.teams).toHaveLength(30);
    });

    it('league-specific directories resolve correctly', () => {
      expect(config.articlesDir).toContain(join('leagues', 'mlb', 'articles'));
      expect(config.imagesDir).toContain(join('leagues', 'mlb', 'images'));
      expect(config.chartersDir).toContain(join('agents', 'charters', 'mlb'));
    });
  });

  describe('Tool routing', () => {
    it('routes to statcast-data tool', () => {
      expect(getLeagueDataTool('mlb')).toBe('statcast-data');
    });

    it('does NOT route mlb to nflverse-data', () => {
      expect(getLeagueDataTool('mlb')).not.toBe('nflverse-data');
    });
  });

  describe('League helpers for MLB', () => {
    it('currentSeason returns valid year for mlb', () => {
      const season = currentSeason('mlb');
      expect(season).toBeGreaterThanOrEqual(2024);
      expect(season).toBeLessThanOrEqual(2027);
    });

    it('dataSourceName for mlb mentions Statcast', () => {
      expect(dataSourceName('mlb')).toContain('Statcast');
    });

    it('getPositionConfig for mlb returns baseball positions', () => {
      const positions = getPositionConfig('mlb');
      const allPositions = positions.groups.flatMap(g => g.positions);
      expect(allPositions).toContain('SP');
      expect(allPositions).toContain('SS');
      expect(allPositions).not.toContain('QB');
    });
  });

  describe('MLB claim extraction', () => {
    const claimConfig = getClaimConfig('mlb');

    it('has stat patterns for baseball metrics', () => {
      expect(claimConfig.statPatterns.length).toBeGreaterThan(5);
    });

    it('has draft patterns', () => {
      expect(claimConfig.draftPatterns.length).toBeGreaterThan(0);
    });

    it('has superlative patterns', () => {
      expect(claimConfig.superlativePatterns.length).toBeGreaterThan(0);
    });

    it('extracts batting average claims', () => {
      const claims = extractClaims('Juan Soto hit .288 with 41 home runs', 'mlb');
      expect(claims.statClaims.length + claims.performanceClaims.length).toBeGreaterThan(0);
    });

    it('extracts ERA claims', () => {
      const claims = extractClaims('Corbin Burnes posted a 2.92 ERA in 2024', 'mlb');
      expect(claims.statClaims.length).toBeGreaterThan(0);
    });

    it('extracts WAR claims', () => {
      const claims = extractClaims('Shohei Ohtani was worth 9.2 WAR last season', 'mlb');
      expect(claims.statClaims.length).toBeGreaterThan(0);
    });
  });

  describe('MLB data scripts exist', () => {
    const mlbDataDir = resolve('content/data/mlb');

    it('shared utilities exist', () => {
      expect(existsSync(join(mlbDataDir, '_shared.py'))).toBe(true);
    });

    it('fetcher exists', () => {
      expect(existsSync(join(mlbDataDir, 'fetch_statcast.py'))).toBe(true);
    });

    it('query scripts exist', () => {
      expect(existsSync(join(mlbDataDir, 'query_player_batting.py'))).toBe(true);
      expect(existsSync(join(mlbDataDir, 'query_player_pitching.py'))).toBe(true);
      expect(existsSync(join(mlbDataDir, 'query_team_batting.py'))).toBe(true);
      expect(existsSync(join(mlbDataDir, 'query_rosters.py'))).toBe(true);
    });
  });

  describe('MLB charters exist', () => {
    const chartersDir = resolve('src/config/defaults/charters/mlb');

    for (const charter of ['lead', 'writer', 'editor', 'publisher', 'panel-moderator']) {
      it(`${charter}.md charter exists`, () => {
        expect(existsSync(join(chartersDir, `${charter}.md`))).toBe(true);
      });
    }
  });

  describe('NFL non-regression', () => {
    it('NFL config still loads correctly', () => {
      const nflConfig = loadConfig({ league: 'nfl' });
      expect(nflConfig.league).toBe('nfl');
      expect(nflConfig.teams).toHaveLength(32);
      expect(nflConfig.leagueConfig.name).toBe('NFL Lab');
    });

    it('NFL claim extraction still works', () => {
      const claims = extractClaims('Patrick Mahomes threw for 5,250 passing yards');
      expect(claims.statClaims.length).toBeGreaterThan(0);
    });

    it('NFL tool routing unchanged', () => {
      expect(getLeagueDataTool('nfl')).toBe('nflverse-data');
    });
  });
});
