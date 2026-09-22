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
import { usersPage, AdminUserRow, AdminUserSubscription } from '../templates/users';
import { feedbackPage } from '../templates/feedback';
import { adminFeedbackPage, AdminFeedbackRow } from '../templates/adminFeedback';
import { englishLevelPage } from '../templates/englishLevel';
import { chineseJobsPage } from '../templates/chinese';
import { countryPage, CountryPageInfo } from '../templates/country';
import { salaryPage, SalaryStatRow } from '../templates/salary';
import { weeklyPage } from '../templates/weekly';
import { adminSubmissionsPage } from '../templates/adminSubmissions';
import { FavoriteRecord } from '../templates/favorites';
import { CompanyStats } from '../templates/companyDetail';
import { hybridSearchJobIds } from '../services/search';
import { recommendJobIdsForUser } from '../services/recommendations';
import { listWeeklyReportWeeks, loadLatestWeeklyReport, loadWeeklyReport } from '../services/weekly';
import { JobSubmissionRow } from '../services/jobSubmissions';
import { ENGLISH_LEVEL_GROUPS, findEnglishLevelGroup } from '../constants/englishLevel';
import { monthlySalarySql } from '../constants/salary';
import { isFavoriteStatus } from '../constants/favorites';
import { isSubscriptionKind } from '../constants/subscriptions';
import { formatSalary } from '../utils/helpers';
import { resolveThumbnail, activeCutoff } from '../utils/helpers';
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
  if (url.searchParams.get('chinese') === '1') {
    return c.redirect(`/jobs/chinese${page > 1 ? `?page=${page}` : ''}`, 301);
  }
  const limit = 30;
  const offset = (page - 1) * limit;

  const cutoff = activeCutoff();

  let allIds: number[] = [];
  let orderedByRelevance = false;

  let valid = true;
  const filterClauses: string[] = ['posted_at >= ?'];
  const filterParams: (string | number)[] = [cutoff];

  if (countrySlug || locationSlug) {
    const [cRow, lRow] = await Promise.all([
      countrySlug ? c.env.DB.prepare('SELECT id FROM countries WHERE slug = ?').bind(countrySlug).first<{ id: number }>() : null,
      locationSlug ? c.env.DB.prepare('SELECT id FROM locations WHERE slug = ?').bind(locationSlug).first<{ id: number }>() : null,
    ]);
    if (countrySlug) {
      if (cRow) { filterClauses.push('country_id = ?'); filterParams.push(cRow.id); }
      else valid = false;
    }
    if (valid && locationSlug) {
      if (lRow) { filterClauses.push('location_id = ?'); filterParams.push(lRow.id); }
      else valid = false;
    }
  }

  if (valid && salaryRange) {
    const [minStr, maxStr] = salaryRange.split('-');
    const salaryMin = parseInt(minStr, 10) || 0;
    const salaryMax = maxStr ? parseInt(maxStr, 10) : 0;
    if (salaryMax > 0) {
      filterClauses.push('salary_upper >= ?', 'salary_lower <= ?');
      filterParams.push(salaryMin, salaryMax);
    } else {
      filterClauses.push('salary_upper >= ?');
      filterParams.push(salaryMin);
    }
  }
  if (valid) {
    if (query) {
      const rankedIds = await hybridSearchJobIds(c.env, query, cutoff);
      if (rankedIds.length > 0) {
        const keepResult = await c.env.DB.prepare(
          `SELECT id FROM jobs WHERE id IN (${rankedIds.join(',')}) AND ${filterClauses.join(' AND ')}`
        ).bind(...filterParams).all<{ id: number }>();
        const keep = new Set((keepResult.results || []).map((r) => r.id));
        const filtered = rankedIds.filter((id) => keep.has(id));
        allIds = filtered.slice(offset, offset + limit + 1);
        orderedByRelevance = true;
      }
    } else {
      const idResult = await c.env.DB.prepare(
        `SELECT id FROM jobs WHERE ${filterClauses.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...filterParams, limit + 1, offset).all<{ id: number }>();
      allIds = (idResult.results || []).map((r) => r.id);
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

  const showDiscovery = page === 1 && !query && !countrySlug && !locationSlug && !salaryRange;
  let newCompanies: Array<{ name: string; slug: string; job_count: number; thumbnail?: string }> = [];
  let topSalaryJobs: Array<{ slug: string; title: string; company_name: string | null; salary_label: string }> = [];
  let recommended: Array<{ slug: string; title: string; company_name: string | null; location_label: string }> = [];
  let chineseFriendlyCount = 0;
  let noEnglishCount = 0;
  if (showDiscovery) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const [companiesRes, salaryRes, countsRes, recIds] = await Promise.all([
        c.env.DB.prepare(
          `SELECT name, slug, job_count, thumbnail FROM companies WHERE created_at >= ? AND job_count > 0 ORDER BY job_count DESC, id DESC LIMIT 12`
        ).bind(weekAgo).all<{ name: string; slug: string; job_count: number; thumbnail: string | null }>(),
        c.env.DB.prepare(`
          SELECT j.slug, j.title, j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle, co.name as company_name
          FROM jobs j LEFT JOIN companies co ON co.id = j.company_id
          WHERE j.created_at >= ? AND j.salary_upper > 0 AND ${monthlySalarySql('j.salary_upper')} < 1000000
          ORDER BY ${monthlySalarySql('j.salary_upper')} DESC LIMIT 5
        `).bind(weekAgo).all<{ slug: string; title: string; salary_lower: number; salary_upper: number; salary_currency: string; salary_pay_cycle: string; company_name: string | null }>(),
        c.env.DB.prepare(
          `SELECT SUM(chinese_friendly) as cf, SUM(CASE WHEN english_level_required = 'none' THEN 1 ELSE 0 END) as ne FROM jobs WHERE posted_at >= ?`
        ).bind(cutoff).first<{ cf: number | null; ne: number | null }>(),
        currentUser ? recommendJobIdsForUser(c.env, currentUser.id, 5).catch(() => [] as number[]) : Promise.resolve([] as number[]),
      ]);
      newCompanies = (companiesRes.results || []).map((co) => ({
        name: co.name, slug: co.slug, job_count: co.job_count,
        thumbnail: resolveThumbnail(co.thumbnail, c.env.STATIC_URL),
      }));
      topSalaryJobs = (salaryRes.results || []).map((j) => ({
        slug: j.slug, title: j.title, company_name: j.company_name,
        salary_label: formatSalary(j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle),
      }));
      chineseFriendlyCount = countsRes?.cf ?? 0;
      noEnglishCount = countsRes?.ne ?? 0;
      if (recIds.length > 0) {
        const recRes = await c.env.DB.prepare(`
          SELECT j.id, j.slug, j.title, co.name as company_name, lo.name_cn as location_name_cn, ct.name_cn as country_name_cn
          FROM jobs j LEFT JOIN companies co ON co.id = j.company_id
          LEFT JOIN locations lo ON lo.id = j.location_id LEFT JOIN countries ct ON ct.id = j.country_id
          WHERE j.id IN (${recIds.join(',')}) AND j.posted_at >= ?
        `).bind(cutoff).all<{ id: number; slug: string; title: string; company_name: string | null; location_name_cn: string | null; country_name_cn: string | null }>();
        const recMap = new Map((recRes.results || []).map((r) => [r.id, r]));
        recommended = recIds.map((id) => recMap.get(id)).filter((r): r is NonNullable<typeof r> => !!r).slice(0, 5).map((r) => ({
          slug: r.slug, title: r.title, company_name: r.company_name,
          location_label: [r.location_name_cn, r.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程',
        }));
      }
    } catch (err) {
      console.error('Home discovery failed:', err instanceof Error ? err.message : err);
    }
  }

  const html = homePage(jobs, countries, locations, page, hasMore, {
    query, countrySlug, locationSlug, salaryRange,
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL,
    topSearchTerms, topLocations,
    feishuGroupLink: c.env.FEISHU_GROUP_LINK,
    telegramChannelUrl: 'https://t.me/yuanchengdao',
    user: currentUser,
    favoritedJobIds,
    newCompanies, topSalaryJobs, recommended, chineseFriendlyCount, noEnglishCount,
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
    SELECT co.id, co.name, co.slug, co.thumbnail, co.description, co.website, co.job_count,
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
  const companyId = company.id as number;
  const [idResult, statsRow, firstRow, topLocRes, topCatRes] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id FROM jobs WHERE company_id = ? AND posted_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(companyId, cutoff, limit + 1, offset).all(),
    c.env.DB.prepare(`
      SELECT COUNT(*) as active,
        MAX(COALESCE(posted_at, created_at)) as last_posted,
        MIN(CASE WHEN salary_lower > 0 THEN ${monthlySalarySql('salary_lower')} END) as smin,
        MAX(CASE WHEN salary_upper > 0 AND ${monthlySalarySql('salary_upper')} < 1000000 THEN ${monthlySalarySql('salary_upper')} END) as smax
      FROM jobs WHERE company_id = ? AND posted_at >= ?
    `).bind(companyId, cutoff).first<{ active: number; last_posted: string | null; smin: number | null; smax: number | null }>(),
    c.env.DB.prepare('SELECT MIN(created_at) as first_seen FROM jobs WHERE company_id = ?').bind(companyId).first<{ first_seen: string | null }>(),
    c.env.DB.prepare(`
      SELECT lo.name_cn, lo.slug, COUNT(*) as count FROM jobs j JOIN locations lo ON lo.id = j.location_id
      WHERE j.company_id = ? AND j.posted_at >= ? GROUP BY lo.id ORDER BY count DESC LIMIT 5
    `).bind(companyId, cutoff).all<{ name_cn: string; slug: string; count: number }>(),
    c.env.DB.prepare(`
      SELECT st.term_cn, st.slug, COUNT(*) as count FROM jobs j JOIN search_terms st ON st.id = j.search_term_id
      WHERE j.company_id = ? AND j.posted_at >= ? AND st.slug IS NOT NULL AND st.term_cn IS NOT NULL
      GROUP BY st.id ORDER BY count DESC LIMIT 5
    `).bind(companyId, cutoff).all<{ term_cn: string; slug: string; count: number }>(),
  ]);
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

  const stats: CompanyStats = {
    activeJobs: statsRow?.active ?? 0,
    firstSeen: firstRow?.first_seen ?? null,
    lastPosted: statsRow?.last_posted ?? null,
    salaryMin: Math.round(statsRow?.smin ?? 0),
    salaryMax: Math.round(statsRow?.smax ?? 0),
    topLocations: topLocRes.results || [],
    topCategories: topCatRes.results || [],
  };

  return c.html(companyDetailPage(company as any, jobs, page, hasMore, c.env.GA_ID, c.env.SITE_URL, c.env.STATIC_URL, c.get('user'), stats));
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
  return c.html(postJobPage({
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
    user: c.get('user'),
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
  }));
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

  const statusParam = new URL(c.req.url).searchParams.get('status') || 'all';
  const activeStatus = statusParam === 'all' || isFavoriteStatus(statusParam) ? statusParam : 'all';

  const recordsResult = await c.env.DB.prepare(
    `SELECT id, job_id, status, notes, job_title, company_name, company_slug, job_slug, apply_url, job_posted_at, created_at, updated_at
     FROM favorites WHERE user_id = ? ORDER BY updated_at DESC`
  ).bind(user.id).all<Omit<FavoriteRecord, 'job'>>();
  const rawRecords = recordsResult.results || [];
  const jobIds = rawRecords.map((r) => r.job_id).filter((v): v is number => typeof v === 'number');

  let jobMap = new Map<number, Job>();
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(`${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')})`).all();
    jobMap = new Map((jobsResult.results as unknown as Job[]).map((job) => [job.id, {
      ...job,
      company_thumbnail: resolveThumbnail(job.company_thumbnail, c.env.STATIC_URL),
    }]));
  }
  const records: FavoriteRecord[] = rawRecords.map((r) => ({
    ...r,
    job: typeof r.job_id === 'number' ? jobMap.get(r.job_id) || null : null,
  }));

  let recommended: Job[] = [];
  try {
    const recIds = await recommendJobIdsForUser(c.env, user.id, 6);
    if (recIds.length > 0) {
      const recRes = await c.env.DB.prepare(
        `${JOBS_HYDRATE} WHERE j.id IN (${recIds.join(',')}) AND j.posted_at >= ?`
      ).bind(activeCutoff()).all();
      const recMap = new Map((recRes.results as unknown as Job[]).map((j) => [j.id, j]));
      recommended = recIds.map((id) => recMap.get(id)).filter((j): j is Job => !!j).slice(0, 6).map((j) => ({
        ...j,
        company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
      }));
    }
  } catch (err) {
    console.error('Recommendations failed:', err instanceof Error ? err.message : err);
  }

  return c.html(favoritesPage(records, recommended, {
    user,
    activeStatus,
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
  }));
});

pages.get('/account', async (c) => {
  const user = c.get('user');
  const url = new URL(c.req.url);
  const nextPath = url.pathname + (url.search || '');
  if (!user) return c.redirect(`/login?next=${encodeURIComponent(nextPath)}`, 302);

  const prefillKindRaw = url.searchParams.get('kind') || '';
  const prefillTermSlug = url.searchParams.get('term') || '';
  const prefillQuery = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const prefillCompanyId = parseInt(url.searchParams.get('company') || '', 10);
  const prefillLocationSlug = url.searchParams.get('location') || '';
  const prefillSalary = url.searchParams.get('salary') || '';

  const [subscriptionsResult, searchTermsResult, locationsResult, prefillLocationRow, prefillTermRow, prefillCompanyRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT s.id, s.kind, s.search_term_id, s.query_text, s.company_id, s.location_id, s.salary_range, s.notify_email, s.notify_telegram,
        st.term_cn, co.name as company_name, lo.name_cn as location_name_cn
      FROM subscriptions s
      LEFT JOIN search_terms st ON s.search_term_id = st.id
      LEFT JOIN companies co ON s.company_id = co.id
      LEFT JOIN locations lo ON s.location_id = lo.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).bind(user.id).all(),
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
    prefillLocationSlug
      ? c.env.DB.prepare(`SELECT id, name_cn FROM locations WHERE slug = ? AND is_active = 1`).bind(prefillLocationSlug).first<{ id: number; name_cn: string }>()
      : Promise.resolve(null),
    prefillTermSlug
      ? c.env.DB.prepare(`SELECT id, term_cn FROM search_terms WHERE slug = ? AND is_active = 1`).bind(prefillTermSlug).first<{ id: number; term_cn: string }>()
      : Promise.resolve(null),
    Number.isFinite(prefillCompanyId) && prefillCompanyId > 0
      ? c.env.DB.prepare(`SELECT id, name FROM companies WHERE id = ?`).bind(prefillCompanyId).first<{ id: number; name: string }>()
      : Promise.resolve(null),
  ]);

  const hasPrefill = !!(prefillLocationRow || prefillSalary || prefillTermRow || prefillCompanyRow || prefillQuery || isSubscriptionKind(prefillKindRaw));
  const inferredKind = isSubscriptionKind(prefillKindRaw)
    ? prefillKindRaw
    : prefillCompanyRow ? 'company' : prefillQuery ? 'keyword' : 'category';
  const prefill = hasPrefill
    ? {
        kind: inferredKind,
        searchTermId: prefillTermRow?.id ?? null,
        searchTermLabel: prefillTermRow?.term_cn ?? null,
        queryText: prefillQuery || null,
        companyId: prefillCompanyRow?.id ?? null,
        companyLabel: prefillCompanyRow?.name ?? null,
        locationId: prefillLocationRow?.id ?? null,
        locationLabel: prefillLocationRow?.name_cn ?? null,
        salaryRange: prefillSalary || null,
      }
    : undefined;

  return c.html(accountPage({
    user,
    subscriptions: (subscriptionsResult.results || []) as any,
    searchTerms: (searchTermsResult.results || []) as Array<{ id: number; term_cn: string; slug: string }>,
    locations: (locationsResult.results || []) as Array<{ id: number; name_cn: string; slug: string }>,
    prefill,
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
  }));
});

