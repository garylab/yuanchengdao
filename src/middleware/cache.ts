import { createMiddleware } from 'hono/factory';
import { Env, AppVariables } from '../types';

function isSkippedPath(path: string): boolean {
  return (
    path.startsWith('/static/') ||
    path.startsWith('/r2/') ||
    path.startsWith('/js/') ||
    path.startsWith('/css/') ||
    path === '/robots.txt' ||
    path.startsWith('/sitemap')
  );
}

export const htmlCacheMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    await next();

    if (isSkippedPath(c.req.path)) return;

    const contentType = c.res.headers.get('Content-Type') || '';
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      c.res.headers.set('Cache-Control', 'private, no-store');
    }
  },
);
