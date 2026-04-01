import { existsSync, mkdirSync, cpSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { normalizeContextPreset, type ContextPreset } from '../pipeline/context-config.js';

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
  cacheDir: string;
  port: number;
  env: 'development' | 'production' | 'test';
  dashboardAuth?: DashboardAuthConfig;
  contextPreset?: ContextPreset;
}

export interface DashboardAuthConfig {
  mode: 'off' | 'local';
  username?: string;
  password?: string;
  sessionCookieName: string;
  sessionTtlHours: number;
  secureCookies: boolean;
}

export type AppConfigOverrides = Partial<Omit<AppConfig, 'dashboardAuth'>> & {
  dashboardAuth?: Partial<DashboardAuthConfig>;
};

const DEFAULT_DATA_DIR = join(homedir(), '.nfl-lab');
const DEFAULT_LEAGUE = 'nfl';
const DEFAULT_PORT = 3456;
const DEFAULT_DASHBOARD_SESSION_COOKIE = 'nfl_lab_dashboard_session';
export const COPILOT_CLI_DEFAULT_MODEL = 'claude-sonnet-4.6';
export const COPILOT_CLI_DEFAULT_MODE = 'article-tools';
export const COPILOT_CLI_DEFAULT_WEB_SEARCH = true;
export const COPILOT_CLI_DEFAULT_SESSION_REUSE = true;

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
 * Initialize data directory structure. Creates directories and copies seed configs.
 * Does NOT seed charters/skills/memory — use seedKnowledge() for that.
 */
