import { Hono } from 'hono';
import { Env, Job, AppVariables } from '../types';
import { homePage } from '../templates/home';
import { jobDetailPage } from '../templates/jobDetail';
import { aboutPage } from '../templates/about';
import { postJobPage } from '../templates/postJob';
import { companiesPage } from '../templates/companies';
import { companyDetailPage } from '../templates/companyDetail';
import { categoriesPage } from '../templates/categories';
import { searchTermPage } from '../templates/searchTerm';
import { locationsPage } from '../templates/locations';
import { locationDetailPage } from '../templates/locationDetail';
import { loginPage } from '../templates/login';
import { favoritesPage } from '../templates/favorites';
import { accountPage } from '../templates/account';
import { resolveThumbnail, activeCutoff } from '../utils/helpers';
import { searchByVector } from '../services/vectorSearch';
import { maxListPage, normalizedListPage } from '../constants/listPagination';

const pages = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const JOBS_HYDRATE = `
  SELECT j.*,
    co.name as company_name, co.slug as company_slug, co.thumbnail as company_thumbnail,
    lo.name as location_name, lo.name_cn as location_name_cn, lo.slug as location_slug,
    ct.code as country_code, ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
  FROM jobs j
  LEFT JOIN companies co ON j.company_id = co.id
  LEFT JOIN locations lo ON j.location_id = lo.id
  LEFT JOIN countries ct ON j.country_id = ct.id`;

pages.get('/', async (c) => {
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const query = url.searchParams.get('q')?.trim() || '';
  const countrySlug = url.searchParams.get('country') || '';
  const locationSlug = url.searchParams.get('location') || '';
  const salaryRange = url.searchParams.get('salary') || '';
  const limit = 30;
  const offset = (page - 1) * limit;

  const cutoff = activeCutoff();

  let allIds: number[] = [];
  let orderedByRelevance = false;

  if (query) {
    const vectorIds = await searchByVector(c.env.AI, c.env.VECTORIZE, query);
    if (vectorIds.length > 0) {
      const activeResult = await c.env.DB.prepare(
        `SELECT id FROM jobs WHERE id IN (${vectorIds.join(',')}) AND posted_at >= ?`
      ).bind(cutoff).all();
      const activeIdSet = new Set((activeResult.results || []).map((r: Record<string, unknown>) => r.id as number));
      const orderedActiveIds = vectorIds.filter((id) => activeIdSet.has(id));
      allIds = orderedActiveIds.slice(offset, offset + limit + 1);
      orderedByRelevance = true;
    }
  } else {
    let idSql = 'SELECT id FROM jobs WHERE posted_at >= ?';
    const idParams: (string | number)[] = [cutoff];
    let valid = true;

    if (countrySlug || locationSlug) {
      const [cRow, lRow] = await Promise.all([
        countrySlug ? c.env.DB.prepare('SELECT id FROM countries WHERE slug = ?').bind(countrySlug).first<{ id: number }>() : null,
        locationSlug ? c.env.DB.prepare('SELECT id FROM locations WHERE slug = ?').bind(locationSlug).first<{ id: number }>() : null,
      ]);
      if (countrySlug) {
        if (cRow) { idSql += ' AND country_id = ?'; idParams.push(cRow.id); }
        else valid = false;
      }
      if (valid && locationSlug) {
        if (lRow) { idSql += ' AND location_id = ?'; idParams.push(lRow.id); }
        else valid = false;
      }
    }

    if (valid) {
      if (salaryRange) {
        const [minStr, maxStr] = salaryRange.split('-');
        const salaryMin = parseInt(minStr, 10) || 0;
        const salaryMax = maxStr ? parseInt(maxStr, 10) : 0;
        if (salaryMax > 0) {
          idSql += ' AND salary_upper >= ? AND salary_lower <= ?';
          idParams.push(salaryMin, salaryMax);
        } else {
          idSql += ' AND salary_upper >= ?';
          idParams.push(salaryMin);
        }
      }

      idSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      idParams.push(limit + 1, offset);

      const idResult = await c.env.DB.prepare(idSql).bind(...idParams).all();
      allIds = (idResult.results || []).map((r: Record<string, unknown>) => r.id as number);
    }
  }

  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;

  const hydrateOrderClause = orderedByRelevance ? '' : ' ORDER BY j.created_at DESC';
  const [jobsResult, countriesResult, locationsResult, topTermsResult, topLocationsResult] = await Promise.all([
    jobIds.length > 0
      ? c.env.DB.prepare(`${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')})${hydrateOrderClause}`).all()
      : { results: [] },
    c.env.DB.prepare(
      `SELECT ct.id, ct.code, ct.name, ct.name_cn, ct.slug, ct.flag_emoji, ct.job_count
       FROM countries ct
       WHERE ct.is_active = 1 AND ct.job_count > 0
       ORDER BY ct.job_count DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT lo.id, lo.name, lo.name_cn, lo.slug, lo.country_id, lo.job_count
       FROM locations lo
       WHERE lo.is_active = 1 AND lo.job_count > 0
       ORDER BY lo.job_count DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT term_cn, slug, job_count FROM search_terms
       WHERE is_active = 1 AND slug IS NOT NULL AND term_cn IS NOT NULL
       ORDER BY job_count DESC LIMIT 7`
    ).all(),
    c.env.DB.prepare(
      `SELECT lo.name_cn, lo.slug, lo.job_count, ct.flag_emoji as country_flag_emoji
       FROM locations lo
       LEFT JOIN countries ct ON lo.country_id = ct.id
       WHERE lo.is_active = 1 AND lo.job_count > 0
       ORDER BY lo.job_count DESC LIMIT 5`
    ).all(),
  ]);

  let jobs: Job[];
  if (orderedByRelevance) {
    const jobMap = new Map((jobsResult.results as unknown as Job[]).map((j) => [j.id, j]));
    jobs = jobIds
      .map((id) => jobMap.get(id))
      .filter((j): j is Job => j !== undefined)
      .map((j) => ({ ...j, company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL) }));
  } else {
    jobs = ((jobsResult.results || []) as unknown as Job[]).map((j) => ({
      ...j,
      company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
    }));
  }
  const countries = (countriesResult.results || []) as unknown as Array<{ id: number; code: string; name: string; name_cn: string; slug: string; job_count: number }>;
  const locations = (locationsResult.results || []) as unknown as Array<{ id: number; name: string; name_cn: string; slug: string; country_id: number; job_count: number }>;
  const topSearchTerms = (topTermsResult.results || []) as unknown as Array<{ term_cn: string; slug: string; job_count: number }>;
  const topLocations = (topLocationsResult.results || []) as unknown as Array<{ name_cn: string; slug: string; job_count: number; country_flag_emoji: string | null }>;

  const currentUser = c.get('user');
  let favoritedJobIds = new Set<number>();
  if (currentUser && jobIds.length > 0) {
    const favoriteResult = await c.env.DB.prepare(
      `SELECT job_id FROM favorites WHERE user_id = ? AND job_id IN (${jobIds.join(',')})`
    ).bind(currentUser.id).all<{ job_id: number }>();
    favoritedJobIds = new Set((favoriteResult.results || []).map((row) => row.job_id));
  }

  const html = homePage(jobs, countries, locations, page, hasMore, {
    query, countrySlug, locationSlug, salaryRange,
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL,
    topSearchTerms, topLocations,
    feishuGroupLink: c.env.FEISHU_GROUP_LINK,
    telegramChannelUrl: 'https://t.me/yuanchengdao',
    user: currentUser,
    favoritedJobIds,
  });
  return c.html(html);
});

