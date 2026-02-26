import { JobsResponse } from "../features/jobs/job.type";

// ─── TTL Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1_000;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Evict all expired entries (call periodically to avoid memory growth). */
  evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

// Singleton cache — 10-minute TTL
export const jobsCache = new TTLCache<JobsResponse>(600);

// Periodically remove stale entries every 5 minutes
setInterval(() => jobsCache.evict(), 5 * 60 * 1_000).unref();

// ─── Cache-key helper ─────────────────────────────────────────────────────────

/**
 * Produces a stable JSON key from the request body:
 * arrays are sorted so ["react","ts"] and ["ts","react"] map to the same key.
 */
export function buildCacheKey(body: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(body).sort()) {
    const v = body[k];
    sorted[k] = Array.isArray(v) ? [...(v as unknown[])].sort() : v;
  }
  return JSON.stringify(sorted);
}