pages.get('/users', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect(`/login?next=${encodeURIComponent('/users')}`, 302);
  if (user.role !== 'admin') return c.notFound();

  const usersResult = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.created_at, u.telegram_chat_id,
       (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) as favorite_count
     FROM users u
     ORDER BY u.id ASC`
  ).all<{
    id: number;
    email: string;
    name: string | null;
    role: 'admin' | 'user';
    created_at: string;
    telegram_chat_id: string | null;
    favorite_count: number;
  }>();

  const users = usersResult.results || [];
  const userIds = users.map((u) => u.id);

  let subsByUser = new Map<number, AdminUserSubscription[]>();
  if (userIds.length > 0) {
    const subsResult = await c.env.DB.prepare(`
      SELECT s.user_id, s.salary_range, s.notify_email, s.notify_telegram,
        st.term_cn, lo.name_cn as location_name_cn
      FROM subscriptions s
      LEFT JOIN search_terms st ON s.search_term_id = st.id
      LEFT JOIN locations lo ON s.location_id = lo.id
      WHERE s.user_id IN (${userIds.join(',')})
      ORDER BY s.created_at DESC
    `).all<{
      user_id: number;
      salary_range: string | null;
      notify_email: number;
      notify_telegram: number;
      term_cn: string | null;
      location_name_cn: string | null;
    }>();
    for (const row of subsResult.results || []) {
      const list = subsByUser.get(row.user_id) || [];
      list.push({
        term_cn: row.term_cn,
        location_name_cn: row.location_name_cn,
        salary_range: row.salary_range,
        notify_email: row.notify_email,
        notify_telegram: row.notify_telegram,
      });
      subsByUser.set(row.user_id, list);
    }
  }

  const rows: AdminUserRow[] = users.map((u) => ({
    ...u,
    subscriptions: subsByUser.get(u.id) || [],
  }));

  return c.html(usersPage({
    user,
    users: rows,
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
  }));
});

pages.get('/feedback', async (c) => {
  const user = c.get('user');
  const url = new URL(c.req.url);
  const prefillCategory = url.searchParams.get('category') || '';
  const referer = c.req.header('Referer') || '';
  return c.html(feedbackPage({
    user,
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
    prefillCategory,
    prefillPageUrl: referer,
  }));
});

pages.get('/admin/feedback', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect(`/login?next=${encodeURIComponent('/admin/feedback')}`, 302);
  if (user.role !== 'admin') return c.notFound();

  const result = await c.env.DB.prepare(`
    SELECT f.id, f.user_id, f.email, f.category, f.message, f.reference_url, f.page_url,
      f.resolved_at, f.admin_notes, f.created_at,
      u.email as user_email, u.name as user_name
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.resolved_at IS NOT NULL, f.created_at DESC
    LIMIT 200
  `).all<AdminFeedbackRow>();

  return c.html(adminFeedbackPage({
    user,
    feedback: (result.results || []) as AdminFeedbackRow[],
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
  }));
});

// Legacy URLs: keep old links/search results working with permanent redirects.
function legacyRedirect(c: { req: { url: string }; redirect: (to: string, status: 301) => Response }, to: string): Response {
  const search = new URL(c.req.url).search;
  return c.redirect(`${to}${search}`, 301);
}
pages.get('/english/:level', (c) => legacyRedirect(c, `/jobs/english-${encodeURIComponent(c.req.param('level'))}`));
pages.get('/chinese', (c) => legacyRedirect(c, '/jobs/chinese'));
pages.get('/salary', (c) => legacyRedirect(c, '/salary-reports'));
pages.get('/weekly', (c) => legacyRedirect(c, '/weekly-reports'));
pages.get('/weekly/:week', (c) => legacyRedirect(c, `/weekly-reports/${encodeURIComponent(c.req.param('week'))}`));
pages.get('/jobs', (c) => legacyRedirect(c, '/'));

pages.get('/jobs/chinese', async (c) => {
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const limit = 30;
  const offset = (page - 1) * limit;
  const cutoff = activeCutoff();

  const [idResult, totalRow] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id FROM jobs WHERE chinese_friendly = 1 AND posted_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(cutoff, limit + 1, offset).all<{ id: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM jobs WHERE chinese_friendly = 1 AND posted_at >= ?').bind(cutoff).first<{ c: number }>(),
  ]);
  const allIds = (idResult.results || []).map((r) => r.id);
  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;
  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(`${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')}) ORDER BY j.created_at DESC`).all();
    jobs = ((jobsResult.results || []) as unknown as Job[]).map((j) => ({ ...j, company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL) }));
  }

  return c.html(chineseJobsPage(jobs, page, hasMore, totalRow?.c ?? 0, {
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL, user: c.get('user'),
  }));
});

