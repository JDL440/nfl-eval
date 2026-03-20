import { existsSync, mkdirSync, cpSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export interface LeagueConfig {
  name: string;
  panelName: string;
  dataSource: string;
  positions: string[];
  substackConfig: {
    labName: string;
    subscribeCaption: string;
    footerPatterns: string[];
  };
}

export interface AppConfig {
  dataDir: string;
  league: string;
  leagueConfig: LeagueConfig;
  dbPath: string;
  articlesDir: string;
  imagesDir: string;
  chartersDir: string;
  skillsDir: string;
  memoryDbPath: string;
  logsDir: string;
  port: number;
  env: 'development' | 'production';
}

const DEFAULT_DATA_DIR = join(homedir(), '.nfl-lab');
const DEFAULT_LEAGUE = 'nfl';
const DEFAULT_PORT = 3456;

/**
 * Load .env file if it exists (simple key=value parser, no dependency needed)
 */
function loadDotEnv(dir: string): void {
  const envPath = join(dir, '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const DEFAULT_NFL_CONFIG: LeagueConfig = {
  name: 'NFL Lab',
  panelName: 'The NFL Lab Expert Panel',
  dataSource: 'nflverse',
  positions: ['QB', 'RB', 'WR', 'TE', 'EDGE', 'CB', 'S', 'LB', 'DL', 'OL'],
  substackConfig: {
    labName: 'NFL Lab',
    subscribeCaption: 'Thanks for reading NFL Lab! Subscribe for free to receive new posts.',
    footerPatterns: ['The NFL Lab', 'Expert Panel', 'virtual front office'],
  },
};

/**
 * Load league configurations from leagues.json in data dir or defaults
 */
function loadLeagueConfigs(dataDir: string): Record<string, LeagueConfig> {
  const configPath = join(dataDir, 'config', 'leagues.json');
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return { nfl: DEFAULT_NFL_CONFIG };
}

/**
 * Initialize data directory structure. Creates directories and copies seed configs
 * if they don't exist.
 */
export function initDataDir(dataDir: string): void {
  const dirs = [
    '',
    'config',
    'logs',
    join('leagues', 'nfl', 'articles'),
    join('leagues', 'nfl', 'images'),
    join('leagues', 'nfl', 'data-cache'),
    join('agents', 'charters'),
    join('agents', 'charters', 'nfl'),
    join('agents', 'skills'),
  ];

  for (const dir of dirs) {
    const fullPath = join(dataDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  // Copy seed configs if they don't exist
  const seedDir = join(__dirname, 'defaults');
  if (existsSync(seedDir)) {
    const configDir = join(dataDir, 'config');
    for (const file of ['models.json', 'leagues.json']) {
      const target = join(configDir, file);
      const source = join(seedDir, file);
      if (!existsSync(target) && existsSync(source)) {
        cpSync(source, target);
      }
    }
  }
}

/**
 * Load application configuration from environment and data directory.
 */
export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const dataDir = resolve(overrides?.dataDir ?? process.env.NFL_DATA_DIR ?? DEFAULT_DATA_DIR);

  // Load .env from data dir config
  loadDotEnv(join(dataDir, 'config'));
  // Also try repo root .env
  loadDotEnv(process.cwd());

  const league = overrides?.league ?? process.env.NFL_LEAGUE ?? DEFAULT_LEAGUE;
  const leagueConfigs = loadLeagueConfigs(dataDir);
  const leagueConfig = leagueConfigs[league];

  if (!leagueConfig) {
    throw new Error(`Unknown league "${league}". Available: ${Object.keys(leagueConfigs).join(', ')}`);
  }

  const port = overrides?.port ?? parseInt(process.env.NFL_PORT ?? String(DEFAULT_PORT), 10);
  const env = (overrides?.env ?? process.env.NODE_ENV ?? 'development') as 'development' | 'production';

  return {
    dataDir,
    league,
    leagueConfig,
    dbPath: join(dataDir, 'pipeline.db'),
    articlesDir: join(dataDir, 'leagues', league, 'articles'),
    imagesDir: join(dataDir, 'leagues', league, 'images'),
    chartersDir: join(dataDir, 'agents', 'charters', league),
    skillsDir: join(dataDir, 'agents', 'skills'),
    memoryDbPath: join(dataDir, 'agents', 'memory.db'),
    logsDir: join(dataDir, 'logs'),
    port,
    env,
    ...overrides,
  };
}
