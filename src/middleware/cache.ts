import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { Env, AppVariables } from '../types';
import { SESSION_COOKIE } from '../services/auth';

const HTML_EDGE_TTL_SECONDS = 45;

function isPrivateHtmlPath(path: string): boolean {
  return (
    path === '/favorites' ||
    path.startsWith('/favorites/') ||
    path === '/account' ||
    path.startsWith('/account/')
  );
}

function isSkippedPath(path: string): boolean {
  return (
    path.startsWith('/api/') ||
    path.startsWith('/static/') ||
    path.startsWith('/r2/') ||
    path.startsWith('/js/') ||
    path.startsWith('/css/') ||
    path === '/robots.txt' ||
    path.startsWith('/sitemap')
  );
}

function isUserScopedApiPath(path: string): boolean {
  return (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/favorites') ||
    path.startsWith('/api/subscriptions') ||
    path.startsWith('/api/telegram')
  );
}

export const htmlCacheMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    const path = c.req.path;

    if (isSkippedPath(path)) {
      await next();
      if (isUserScopedApiPath(path)) {
        c.header('Cache-Control', 'private, no-store');
      }
      return;
    }

    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      await next();
      c.header('Cache-Control', 'private, no-store');
      return;
    }

    const hasSession = Boolean(getCookie(c, SESSION_COOKIE));
    if (hasSession || isPrivateHtmlPath(path)) {
      await next();
      c.header('Cache-Control', 'private, no-store');
      return;
    }

    const cacheKey = new Request(c.req.url, { method: 'GET' });
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      return cached;
    }

    await next();

    if (c.res.status !== 200) return;
    const contentType = c.res.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) return;
    if (c.res.headers.has('Set-Cookie')) {
      c.header('Cache-Control', 'private, no-store');
      return;
    }

    const headers = new Headers(c.res.headers);
    headers.set('Cache-Control', `public, s-maxage=${HTML_EDGE_TTL_SECONDS}, max-age=0`);
    const body = await c.res.arrayBuffer();
    const response = new Response(body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers,
    });
    c.executionCtx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  },
);
