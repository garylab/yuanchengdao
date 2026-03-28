import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { Env } from './types';
import pages from './routes/pages';
import api from './routes/api';
import { syncJobs } from './services/jobSync';
import { appScript, appScriptVersion } from './public/app';

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

app.get('/js/app.js', (c) => {
  c.header('Content-Type', 'application/javascript');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(appScript);
});

app.route('/', pages);
app.route('/', api);

app.get('/robots.txt', (c) => {
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${c.env.SITE_URL}/sitemap.xml`);
});

app.get('/sitemap.xml', (c) => {
  const site = c.env.SITE_URL;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${site}/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>${site}/sitemap-categories.xml</loc></sitemap>
  <sitemap><loc>${site}/sitemap-locations.xml</loc></sitemap>
  <sitemap><loc>${site}/sitemap-companies.xml</loc></sitemap>
  <sitemap><loc>${site}/sitemap-jobs.xml</loc></sitemap>
</sitemapindex>`;
  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

app.get('/sitemap-pages.xml', (c) => {
  const site = c.env.SITE_URL;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${site}/companies</loc><changefreq>daily</changefreq><priority>0.7</priority></url>
  <url><loc>${site}/locations</loc><changefreq>daily</changefreq><priority>0.7</priority></url>
  <url><loc>${site}/categories</loc><changefreq>daily</changefreq><priority>0.7</priority></url>
  <url><loc>${site}/about</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>`;
  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

app.get('/sitemap-categories.xml', async (c) => {
  const site = c.env.SITE_URL;
  const terms = await c.env.DB.prepare(
    'SELECT slug FROM search_terms WHERE is_active = 1 AND slug IS NOT NULL AND term_cn IS NOT NULL'
  ).all();
  const urls = (terms.results || []).map((t: Record<string, unknown>) =>
    `<url><loc>${site}/category/${t.slug}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`;
  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

app.get('/sitemap-locations.xml', async (c) => {
  const site = c.env.SITE_URL;
  const locations = await c.env.DB.prepare(
    `SELECT slug FROM locations WHERE is_active = 1 AND job_count > 0 ORDER BY job_count DESC`
  ).all();
  const urls = (locations.results || []).map((lo: Record<string, unknown>) =>
    `<url><loc>${site}/location/${lo.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`;
  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

app.get('/sitemap-companies.xml', async (c) => {
  const site = c.env.SITE_URL;
  const companies = await c.env.DB.prepare(
    'SELECT slug FROM companies WHERE job_count > 0 ORDER BY job_count DESC'
  ).all();
  const urls = (companies.results || []).map((co: Record<string, unknown>) =>
    `<url><loc>${site}/company/${co.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`;
  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

app.get('/sitemap-jobs.xml', async (c) => {
  const site = c.env.SITE_URL;
  const jobs = await c.env.DB.prepare(
    'SELECT slug, updated_at FROM jobs ORDER BY posted_at DESC LIMIT 5000'
  ).all();
  const urls = (jobs.results || []).map((j: Record<string, unknown>) => {
    const raw = (j.updated_at as string) || new Date().toISOString();
    const date = raw.substring(0, 10);
    return `<url><loc>${site}/job/${j.slug}</loc><lastmod>${date}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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
    <link rel="icon" href="${c.env.STATIC_URL}/favicon.ico" type="image/x-icon">
    <script src="${c.env.STATIC_URL}/js/tailwindcss.js"></script></head>
    <body class="bg-stone-50 flex items-center justify-center min-h-screen">
      <div class="text-center">
        <img src="${c.env.STATIC_URL}/yuanchengdao-logo.png" alt="远程岛" class="h-12 mx-auto mb-4">
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
