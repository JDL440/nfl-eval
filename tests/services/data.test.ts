import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataService, DataServiceError } from '../../src/services/data.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a mock Response that resolves to `body` as JSON. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ── Setup ────────────────────────────────────────────────────────────

let service: DataService;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  service = new DataService({ baseUrl: 'http://localhost:8100' });
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse({ status: 'stub' }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Extract the URL string from the most recent fetch call. */
function calledUrl(): string {
  const [url] = fetchSpy.mock.calls[0] as [string];
  return url;
}

/** Extract URLSearchParams from the most recent fetch call. */
function calledParams(): URLSearchParams {
  return new URL(calledUrl()).searchParams;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('DataService', () => {
  // ── Constructor ──────────────────────────────────────────────────

  it('uses default base URL when no config provided', async () => {
    const defaultService = new DataService();
    await defaultService.health();
    expect(calledUrl()).toContain('http://localhost:8100');
  });

  it('strips trailing slashes from base URL', async () => {
    const svc = new DataService({ baseUrl: 'http://localhost:9000///' });
    await svc.health();
    expect(calledUrl()).toMatch(/^http:\/\/localhost:9000\/health/);
  });

  // ── Health ───────────────────────────────────────────────────────

  describe('health()', () => {
    it('calls /health', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ status: 'ok', league: 'nfl' }),
      );
      const res = await service.health();
      expect(calledUrl()).toBe('http://localhost:8100/health');
      expect(res).toEqual({ status: 'ok', league: 'nfl' });
    });
  });

  // ── Player Stats ────────────────────────────────────────────────

  describe('playerStats()', () => {
    it('sends player and default season', async () => {
      await service.playerStats('Patrick Mahomes');
      const p = calledParams();
      expect(p.get('player')).toBe('Patrick Mahomes');
      expect(p.has('season')).toBe(false);
    });

    it('sends explicit season', async () => {
      await service.playerStats('Jalen Hurts', 2023);
      const p = calledParams();
      expect(p.get('player')).toBe('Jalen Hurts');
      expect(p.get('season')).toBe('2023');
    });
  });

  // ── Team Efficiency ─────────────────────────────────────────────

  describe('teamEfficiency()', () => {
    it('sends team abbreviation', async () => {
      await service.teamEfficiency('SEA', 2024);
      const p = calledParams();
      expect(p.get('team')).toBe('SEA');
      expect(p.get('season')).toBe('2024');
    });
  });

  // ── Positional Rankings ─────────────────────────────────────────

  describe('positionalRankings()', () => {
    it('sends all required params', async () => {
      await service.positionalRankings('QB', 'passing_epa', 2024, 10);
      const p = calledParams();
      expect(p.get('position')).toBe('QB');
      expect(p.get('metric')).toBe('passing_epa');
      expect(p.get('season')).toBe('2024');
      expect(p.get('top')).toBe('10');
    });

    it('omits optional params when not provided', async () => {
      await service.positionalRankings('WR', 'receiving_yards');
      const p = calledParams();
      expect(p.get('position')).toBe('WR');
      expect(p.get('metric')).toBe('receiving_yards');
      expect(p.has('season')).toBe(false);
      expect(p.has('top')).toBe(false);
    });
  });

  // ── Snap Counts ─────────────────────────────────────────────────

  describe('snapCounts()', () => {
    it('sends season and team', async () => {
      await service.snapCounts(2024, 'KC');
      const p = calledParams();
      expect(p.get('season')).toBe('2024');
      expect(p.get('team')).toBe('KC');
    });

    it('sends player lookup', async () => {
      await service.snapCounts(2024, undefined, 'Travis Kelce');
      const p = calledParams();
      expect(p.get('player')).toBe('Travis Kelce');
      expect(p.has('team')).toBe(false);
    });
  });

  // ── Draft History ───────────────────────────────────────────────

  describe('draftHistory()', () => {
    it('sends position and pick range', async () => {
      await service.draftHistory({ position: 'WR', pickRange: '1-10' });
      const p = calledParams();
      expect(p.get('position')).toBe('WR');
      expect(p.get('pick_range')).toBe('1-10');
    });

    it('sends player lookup', async () => {
      await service.draftHistory({ player: 'Jaxon Smith-Njigba' });
      expect(calledParams().get('player')).toBe('Jaxon Smith-Njigba');
    });

    it('sends no params when options omitted', async () => {
      await service.draftHistory();
      expect(calledUrl()).toBe('http://localhost:8100/api/draft-history');
    });
  });

  // ── Combine ─────────────────────────────────────────────────────

  describe('combineProfile()', () => {
    it('sends player name', async () => {
      await service.combineProfile({ player: 'Garrett Wilson' });
      expect(calledParams().get('player')).toBe('Garrett Wilson');
    });

    it('sends positional leaderboard params', async () => {
      await service.combineProfile({ position: 'CB', metric: 'forty' });
      const p = calledParams();
      expect(p.get('position')).toBe('CB');
      expect(p.get('metric')).toBe('forty');
    });
  });

  // ── NGS Passing ─────────────────────────────────────────────────

  describe('ngsPassing()', () => {
    it('sends season and player', async () => {
      await service.ngsPassing(2024, 'Geno Smith', 'avg_time_to_throw');
      const p = calledParams();
      expect(p.get('season')).toBe('2024');
      expect(p.get('player')).toBe('Geno Smith');
      expect(p.get('metric')).toBe('avg_time_to_throw');
    });

    it('sends only season', async () => {
      await service.ngsPassing(2024);
      const p = calledParams();
      expect(p.get('season')).toBe('2024');
      expect(p.has('player')).toBe(false);
    });
  });

  // ── Defense ─────────────────────────────────────────────────────

  describe('defenseStats()', () => {
    it('sends season and player', async () => {
      await service.defenseStats(2024, { player: 'Devon Witherspoon' });
      const p = calledParams();
      expect(p.get('season')).toBe('2024');
      expect(p.get('player')).toBe('Devon Witherspoon');
    });

    it('sends team-level query', async () => {
      await service.defenseStats(2024, { team: 'SEA', position: 'CB' });
      const p = calledParams();
      expect(p.get('team')).toBe('SEA');
      expect(p.get('position')).toBe('CB');
    });
  });

  // ── Prediction Markets ──────────────────────────────────────────

  describe('predictionMarkets()', () => {
    it('sends search query', async () => {
      await service.predictionMarkets({ search: 'Super Bowl' });
      expect(calledParams().get('search')).toBe('Super Bowl');
    });

    it('sends team and market type', async () => {
      await service.predictionMarkets({ team: 'BUF', marketType: 'futures' });
      const p = calledParams();
      expect(p.get('team')).toBe('BUF');
      expect(p.get('market_type')).toBe('futures');
    });
  });

  // ── Error Handling ──────────────────────────────────────────────

  describe('error handling', () => {
    it('throws DataServiceError when sidecar is unreachable', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const promise = service.health();
      await expect(promise).rejects.toThrow(DataServiceError);
      await expect(promise).rejects.toThrow(/unreachable/);
    });

    it('throws DataServiceError with status code on 500', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));
      try {
        await service.playerStats('test');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(DataServiceError);
        expect((err as DataServiceError).statusCode).toBe(500);
      }
    });

    it('throws DataServiceError on 404', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ detail: 'not found' }, 404));
      await expect(service.teamEfficiency('XYZ')).rejects.toThrow(
        DataServiceError,
      );
    });
  });
});
