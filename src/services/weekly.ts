import { Env } from '../types';
import { formatSalary } from '../utils/helpers';
import { sendWeeklyDigestEmail } from './email';

export type WeeklyReportJob = {
  slug: string;
  title: string;
  company_name: string;
  location_label: string;
  salary_label: string;
};

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  newJobs: number;
  activeJobs: number;
  newCompanies: number;
  chineseFriendlyNew: number;
  noEnglishNew: number;
  topSalaryJobs: WeeklyReportJob[];
  newCompanyList: Array<{ name: string; slug: string; job_count: number }>;
  topCategories: Array<{ term_cn: string; slug: string; count: number }>;
  topCountries: Array<{ name_cn: string; slug: string; flag: string; count: number }>;
};

export type WeeklyPersonal = {
  favoritesTotal: number;
  favoritesExpired: number;
  favoritesApplied: number;
  deliveriesThisWeek: number;
  subscriptionsTotal: number;
};

function sqliteNow(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

export async function buildWeeklyReport(env: Env): Promise<WeeklyReport> {
  const since = sqliteNow(7);
  const activeSince = sqliteNow(30);
  const weekStart = since.slice(0, 10);
  const weekEnd = new Date().toISOString().slice(0, 10);

  const [
    newJobsRow, activeRow, newCompaniesRow, cfRow, noEngRow,
    topSalary, newCompanies, topCategories, topCountries,
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM jobs WHERE created_at >= ?').bind(since).first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) as c FROM jobs WHERE posted_at >= ?').bind(activeSince).first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) as c FROM companies WHERE created_at >= ? AND job_count > 0').bind(since).first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) as c FROM jobs WHERE created_at >= ? AND chinese_friendly = 1').bind(since).first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(*) as c FROM jobs WHERE created_at >= ? AND english_level_required = 'none'").bind(since).first<{ c: number }>(),
    env.DB.prepare(`
      SELECT j.slug, j.title, j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle,
        co.name as company_name, lo.name_cn as location_name_cn, ct.name_cn as country_name_cn
      FROM jobs j
      LEFT JOIN companies co ON co.id = j.company_id
      LEFT JOIN locations lo ON lo.id = j.location_id
      LEFT JOIN countries ct ON ct.id = j.country_id
      WHERE j.created_at >= ? AND j.salary_upper > 0 AND j.salary_pay_cycle IN ('year','month')
      ORDER BY CASE j.salary_pay_cycle WHEN 'month' THEN j.salary_upper * 12 ELSE j.salary_upper END DESC
      LIMIT 10
    `).bind(since).all<{
      slug: string; title: string; salary_lower: number; salary_upper: number; salary_currency: string; salary_pay_cycle: string;
      company_name: string | null; location_name_cn: string | null; country_name_cn: string | null;
    }>(),
    env.DB.prepare(
      `SELECT name, slug, job_count FROM companies WHERE created_at >= ? AND job_count > 0 ORDER BY job_count DESC, id DESC LIMIT 8`
    ).bind(since).all<{ name: string; slug: string; job_count: number }>(),
    env.DB.prepare(`
      SELECT st.term_cn, st.slug, COUNT(*) as count
      FROM jobs j JOIN search_terms st ON st.id = j.search_term_id
      WHERE j.created_at >= ? AND st.slug IS NOT NULL AND st.term_cn IS NOT NULL
      GROUP BY st.id ORDER BY count DESC LIMIT 8
    `).bind(since).all<{ term_cn: string; slug: string; count: number }>(),
    env.DB.prepare(`
      SELECT ct.name_cn, ct.slug, ct.flag_emoji as flag, COUNT(*) as count
      FROM jobs j JOIN countries ct ON ct.id = j.country_id
      WHERE j.created_at >= ?
      GROUP BY ct.id ORDER BY count DESC LIMIT 6
    `).bind(since).all<{ name_cn: string; slug: string; flag: string; count: number }>(),
  ]);

  const topSalaryJobs: WeeklyReportJob[] = (topSalary.results || []).map((j) => ({
    slug: j.slug,
    title: j.title,
    company_name: j.company_name || '',
    location_label: [j.location_name_cn, j.country_name_cn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '远程',
    salary_label: formatSalary(j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle),
  }));

  return {
    weekStart,
    weekEnd,
    generatedAt: new Date().toISOString(),
    newJobs: newJobsRow?.c ?? 0,
    activeJobs: activeRow?.c ?? 0,
    newCompanies: newCompaniesRow?.c ?? 0,
    chineseFriendlyNew: cfRow?.c ?? 0,
    noEnglishNew: noEngRow?.c ?? 0,
    topSalaryJobs,
    newCompanyList: newCompanies.results || [],
    topCategories: topCategories.results || [],
    topCountries: (topCountries.results || []).map((c) => ({ ...c, flag: c.flag || '🌍' })),
  };
}

