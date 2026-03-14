import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { Env } from './types';
import pages from './routes/pages';
import api from './routes/api';
import { syncJobs } from './services/jobSync';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (c.req.method === 'OPTIONS') return new Response(null, { status: 204 });
  await next();
});

app.get(
  '/static/*',
  cache({ cacheName: 'yuanchengdao-static', cacheControl: 'public, max-age=86400' })
);

app.get('/r2/*', async (c) => {
  const key = c.req.path.replace('/r2/', '');
  const object = await c.env.R2.get(key);
  if (!object) return c.notFound();
  c.header('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(object.body as ReadableStream);
});

app.route('/', pages);
app.route('/', api);

app.get('/robots.txt', (c) => {
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${c.env.SITE_URL}/sitemap.xml`);
});

app.get('/sitemap.xml', async (c) => {
  const jobs = await c.env.DB.prepare(
    'SELECT slug, updated_at FROM jobs WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1000'
  ).all();

  const urls = (jobs.results || []).map((j: Record<string, unknown>) =>
    `<url><loc>${c.env.SITE_URL}/job/${j.slug}</loc><lastmod>${(j.updated_at as string || new Date().toISOString()).split('T')[0]}</lastmod></url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${c.env.SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${c.env.SITE_URL}/about</loc><changefreq>monthly</changefreq></url>
  ${urls}
</urlset>`;

  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

app.notFound((c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head><meta charset="UTF-8"><title>404 | 远程岛</title>
    <script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-stone-50 flex items-center justify-center min-h-screen">
      <div class="text-center">
        <p class="text-6xl mb-4">🏝️</p>
        <h1 class="text-3xl font-bold mb-2">页面未找到</h1>
        <p class="text-stone-500 mb-6">你访问的页面不存在</p>
        <a href="/" class="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition">返回首页</a>
      </div>
    </body>
    </html>
  `, 404);
});

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      syncJobs(env).catch((err) => {
        console.error('Scheduled sync failed:', err);
      })
    );
  },
};
