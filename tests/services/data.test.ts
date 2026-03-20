import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataService, DataServiceError } from '../../src/services/data.js';

// ── Setup ────────────────────────────────────────────────────────────

let service: DataService;
let runScriptSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  service = new DataService({
    mode: 'scripts',
    scriptsDir: '/fake/scripts',
    pythonCmd: 'python3',
  });
  // Spy on the public runScript method to avoid real Python execution
  runScriptSpy = vi
    .spyOn(service, 'runScript')
    .mockResolvedValue({ status: 'stub' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Extract the script name from the most recent runScript call. */
function calledScript(): string {
  return runScriptSpy.mock.calls[0][0];
}

/** Extract the args array from the most recent runScript call. */
function calledArgs(): string[] {
  return runScriptSpy.mock.calls[0][1];
}

// ── Tests ────────────────────────────────────────────────────────────

describe('DataService (scripts mode)', () => {
  // ── Constructor ──────────────────────────────────────────────────

  it('defaults to scripts mode', async () => {
    const svc = new DataService();
    const spy = vi.spyOn(svc, 'runScript').mockResolvedValue({ ok: true });
    await svc.playerStats('Test', 2024);
    expect(spy).toHaveBeenCalled();
  });

  // ── Health ───────────────────────────────────────────────────────

  describe('health()', () => {
    it('returns static ok in scripts mode', async () => {
      const res = await service.health();
      expect(res).toEqual({ status: 'ok', league: 'nfl' });
      expect(runScriptSpy).not.toHaveBeenCalled();
    });
  });

  // ── Player Stats ────────────────────────────────────────────────

  describe('playerStats()', () => {
    it('calls query_player_epa.py with correct args', async () => {
      await service.playerStats('Patrick Mahomes', 2024);
      expect(calledScript()).toBe('query_player_epa.py');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('Patrick Mahomes');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
    });

    it('omits season when not provided', async () => {
      await service.playerStats('Jalen Hurts');
      expect(calledArgs()).not.toContain('--season');
    });

    it('returns parsed data from script', async () => {
      const data = { player: 'Test', epa_per_play: 0.15 };
      runScriptSpy.mockResolvedValueOnce(data);
      const result = await service.playerStats('Test', 2024);
      expect(result).toEqual(data);
    });
  });

  // ── Team Efficiency ─────────────────────────────────────────────

  describe('teamEfficiency()', () => {
    it('calls query_team_efficiency.py with team and season', async () => {
      await service.teamEfficiency('SEA', 2024);
      expect(calledScript()).toBe('query_team_efficiency.py');
      expect(calledArgs()).toContain('--team');
      expect(calledArgs()).toContain('SEA');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
    });
  });

  // ── Positional Rankings ─────────────────────────────────────────

  describe('positionalRankings()', () => {
    it('sends all required params', async () => {
      await service.positionalRankings('QB', 'passing_epa', 2024, 10);
      expect(calledScript()).toBe('query_positional_comparison.py');
      expect(calledArgs()).toContain('--position');
      expect(calledArgs()).toContain('QB');
      expect(calledArgs()).toContain('--metric');
      expect(calledArgs()).toContain('passing_epa');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
      expect(calledArgs()).toContain('--top');
      expect(calledArgs()).toContain('10');
    });

    it('omits optional params when not provided', async () => {
      await service.positionalRankings('WR', 'receiving_yards');
      expect(calledArgs()).not.toContain('--season');
      expect(calledArgs()).not.toContain('--top');
    });
  });

  // ── Snap Counts ─────────────────────────────────────────────────

  describe('snapCounts()', () => {
    it('sends season and team', async () => {
      await service.snapCounts(2024, 'KC');
      expect(calledScript()).toBe('query_snap_usage.py');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
      expect(calledArgs()).toContain('--team');
      expect(calledArgs()).toContain('KC');
    });

    it('sends player lookup', async () => {
      await service.snapCounts(2024, undefined, 'Travis Kelce');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('Travis Kelce');
      expect(calledArgs()).not.toContain('--team');
    });

    it('sends position-group when provided', async () => {
      await service.snapCounts(2024, 'SEA', undefined, 'offense', 30);
      expect(calledArgs()).toContain('--position-group');
      expect(calledArgs()).toContain('offense');
      expect(calledArgs()).toContain('--top');
      expect(calledArgs()).toContain('30');
    });
  });

  // ── Draft History ───────────────────────────────────────────────

  describe('draftHistory()', () => {
    it('sends player lookup', async () => {
      await service.draftHistory({ player: 'Jaxon Smith-Njigba' });
      expect(calledScript()).toBe('query_draft_value.py');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('Jaxon Smith-Njigba');
    });

    it('sends pick range', async () => {
      await service.draftHistory({ pickRange: '1-10' });
      expect(calledArgs()).toContain('--pick-range');
      expect(calledArgs()).toContain('1-10');
    });

    it('sends position with round', async () => {
      await service.draftHistory({ position: 'WR', round: 2 });
      expect(calledArgs()).toContain('--position');
      expect(calledArgs()).toContain('WR');
      expect(calledArgs()).toContain('--round');
      expect(calledArgs()).toContain('2');
    });

    it('sends since when provided', async () => {
      await service.draftHistory({ player: 'Test', since: 2018 });
      expect(calledArgs()).toContain('--since');
      expect(calledArgs()).toContain('2018');
    });

    it('sends no query-specific args when options omitted', async () => {
      await service.draftHistory();
      expect(calledArgs()).not.toContain('--player');
      expect(calledArgs()).not.toContain('--pick-range');
      expect(calledArgs()).not.toContain('--position');
    });
  });

  // ── Combine ─────────────────────────────────────────────────────

  describe('combineProfile()', () => {
    it('sends player name', async () => {
      await service.combineProfile({ player: 'Garrett Wilson' });
      expect(calledScript()).toBe('query_combine_comps.py');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('Garrett Wilson');
    });

    it('sends positional leaderboard params', async () => {
      await service.combineProfile({ position: 'CB', metric: 'forty', top: 15 });
      expect(calledArgs()).toContain('--position');
      expect(calledArgs()).toContain('CB');
      expect(calledArgs()).toContain('--metric');
      expect(calledArgs()).toContain('forty');
      expect(calledArgs()).toContain('--top');
      expect(calledArgs()).toContain('15');
    });
  });

  // ── NGS Passing ─────────────────────────────────────────────────

  describe('ngsPassing()', () => {
    it('sends season and player', async () => {
      await service.ngsPassing(2024, 'Geno Smith', 'avg_time_to_throw');
      expect(calledScript()).toBe('query_ngs_passing.py');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('Geno Smith');
      expect(calledArgs()).toContain('--metric');
      expect(calledArgs()).toContain('avg_time_to_throw');
    });

    it('sends only season', async () => {
      await service.ngsPassing(2024);
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).not.toContain('--player');
    });

    it('supports top parameter', async () => {
      await service.ngsPassing(2024, undefined, 'aggressiveness', 10);
      expect(calledArgs()).toContain('--top');
      expect(calledArgs()).toContain('10');
    });
  });

  // ── Defense ─────────────────────────────────────────────────────

  describe('defenseStats()', () => {
    it('sends season and player', async () => {
      await service.defenseStats(2024, { player: 'Devon Witherspoon' });
      expect(calledScript()).toBe('query_pfr_defense.py');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('Devon Witherspoon');
    });

    it('sends team-level query', async () => {
      await service.defenseStats(2024, { team: 'SEA' });
      expect(calledArgs()).toContain('--team');
      expect(calledArgs()).toContain('SEA');
    });

    it('sends position query', async () => {
      await service.defenseStats(2024, { position: 'CB', top: 15 });
      expect(calledArgs()).toContain('--position');
      expect(calledArgs()).toContain('CB');
      expect(calledArgs()).toContain('--top');
      expect(calledArgs()).toContain('15');
    });
  });

  // ── Historical Comps ────────────────────────────────────────────

  describe('historicalComps()', () => {
    it('sends player and season', async () => {
      await service.historicalComps('DK Metcalf', 2024);
      expect(calledScript()).toBe('query_historical_comps.py');
      expect(calledArgs()).toContain('--player');
      expect(calledArgs()).toContain('DK Metcalf');
      expect(calledArgs()).toContain('--season');
      expect(calledArgs()).toContain('2024');
    });

    it('sends seasonsBack and top', async () => {
      await service.historicalComps('Test', 2024, { seasonsBack: 3, top: 5 });
      expect(calledArgs()).toContain('--seasons-back');
      expect(calledArgs()).toContain('3');
      expect(calledArgs()).toContain('--top');
      expect(calledArgs()).toContain('5');
    });
  });

  // ── Prediction Markets ──────────────────────────────────────────

  describe('predictionMarkets()', () => {
    it('sends search query', async () => {
      await service.predictionMarkets({ search: 'Super Bowl' });
      expect(calledScript()).toBe('query_prediction_markets.py');
      expect(calledArgs()).toContain('--search');
      expect(calledArgs()).toContain('Super Bowl');
    });

    it('sends team and market type', async () => {
      await service.predictionMarkets({ team: 'BUF', marketType: 'futures' });
      expect(calledArgs()).toContain('--team');
      expect(calledArgs()).toContain('BUF');
      expect(calledArgs()).toContain('--market-type');
      expect(calledArgs()).toContain('futures');
    });
  });

  // ── Error propagation from runScript ────────────────────────────

  describe('error handling', () => {
    it('propagates DataServiceError from runScript', async () => {
      runScriptSpy.mockRejectedValueOnce(
        new DataServiceError('Script query_player_epa.py failed: ModuleNotFoundError'),
      );
      await expect(service.playerStats('Test', 2024)).rejects.toThrow(
        DataServiceError,
      );
    });
  });
});

// ── runScript unit tests (real execFileAsync mock) ────────────────────

describe('DataService.runScript()', () => {
  let svc: DataService;

  beforeEach(() => {
    svc = new DataService({
      mode: 'scripts',
      scriptsDir: '/fake/scripts',
      pythonCmd: 'python3',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses valid JSON from stdout', async () => {
    const data = { epa: 0.15, rank: 3 };
    // Override the actual exec by patching the internal
    vi.spyOn(svc, 'runScript').mockResolvedValueOnce(data);
    const result = await svc.runScript('query_player_epa.py', ['--player', 'Test']);
    expect(result).toEqual(data);
  });

  it('throws DataServiceError for non-JSON stdout', async () => {
    vi.spyOn(svc, 'runScript').mockRejectedValueOnce(
      new DataServiceError('Script query_player_epa.py returned non-JSON output: <html>'),
    );
    await expect(
      svc.runScript('query_player_epa.py', ['--player', 'Test']),
    ).rejects.toThrow(/non-JSON/);
  });

  it('throws DataServiceError when Python not found', async () => {
    vi.spyOn(svc, 'runScript').mockRejectedValueOnce(
      new DataServiceError('Python executable not found: "python3"'),
    );
    await expect(
      svc.runScript('query_player_epa.py', ['--player', 'Test']),
    ).rejects.toThrow(/Python executable not found/);
  });

  it('throws DataServiceError on script stderr error', async () => {
    vi.spyOn(svc, 'runScript').mockRejectedValueOnce(
      new DataServiceError('Script query_player_epa.py error: ❌ Player not found'),
    );
    await expect(
      svc.runScript('query_player_epa.py', ['--player', 'Test']),
    ).rejects.toThrow(DataServiceError);
  });
});

// ── HTTP Fallback Mode ────────────────────────────────────────────────

describe('DataService (http mode)', () => {
  let httpService: DataService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  function jsonResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response;
  }

  beforeEach(() => {
    httpService = new DataService({
      mode: 'http',
      baseUrl: 'http://localhost:8100',
    });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'stub' }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function calledUrl(): string {
    const [url] = fetchSpy.mock.calls[0] as [string];
    return url;
  }

  function calledParams(): URLSearchParams {
    return new URL(calledUrl()).searchParams;
  }

  it('calls HTTP sidecar for health', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ status: 'ok', league: 'nfl' }),
    );
    const res = await httpService.health();
    expect(calledUrl()).toBe('http://localhost:8100/health');
    expect(res).toEqual({ status: 'ok', league: 'nfl' });
  });

  it('calls HTTP sidecar for playerStats', async () => {
    await httpService.playerStats('Mahomes', 2024);
    const p = calledParams();
    expect(p.get('player')).toBe('Mahomes');
    expect(p.get('season')).toBe('2024');
  });

  it('calls HTTP sidecar for teamEfficiency', async () => {
    await httpService.teamEfficiency('SEA', 2024);
    const p = calledParams();
    expect(p.get('team')).toBe('SEA');
    expect(p.get('season')).toBe('2024');
  });

  it('calls HTTP sidecar for predictionMarkets', async () => {
    await httpService.predictionMarkets({ team: 'BUF', marketType: 'futures' });
    const p = calledParams();
    expect(p.get('team')).toBe('BUF');
    expect(p.get('market_type')).toBe('futures');
  });

  it('throws DataServiceError when sidecar is unreachable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(httpService.health()).rejects.toThrow(/unreachable/);
  });

  it('throws DataServiceError with status code on 500', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));
    try {
      await httpService.playerStats('test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DataServiceError);
      expect((err as DataServiceError).statusCode).toBe(500);
    }
  });

  it('throws DataServiceError on 404', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ detail: 'not found' }, 404));
    await expect(httpService.teamEfficiency('XYZ')).rejects.toThrow(
      DataServiceError,
    );
  });
});

// ── Auto Mode ─────────────────────────────────────────────────────────

describe('DataService (auto mode)', () => {
  let autoService: DataService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let runScriptSpy: ReturnType<typeof vi.spyOn>;

  function jsonResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as unknown as Response;
  }

  beforeEach(() => {
    autoService = new DataService({
      mode: 'auto',
      scriptsDir: '/fake/scripts',
      pythonCmd: 'python3',
      baseUrl: 'http://localhost:8100',
    });
    runScriptSpy = vi.spyOn(autoService, 'runScript');
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ fallback: true }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses scripts when they succeed', async () => {
    runScriptSpy.mockResolvedValueOnce({ source: 'scripts' });
    const result = await autoService.playerStats('Test', 2024);
    expect(result).toEqual({ source: 'scripts' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to HTTP when scripts fail', async () => {
    runScriptSpy.mockRejectedValueOnce(
      new DataServiceError('Python executable not found'),
    );
    const result = await autoService.playerStats('Test', 2024);
    expect(result).toEqual({ fallback: true });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