pages.get('/job/:slug', async (c) => {
  const slug = c.req.param('slug');

  const baseJob = await c.env.DB.prepare(
    'SELECT * FROM jobs WHERE slug = ?'
  ).bind(slug).first<Job>();

  if (!baseJob) {
    return c.html(
      `<div class="text-center py-20"><h1 class="text-2xl">404 - 职位未找到</h1><a href="/" class="text-brand-500">返回首页</a></div>`,
      404
    );
  }

  const [companyRow, locationRow, countryRow] = await Promise.all([
    baseJob.company_id
      ? c.env.DB.prepare('SELECT id, name, slug, thumbnail FROM companies WHERE id = ?').bind(baseJob.company_id).first<{
        id: number; name: string; slug: string; thumbnail: string | null;
      }>()
      : null,
    baseJob.location_id
      ? c.env.DB.prepare('SELECT id, name, name_cn, slug, country_id FROM locations WHERE id = ?').bind(baseJob.location_id).first<{
        id: number; name: string; name_cn: string; slug: string; country_id: number | null;
      }>()
      : null,
    baseJob.country_id
      ? c.env.DB.prepare('SELECT id, code, name_cn, flag_emoji FROM countries WHERE id = ?').bind(baseJob.country_id).first<{
        id: number; code: string; name_cn: string; flag_emoji: string | null;
      }>()
      : null,
  ]);

  const job: Job = {
    ...baseJob,
    company_name: companyRow?.name,
    company_slug: companyRow?.slug,
    company_thumbnail: companyRow?.thumbnail ? resolveThumbnail(companyRow.thumbnail, c.env.STATIC_URL) : undefined,
    location_name: locationRow?.name,
    location_name_cn: locationRow?.name_cn,
    location_slug: locationRow?.slug,
    country_code: countryRow?.code,
    country_name_cn: countryRow?.name_cn,
    country_flag_emoji: countryRow?.flag_emoji ?? undefined,
  };

  const postedAt = job.posted_at || job.created_at;
  const ageMs = Date.now() - new Date(postedAt).getTime();
  const ageDays = ageMs / 86400000;

  if (ageDays > 90) {
    return c.html(
      `<div class="text-center py-20"><h1 class="text-2xl">410 - 此职位已被删除</h1><p class="text-surface-500 mt-2">该职位发布时间已超过 90 天，已被移除。</p><a href="/" class="text-brand-500 mt-4 inline-block">返回首页</a></div>`,
      410
    );
  }

  const isExpired = ageDays > 30;

  const currentUser = c.get('user');
  let isFavorited = false;
  if (currentUser) {
    const favorite = await c.env.DB.prepare(
      'SELECT id FROM favorites WHERE user_id = ? AND job_id = ?'
    ).bind(currentUser.id, job.id).first<{ id: number }>();
    isFavorited = !!favorite;
  }

  let similarJobs: Job[] = [];
  if (job.search_term_id) {
    const activeDate = activeCutoff();
    const simIdResult = await c.env.DB.prepare(
      'SELECT id FROM jobs WHERE search_term_id = ? AND id != ? AND posted_at >= ? ORDER BY created_at DESC LIMIT 10'
    ).bind(job.search_term_id, job.id, activeDate).all();
    const simIds = (simIdResult.results || []).map((r: Record<string, unknown>) => r.id as number);

    if (simIds.length > 0) {
      const result = await c.env.DB.prepare(`
        SELECT j.slug, j.title, j.created_at, j.posted_at,
          co.name as company_name, co.slug as company_slug, co.thumbnail as company_thumbnail,
          lo.name_cn as location_name_cn, lo.slug as location_slug, ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
        FROM jobs j
        LEFT JOIN companies co ON j.company_id = co.id
        LEFT JOIN locations lo ON j.location_id = lo.id
        LEFT JOIN countries ct ON j.country_id = ct.id
        WHERE j.id IN (${simIds.join(',')})
        ORDER BY j.created_at DESC
      `).all();
      similarJobs = ((result.results || []) as unknown as Job[]).map(j => ({
        ...j,
        company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
      })) as Job[];
    }
  }

  return c.html(jobDetailPage(job, similarJobs, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, isExpired, currentUser, isFavorited));
});

