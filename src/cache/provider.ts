/**
 * cache/provider.ts — Pluggable cache provider interface.
 *
 * Defines the CacheProvider contract and CacheOptions for TTL-aware caching.
 * Default implementation: FileCacheProvider (file-based, survives restarts).
 * Future implementations: RedisCacheProvider, MemoryCacheProvider, etc.
 */

// ---------------------------------------------------------------------------
// Cache entry metadata
// ---------------------------------------------------------------------------

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  createdAt: number;   // epoch ms
  expiresAt: number;   // epoch ms (0 = never)
  hits: number;
}

// ---------------------------------------------------------------------------
// Options for cache get/set
// ---------------------------------------------------------------------------

export interface CacheSetOptions {
  /** TTL in seconds. 0 = no expiration. */
  ttlSeconds?: number;
}

// ---------------------------------------------------------------------------
// CacheProvider interface — implement this for new backends
// ---------------------------------------------------------------------------

export interface CacheProvider {
  /** Retrieve a cached value. Returns null on miss or expiry. */
  get<T = unknown>(key: string): T | null;

  /** Store a value in the cache. */
  set<T = unknown>(key: string, data: T, options?: CacheSetOptions): void;

  /** Remove a specific key. */
  delete(key: string): boolean;

  /** Check if a key exists and is not expired. */
  has(key: string): boolean;

  /** Remove all expired entries. Returns number of entries purged. */
  purgeExpired(): number;

  /** Clear the entire cache. Returns number of entries removed. */
  clear(): number;

  /** Get cache stats for monitoring. */
  stats(): CacheStats;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  size?: number; // bytes, if available
}

// ---------------------------------------------------------------------------
// Default TTLs by data category (seconds)
// ---------------------------------------------------------------------------

export const DEFAULT_TTL = {
  /** Roster data — changes daily at most, but stale data is low-risk */
  roster: 4 * 60 * 60,       // 4 hours

  /** Snap counts — updated weekly during season */
  snapCounts: 6 * 60 * 60,   // 6 hours

  /** Team efficiency stats */
  teamStats: 4 * 60 * 60,    // 4 hours

  /** Player stats */
  playerStats: 4 * 60 * 60,  // 4 hours

  /** Positional rankings */
  rankings: 4 * 60 * 60,     // 4 hours

  /** Draft history — changes very rarely */
  draftHistory: 24 * 60 * 60, // 24 hours

  /** Combine data — static after event */
  combine: 24 * 60 * 60,     // 24 hours

  /** PFR defense — weekly during season */
  pfrDefense: 6 * 60 * 60,   // 6 hours

  /** NGS passing — weekly during season */
  ngsPassing: 6 * 60 * 60,   // 6 hours

  /** Historical comps — very stable */
  historicalComps: 24 * 60 * 60, // 24 hours

  /** Prediction markets — changes frequently */
  predictions: 30 * 60,      // 30 minutes

  /** Default fallback */
  default: 2 * 60 * 60,      // 2 hours
} as const;