// Hono params must span a whole segment, so `/jobs/english-<level>` is matched here and parsed by hand.
pages.get('/jobs/:collection', async (c) => {
  const match = /^english-(.+)$/.exec(c.req.param('collection'));
  const group = match ? findEnglishLevelGroup(match[1]) : null;
  if (!group) return c.notFound();
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const limit = 30;
  const offset = (page - 1) * limit;
  const cutoff = activeCutoff();

  const placeholders = group.levels.map(() => '?').join(',');
  const [idResult, countsResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id FROM jobs WHERE posted_at >= ? AND english_level_required IN (${placeholders}) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(cutoff, ...group.levels, limit + 1, offset).all<{ id: number }>(),
    c.env.DB.prepare(
      `SELECT english_level_required as level, COUNT(*) as count FROM jobs WHERE posted_at >= ? GROUP BY english_level_required`
    ).bind(cutoff).all<{ level: string; count: number }>(),
  ]);
  const counts: Record<string, number> = {};
  for (const g of ENGLISH_LEVEL_GROUPS) {
    counts[g.slug] = (countsResult.results || [])
      .filter((r) => (g.levels as readonly string[]).includes(r.level))
      .reduce((sum, r) => sum + r.count, 0);
  }

  const allIds = (idResult.results || []).map((r) => r.id);
  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;
  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(`${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')}) ORDER BY j.created_at DESC`).all();
    jobs = ((jobsResult.results || []) as unknown as Job[]).map((j) => ({ ...j, company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL) }));
  }

  return c.html(englishLevelPage(group, jobs, page, hasMore, counts, {
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL, user: c.get('user'),
  }));
});

