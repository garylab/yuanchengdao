import { Env } from '../types';
import { findCountry, generateJobSlug, getOrCreateCompany, getOrCreateLocation } from './jobSync';
import { upsertJobVector } from './vectorSearch';
import { detectChineseFriendly } from '../constants/chineseFriendly';
import { parseEnglishLevel } from '../constants/englishLevel';

export type JobSubmissionRow = {
  id: number;
  user_id: number | null;
  company_name: string;
  company_website: string | null;
  company_logo: string | null;
  title: string;
  description: string;
  apply_url: string | null;
  apply_email: string | null;
  location_text: string | null;
  location_requirement: number;
  english_level: string;
  schedule_type: string | null;
  salary_text: string | null;
  salary_lower: number;
  salary_upper: number;
  salary_pay_cycle: string;
  contact_email: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  job_id: number | null;
  ip: string | null;
  user_agent: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export async function loadSubmission(env: Env, id: number): Promise<JobSubmissionRow | null> {
  return env.DB.prepare('SELECT * FROM job_submissions WHERE id = ?').bind(id).first<JobSubmissionRow>();
}

export async function publishSubmission(
  env: Env,
  submission: JobSubmissionRow,
  options: { searchTermId: number; countryCode?: string | null; locationName?: string | null; locationNameCn?: string | null },
): Promise<{ jobId: number; slug: string }> {
  const applyOptions: Array<{ title: string; link: string }> = [];
  if (submission.apply_url) applyOptions.push({ title: '官网申请', link: submission.apply_url });
  if (submission.apply_email) applyOptions.push({ title: '邮件申请', link: `mailto:${submission.apply_email}` });

  const detectedExtensions = {
    posted_at: 'just now',
    schedule_type: submission.schedule_type || undefined,
    work_from_home: true,
    salary: submission.salary_text || undefined,
    source: 'employer',
  };

  const crawledInsert = await env.DB.prepare(`
    INSERT INTO jobs_crawled
      (job_id, htidocid, title, company_name, location, via, description, thumbnail,
       extensions, detected_extensions, job_highlights, apply_options,
       search_country, search_term_id, process_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, 1)
  `).bind(
    `employer-${submission.id}`,
    `employer-${submission.id}`,
    submission.title,
    submission.company_name,
    submission.location_text,
    '远程岛直投',
    submission.description,
    JSON.stringify(detectedExtensions),
    applyOptions.length > 0 ? JSON.stringify(applyOptions) : null,
    options.countryCode || null,
    options.searchTermId,
  ).run();
  const crawledId = crawledInsert.meta.last_row_id as number;

  let countryId: number | null = null;
  if (options.countryCode) {
    const country = await findCountry(env.DB, options.countryCode);
    countryId = country?.id ?? null;
  }

  let locationId: number | null = null;
  if (options.locationName) {
    locationId = await getOrCreateLocation(
      env.DB,
      options.locationName,
      options.locationNameCn || options.locationName,
      countryId,
    );
  }

  const companyId = await getOrCreateCompany(
    env,
    submission.company_name,
    null,
    locationId,
    null,
    submission.company_website,
  );

  if (submission.company_logo) {
    await env.DB.prepare(
      `UPDATE companies SET thumbnail = ? WHERE id = ? AND (thumbnail IS NULL OR thumbnail = '')`
    ).bind(submission.company_logo, companyId).run();
  }

  const slug = await generateJobSlug(env.DB, submission.title, submission.company_name, crawledId);
  const chineseFriendly = detectChineseFriendly(submission.title, submission.description) ? 1 : 0;
  const englishLevel = parseEnglishLevel(submission.english_level);
  const postedAt = new Date().toISOString();

  const jobInsert = await env.DB.prepare(`
    INSERT INTO jobs
      (crawled_id, slug, title, description, company_id, location_id, country_id, search_term_id, posted_at,
       salary_lower, salary_upper, salary_currency, salary_pay_cycle,
       detected_extensions, job_highlights, apply_options, location_requirement, english_level_required,
       chinese_friendly, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CNY', ?, ?, NULL, ?, ?, ?, ?, 'employer')
  `).bind(
    crawledId,
    slug,
    submission.title,
    submission.description,
    companyId,
    locationId,
    countryId,
    options.searchTermId,
    postedAt,
    submission.salary_lower,
    submission.salary_upper,
    submission.salary_pay_cycle,
    JSON.stringify(detectedExtensions),
    applyOptions.length > 0 ? JSON.stringify(applyOptions) : null,
    submission.location_requirement,
    englishLevel,
    chineseFriendly,
  ).run();
  const jobId = jobInsert.meta.last_row_id as number;

  try {
    await upsertJobVector(env.AI, env.VECTORIZE, jobId, submission.title, submission.description);
  } catch (err) {
    console.error(`Vector upsert failed for employer job ${jobId}:`, err);
  }

  const counters: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE companies SET job_count = job_count + 1 WHERE id = ?').bind(companyId),
    env.DB.prepare('UPDATE search_terms SET job_count = job_count + 1 WHERE id = ?').bind(options.searchTermId),
  ];
  if (locationId) counters.push(env.DB.prepare('UPDATE locations SET job_count = job_count + 1 WHERE id = ?').bind(locationId));
  if (countryId) counters.push(env.DB.prepare('UPDATE countries SET job_count = job_count + 1 WHERE id = ?').bind(countryId));
  counters.push(
    env.DB.prepare(
      `UPDATE job_submissions SET status = 'approved', job_id = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).bind(jobId, submission.id),
  );
  await env.DB.batch(counters);

  return { jobId, slug };
}
