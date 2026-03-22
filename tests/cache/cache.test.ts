import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileCacheProvider } from '../../src/cache/file-cache.js';
import {
  QueryCache,
  NullCacheProvider,
  rosterCacheKey,
  snapsCacheKey,
  playerStatsCacheKey,
  pythonQueryCacheKey,
  initGlobalCache,
  getGlobalCache,
  resetGlobalCache,
  DEFAULT_TTL,
} from '../../src/cache/index.js';

describe('FileCacheProvider', () => {
  let dir: string;
  let provider: FileCacheProvider;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cache-test-'));
    provider = new FileCacheProvider(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('get returns null on miss', () => {
    expect(provider.get('nonexistent')).toBeNull();
  });

  it('set and get roundtrip', () => {
    provider.set('key1', { team: 'SEA', players: 53 });
    expect(provider.get<{ team: string; players: number }>('key1')).toEqual({
      team: 'SEA',
      players: 53,
    });
  });

  it('stores entries as JSON files on disk', () => {
    provider.set('roster:SEA:2025', ['Kenneth Walker III']);
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    expect(files.length).toBe(1);
  });

  it('survives new provider instance (restart simulation)', () => {
    provider.set('persist-key', { value: 42 });
    const provider2 = new FileCacheProvider(dir);
    expect(provider2.get<{ value: number }>('persist-key')).toEqual({ value: 42 });
  });

  it('respects TTL — expired entries return null', () => {
    // Set with 0-second TTL (expired immediately)
    provider.set('expired', 'data', { ttlSeconds: 0.001 });
    // Wait a tiny bit for expiry
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(provider.get('expired')).toBeNull();
  });

  it('entries with ttlSeconds=0 never expire', () => {
    provider.set('forever', 'data', { ttlSeconds: 0 });
    expect(provider.get('forever')).toBe('data');
  });

  it('delete removes an entry', () => {
    provider.set('to-delete', 'value');
    expect(provider.has('to-delete')).toBe(true);
    expect(provider.delete('to-delete')).toBe(true);
    expect(provider.has('to-delete')).toBe(false);
  });

  it('has returns false for expired entries', () => {
    provider.set('exp', 'data', { ttlSeconds: 0.001 });
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(provider.has('exp')).toBe(false);
  });

  it('clear removes all entries', () => {
    provider.set('a', 1);
    provider.set('b', 2);
    provider.set('c', 3);
    expect(provider.clear()).toBe(3);
    expect(provider.stats().entries).toBe(0);
  });

  it('purgeExpired only removes expired entries', () => {
    provider.set('fresh', 'data', { ttlSeconds: 3600 });
    provider.set('stale', 'data', { ttlSeconds: 0.001 });
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(provider.purgeExpired()).toBe(1);
    expect(provider.get('fresh')).toBe('data');
  });

  it('stats tracks hits and misses', () => {
    provider.set('hit-me', 'data');
    provider.get('hit-me');  // hit
    provider.get('miss-me'); // miss
    const s = provider.stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(1);
    expect(s.entries).toBe(1);
    expect(s.size).toBeGreaterThan(0);
  });

  it('creates cache dir if it does not exist', () => {
    const newDir = join(dir, 'nested', 'cache');
    const p = new FileCacheProvider(newDir);
    expect(existsSync(newDir)).toBe(true);
    p.set('test', 1);
    expect(p.get('test')).toBe(1);
  });
});

describe('QueryCache', () => {
  let dir: string;
  let cache: QueryCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qcache-test-'));
    cache = new QueryCache(new FileCacheProvider(dir));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('getOrFetch caches the result of the fetcher', () => {
    let callCount = 0;
    const fetcher = () => { callCount++; return { team: 'SEA' }; };

    const result1 = cache.getOrFetch('key', fetcher, 3600);
    const result2 = cache.getOrFetch('key', fetcher, 3600);

    expect(result1).toEqual({ team: 'SEA' });
    expect(result2).toEqual({ team: 'SEA' });
    expect(callCount).toBe(1); // fetcher called only once
  });

  it('getOrFetch does not cache null returns', () => {
    let callCount = 0;
    const fetcher = () => { callCount++; return null; };

    cache.getOrFetch('null-key', fetcher, 3600);
    cache.getOrFetch('null-key', fetcher, 3600);

    expect(callCount).toBe(2); // fetcher called both times
  });

  it('getOrFetchAsync works with async fetchers', async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return [1, 2, 3]; };

    const r1 = await cache.getOrFetchAsync('async-key', fetcher, 3600);
    const r2 = await cache.getOrFetchAsync('async-key', fetcher, 3600);

    expect(r1).toEqual([1, 2, 3]);
    expect(r2).toEqual([1, 2, 3]);
    expect(callCount).toBe(1);
  });

  it('invalidate removes a cached entry', () => {
    cache.set('inv-key', 'value');
    expect(cache.get('inv-key')).toBe('value');
    cache.invalidate('inv-key');
    expect(cache.get('inv-key')).toBeNull();
  });
});

describe('NullCacheProvider', () => {
  it('never caches anything', () => {
    const provider = new NullCacheProvider();
    provider.set('key', 'data');
    expect(provider.get('key')).toBeNull();
    expect(provider.has('key')).toBe(false);
    expect(provider.stats().entries).toBe(0);
  });

  it('tracks misses', () => {
    const provider = new NullCacheProvider();
    provider.get('a');
    provider.get('b');
    expect(provider.stats().misses).toBe(2);
  });
});

describe('Cache key builders', () => {
  it('rosterCacheKey normalizes team to uppercase', () => {
    expect(rosterCacheKey('sea', 2025)).toBe('roster:SEA:2025');
  });

  it('snapsCacheKey includes all parameters', () => {
    expect(snapsCacheKey('SEA', 2025, 'offense', 20)).toBe('snaps:SEA:2025:offense:20');
  });

  it('playerStatsCacheKey normalizes player name', () => {
    expect(playerStatsCacheKey('Jaxon Smith-Njigba', 2025)).toBe('player-stats:jaxon-smith-njigba:2025');
  });

  it('pythonQueryCacheKey combines script and args', () => {
    expect(pythonQueryCacheKey('query_rosters.py', ['--team', 'SEA'])).toBe(
      'py:query_rosters.py:--team:SEA',
    );
  });
});

describe('Global cache', () => {
  afterEach(() => {
    resetGlobalCache();
  });

  it('getGlobalCache returns NullCacheProvider when uninitialized', () => {
    resetGlobalCache();
    const cache = getGlobalCache();
    cache.set('test', 'value');
    expect(cache.get('test')).toBeNull(); // NullCacheProvider
  });

  it('initGlobalCache sets the global provider', () => {
    const dir = mkdtempSync(join(tmpdir(), 'global-cache-'));
    try {
      const cache = initGlobalCache(new FileCacheProvider(dir));
      cache.set('test', 'value', { ttlSeconds: 3600 });
      expect(getGlobalCache().get('test')).toBe('value');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('DEFAULT_TTL', () => {
  it('has expected categories', () => {
    expect(DEFAULT_TTL.roster).toBe(4 * 3600);
    expect(DEFAULT_TTL.snapCounts).toBe(6 * 3600);
    expect(DEFAULT_TTL.draftHistory).toBe(24 * 3600);
    expect(DEFAULT_TTL.predictions).toBe(30 * 60);
    expect(DEFAULT_TTL.default).toBe(2 * 3600);
  });
});
