const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  ok: boolean; // true = favicon loaded, false = error (show GlobeIcon)
  ts: number;
}

const cache = new Map<string, CacheEntry>();

export function getCached(domain: string): CacheEntry | null {
  const entry = cache.get(domain);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(domain);
    return null;
  }
  return entry;
}

export function setCached(domain: string, ok: boolean): void {
  cache.set(domain, { ok, ts: Date.now() });
}
