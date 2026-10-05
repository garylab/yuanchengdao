import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { activeCutoff, formatSalary, toIsoDateTime, truncate } from '../utils/helpers';

const feeds = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const FEED_LIMIT = 50;
/** Long enough that a polling reader is cheap, short enough that a feed is not
 *  advertising yesterday's jobs. */
const FEED_MAX_AGE = 900;

interface FeedJob {
  slug: string;
  title: string;
  description: string;
  created_at: string;
  posted_at: string | null;
  salary_lower: number;
  salary_upper: number;
  salary_currency: string;
  salary_pay_cycle: string;
  company_name: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RSS pubDate is RFC 822, not ISO 8601. */
function toRfc822(dateStr: string | null | undefined): string {
  const iso = toIsoDateTime(dateStr);
  return iso ? new Date(iso).toUTCString() : new Date().toUTCString();
}

function selectJobs(env: Env, where: string, binds: unknown[]): Promise<D1Result<FeedJob>> {
  return env.DB.prepare(`
    SELECT j.slug, j.title, j.description, j.created_at, j.posted_at,
      j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle,
      co.name as company_name, lo.name_cn as location_name_cn, ct.name_cn as country_name_cn
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE j.posted_at >= ?${where ? ` AND ${where}` : ''}
    ORDER BY j.created_at DESC
    LIMIT ${FEED_LIMIT}
  `).bind(activeCutoff(), ...binds).all<FeedJob>();
}

function renderFeed(opts: {
  siteUrl: string;
  selfPath: string;
  linkPath: string;
  title: string;
  description: string;
  jobs: FeedJob[];
}): string {
  const base = opts.siteUrl.replace(/\/$/, '');

  const items = opts.jobs.map((job) => {
    // Tagged the same way the Telegram channel tags its links, so feed traffic
    // is separable from direct and social in analytics.
    const link = `${base}/job/${encodeURIComponent(job.slug)}?utm_source=rss&utm_medium=feed&utm_campaign=job_feed`;
    const place = [job.location_name_cn, job.country_name_cn]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ') || '全球远程';
    const salary = formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle);

    const summary = [
      job.company_name ? `公司：${job.company_name}` : '',
      `地点：${place}`,
      salary ? `薪资：${salary}` : '',
      '',
      truncate(job.description, 500),
    ].filter((line) => line !== '').join('\n');

    return `    <item>
      <title>${escapeXml(`${job.title}${job.company_name ? ` - ${job.company_name}` : ''}`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(`${base}/job/${encodeURIComponent(job.slug)}`)}</guid>
      <pubDate>${toRfc822(job.created_at || job.posted_at)}</pubDate>
      <description>${escapeXml(summary)}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(opts.title)}</title>
    <link>${escapeXml(`${base}${opts.linkPath}`)}</link>
    <description>${escapeXml(opts.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${toRfc822(opts.jobs[0]?.created_at)}</lastBuildDate>
    <atom:link href="${escapeXml(`${base}${opts.selfPath}`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

function xml(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${FEED_MAX_AGE}`,
    },
  });
}

feeds.get('/feed.xml', async (c) => {
  const result = await selectJobs(c.env, '', []);
  return xml(renderFeed({
    siteUrl: c.env.SITE_URL,
    selfPath: '/feed.xml',
    linkPath: '/',
    title: '远程岛 - 最新远程职位',
    description: '面向华人的全球远程工作平台，每天更新来自世界各地的远程岗位。',
    jobs: result.results || [],
  }));
});

feeds.get('/jobs/chinese/feed.xml', async (c) => {
  const result = await selectJobs(c.env, 'j.chinese_friendly = 1', []);
  return xml(renderFeed({
    siteUrl: c.env.SITE_URL,
    selfPath: '/jobs/chinese/feed.xml',
    linkPath: '/jobs/chinese',
    title: '远程岛 - 中文友好远程职位',
    description: '明确接受中文沟通或面向华人团队的远程岗位。',
    jobs: result.results || [],
  }));
});

feeds.get('/category/:slug/feed.xml', async (c) => {
  const slug = c.req.param('slug');
  const term = await c.env.DB.prepare(
    'SELECT id, term_cn FROM search_terms WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: number; term_cn: string }>();
  if (!term) return c.notFound();

  const result = await selectJobs(c.env, 'j.search_term_id = ?', [term.id]);
  return xml(renderFeed({
    siteUrl: c.env.SITE_URL,
    selfPath: `/category/${slug}/feed.xml`,
    linkPath: `/category/${slug}`,
    title: `远程岛 - 远程${term.term_cn}`,
    description: `最新的远程${term.term_cn}岗位，每天更新。`,
    jobs: result.results || [],
  }));
});

feeds.get('/country/:slug/feed.xml', async (c) => {
  const slug = c.req.param('slug');
  const country = await c.env.DB.prepare(
    'SELECT id, name_cn FROM countries WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: number; name_cn: string }>();
  if (!country) return c.notFound();

  const result = await selectJobs(c.env, 'j.country_id = ?', [country.id]);
  return xml(renderFeed({
    siteUrl: c.env.SITE_URL,
    selfPath: `/country/${slug}/feed.xml`,
    linkPath: `/country/${slug}`,
    title: `远程岛 - ${country.name_cn}远程职位`,
    description: `${country.name_cn}的远程工作机会，每天更新。`,
    jobs: result.results || [],
  }));
});

export default feeds;