pages.get('/companies', async (c) => {
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const query = url.searchParams.get('q')?.trim() || '';
  const limit = 30;
  const offset = (page - 1) * limit;

  let listSql = `
    SELECT co.id, co.name, co.slug, co.thumbnail, co.job_count,
      lo.name_cn as location_name_cn,
      ct.name_cn as country_name_cn,
      ct.flag_emoji as country_flag_emoji
    FROM companies co
    LEFT JOIN locations lo ON co.location_id = lo.id
    LEFT JOIN countries ct ON lo.country_id = ct.id
    WHERE co.job_count > 0`;
  const params: (string | number)[] = [];

  if (query) {
    listSql += ' AND co.name LIKE ?';
    params.push(`%${query}%`);
  }

  listSql += ' ORDER BY co.job_count DESC LIMIT ? OFFSET ?';
  params.push(limit + 1, offset);

  const result = await c.env.DB.prepare(listSql).bind(...params).all();

  const allCompanies = (result.results || []).map((r: Record<string, unknown>) => ({
    ...r,
    thumbnail: resolveThumbnail(r.thumbnail as string | null, c.env.STATIC_URL),
  }));
  const hasMoreRaw = allCompanies.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const companies = hasMoreRaw ? allCompanies.slice(0, limit) : allCompanies;

  return c.html(companiesPage(
    companies as any[], page, hasMore, query,
    c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user'),
  ));
});

