/**
 * cache/index.ts — QueryCache: high-level cached query executor.
 *
 * Wraps a CacheProvider with a convenient execute-or-cache pattern.
 * Used by roster-context.ts Python queries and MCP tool handlers.
 *
 * Usage:
 *   const cache = new QueryCache(provider);
 *   const data = cache.getOrFetch('roster:SEA:2025', () => queryRoster('SEA', 2025), DEFAULT_TTL.roster);
 */

import type { CacheProvider, CacheSetOptions, CacheStats } from './provider.js';
export type { CacheProvider, CacheEntry, CacheSetOptions, CacheStats } from './provider.js';
export { DEFAULT_TTL } from './provider.js';
export { FileCacheProvider } from './file-cache.js';

// ---------------------------------------------------------------------------
// QueryCache — the main API surface
// ---------------------------------------------------------------------------

export class QueryCache {
  constructor(private provider: CacheProvider) {}

  /**
   * Get a cached value, or execute the fetcher and cache the result.
   * Returns null if fetcher returns null/undefined (does not cache nulls).
   */
  getOrFetch<T>(key: string, fetcher: () => T | null, ttlSeconds?: number): T | null {
    const cached = this.provider.get<T>(key);
    if (cached !== null) return cached;

    const data = fetcher();
    if (data != null) {
      this.provider.set(key, data, ttlSeconds != null ? { ttlSeconds } : undefined);
    }
    return data;
  }

  /**
   * Async variant for async fetchers (e.g., MCP tool handlers).
   */
  async getOrFetchAsync<T>(key: string, fetcher: () => Promise<T | null>, ttlSeconds?: number): Promise<T | null> {
    const cached = this.provider.get<T>(key);
    if (cached !== null) return cached;

    const data = await fetcher();
    if (data != null) {
      this.provider.set(key, data, ttlSeconds != null ? { ttlSeconds } : undefined);
    }
    return data;
  }

  /** Direct get — used when you want to check cache without fetching. */
  get<T>(key: string): T | null {
    return this.provider.get<T>(key);
  }

  /** Direct set — used when you want to manually populate cache. */
  set<T>(key: string, data: T, options?: CacheSetOptions): void {
    this.provider.set(key, data, options);
  }

  /** Invalidate a specific key. */
  invalidate(key: string): boolean {
    return this.provider.delete(key);
  }

  /** Invalidate all keys matching a prefix. */
  invalidatePrefix(prefix: string): number {
    // Provider doesn't expose key iteration, so we delegate to purge pattern.
    // For file-based cache, this is handled by the clear method.
    // For a real prefix invalidation, we'd need provider-level support.
    // For now, expose the underlying provider methods.
    return 0;
  }

  /** Remove expired entries. */
  purgeExpired(): number {
    return this.provider.purgeExpired();
  }

  /** Clear entire cache. */
  clear(): number {
    return this.provider.clear();
  }

  /** Get cache statistics. */
  stats(): CacheStats {
    return this.provider.stats();
  }
}

// ---------------------------------------------------------------------------
// Cache key builders — standardized key format for all data types
// ---------------------------------------------------------------------------

export function rosterCacheKey(team: string, season: number): string {
  return `roster:${team.toUpperCase()}:${season}`;
}

export function snapsCacheKey(team: string, season: number, group: string, top: number): string {
  return `snaps:${team.toUpperCase()}:${season}:${group}:${top}`;
}

export function playerStatsCacheKey(player: string, season: number): string {
  return `player-stats:${normalize(player)}:${season}`;
}

export function teamEfficiencyCacheKey(team: string, season: number): string {
  return `team-efficiency:${team.toUpperCase()}:${season}`;
}

export function positionalRankingsCacheKey(position: string, metric: string, season: number, top: number): string {
  return `rankings:${position}:${metric}:${season}:${top}`;
}

export function draftHistoryCacheKey(args: string[]): string {
  return `draft-history:${args.join(':')}`;
}

export function combineCacheKey(args: string[]): string {
  return `combine:${args.join(':')}`;
}

export function pfrDefenseCacheKey(args: string[]): string {
  return `pfr-defense:${args.join(':')}`;
}

export function ngsPassingCacheKey(args: string[]): string {
  return `ngs-passing:${args.join(':')}`;
}

export function historicalCompsCacheKey(player: string, season: number): string {
  return `historical-comps:${normalize(player)}:${season}`;
}

export function predictionsCacheKey(args: string[]): string {
  return `predictions:${args.join(':')}`;
}

/** Generic key for any Python query: script name + args. */
export function pythonQueryCacheKey(script: string, args: string[]): string {
  return `py:${script}:${args.join(':')}`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

// ---------------------------------------------------------------------------
// Singleton accessor — lazily initialized, configurable
// ---------------------------------------------------------------------------

let _globalCache: QueryCache | null = null;

/** Get (or create) the global QueryCache instance. */
export function getGlobalCache(cacheDir?: string): QueryCache {
  if (!_globalCache && cacheDir) {
    const { FileCacheProvider } = require('./file-cache.js') as typeof import('./file-cache.js');
    _globalCache = new QueryCache(new FileCacheProvider(cacheDir));
  }
  if (!_globalCache) {
    // Return a no-op cache if not initialized (tests, etc.)
    return new QueryCache(new NullCacheProvider());
  }
  return _globalCache;
}

/** Initialize the global cache with a specific provider. */
export function initGlobalCache(provider: CacheProvider): QueryCache {
  _globalCache = new QueryCache(provider);
  return _globalCache;
}

/** Reset global cache (for tests). */
export function resetGlobalCache(): void {
  _globalCache = null;
}

// ---------------------------------------------------------------------------
// NullCacheProvider — pass-through, caches nothing (for tests / fallback)
// ---------------------------------------------------------------------------

export class NullCacheProvider implements CacheProvider {
  private misses = 0;

  get<T = unknown>(_key: string): T | null {
    this.misses++;
    return null;
  }

  set<T = unknown>(_key: string, _data: T, _options?: CacheSetOptions): void {
    // no-op
  }

  delete(_key: string): boolean {
    return false;
  }

  has(_key: string): boolean {
    return false;
  }

  purgeExpired(): number {
    return 0;
  }

  clear(): number {
    return 0;
  }

  stats(): CacheStats {
    return { entries: 0, hits: 0, misses: this.misses };
  }
}