pages.get('/country/:slug', async (c) => {
  const slug = c.req.param('slug');
  const url = new URL(c.req.url);
  const { page, redirectPath } = normalizedListPage(url, c.env);
  if (redirectPath) return c.redirect(redirectPath, 302);
  const listPageCap = maxListPage(c.env);
  const limit = 30;
  const offset = (page - 1) * limit;

  const country = await c.env.DB.prepare(
    'SELECT id, code, name, name_cn, slug, flag_emoji, job_count FROM countries WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<CountryPageInfo>();
  if (!country) return c.notFound();

  const cutoff = activeCutoff();
  const [idResult, topLocRes, othersRes] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id FROM jobs WHERE country_id = ? AND posted_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(country.id, cutoff, limit + 1, offset).all<{ id: number }>(),
    c.env.DB.prepare(
      'SELECT name_cn, slug, job_count FROM locations WHERE country_id = ? AND is_active = 1 AND job_count > 0 ORDER BY job_count DESC LIMIT 8'
    ).bind(country.id).all<{ name_cn: string; slug: string; job_count: number }>(),
    c.env.DB.prepare(
      'SELECT name_cn, slug, flag_emoji, job_count FROM countries WHERE is_active = 1 AND job_count > 0 AND id != ? ORDER BY job_count DESC LIMIT 20'
    ).bind(country.id).all<{ name_cn: string; slug: string; flag_emoji: string | null; job_count: number }>(),
  ]);
  const allIds = (idResult.results || []).map((r) => r.id);
  const hasMoreRaw = allIds.length > limit;
  const hasMore = hasMoreRaw && page < listPageCap;
  const jobIds = hasMoreRaw ? allIds.slice(0, limit) : allIds;
  let jobs: Job[] = [];
  if (jobIds.length > 0) {
    const jobsResult = await c.env.DB.prepare(`${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')}) ORDER BY j.created_at DESC`).all();
    jobs = ((jobsResult.results || []) as unknown as Job[]).map((j) => ({ ...j, company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL) }));
  }

  return c.html(countryPage(country, jobs, page, hasMore, topLocRes.results || [], othersRes.results || [], {
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL, user: c.get('user'),
  }));
});

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

