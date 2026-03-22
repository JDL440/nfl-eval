/**
 * mcp-cache.mjs — Lightweight file-based cache for MCP tool handlers.
 *
 * Pure ESM, no dependencies on CJS TypeScript modules.
 * Uses the same file format as FileCacheProvider so caches are interoperable.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

// Default TTLs (seconds) — mirrors src/cache/provider.ts DEFAULT_TTL
const TTL = {
    roster: 4 * 3600,
    snapCounts: 6 * 3600,
    teamStats: 4 * 3600,
    playerStats: 4 * 3600,
    rankings: 4 * 3600,
    draftHistory: 24 * 3600,
    combine: 24 * 3600,
    pfrDefense: 6 * 3600,
    ngsPassing: 6 * 3600,
    historicalComps: 24 * 3600,
    predictions: 30 * 60,
    default: 2 * 3600,
};

// Resolve cache directory: ~/.nfl-lab/leagues/nfl/data-cache/
const DATA_DIR = process.env.NFL_DATA_DIR || join(homedir(), ".nfl-lab");
const CACHE_DIR = join(DATA_DIR, "leagues", "nfl", "data-cache");

function ensureCacheDir() {
    if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function keyToPath(key) {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 12);
    const suffix = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    return join(CACHE_DIR, `${hash}_${suffix}.json`);
}

/**
 * Get a cached value. Returns null on miss or expiry.
 */
export function cacheGet(key) {
    const filePath = keyToPath(key);
    if (!existsSync(filePath)) return null;

    try {
        const entry = JSON.parse(readFileSync(filePath, "utf-8"));
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
            try { unlinkSync(filePath); } catch { /* best effort */ }
            return null;
        }
        // Update hit count (best-effort)
        entry.hits = (entry.hits || 0) + 1;
        try { writeFileSync(filePath, JSON.stringify(entry), "utf-8"); } catch { /* advisory */ }
        return entry.data;
    } catch {
        try { unlinkSync(filePath); } catch { /* corrupted, remove */ }
        return null;
    }
}

/**
 * Store a value in the cache with a TTL (seconds).
 */
export function cacheSet(key, data, ttlSeconds) {
    ensureCacheDir();
    const now = Date.now();
    const entry = {
        key,
        data,
        createdAt: now,
        expiresAt: ttlSeconds > 0 ? now + ttlSeconds * 1000 : 0,
        hits: 0,
    };
    try {
        writeFileSync(keyToPath(key), JSON.stringify(entry), "utf-8");
    } catch {
        // Best-effort
    }
}

/**
 * Wrap runPythonQuery with caching. Returns the tool result object.
 *
 * @param {string} cacheKey   — Unique key for this query
 * @param {number} ttlSeconds — Time-to-live in seconds
 * @param {Function} fetcher  — async () => { data, error } from runPythonQuery
 * @param {Function} format   — (data) => { textResultForLlm, resultType }
 */
export async function cachedQuery(cacheKey, ttlSeconds, fetcher, format) {
    const cached = cacheGet(cacheKey);
    if (cached !== null) {
        return format(cached);
    }

    const { data, error } = await fetcher();
    if (error) {
        return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    }

    if (data != null) {
        cacheSet(cacheKey, data, ttlSeconds);
    }

    return format(data);
}

export { TTL };
