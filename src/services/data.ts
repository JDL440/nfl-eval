/**
 * DataService -- nflverse data queries via Python CLI scripts.
 *
 * Primary mode: shells out to Python scripts in content/data/ via
 * child_process.execFile. Fallback: HTTP sidecar at localhost:8100
 * when DATA_SOURCE=http or when scripts are unavailable.
 *
 * Mode selection (env DATA_SOURCE):
 *   "scripts" -- always use Python scripts (default)
 *   "http"    -- always use HTTP sidecar
 *   "auto"    -- try scripts first, fall back to HTTP on failure
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

// ── Types ────────────────────────────────────────────────────────────

export type DataSourceMode = 'scripts' | 'http' | 'auto';

export interface DataServiceConfig {
  scriptsDir?: string;
  pythonCmd?: string;
  baseUrl?: string;
  mode?: DataSourceMode;
  scriptTimeout?: number;
}

export interface HealthResponse {
  status: string;
  league: string;
}

export interface DraftHistoryOptions {
  position?: string;
  pickRange?: string;
  player?: string;
  round?: number;
  since?: number;
}

export interface CombineProfileOptions {
  player?: string;
  position?: string;
  metric?: string;
  top?: number;
}

export interface DefenseStatsOptions {
  player?: string;
  team?: string;
  position?: string;
  top?: number;
}

export interface PredictionMarketOptions {
  search?: string;
  team?: string;
  marketType?: string;
}

export interface HistoricalCompsOptions {
  seasonsBack?: number;
  top?: number;
}

export class DataServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'DataServiceError';
  }
}

// ── Service ──────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'http://localhost:8100';
const DEFAULT_SCRIPT_TIMEOUT = 120_000;
const MAX_BUFFER = 10 * 1024 * 1024;

export class DataService {
  private readonly scriptsDir: string;
  private readonly pythonCmd: string;
  private readonly baseUrl: string;
  private readonly mode: DataSourceMode;
  private readonly scriptTimeout: number;

  constructor(config?: DataServiceConfig) {
    this.scriptsDir =
      config?.scriptsDir ?? process.env.NFL_SCRIPTS_DIR ?? join(process.cwd(), 'content', 'data');
    this.pythonCmd = config?.pythonCmd ?? 'python';
    this.baseUrl = (config?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.mode = config?.mode ?? (resolveEnvMode() || 'scripts');
    this.scriptTimeout = config?.scriptTimeout ?? DEFAULT_SCRIPT_TIMEOUT;
  }

  // ── Public API ───────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    if (this.mode !== 'http') {
      return { status: 'ok', league: 'nfl' } as HealthResponse;
    }
    return this.httpGet<HealthResponse>('/health');
  }

  async playerStats(player: string, season?: number): Promise<unknown> {
    const args = ['--player', player];
    if (season !== undefined) args.push('--season', String(season));
    return this.query('query_player_epa.py', args, '/api/player-stats', {
      player,
      ...(season !== undefined && { season: String(season) }),
    });
  }

  async teamEfficiency(team: string, season?: number): Promise<unknown> {
    const args = ['--team', team];
    if (season !== undefined) args.push('--season', String(season));
    return this.query('query_team_efficiency.py', args, '/api/team-efficiency', {
      team,
      ...(season !== undefined && { season: String(season) }),
    });
  }

  async positionalRankings(
    position: string,
    metric: string,
    season?: number,
    top?: number,
  ): Promise<unknown> {
    const args = ['--position', position, '--metric', metric];
    if (season !== undefined) args.push('--season', String(season));
    if (top !== undefined) args.push('--top', String(top));
    return this.query(
      'query_positional_comparison.py',
      args,
      '/api/positional-rankings',
      {
        position,
        metric,
        ...(season !== undefined && { season: String(season) }),
        ...(top !== undefined && { top: String(top) }),
      },
    );
  }

  async snapCounts(
    season?: number,
    team?: string,
    player?: string,
    positionGroup?: string,
    top?: number,
  ): Promise<unknown> {
    const args: string[] = [];
    if (season !== undefined) args.push('--season', String(season));
    if (player !== undefined) {
      args.push('--player', player);
    } else if (team !== undefined) {
      args.push('--team', team);
      if (positionGroup !== undefined)
        args.push('--position-group', positionGroup);
      if (top !== undefined) args.push('--top', String(top));
    }
    const httpParams: Record<string, string> = {};
    if (season !== undefined) httpParams.season = String(season);
    if (team !== undefined) httpParams.team = team;
    if (player !== undefined) httpParams.player = player;
    return this.query('query_snap_usage.py', args, '/api/snap-counts', httpParams);
  }

  async draftHistory(options?: DraftHistoryOptions): Promise<unknown> {
    const args: string[] = [];
    const httpParams: Record<string, string> = {};
    if (options?.player !== undefined) {
      args.push('--player', options.player);
      httpParams.player = options.player;
    } else if (options?.pickRange !== undefined) {
      args.push('--pick-range', options.pickRange);
      httpParams.pick_range = options.pickRange;
    } else if (options?.position !== undefined) {
      args.push('--position', options.position);
      httpParams.position = options.position;
      if (options.round !== undefined) {
        args.push('--round', String(options.round));
      }
    }
    if (options?.since !== undefined) {
      args.push('--since', String(options.since));
    }
    return this.query('query_draft_value.py', args, '/api/draft-history', httpParams);
  }

  async combineProfile(options?: CombineProfileOptions): Promise<unknown> {
    const args: string[] = [];
    const httpParams: Record<string, string> = {};
    if (options?.player !== undefined) {
      args.push('--player', options.player);
      httpParams.player = options.player;
    } else if (options?.position !== undefined) {
      args.push('--position', options.position);
      httpParams.position = options.position;
      if (options.metric !== undefined) {
        args.push('--metric', options.metric);
        httpParams.metric = options.metric;
      }
      if (options.top !== undefined) {
        args.push('--top', String(options.top));
      }
    }
    return this.query('query_combine_comps.py', args, '/api/combine', httpParams);
  }

  async ngsPassing(
    season?: number,
    player?: string,
    metric?: string,
    top?: number,
  ): Promise<unknown> {
    const args: string[] = [];
    const httpParams: Record<string, string> = {};
    if (season !== undefined) {
      args.push('--season', String(season));
      httpParams.season = String(season);
    }
    if (player !== undefined) {
      args.push('--player', player);
      httpParams.player = player;
    }
    if (metric !== undefined) {
      args.push('--metric', metric);
      httpParams.metric = metric;
    }
    if (top !== undefined) {
      args.push('--top', String(top));
    }
    return this.query('query_ngs_passing.py', args, '/api/ngs-passing', httpParams);
  }

  async defenseStats(
    season?: number,
    options?: DefenseStatsOptions,
  ): Promise<unknown> {
    const args: string[] = [];
    const httpParams: Record<string, string> = {};
    if (season !== undefined) {
      args.push('--season', String(season));
      httpParams.season = String(season);
    }
    if (options?.player !== undefined) {
      args.push('--player', options.player);
      httpParams.player = options.player;
    } else if (options?.team !== undefined) {
      args.push('--team', options.team);
      httpParams.team = options.team;
    } else if (options?.position !== undefined) {
      args.push('--position', options.position);
      httpParams.position = options.position;
    }
    if (options?.top !== undefined) {
      args.push('--top', String(options.top));
    }
    return this.query('query_pfr_defense.py', args, '/api/defense', httpParams);
  }

  async historicalComps(
    player: string,
    season: number,
    options?: HistoricalCompsOptions,
  ): Promise<unknown> {
    const args = ['--player', player, '--season', String(season)];
    if (options?.seasonsBack !== undefined)
      args.push('--seasons-back', String(options.seasonsBack));
    if (options?.top !== undefined)
      args.push('--top', String(options.top));
    return this.query('query_historical_comps.py', args, '/api/historical-comps', {
      player,
      season: String(season),
    });
  }

  async predictionMarkets(
    options?: PredictionMarketOptions,
  ): Promise<unknown> {
    const args: string[] = [];
    const httpParams: Record<string, string> = {};
    if (options?.search !== undefined) {
      args.push('--search', options.search);
      httpParams.search = options.search;
    }
    if (options?.team !== undefined) {
      args.push('--team', options.team);
      httpParams.team = options.team;
    }
    if (options?.marketType !== undefined) {
      args.push('--market-type', options.marketType);
      httpParams.market_type = options.marketType;
    }
    return this.query(
      'query_prediction_markets.py',
      args,
      '/api/prediction-markets',
      httpParams,
    );
  }

  // ── Script execution (public for testability) ───────────────────

  async runScript(scriptName: string, args: string[]): Promise<unknown> {
    const scriptPath = join(this.scriptsDir, scriptName);
    const cmd = [scriptPath, ...args, '--format', 'json'];
    try {
      const { stdout, stderr } = await execFileAsync(this.pythonCmd, cmd, {
        cwd: process.cwd(),
        timeout: this.scriptTimeout,
        maxBuffer: MAX_BUFFER,
      });
      if (stderr) {
        const isError =
          stderr.includes('\u274C') || stderr.includes('ERROR');
        if (isError) {
          throw new DataServiceError(
            `Script ${scriptName} error: ${stderr.trim()}`,
          );
        }
      }
      try {
        return JSON.parse(stdout);
      } catch {
        throw new DataServiceError(
          `Script ${scriptName} returned non-JSON output: ${stdout.slice(0, 200)}`,
        );
      }
    } catch (err) {
      if (err instanceof DataServiceError) throw err;
      const e = err as NodeJS.ErrnoException & { stderr?: string };
      if (e.code === 'ENOENT') {
        throw new DataServiceError(
          `Python executable not found: "${this.pythonCmd}". ` +
            'Install Python or set pythonCmd / DATA_PYTHON_CMD.',
        );
      }
      const msg = e.stderr?.trim() || e.message;
      throw new DataServiceError(`Script ${scriptName} failed: ${msg}`);
    }
  }

  // ── Internals ───────────────────────────────────────────────────

  private async query(
    script: string,
    scriptArgs: string[],
    httpPath: string,
    httpParams: Record<string, string>,
  ): Promise<unknown> {
    if (this.mode === 'http') {
      return this.httpGet(httpPath, httpParams);
    }
    if (this.mode === 'scripts') {
      return this.runScript(script, scriptArgs);
    }
    // auto: try scripts, fall back to HTTP
    try {
      return await this.runScript(script, scriptArgs);
    } catch {
      return this.httpGet(httpPath, httpParams);
    }
  }

  private async httpGet<T = unknown>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (err) {
      throw new DataServiceError(
        `Data sidecar unreachable at ${this.baseUrl}: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new DataServiceError(
        `Sidecar returned ${response.status} for ${path}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function resolveEnvMode(): DataSourceMode | undefined {
  const val = process.env.DATA_SOURCE?.toLowerCase();
  if (val === 'scripts' || val === 'http' || val === 'auto') return val;
  return undefined;
}
