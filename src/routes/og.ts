import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { escapeHtml, formatSalary } from '../utils/helpers';

const og = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/** Bump to invalidate every cached card without touching the bucket. */
const CARD_VERSION = 'v1';
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

interface CardJob {
  title: string;
  company_name: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
  country_flag_emoji: string | null;
  salary_lower: number;
  salary_upper: number;
  salary_currency: string;
  salary_pay_cycle: string;
}

/**
 * The card markup. Deliberately system-font only: the renderer has no network
 * access to our CSS bundle, and a webfont that fails to load is worse than a
 * system CJK stack that renders everywhere.
 */
function cardHtml(job: CardJob): string {
  const place = [job.location_name_cn, job.country_name_cn]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ') || '全球远程';
  const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);
  const flag = job.country_flag_emoji || '🌍';

  const facts = [
    `${flag} ${place}`,
    salary ? `💰 ${salary}` : '',
    '🏝 远程',
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
    background: linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #ffedd5 100%);
    font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif;
    color: #1c1917;
  }
  .company { font-size: 32px; font-weight: 600; color: #ea580c; margin-bottom: 24px; }
  .title {
    font-size: 64px; line-height: 1.22; font-weight: 800; letter-spacing: -1px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .facts { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 36px; }
  .fact { font-size: 28px; background: #fff; border: 1px solid #fed7aa; border-radius: 999px; padding: 10px 24px; color: #57534e; }
  .footer { display: flex; align-items: center; justify-content: space-between; font-size: 26px; color: #78716c; }
  .brand { font-weight: 700; color: #ea580c; font-size: 30px; }
</style></head>
<body>
  <div>
    <div class="company">${escapeHtml(job.company_name || '远程职位')}</div>
    <div class="title">${escapeHtml(job.title)}</div>
    <div class="facts">${facts.map((f) => `<span class="fact">${escapeHtml(f)}</span>`).join('')}</div>
  </div>
  <div class="footer">
    <span class="brand">🏝 远程岛</span>
    <span>yuanchengdao.com · 华人远程工作平台</span>
  </div>
</body></html>`;
}

/**
 * Render via the Browser Rendering REST API. Chosen over the Workers binding so
 * the Worker keeps its current dependency set and bundle size — this is one
 * fetch with a scoped token.
 *
 * Returns null on any failure; the caller falls back rather than 500s, because a
 * missing share image must never take a job page's crawl down with it.
 */
async function renderCard(env: Env, html: string): Promise<ArrayBuffer | null> {
  const accountId = (env.CF_ACCOUNT_ID || '').trim();
  const token = (env.CF_API_TOKEN || '').trim();
  if (!accountId || !token) return null;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
          screenshotOptions: { type: 'png' },
        }),
      },
    );

    const contentType = res.headers.get('Content-Type') || '';
    if (!res.ok || !contentType.includes('image/')) {
      // The endpoint reports failures as a JSON envelope rather than a status.
      console.error(`Browser Rendering failed (${res.status} ${contentType}): ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.error('Browser Rendering request threw', err instanceof Error ? err.message : err);
    return null;
  }
}

og.get('/og/job/:file', async (c) => {
  const file = c.req.param('file');
  if (!file.endsWith('.png')) return c.notFound();
  const slug = file.slice(0, -4);

  const key = `og/${CARD_VERSION}/job/${slug}.png`;
  const cached = await c.env.R2.get(key);
  if (cached) {
    return new Response(cached.body as ReadableStream, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800, immutable' },
    });
  }

  const job = await c.env.DB.prepare(`
    SELECT j.title, j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle,
      co.name as company_name, lo.name_cn as location_name_cn,
      ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE j.slug = ?
  `).bind(slug).first<CardJob>();

  // No job, or no renderer configured: fall back to the static logo so the page
  // still produces a card instead of a broken image.
  if (!job) return c.redirect('/yuanchengdao-logo.png', 302);

  const png = await renderCard(c.env, cardHtml(job));
  if (!png) return c.redirect('/yuanchengdao-logo.png', 302);

  // A posting's card never changes, so one render per job is all this ever costs.
  await c.env.R2.put(key, png, { httpMetadata: { contentType: 'image/png' } });

  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800, immutable' },
  });
});

export default og;
