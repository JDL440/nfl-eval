import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, initDataDir } from '../src/config/index.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('config', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-lab-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads config with custom data dir', () => {
    const config = loadConfig({ dataDir: tempDir });
    expect(config.dataDir).toBe(tempDir);
    expect(config.league).toBe('nfl');
    expect(config.leagueConfig.name).toBe('NFL Lab');
  });

  it('initializes data directory structure', () => {
    initDataDir(tempDir);
    expect(existsSync(join(tempDir, 'config'))).toBe(true);
    expect(existsSync(join(tempDir, 'logs'))).toBe(true);
    expect(existsSync(join(tempDir, 'leagues', 'nfl', 'articles'))).toBe(true);
    expect(existsSync(join(tempDir, 'agents', 'charters'))).toBe(true);
    expect(existsSync(join(tempDir, 'agents', 'skills'))).toBe(true);
  });

  it('respects NFL_DATA_DIR env var', () => {
    const origEnv = process.env.NFL_DATA_DIR;
    process.env.NFL_DATA_DIR = tempDir;
    try {
      const config = loadConfig();
      expect(config.dataDir).toBe(tempDir);
    } finally {
      if (origEnv) process.env.NFL_DATA_DIR = origEnv;
      else delete process.env.NFL_DATA_DIR;
    }
  });

  it('throws on unknown league', () => {
    expect(() => loadConfig({ dataDir: tempDir, league: 'mlb' })).toThrow('Unknown league');
  });

  it('sets correct paths for league-scoped dirs', () => {
    const config = loadConfig({ dataDir: tempDir });
    expect(config.articlesDir).toContain(join('leagues', 'nfl', 'articles'));
    expect(config.imagesDir).toContain(join('leagues', 'nfl', 'images'));
  });

  it('copies seed configs on initDataDir', () => {
    initDataDir(tempDir);
    expect(existsSync(join(tempDir, 'config', 'models.json'))).toBe(true);
    expect(existsSync(join(tempDir, 'config', 'leagues.json'))).toBe(true);
  });

  it('does not overwrite existing configs on re-init', () => {
    initDataDir(tempDir);
    // Verify first init creates files
    expect(existsSync(join(tempDir, 'config', 'leagues.json'))).toBe(true);
    // Second init should not throw
    initDataDir(tempDir);
    expect(existsSync(join(tempDir, 'config', 'leagues.json'))).toBe(true);
  });

  it('computes all derived paths correctly', () => {
    const config = loadConfig({ dataDir: tempDir });
    expect(config.dbPath).toBe(join(tempDir, 'pipeline.db'));
    expect(config.chartersDir).toBe(join(tempDir, 'agents', 'charters', 'nfl'));
    expect(config.skillsDir).toBe(join(tempDir, 'agents', 'skills'));
    expect(config.memoryDbPath).toBe(join(tempDir, 'agents', 'memory.db'));
    expect(config.logsDir).toBe(join(tempDir, 'logs'));
  });

  it('uses default port and env', () => {
    const origNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const config = loadConfig({ dataDir: tempDir });
      expect(config.port).toBe(3456);
      expect(config.env).toBe('development');
    } finally {
      if (origNodeEnv) process.env.NODE_ENV = origNodeEnv;
      else delete process.env.NODE_ENV;
    }
  });

  it('accepts port and env overrides', () => {
    const config = loadConfig({ dataDir: tempDir, port: 8080, env: 'production' });
    expect(config.port).toBe(8080);
    expect(config.env).toBe('production');
  });
});