pages.get('/salary-reports', async (c) => {
  const cutoff = activeCutoff();
  const midpoint = 'CASE WHEN j.salary_lower > 0 AND j.salary_upper > 0 THEN (j.salary_lower + j.salary_upper) / 2.0 ELSE MAX(j.salary_lower, j.salary_upper) END';
  const [rowsRes, totalRes] = await Promise.all([
    c.env.DB.prepare(`
      SELECT j.search_term_id, st.term_cn, st.slug, ${monthlySalarySql(midpoint)} as monthly
      FROM jobs j LEFT JOIN search_terms st ON st.id = j.search_term_id
      WHERE j.posted_at >= ? AND (j.salary_lower > 0 OR j.salary_upper > 0)
    `).bind(cutoff).all<{ search_term_id: number | null; term_cn: string | null; slug: string | null; monthly: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM jobs WHERE posted_at >= ?').bind(cutoff).first<{ c: number }>(),
  ]);

  const samples = (rowsRes.results || []).filter((r) => Number.isFinite(r.monthly) && r.monthly >= 500 && r.monthly <= 500000);
  const byTerm = new Map<number, { term_cn: string; slug: string; values: number[] }>();
  const allValues: number[] = [];
  for (const r of samples) {
    allValues.push(r.monthly);
    if (r.search_term_id && r.term_cn && r.slug) {
      const entry = byTerm.get(r.search_term_id) || { term_cn: r.term_cn, slug: r.slug, values: [] };
      entry.values.push(r.monthly);
      byTerm.set(r.search_term_id, entry);
    }
  }
  allValues.sort((a, b) => a - b);

  const rows: SalaryStatRow[] = [...byTerm.values()]
    .filter((t) => t.values.length >= 5)
    .map((t) => {
      const v = [...t.values].sort((a, b) => a - b);
      return { term_cn: t.term_cn, slug: t.slug, count: v.length, p25: percentile(v, 0.25), median: percentile(v, 0.5), p75: percentile(v, 0.75), max: v[v.length - 1] };
    })
    .sort((a, b) => b.median - a.median);

  const bucketDefs: Array<{ label: string; min: number; max: number }> = [
    { label: '< 5k', min: 0, max: 5000 },
    { label: '5k – 1万', min: 5000, max: 10000 },
    { label: '1万 – 2万', min: 10000, max: 20000 },
    { label: '2万 – 3万', min: 20000, max: 30000 },
    { label: '3万 – 5万', min: 30000, max: 50000 },
    { label: '5万 – 8万', min: 50000, max: 80000 },
    { label: '8万+', min: 80000, max: Infinity },
  ];
  const buckets = bucketDefs.map((b) => ({ label: b.label, count: allValues.filter((v) => v >= b.min && v < b.max).length }));

  return c.html(salaryPage(rows, {
    sampleCount: allValues.length,
    totalActive: totalRes?.c ?? 0,
    median: percentile(allValues, 0.5),
    p25: percentile(allValues, 0.25),
    p75: percentile(allValues, 0.75),
    buckets,
  }, { gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL, user: c.get('user') }));
});

pages.get('/weekly-reports', async (c) => {
  const [report, weeks] = await Promise.all([loadLatestWeeklyReport(c.env), listWeeklyReportWeeks(c.env)]);
  return c.html(weeklyPage(report, weeks, {
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL, user: c.get('user'), isLatest: true,
  }));
});

pages.get('/weekly-reports/:week', async (c) => {
  const week = c.req.param('week');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return c.notFound();
  const [report, weeks] = await Promise.all([loadWeeklyReport(c.env, week), listWeeklyReportWeeks(c.env)]);
  if (!report) return c.notFound();
  return c.html(weeklyPage(report, weeks, {
    gaId: c.env.GA_ID, siteUrl: c.env.SITE_URL, staticUrl: c.env.STATIC_URL, user: c.get('user'), isLatest: weeks[0] === week,
  }));
});

pages.get('/admin/submissions', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect(`/login?next=${encodeURIComponent('/admin/submissions')}`, 302);
  if (user.role !== 'admin') return c.notFound();

  const [subsRes, termsRes, countriesRes] = await Promise.all([
    c.env.DB.prepare(`
      SELECT s.*, j.slug as job_slug FROM job_submissions s LEFT JOIN jobs j ON j.id = s.job_id
      ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC LIMIT 200
    `).all<JobSubmissionRow & { job_slug: string | null }>(),
    c.env.DB.prepare(
      `SELECT id, term_cn FROM search_terms WHERE is_active = 1 AND term_cn IS NOT NULL AND slug IS NOT NULL ORDER BY term_cn`
    ).all<{ id: number; term_cn: string }>(),
    c.env.DB.prepare(`SELECT code, name_cn FROM countries WHERE is_active = 1 ORDER BY job_count DESC`).all<{ code: string; name_cn: string }>(),
  ]);

  return c.html(adminSubmissionsPage({
    user,
    submissions: subsRes.results || [],
    searchTerms: termsRes.results || [],
    countries: countriesRes.results || [],
    gaId: c.env.GA_ID,
    staticUrl: c.env.STATIC_URL,
  }));
});

export default pages;
