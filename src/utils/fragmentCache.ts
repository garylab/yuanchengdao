/**
 * Worker-internal JSON fragment cache built on the Cache API.
 *
 * Fragments are stored under a synthetic origin that never reaches the browser,
 * so the zone's Browser Cache TTL override (which broke HTML caching before)
 * cannot touch them. Only user-independent data may be cached here; HTML
 * responses keep `private, no-store`.
 */
const FRAGMENT_ORIGIN = 'https://fragments.yuanchengdao.internal/';

export const FRAGMENT_TTL = {
  short: 300,   // 5 min: home filter lists, discovery strip, collection counts
  long: 3600,   // 1 h: salary statistics
} as const;

type WaitUntil = ((p: Promise<unknown>) => void) | null | undefined;

function fragmentCache(): Cache | null {
  const g = globalThis as unknown as { caches?: { default?: Cache } };
  return g.caches?.default ?? null;
}

export async function cachedJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>, waitUntil?: WaitUntil): Promise<T> {
  const cache = fragmentCache();
  const request = new Request(FRAGMENT_ORIGIN + encodeURIComponent(key));
  if (cache) {
    try {
      const hit = await cache.match(request);
      if (hit) return (await hit.json()) as T;
    } catch (err) {
      console.warn(`fragment cache read failed (${key}):`, err instanceof Error ? err.message : err);
    }
  }
  const value = await loader();
  if (cache) {
    const put = cache
      .put(request, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttlSeconds}` },
      }))
      .catch((err) => console.warn(`fragment cache write failed (${key}):`, err instanceof Error ? err.message : err));
    if (waitUntil) waitUntil(put); else await put;
  }
  return value;
}