export function initDataDir(dataDir: string, league: string = DEFAULT_LEAGUE): void {
  const dirs = [
    '',
    'config',
    'logs',
    join('leagues', league, 'articles'),
    join('leagues', league, 'images'),
    join('leagues', league, 'data-cache'),
    join('agents', 'charters'),
    join('agents', 'charters', league),
    join('agents', 'skills'),
  ];

  for (const dir of dirs) {
    const fullPath = join(dataDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  const seedDir = join(__dirname, 'defaults');
  if (!existsSync(seedDir)) return;

  // Copy seed configs if they don't exist
  const configDir = join(dataDir, 'config');
  for (const file of ['models.json', 'leagues.json']) {
    const target = join(configDir, file);
    const source = join(seedDir, file);
    if (!existsSync(target) && existsSync(source)) {
      cpSync(source, target);
    }
  }
}

/**
 * Seed agent knowledge (charters, skills, bootstrap memory) for a fresh install.
 * Only copies files that don't already exist — safe to call multiple times.
 * Called by `npm run v2:init`, NOT by general startup.
 */
export function seedKnowledge(dataDir: string, league: string = DEFAULT_LEAGUE): { charters: number; skills: number; memory: number } {
  const seedDir = join(__dirname, 'defaults');
  const result = { charters: 0, skills: 0, memory: 0 };
  if (!existsSync(seedDir)) return result;

  // Seed charters for this league (only if charter dir is empty)
  const charterSeedDir = join(seedDir, 'charters', league);
  const charterDestDir = join(dataDir, 'agents', 'charters', league);
  if (existsSync(charterSeedDir)) {
    const existing = existsSync(charterDestDir)
      ? readdirSync(charterDestDir).filter((f) => f.endsWith('.md'))
      : [];
    if (existing.length === 0) {
      const files = readdirSync(charterSeedDir).filter((f) => f.endsWith('.md'));
      cpSync(charterSeedDir, charterDestDir, { recursive: true });
      result.charters = files.length;
    }
  }

  // Seed skills (only files that don't already exist)
  const skillSeedDir = join(seedDir, 'skills');
  const skillDestDir = join(dataDir, 'agents', 'skills');
  if (existsSync(skillSeedDir)) {
    for (const file of readdirSync(skillSeedDir)) {
      if (!file.endsWith('.md')) continue;
      const target = join(skillDestDir, file);
      if (!existsSync(target)) {
        cpSync(join(skillSeedDir, file), target);
        result.skills++;
      }
    }
  }

  // DEPRECATED — Memory bootstrap: DB and schema are created here to keep the storage layer
  // intact for a future redesign spike, but runtime prompt injection is disabled in runner.ts.
  // Entries seeded below will not be recalled or injected during pipeline execution.
  // Bootstrap memory (only if memory.db doesn't exist yet)
  const memoryPath = join(dataDir, 'agents', 'memory.db');
  const bootstrapPath = join(seedDir, 'bootstrap-memory.json');
  if (!existsSync(memoryPath) && existsSync(bootstrapPath)) {
    try {
      const { AgentMemory } = require('../agents/memory.js');
      const entries = JSON.parse(readFileSync(bootstrapPath, 'utf-8'));
      const memory = new AgentMemory(memoryPath);
      for (const entry of entries) {
        memory.store({
          agentName: entry.agentName,
          category: entry.category,
          content: entry.content,
          relevanceScore: entry.relevanceScore ?? 1.0,
        });
        result.memory++;
      }
      memory.close();
    } catch {
      // Non-fatal: memory bootstrap is optional
    }
  }

  return result;
}

export const CORE_RUNTIME_PROMPT_DEFAULTS = Object.freeze({
  charters: ['lead', 'writer', 'editor', 'panel-moderator', 'publisher'] as const,
  skills: [
    'article-discussion',
    'article-lifecycle',
    'discussion-prompt',
    'panel-composition',
    'fact-checking',
    'idea-generation',
    'substack-article',
    'writer-fact-check',
    'editor-review',
    'publisher',
  ] as const,
});

export function refreshCorePromptDefaults(
  dataDir: string,
  league: string = DEFAULT_LEAGUE,
): { charters: number; skills: number; updated: string[] } {
  const seedDir = join(__dirname, 'defaults');
  const result = { charters: 0, skills: 0, updated: [] as string[] };
  if (!existsSync(seedDir)) return result;

  const charterSeedDir = join(seedDir, 'charters', league);
  const charterDestDir = join(dataDir, 'agents', 'charters', league);
  mkdirSync(charterDestDir, { recursive: true });
  for (const name of CORE_RUNTIME_PROMPT_DEFAULTS.charters) {
    const source = join(charterSeedDir, `${name}.md`);
    if (!existsSync(source)) continue;
    cpSync(source, join(charterDestDir, `${name}.md`));
    result.charters += 1;
    result.updated.push(`charter:${name}`);
  }

  const skillSeedDir = join(seedDir, 'skills');
  const skillDestDir = join(dataDir, 'agents', 'skills');
  mkdirSync(skillDestDir, { recursive: true });
  for (const name of CORE_RUNTIME_PROMPT_DEFAULTS.skills) {
    const source = join(skillSeedDir, `${name}.md`);
    if (!existsSync(source)) continue;
    cpSync(source, join(skillDestDir, `${name}.md`));
    result.skills += 1;
    result.updated.push(`skill:${name}`);
  }

  return result;
}

/**
 * Prepare the runtime data directory for normal app startup.
 * This intentionally overwrites the curated core prompts so the live runtime
 * stays aligned with the repo-managed defaults.
 */
export function prepareRuntimeDataDir(
  dataDir: string,
  league: string = DEFAULT_LEAGUE,
): { refreshed: { charters: number; skills: number; updated: string[] } } {
  initDataDir(dataDir, league);
  return {
    refreshed: refreshCorePromptDefaults(dataDir, league),
  };
}

/**
 * Load application configuration from environment and data directory.
 */
export function resolveDashboardAuthConfig(
  env: 'development' | 'production' | 'test',
  overrides?: Partial<DashboardAuthConfig>,
): DashboardAuthConfig {
  const rawMode = (overrides?.mode ?? process.env.DASHBOARD_AUTH_MODE ?? 'off').trim().toLowerCase();
  if (rawMode !== 'off' && rawMode !== 'local') {
    throw new Error(`Invalid DASHBOARD_AUTH_MODE "${rawMode}". Expected "off" or "local".`);
  }

  const sessionTtlHours = overrides?.sessionTtlHours
    ?? parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS ?? '24', 10);
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours <= 0) {
    throw new Error('DASHBOARD_SESSION_TTL_HOURS must be a positive number of hours.');
  }

  const username = overrides?.username ?? process.env.DASHBOARD_AUTH_USERNAME ?? '';
  const password = overrides?.password ?? process.env.DASHBOARD_AUTH_PASSWORD ?? '';

  if (rawMode === 'local' && (!username.trim() || !password)) {
    throw new Error(
      'Local dashboard auth requires both DASHBOARD_AUTH_USERNAME and DASHBOARD_AUTH_PASSWORD.',
    );
  }

  return {
    mode: rawMode,
    username: username.trim() || undefined,
    password: password || undefined,
    sessionCookieName: overrides?.sessionCookieName
      ?? process.env.DASHBOARD_SESSION_COOKIE
      ?? DEFAULT_DASHBOARD_SESSION_COOKIE,
    sessionTtlHours,
    secureCookies: overrides?.secureCookies
      ?? (process.env.DASHBOARD_SECURE_COOKIES?.toLowerCase() === 'true'),
  };
}

export function loadConfig(overrides?: AppConfigOverrides): AppConfig {
  const dataDir = resolve(overrides?.dataDir ?? process.env.NFL_DATA_DIR ?? DEFAULT_DATA_DIR);

  loadDotEnv(join(dataDir, 'config'));
  loadDotEnv(process.cwd());

  const league = overrides?.league ?? process.env.NFL_LEAGUE ?? DEFAULT_LEAGUE;
  const leagueConfigs = loadLeagueConfigs(dataDir);
  const leagueConfig = leagueConfigs[league];

  if (!leagueConfig) {
    throw new Error(`Unknown league "${league}". Available: ${Object.keys(leagueConfigs).join(', ')}`);
  }

  const port = overrides?.port ?? parseInt(process.env.NFL_PORT ?? String(DEFAULT_PORT), 10);
  const env = (overrides?.env ?? process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test';
  const dashboardAuth = resolveDashboardAuthConfig(env, overrides?.dashboardAuth);
  const contextPreset = overrides?.contextPreset ?? normalizeContextPreset(process.env.NFL_CONTEXT_PRESET);

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
    cacheDir: join(dataDir, 'leagues', league, 'data-cache'),
    port,
    env,
    contextPreset,
    ...overrides,
    dashboardAuth,
  };
}
