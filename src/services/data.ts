/**
 * DataService — HTTP client for the NFL Data Sidecar (Python FastAPI).
 *
 * The sidecar wraps nflverse data queries behind a REST API so the
 * TypeScript pipeline can fetch player stats, team efficiency, draft
 * history, etc. without spawning Python processes.
 *
 * Default sidecar URL: http://localhost:8100
 */

// ── Types ────────────────────────────────────────────────────────────

export interface DataSidecarConfig {
  baseUrl: string;
}

export interface HealthResponse {
  status: string;
  league: string;
}

export interface DraftHistoryOptions {
  position?: string;
  pickRange?: string;
  player?: string;
}

export interface CombineProfileOptions {
  player?: string;
  position?: string;
  metric?: string;
}

export interface DefenseStatsOptions {
  player?: string;
  team?: string;
  position?: string;
}

export interface PredictionMarketOptions {
  search?: string;
  team?: string;
  marketType?: string;
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

export class DataService {
  private readonly baseUrl: string;

  constructor(config?: DataSidecarConfig) {
    this.baseUrl = (config?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  // ── Public API ───────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  async playerStats(player: string, season?: number): Promise<unknown> {
    const params: Record<string, string> = { player };
    if (season !== undefined) params.season = String(season);
    return this.get('/api/player-stats', params);
  }

  async teamEfficiency(team: string, season?: number): Promise<unknown> {
    const params: Record<string, string> = { team };
    if (season !== undefined) params.season = String(season);
    return this.get('/api/team-efficiency', params);
  }

  async positionalRankings(
    position: string,
    metric: string,
    season?: number,
    top?: number,
  ): Promise<unknown> {
    const params: Record<string, string> = { position, metric };
    if (season !== undefined) params.season = String(season);
    if (top !== undefined) params.top = String(top);
    return this.get('/api/positional-rankings', params);
  }

  async snapCounts(
    season?: number,
    team?: string,
    player?: string,
  ): Promise<unknown> {
    const params: Record<string, string> = {};
    if (season !== undefined) params.season = String(season);
    if (team !== undefined) params.team = team;
    if (player !== undefined) params.player = player;
    return this.get('/api/snap-counts', params);
  }

  async draftHistory(options?: DraftHistoryOptions): Promise<unknown> {
    const params: Record<string, string> = {};
    if (options?.position !== undefined) params.position = options.position;
    if (options?.pickRange !== undefined) params.pick_range = options.pickRange;
    if (options?.player !== undefined) params.player = options.player;
    return this.get('/api/draft-history', params);
  }

  async combineProfile(options?: CombineProfileOptions): Promise<unknown> {
    const params: Record<string, string> = {};
    if (options?.player !== undefined) params.player = options.player;
    if (options?.position !== undefined) params.position = options.position;
    if (options?.metric !== undefined) params.metric = options.metric;
    return this.get('/api/combine', params);
  }

  async ngsPassing(
    season?: number,
    player?: string,
    metric?: string,
  ): Promise<unknown> {
    const params: Record<string, string> = {};
    if (season !== undefined) params.season = String(season);
    if (player !== undefined) params.player = player;
    if (metric !== undefined) params.metric = metric;
    return this.get('/api/ngs-passing', params);
  }

  async defenseStats(
    season?: number,
    options?: DefenseStatsOptions,
  ): Promise<unknown> {
    const params: Record<string, string> = {};
    if (season !== undefined) params.season = String(season);
    if (options?.player !== undefined) params.player = options.player;
    if (options?.team !== undefined) params.team = options.team;
    if (options?.position !== undefined) params.position = options.position;
    return this.get('/api/defense', params);
  }

  async predictionMarkets(
    options?: PredictionMarketOptions,
  ): Promise<unknown> {
    const params: Record<string, string> = {};
    if (options?.search !== undefined) params.search = options.search;
    if (options?.team !== undefined) params.team = options.team;
    if (options?.marketType !== undefined) params.market_type = options.marketType;
    return this.get('/api/prediction-markets', params);
  }

  // ── Internals ────────────────────────────────────────────────────

  private async get<T = unknown>(
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
