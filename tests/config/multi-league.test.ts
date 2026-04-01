import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, initDataDir, seedKnowledge } from '../../src/config/index.js';
import { getLeagueDataTool } from '../../src/pipeline/actions.js';
import { currentSeason, dataSourceName } from '../../src/pipeline/league-helpers.js';
import { getClaimConfig, extractClaims } from '../../src/pipeline/claim-extractor.js';

const teamsDir = resolve('src/config/defaults/teams');
const chartersDir = resolve('src/config/defaults/charters');
const skillsDir = resolve('src/config/defaults/skills');

function loadTeamFile(league: string) {
  return JSON.parse(readFileSync(resolve(teamsDir, `${league}.json`), 'utf-8'));
}

describe('Multi-League Config', () => {
  describe('Config loading', () => {
    it('defaults to nfl when no league override is provided', () => {
      const config = loadConfig();
      expect(config.league).toBe('nfl');
    });

    it('loadConfig with league "nfl" returns config with 32 teams', () => {
      const config = loadConfig({ league: 'nfl' });
      expect(config.league).toBe('nfl');
      expect(config.teams).toHaveLength(32);
    });

    it('loadConfig with league "mlb" returns valid config with 30 teams', () => {
      const config = loadConfig({ league: 'mlb' });
      expect(config.league).toBe('mlb');
      expect(config.teams).toHaveLength(30);
      expect(config.leagueConfig.name).toBe('MLB Lab');
      expect(config.leagueConfig.dataSource).toBe('baseballsavant');
    });
  });

  describe('Team files', () => {
    it('nfl.json has 32 teams', () => {
      const teams = loadTeamFile('nfl');
      expect(teams).toHaveLength(32);
    });

    it('mlb.json has 30 teams', () => {
      const teams = loadTeamFile('mlb');
      expect(teams).toHaveLength(30);
    });

    it('each NFL team has abbr, name, city fields', () => {
      const teams = loadTeamFile('nfl');
      for (const team of teams) {
        expect(team).toHaveProperty('abbr');
        expect(team).toHaveProperty('name');
        expect(team).toHaveProperty('city');
      }
    });

    it('each MLB team has abbr, name, city fields', () => {
      const teams = loadTeamFile('mlb');
      for (const team of teams) {
        expect(team).toHaveProperty('abbr');
        expect(team).toHaveProperty('name');
        expect(team).toHaveProperty('city');
      }
    });

    it('NFL teams include expected abbreviations', () => {
      const teams = loadTeamFile('nfl');
      const abbrs = teams.map((t: { abbr: string }) => t.abbr);
      for (const expected of ['ARI', 'GB', 'KC', 'SF', 'LAR']) {
        expect(abbrs).toContain(expected);
      }
    });

    it('MLB teams include expected abbreviations', () => {
      const teams = loadTeamFile('mlb');
      const abbrs = teams.map((t: { abbr: string }) => t.abbr);
      for (const expected of ['NYY', 'LAD', 'BOS', 'CHC', 'STL']) {
        expect(abbrs).toContain(expected);
      }
    });
  });

  describe('League data tool routing', () => {
    it('returns nflverse-data for nfl', () => {
      expect(getLeagueDataTool('nfl')).toBe('nflverse-data');
    });

    it('returns statcast-data for mlb', () => {
      expect(getLeagueDataTool('mlb')).toBe('statcast-data');
    });

    it('returns nflverse-data as default fallback for unknown leagues', () => {
      expect(getLeagueDataTool('nba')).toBe('nflverse-data');
    });
  });

  describe('Current season helper', () => {
    it('returns a reasonable year', () => {
      const year = currentSeason();
      expect(year).toBeGreaterThanOrEqual(2024);
      expect(year).toBeLessThanOrEqual(2027);
    });

    it('returns a number for nfl', () => {
      expect(typeof currentSeason('nfl')).toBe('number');
    });

    it('returns a number for mlb', () => {
      expect(typeof currentSeason('mlb')).toBe('number');
    });

    it('returns a number for nba', () => {
      expect(typeof currentSeason('nba')).toBe('number');
    });
  });

  describe('Claim extraction', () => {
    it('NFL config has non-empty statPatterns', () => {
      const config = getClaimConfig('nfl');
      expect(config.statPatterns.length).toBeGreaterThan(0);
    });

    it('NFL config has non-empty draftPatterns', () => {
      const config = getClaimConfig('nfl');
      expect(config.draftPatterns.length).toBeGreaterThan(0);
    });

    it('NFL config has non-empty superlativePatterns', () => {
      const config = getClaimConfig('nfl');
      expect(config.superlativePatterns.length).toBeGreaterThan(0);
    });

    it('MLB config exists with expected shape', () => {
      const config = getClaimConfig('mlb');
      expect(config).toHaveProperty('statPatterns');
      expect(config).toHaveProperty('draftPatterns');
      expect(config).toHaveProperty('superlativePatterns');
    });

    it('extractClaims extracts stat claims from NFL text', () => {
      const claims = extractClaims('Patrick Mahomes threw for 5,250 passing yards');
      expect(claims.statClaims.length).toBeGreaterThan(0);
    });
  });

  describe('League helpers', () => {
    it('dataSourceName for nfl returns nflverse', () => {
      expect(dataSourceName('nfl')).toBe('nflverse');
    });

    it('dataSourceName for mlb contains Statcast', () => {
      expect(dataSourceName('mlb')).toContain('Statcast');
    });
  });

  describe('MLB charter files', () => {
    const expectedCharters = ['lead.md', 'writer.md', 'editor.md', 'publisher.md', 'panel-moderator.md'];

    it('mlb charter directory exists', () => {
      expect(existsSync(join(chartersDir, 'mlb'))).toBe(true);
    });

    for (const file of expectedCharters) {
      it(`mlb/${file} exists and has Identity section`, () => {
        const path = join(chartersDir, 'mlb', file);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('## Identity');
        expect(content).toContain('## Responsibilities');
      });
    }

    it('mlb charters reference MLB Lab branding', () => {
      const lead = readFileSync(join(chartersDir, 'mlb', 'lead.md'), 'utf-8');
      expect(lead.toLowerCase()).toContain('mlb');
    });

    it('mlb charters do NOT hardcode NFL references', () => {
      for (const file of expectedCharters) {
        const content = readFileSync(join(chartersDir, 'mlb', file), 'utf-8');
        expect(content).not.toMatch(/\bnflverse\b/i);
        expect(content).not.toMatch(/\bNFL Lab\b/);
      }
    });
  });

  describe('Statcast data skill', () => {
    it('statcast-data.md exists', () => {
      expect(existsSync(join(skillsDir, 'statcast-data.md'))).toBe(true);
    });

    it('has correct frontmatter', () => {
      const content = readFileSync(join(skillsDir, 'statcast-data.md'), 'utf-8');
      expect(content).toContain('name: statcast-data');
      expect(content).toContain('tools: [statcast-data, prediction-markets]');
    });
  });

  describe('seedKnowledge() for MLB', () => {
    it('seeds MLB charters into a fresh data directory', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'mlb-seed-'));
      initDataDir(tmpDir, 'mlb');
      const result = seedKnowledge(tmpDir, 'mlb');
      expect(result.charters).toBe(5);
      expect(existsSync(join(tmpDir, 'agents', 'charters', 'mlb', 'lead.md'))).toBe(true);
      expect(existsSync(join(tmpDir, 'agents', 'charters', 'mlb', 'writer.md'))).toBe(true);
    });

    it('seeds statcast-data.md skill alongside existing skills', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'mlb-seed-'));
      initDataDir(tmpDir, 'mlb');
      const result = seedKnowledge(tmpDir, 'mlb');
      expect(result.skills).toBeGreaterThanOrEqual(1);
      expect(existsSync(join(tmpDir, 'agents', 'skills', 'statcast-data.md'))).toBe(true);
    });

    it('initDataDir creates league-specific directories for mlb', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'mlb-init-'));
      initDataDir(tmpDir, 'mlb');
      expect(existsSync(join(tmpDir, 'leagues', 'mlb', 'articles'))).toBe(true);
      expect(existsSync(join(tmpDir, 'leagues', 'mlb', 'data-cache'))).toBe(true);
      expect(existsSync(join(tmpDir, 'agents', 'charters', 'mlb'))).toBe(true);
    });

    it('does not overwrite existing charters on re-seed', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'mlb-reseed-'));
      initDataDir(tmpDir, 'mlb');
      const first = seedKnowledge(tmpDir, 'mlb');
      expect(first.charters).toBe(5);
      const second = seedKnowledge(tmpDir, 'mlb');
      expect(second.charters).toBe(0);
    });
  });
});
