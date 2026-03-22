/**
 * cache/file-cache.ts — File-based cache provider.
 *
 * Stores each cache entry as a JSON file in the cache directory.
 * Survives process restarts (unlike in-memory caches).
 * Safe for single-process use; not suitable for multi-process without locking.
 *
 * File layout:
 *   {cacheDir}/
 *     {sanitized-key}.json    — { key, data, createdAt, expiresAt, hits }
 *
 * Keys are hashed to safe filenames using a simple deterministic hash.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { CacheProvider, CacheEntry, CacheSetOptions, CacheStats } from './provider.js';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class FileCacheProvider implements CacheProvider {
  private cacheDir: string;
  private hitCount = 0;
  private missCount = 0;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }

  get<T = unknown>(key: string): T | null {
    const filePath = this.keyToPath(key);
    if (!existsSync(filePath)) {
      this.missCount++;
      return null;
    }

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry<T>;

      // Check expiration
      if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
        this.deleteFile(filePath);
        this.missCount++;
        return null;
      }

      // Update hit count (best-effort, don't fail on write error)
      entry.hits++;
      try {
        writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
      } catch {
        // Non-fatal: hit count is advisory
      }

      this.hitCount++;
      return entry.data;
    } catch {
      // Corrupted file — remove it
      this.deleteFile(filePath);
      this.missCount++;
      return null;
    }
  }

  set<T = unknown>(key: string, data: T, options?: CacheSetOptions): void {
    const ttl = options?.ttlSeconds ?? 0;
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      data,
      createdAt: now,
      expiresAt: ttl > 0 ? now + ttl * 1000 : 0,
      hits: 0,
    };

    const filePath = this.keyToPath(key);
    try {
      writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch {
      // Non-fatal: caching is best-effort
    }
  }

  delete(key: string): boolean {
    return this.deleteFile(this.keyToPath(key));
  }

  has(key: string): boolean {
    const filePath = this.keyToPath(key);
    if (!existsSync(filePath)) return false;

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry;
      if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
        this.deleteFile(filePath);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  purgeExpired(): number {
    let count = 0;
    const now = Date.now();

    for (const file of this.listFiles()) {
      try {
        const raw = readFileSync(file, 'utf-8');
        const entry = JSON.parse(raw) as CacheEntry;
        if (entry.expiresAt > 0 && now > entry.expiresAt) {
          this.deleteFile(file);
          count++;
        }
      } catch {
        // Corrupted — remove
        this.deleteFile(file);
        count++;
      }
    }

    return count;
  }

  clear(): number {
    let count = 0;
    for (const file of this.listFiles()) {
      this.deleteFile(file);
      count++;
    }
    this.hitCount = 0;
    this.missCount = 0;
    return count;
  }

  stats(): CacheStats {
    const files = this.listFiles();
    let totalSize = 0;
    for (const file of files) {
      try {
        totalSize += statSync(file).size;
      } catch {
        // skip
      }
    }
    return {
      entries: files.length,
      hits: this.hitCount,
      misses: this.missCount,
      size: totalSize,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Convert a cache key to a filesystem path. Uses SHA-256 prefix + sanitized suffix. */
  private keyToPath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 12);
    // Keep a readable suffix from the key (alphanumeric + hyphens, max 60 chars)
    const suffix = key
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    return join(this.cacheDir, `${hash}_${suffix}.json`);
  }

  private deleteFile(filePath: string): boolean {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
    } catch {
      // Best-effort
    }
    return false;
  }

  private listFiles(): string[] {
    if (!existsSync(this.cacheDir)) return [];
    try {
      return readdirSync(this.cacheDir)
        .filter(f => f.endsWith('.json'))
        .map(f => join(this.cacheDir, f));
    } catch {
      return [];
    }
  }
}
