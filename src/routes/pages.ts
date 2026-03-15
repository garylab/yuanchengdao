import { Hono } from 'hono';
import { Env, Job } from '../types';
import { homePage } from '../templates/home';
import { jobDetailPage } from '../templates/jobDetail';
import { aboutPage } from '../templates/about';
import { resolveThumbnail } from '../utils/helpers';

const pages = new Hono<{ Bindings: Env }>();

pages.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const query = url.searchParams.get('q')?.trim() || '';
  const countrySlug = url.searchParams.get('country') || '';
  const locationSlug = url.searchParams.get('location') || '';
  const salaryRange = url.searchParams.get('salary') || '';
  const limit = 30;
  const offset = (page - 1) * limit;

  let countSql = 'SELECT COUNT(*) as total FROM jobs j WHERE j.is_active = 1';
  let jobSql = `
    SELECT j.*,
      co.name as company_name, co.thumbnail as company_thumbnail,
      lo.name as location_name, lo.name_cn as location_name_cn,
      ct.code as country_code, ct.name_cn as country_name_cn
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE j.is_active = 1`;
  const params: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (query) {
    jobSql += ' AND (j.title LIKE ? OR co.name LIKE ? OR j.description LIKE ?)';
    countSql += ' AND (j.title LIKE ? OR j.description LIKE ?)';
    const wildcard = `%${query}%`;
    params.push(wildcard, wildcard, wildcard);
    countParams.push(wildcard, wildcard);
  }

  if (countrySlug) {
    jobSql += ' AND ct.slug = ?';
    countSql += ' AND j.country_id = (SELECT id FROM countries WHERE slug = ?)';
    params.push(countrySlug);
    countParams.push(countrySlug);
  }

  if (locationSlug) {
    jobSql += ' AND lo.slug = ?';
    countSql += ' AND j.location_id = (SELECT id FROM locations WHERE slug = ?)';
    params.push(locationSlug);
    countParams.push(locationSlug);
  }

  if (salaryRange) {
    const [minStr, maxStr] = salaryRange.split('-');
    const salaryMin = parseInt(minStr, 10) || 0;
    const salaryMax = maxStr ? parseInt(maxStr, 10) : 0;
    if (salaryMax > 0) {
      jobSql += ' AND j.salary_upper >= ? AND j.salary_lower <= ?';
      countSql += ' AND j.salary_upper >= ? AND j.salary_lower <= ?';
      params.push(salaryMin, salaryMax);
      countParams.push(salaryMin, salaryMax);
    } else {
      jobSql += ' AND j.salary_upper >= ?';
      countSql += ' AND j.salary_upper >= ?';
      params.push(salaryMin);
      countParams.push(salaryMin);
    }
  }

  jobSql += ' ORDER BY j.posted_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [countResult, jobsResult, countriesResult, locationsResult] = await Promise.all([
    c.env.DB.prepare(countSql).bind(...countParams).first<{ total: number }>(),
    c.env.DB.prepare(jobSql).bind(...params).all(),
    c.env.DB.prepare(
      `SELECT ct.*, COUNT(j.id) as job_count FROM countries ct
       JOIN jobs j ON j.country_id = ct.id AND j.is_active = 1
       WHERE ct.is_active = 1
       GROUP BY ct.id HAVING job_count > 0 ORDER BY job_count DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT lo.id, lo.name, lo.name_cn, lo.slug, lo.country_id, COUNT(j.id) as job_count FROM locations lo
       JOIN jobs j ON j.location_id = lo.id AND j.is_active = 1
       WHERE lo.is_active = 1
       GROUP BY lo.id HAVING job_count > 0 ORDER BY job_count DESC`
    ).all(),
  ]);

  const total = countResult?.total || 0;
  const jobs = ((jobsResult.results || []) as unknown as Job[]).map(j => ({
    ...j,
    company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
  }));
  const countries = (countriesResult.results || []) as unknown as Array<{ id: number; code: string; name: string; name_cn: string; slug: string; job_count: number }>;
  const locations = (locationsResult.results || []) as unknown as Array<{ id: number; name: string; name_cn: string; slug: string; country_id: number; job_count: number }>;

  const html = homePage(jobs, countries, locations, page, total, {
    query, countrySlug, locationSlug, salaryRange,
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL,
  });
  return c.html(html);
});

pages.get('/job/:slug', async (c) => {
  const slug = c.req.param('slug');

  const job = await c.env.DB.prepare(`
    SELECT j.*,
      co.name as company_name, co.thumbnail as company_thumbnail,
      lo.name as location_name, lo.name_cn as location_name_cn,
      ct.code as country_code, ct.name_cn as country_name_cn
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE j.slug = ?
  `).bind(slug).first<Job>();

  if (!job) {
    return c.html(
      `<div class="text-center py-20"><h1 class="text-2xl">404 - 职位未找到</h1><a href="/" class="text-brand-500">返回首页</a></div>`,
      404
    );
  }

  job.company_thumbnail = resolveThumbnail(job.company_thumbnail, c.env.STATIC_URL) as string;
  return c.html(jobDetailPage(job, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL));
});

pages.get('/about', (c) => {
  return c.html(aboutPage(c.env.GA_ID, c.env.STATIC_URL));
});

export default pages;