pages.get('/company/:slug', async (c) => {
  const slug = c.req.param('slug');
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const limit = 30;
  const offset = (page - 1) * limit;

  const company = await c.env.DB.prepare(`
    SELECT co.id, co.name, co.slug, co.thumbnail,
      lo.name_cn as location_name_cn,
      ct.name_cn as country_name_cn,
      ct.flag_emoji as country_flag_emoji
    FROM companies co
    LEFT JOIN locations lo ON co.location_id = lo.id
    LEFT JOIN countries ct ON lo.country_id = ct.id
    WHERE co.slug = ?
  `).bind(slug).first<Record<string, unknown>>();

  if (!company) {
    return c.html(
      `<div class="text-center py-20"><h1 class="text-2xl">404 - 公司未找到</h1><a href="/companies" class="text-brand-500">返回公司列表</a></div>`,
      404
    );
  }

  company.thumbnail = resolveThumbnail(company.thumbnail as string | null, c.env.STATIC_URL) as any;

  const cutoff = activeCutoff();
  const idResult = await c.env.DB.prepare(
    'SELECT id FROM jobs WHERE company_id = ? AND posted_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(company.id, cutoff, limit + 1, offset).all();
  const allIds = (idResult.results || []).map((r: Record<string, unknown>) => r.id as number);
  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;

  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(
      `${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')}) ORDER BY j.created_at DESC`
    ).all();
    jobs = ((jobsResult.results || []) as unknown as Job[]).map(j => ({
      ...j,
      company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
    }));
  }

  return c.html(companyDetailPage(company as any, jobs, page, hasMore, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user')));
});

pages.get('/categories', async (c) => {
  const query = new URL(c.req.url).searchParams.get('q')?.trim() || '';

  let sql = `SELECT id, term, term_cn, slug, job_count FROM search_terms
     WHERE is_active = 1 AND slug IS NOT NULL AND term_cn IS NOT NULL`;
  const params: string[] = [];

  if (query) {
    sql += ' AND (term_cn LIKE ? OR term LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }

  sql += ' ORDER BY job_count DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  const terms = (result.results || []) as unknown as Array<{ id: number; term: string; term_cn: string; slug: string; job_count: number }>;
  return c.html(categoriesPage(terms, query, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user')));
});

pages.get('/category/:slug', async (c) => {
  const slug = c.req.param('slug');
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const limit = 30;
  const offset = (page - 1) * limit;

  const term = await c.env.DB.prepare(
    'SELECT id, term, term_cn, slug FROM search_terms WHERE slug = ? AND is_active = 1 AND term_cn IS NOT NULL AND slug IS NOT NULL'
  ).bind(slug).first<{ id: number; term: string; term_cn: string; slug: string }>();

  if (!term) {
    return c.html(
      `<div class="text-center py-20"><h1 class="text-2xl">404 - 页面未找到</h1><a href="/" class="text-brand-500">返回首页</a></div>`,
      404
    );
  }

  const cutoff = activeCutoff();
  const idResult = await c.env.DB.prepare(
    'SELECT id FROM jobs WHERE search_term_id = ? AND posted_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(term.id, cutoff, limit + 1, offset).all();
  const allIds = (idResult.results || []).map((r: Record<string, unknown>) => r.id as number);
  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;

  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(
      `${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')}) ORDER BY j.created_at DESC`
    ).all();
    jobs = ((jobsResult.results || []) as unknown as Job[]).map(j => ({
      ...j,
      company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
    }));
  }

  return c.html(searchTermPage(term, jobs, page, hasMore, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user')));
});

pages.get('/locations', async (c) => {
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const query = url.searchParams.get('q')?.trim() || '';
  const limit = 30;
  const offset = (page - 1) * limit;

  let listSql = `
    SELECT lo.id, lo.name, lo.name_cn, lo.slug, lo.job_count,
      ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
    FROM locations lo
    LEFT JOIN countries ct ON lo.country_id = ct.id
    WHERE lo.is_active = 1 AND lo.job_count > 0`;
  const params: (string | number)[] = [];

  if (query) {
    listSql += ' AND (lo.name LIKE ? OR lo.name_cn LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }

  listSql += ' ORDER BY lo.job_count DESC LIMIT ? OFFSET ?';
  params.push(limit + 1, offset);

  const result = await c.env.DB.prepare(listSql).bind(...params).all();

  const allLocations = (result.results || []) as unknown as Array<{ id: number; name: string; name_cn: string; slug: string; country_name_cn: string | null; country_flag_emoji: string | null; job_count: number }>;
  const hasMoreRaw = allLocations.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const locations = hasMoreRaw ? allLocations.slice(0, limit) : allLocations;

  return c.html(locationsPage(locations, page, hasMore, query, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user')));
});

pages.get('/location/:slug', async (c) => {
  const slug = c.req.param('slug');
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const limit = 30;
  const offset = (page - 1) * limit;

  const location = await c.env.DB.prepare(`
    SELECT lo.id, lo.name, lo.name_cn, lo.slug,
      ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
    FROM locations lo
    LEFT JOIN countries ct ON lo.country_id = ct.id
    WHERE lo.slug = ? AND lo.is_active = 1
  `).bind(slug).first<{ id: number; name: string; name_cn: string; slug: string; country_name_cn: string | null; country_flag_emoji: string | null }>();

  if (!location) {
    return c.html(
      `<div class="text-center py-20"><h1 class="text-2xl">404 - 地区未找到</h1><a href="/" class="text-brand-500">返回首页</a></div>`,
      404
    );
  }

  const cutoff = activeCutoff();
  const idResult = await c.env.DB.prepare(
    'SELECT id FROM jobs WHERE location_id = ? AND posted_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(location.id, cutoff, limit + 1, offset).all();
  const allIds = (idResult.results || []).map((r: Record<string, unknown>) => r.id as number);
  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;

  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(
      `${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')}) ORDER BY j.created_at DESC`
    ).all();
    jobs = ((jobsResult.results || []) as unknown as Job[]).map(j => ({
      ...j,
      company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
    }));
  }

  return c.html(locationDetailPage(location, jobs, page, hasMore, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user')));
});

pages.get('/about', (c) => {
  return c.html(aboutPage(c.env.GA_ID, c.env.STATIC_URL, c.get('user')));
});

pages.get('/post-job', (c) => {
  return c.html(postJobPage(c.env.GA_ID, c.env.STATIC_URL, c.get('user')));
});

pages.get('/login', (c) => {
  const user = c.get('user');
  const nextPath = c.req.query('next') || '/';
  if (user) return c.redirect(nextPath.startsWith('/') ? nextPath : '/', 302);
  const errorCode = c.req.query('error');
  const errorMessage = errorCode === 'google' ? 'Google 登录失败，请重试'
    : errorCode === 'config' ? '登录服务未配置'
    : undefined;
  return c.html(loginPage({
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
    siteUrl: c.env.SITE_URL,
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
    nextPath,
    error: errorMessage,
    user: null,
  }));
});

pages.get('/favorites', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect(`/login?next=${encodeURIComponent('/favorites')}`, 302);

  const idResult = await c.env.DB.prepare(
    'SELECT job_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all<{ job_id: number }>();
  const jobIds = (idResult.results || []).map((row) => row.job_id);

  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(
      `${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')})`
    ).all();
    const jobMap = new Map((jobsResult.results as unknown as Job[]).map((job) => [job.id, job]));
    jobs = jobIds
      .map((id) => jobMap.get(id))
      .filter((job): job is Job => job !== undefined)
      .map((job) => ({
        ...job,
        company_thumbnail: resolveThumbnail(job.company_thumbnail, c.env.STATIC_URL),
      }));
  }

  return c.html(favoritesPage(jobs, {
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
    user,
  }));
});

pages.get('/account', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect(`/login?next=${encodeURIComponent('/account')}`, 302);

  const [subscriptionIdsResult, searchTermsResult, locationsResult] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all<{ id: number }>(),
    c.env.DB.prepare(
      `SELECT id, term_cn, slug FROM search_terms
       WHERE is_active = 1 AND slug IS NOT NULL AND term_cn IS NOT NULL
       ORDER BY job_count DESC`
    ).all<{ id: number; term_cn: string; slug: string }>(),
    c.env.DB.prepare(
      `SELECT id, name_cn, slug FROM locations
       WHERE is_active = 1 AND job_count > 0
       ORDER BY job_count DESC LIMIT 200`
    ).all<{ id: number; name_cn: string; slug: string }>(),
  ]);

  const subscriptionIds = (subscriptionIdsResult.results || []).map((row) => row.id);
  let subscriptions: Array<{
    id: number;
    search_term_id: number;
    location_id: number | null;
    notify_email: number;
    notify_telegram: number;
    term_cn: string | null;
    location_name_cn: string | null;
  }> = [];

  if (subscriptionIds.length > 0) {
    const hydrated = await c.env.DB.prepare(`
      SELECT s.id, s.search_term_id, s.location_id, s.notify_email, s.notify_telegram,
        st.term_cn, lo.name_cn as location_name_cn
      FROM subscriptions s
      LEFT JOIN search_terms st ON s.search_term_id = st.id
      LEFT JOIN locations lo ON s.location_id = lo.id
      WHERE s.id IN (${subscriptionIds.join(',')})
      ORDER BY s.created_at DESC
    `).all();
    subscriptions = (hydrated.results || []) as typeof subscriptions;
  }

  return c.html(accountPage({
    user,
    subscriptions,
    searchTerms: (searchTermsResult.results || []) as Array<{ id: number; term_cn: string; slug: string }>,
    locations: (locationsResult.results || []) as Array<{ id: number; name_cn: string; slug: string }>,
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
  }));
});

export default pages;
