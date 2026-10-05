import { createMiddleware } from 'hono/factory';
import { Env, AppVariables } from '../types';

function isSkippedPath(path: string): boolean {
  return (
    path.startsWith('/static/') ||
    path.startsWith('/r2/') ||
    path.startsWith('/js/') ||
    path.startsWith('/css/') ||
    path === '/robots.txt' ||
    path.startsWith('/sitemap') ||
    path.startsWith('/og/') ||
    path.endsWith('/feed.xml')
  );
}

export const htmlCacheMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    await next();

    if (isSkippedPath(c.req.path)) return;
    // Handlers that opt into caching (user-independent JSON) keep their own header.
    if (c.res.headers.get('Cache-Control')) return;

    const contentType = c.res.headers.get('Content-Type') || '';
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      // `no-cache` (revalidate before reuse), NOT `no-store`. A `no-store` page is
      // evicted from the back/forward cache as soon as anything writes a cookie
      // while it sits there — and gtag writes `_ga` on the next page view — so
      // every "back" from a job detail page paid a full round trip. Requires the
      // Cloudflare cache rule for HTML to respect origin headers; the zone's
      // Browser Cache TTL override would otherwise rewrite this into a real max-age.
      c.res.headers.set('Cache-Control', 'private, no-cache, must-revalidate');
      c.res.headers.set('Vary', 'Cookie');
    }
  },
);
