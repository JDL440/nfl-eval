import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, initDataDir, seedKnowledge } from '../../src/config/index.js';

describe('MLB Boot Sequence', () => {
  it('loadConfig with mlb returns valid AppConfig', () => {
    const config = loadConfig({ league: 'mlb' });
    expect(config.league).toBe('mlb');
    expect(config.leagueConfig.name).toBe('MLB Lab');
    expect(config.leagueConfig.dataSource).toBe('baseballsavant');
    expect(config.leagueConfig.positions).toContain('SP');
    expect(config.leagueConfig.positions).toContain('SS');
    expect(config.teams).toHaveLength(30);
  });

  it('initDataDir creates MLB directory structure', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'mlb-boot-'));
    initDataDir(tmp, 'mlb');

    expect(existsSync(join(tmp, 'leagues', 'mlb', 'articles'))).toBe(true);
    expect(existsSync(join(tmp, 'leagues', 'mlb', 'images'))).toBe(true);
    expect(existsSync(join(tmp, 'leagues', 'mlb', 'data-cache'))).toBe(true);
    expect(existsSync(join(tmp, 'agents', 'charters', 'mlb'))).toBe(true);
    expect(existsSync(join(tmp, 'agents', 'skills'))).toBe(true);
  });

  it('seedKnowledge copies all 5 MLB charters', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'mlb-seed-'));
    initDataDir(tmp, 'mlb');
    const result = seedKnowledge(tmp, 'mlb');

    expect(result.charters).toBe(5);
    const charterDir = join(tmp, 'agents', 'charters', 'mlb');
    const files = readdirSync(charterDir).filter(f => f.endsWith('.md'));
    expect(files).toContain('lead.md');
    expect(files).toContain('writer.md');
    expect(files).toContain('editor.md');
    expect(files).toContain('publisher.md');
    expect(files).toContain('panel-moderator.md');
  });

  it('seedKnowledge copies statcast-data.md skill', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'mlb-skill-'));
    initDataDir(tmp, 'mlb');
    const result = seedKnowledge(tmp, 'mlb');

    expect(result.skills).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(tmp, 'agents', 'skills', 'statcast-data.md'))).toBe(true);
    const content = readFileSync(join(tmp, 'agents', 'skills', 'statcast-data.md'), 'utf-8');
    expect(content).toContain('name: statcast-data');
  });

  it('MLB config has correct substackConfig', () => {
    const config = loadConfig({ league: 'mlb' });
    expect(config.leagueConfig.substackConfig.labName).toBe('MLB Lab');
    expect(config.leagueConfig.substackConfig.footerPatterns).toContain('The MLB Lab');
  });

  it('MLB teams file has expected structure', () => {
    const config = loadConfig({ league: 'mlb' });
    for (const team of config.teams) {
      expect(team).toHaveProperty('abbr');
      expect(team).toHaveProperty('name');
      expect(team).toHaveProperty('city');
      expect(typeof team.abbr).toBe('string');
      expect(team.abbr.length).toBeGreaterThanOrEqual(2);
      expect(team.abbr.length).toBeLessThanOrEqual(3);
    }
  });

  it('initDataDir copies team files including mlb.json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'mlb-teams-'));
    initDataDir(tmp, 'mlb');
    expect(existsSync(join(tmp, 'config', 'teams', 'mlb.json'))).toBe(true);
    const teams = JSON.parse(readFileSync(join(tmp, 'config', 'teams', 'mlb.json'), 'utf-8'));
    expect(teams).toHaveLength(30);
  });

  it('does not break NFL boot when MLB exists', () => {
    const nflConfig = loadConfig({ league: 'nfl' });
    expect(nflConfig.league).toBe('nfl');
    expect(nflConfig.leagueConfig.name).toBe('NFL Lab');
    expect(nflConfig.teams).toHaveLength(32);
  });
});