export async function saveWeeklyReport(env: Env, report: WeeklyReport): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO weekly_reports (week_start, payload) VALUES (?, ?)
     ON CONFLICT(week_start) DO UPDATE SET payload = excluded.payload, created_at = datetime('now')`
  ).bind(report.weekStart, JSON.stringify(report)).run();
}

export async function loadLatestWeeklyReport(env: Env): Promise<WeeklyReport | null> {
  const row = await env.DB.prepare(
    'SELECT payload FROM weekly_reports ORDER BY week_start DESC LIMIT 1'
  ).first<{ payload: string }>();
  if (!row) return null;
  try { return JSON.parse(row.payload) as WeeklyReport; } catch { return null; }
}

export async function loadWeeklyReport(env: Env, weekStart: string): Promise<WeeklyReport | null> {
  const row = await env.DB.prepare(
    'SELECT payload FROM weekly_reports WHERE week_start = ?'
  ).bind(weekStart).first<{ payload: string }>();
  if (!row) return null;
  try { return JSON.parse(row.payload) as WeeklyReport; } catch { return null; }
}

export async function listWeeklyReportWeeks(env: Env, limit = 12): Promise<string[]> {
  const rows = await env.DB.prepare(
    'SELECT week_start FROM weekly_reports ORDER BY week_start DESC LIMIT ?'
  ).bind(limit).all<{ week_start: string }>();
  return (rows.results || []).map((r) => r.week_start);
}

export async function personalWeeklyStats(env: Env, userId: number): Promise<WeeklyPersonal> {
  const since = sqliteNow(7);
  const expiredBefore = sqliteNow(30);
  const [fav, deliveries, subs] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status IN ('saved','applied','interviewing') AND (job_id IS NULL OR job_posted_at < ?) THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status IN ('applied','interviewing','offer') THEN 1 ELSE 0 END) as applied
      FROM favorites WHERE user_id = ? AND status != 'archived'
    `).bind(expiredBefore, userId).first<{ total: number; expired: number | null; applied: number | null }>(),
    env.DB.prepare(`
      SELECT COUNT(*) as c FROM subscription_deliveries d
      JOIN subscriptions s ON s.id = d.subscription_id
      WHERE s.user_id = ? AND d.delivered_at >= ?
    `).bind(userId, since).first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) as c FROM subscriptions WHERE user_id = ?').bind(userId).first<{ c: number }>(),
  ]);
  return {
    favoritesTotal: fav?.total ?? 0,
    favoritesExpired: fav?.expired ?? 0,
    favoritesApplied: fav?.applied ?? 0,
    deliveriesThisWeek: deliveries?.c ?? 0,
    subscriptionsTotal: subs?.c ?? 0,
  };
}

export async function runWeeklyDigest(env: Env, options?: { sendEmails?: boolean }): Promise<{ report: WeeklyReport; sent: number }> {
  const report = await buildWeeklyReport(env);
  await saveWeeklyReport(env, report);

  if (options?.sendEmails === false) return { report, sent: 0 };

  const users = await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE weekly_digest = 1 ORDER BY id'
  ).all<{ id: number; email: string; name: string | null }>();

  let sent = 0;
  for (const user of users.results || []) {
    try {
      const personal = await personalWeeklyStats(env, user.id);
      const result = await sendWeeklyDigestEmail(env, user.email, report, personal);
      if (result.ok) sent++;
    } catch (err) {
      console.error(`Weekly digest failed for user ${user.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { report, sent };
}
