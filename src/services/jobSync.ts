import { Env, SerpApiJob, CrawledJob } from '../types';
import { buildSearchPlan, fetchOneQuery, decodeJobId } from './serpapi';
import { translateBatch, TranslateInput } from './translate';
import { uploadThumbnail } from './thumbnail';

function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getTimezoneOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const localStr = now.toLocaleString('en-US', { timeZone: timezone });
    return new Date(localStr).getTime() - new Date(utcStr).getTime();
  } catch {
    return 0;
  }
}

function parsePostedAt(detectedExtensions: string | null, timezone: string): string | null {
  if (!detectedExtensions) return null;
  try {
    const ext = JSON.parse(detectedExtensions);
    const raw = ext.posted_at as string | undefined;
    if (!raw) return null;

    const offsetMs = getTimezoneOffsetMs(timezone);
    const nowLocal = new Date(Date.now() + offsetMs);

    const match = raw.match(/(\d+)\s*(hour|day|week|month)/i);
    if (!match) return new Date(nowLocal.getTime() - offsetMs).toISOString();
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('hour')) nowLocal.setHours(nowLocal.getHours() - num);
    else if (unit.startsWith('day')) nowLocal.setDate(nowLocal.getDate() - num);
    else if (unit.startsWith('week')) nowLocal.setDate(nowLocal.getDate() - num * 7);
    else if (unit.startsWith('month')) nowLocal.setMonth(nowLocal.getMonth() - num);
    return new Date(nowLocal.getTime() - offsetMs).toISOString();
  } catch {
    return null;
  }
}

async function saveCrawledJob(
  db: D1Database,
  job: SerpApiJob,
  searchQuery: string,
  searchCountry: string,
): Promise<number | null> {
  const decoded = decodeJobId(job.job_id);
  if (!decoded) {
    console.error(`Could not decode job_id: ${job.job_id.substring(0, 50)}`);
    return null;
  }

  try {
    const result = await db.prepare(`
      INSERT OR IGNORE INTO jobs_crawled
        (job_id, htidocid, title, company_name, location, via, description, thumbnail,
         extensions, detected_extensions, job_highlights, apply_options,
         search_query, search_country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      job.job_id,
      decoded.htidocid,
      job.title || '',
      job.company_name || '',
      job.location || null,
      job.via || null,
      job.description || null,
      job.thumbnail || null,
      job.extensions ? JSON.stringify(job.extensions) : null,
      job.detected_extensions ? JSON.stringify(job.detected_extensions) : null,
      job.job_highlights ? JSON.stringify(job.job_highlights) : null,
      job.apply_options ? JSON.stringify(job.apply_options) : null,
      searchQuery,
      searchCountry,
    ).run();

    if (result.success && result.meta.changes > 0) {
      return result.meta.last_row_id as number;
    }
    return null;
  } catch (err) {
    console.error(`Failed to save crawled job ${decoded.htidocid}:`, err);
    return null;
  }
}

async function getOrCreateCountry(
  db: D1Database, code: string, name: string, nameCn: string, timezone: string
): Promise<{ id: number; timezone: string } | null> {
  if (!code || code.length !== 2) return null;
  const lower = code.toLowerCase();
  const existing = await db.prepare('SELECT id, timezone FROM countries WHERE code = ?')
    .bind(lower).first<{ id: number; timezone: string }>();
  if (existing) return existing;

  const slug = toSlug(name || lower);
  const tz = timezone || 'UTC';
  const result = await db.prepare(
    'INSERT INTO countries (code, name, name_cn, slug, timezone) VALUES (?, ?, ?, ?, ?)'
  ).bind(lower, name || lower, nameCn || lower, slug, tz).run();
  return { id: result.meta.last_row_id as number, timezone: tz };
}

async function getOrCreateLocation(
  db: D1Database, name: string, nameCn: string, countryId: number | null
): Promise<number> {
  const slug = toSlug(name);
  const existing = await db.prepare('SELECT id FROM locations WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (existing) return existing.id;

  const result = await db.prepare(
    'INSERT INTO locations (name, name_cn, slug, country_id) VALUES (?, ?, ?, ?)'
  ).bind(name, nameCn, slug, countryId).run();
  return result.meta.last_row_id as number;
}

async function getOrCreateCompany(
  env: Env,
  name: string,
  thumbnailUrl: string | null,
  locationId: number,
): Promise<number> {
  const slug = toSlug(name);
  const existing = await env.DB.prepare(
    'SELECT id FROM companies WHERE slug = ?'
  ).bind(slug).first<{ id: number }>();
  if (existing) return existing.id;

  let thumbnail = thumbnailUrl;
  if (thumbnailUrl) {
    const r2Url = await uploadThumbnail(env.R2, env.STATIC_URL, thumbnailUrl, slug);
    if (r2Url) thumbnail = r2Url;
  }

  const result = await env.DB.prepare(
    'INSERT INTO companies (name, slug, thumbnail, location_id) VALUES (?, ?, ?, ?)'
  ).bind(name, slug, thumbnail, locationId).run();
  return result.meta.last_row_id as number;
}

async function generateJobSlug(db: D1Database, title: string, companyName: string, jobId: number): Promise<string> {
  const base = toSlug(`${title}-${companyName}`).substring(0, 80);
  let candidate = `${base}-${jobId}`;
  let attempt = 0;
  while (attempt < 5) {
    const exists = await db.prepare('SELECT 1 FROM jobs WHERE slug = ?').bind(candidate).first();
    if (!exists) return candidate;
    attempt++;
    candidate = `${base}-${jobId}-${attempt}`;
  }
  return `${base}-${jobId}-${Date.now()}`;
}

async function processUnprocessedJobs(env: Env): Promise<number> {
  const BATCH_SIZE = 5;
  const unprocessed = await env.DB.prepare(
    'SELECT * FROM jobs_crawled WHERE process_status = 0 ORDER BY id LIMIT ?'
  ).bind(BATCH_SIZE).all();

  const crawledJobs = (unprocessed.results || []) as unknown as CrawledJob[];
  if (crawledJobs.length === 0) return 0;

  console.log(`  Translating ${crawledJobs.length} unprocessed jobs...`);

  const inputs: TranslateInput[] = crawledJobs.map(crawled => {
    const decoded = decodeJobId(crawled.job_id) || { htidocid: crawled.htidocid };
    return { crawled, decoded };
  });

  const translations = await translateBatch(inputs, env.OPENAI_API_KEY);

  let saved = 0;
  for (const tr of translations) {
    const crawled = crawledJobs[tr.index];
    if (!crawled) continue;

    try {
      const country = await getOrCreateCountry(env.DB, tr.country_code, tr.country_name, tr.country_name_cn, tr.country_timezone);
      const countryId = country?.id ?? null;
      const locationId = await getOrCreateLocation(env.DB, tr.location_name, tr.location_name_cn, countryId);
      const companyId = await getOrCreateCompany(
        env,
        crawled.company_name,
        crawled.thumbnail,
        locationId,
      );

      const postedAt = parsePostedAt(crawled.detected_extensions, country?.timezone || 'UTC');
      const tempSlug = `temp-${Date.now()}-${crawled.id}`;

      const result = await env.DB.prepare(`
        INSERT INTO jobs
          (crawled_id, slug, title, description, company_id, location_id, country_id, posted_at,
           salary_lower, salary_upper, salary_currency, salary_pay_cycle,
           detected_extensions, job_highlights, apply_options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crawled.id,
        tempSlug,
        tr.title_zh,
        tr.description_zh,
        companyId,
        locationId,
        countryId,
        postedAt,
        tr.salary_lower,
        tr.salary_upper,
        tr.salary_currency,
        tr.salary_pay_cycle,
        crawled.detected_extensions,
        tr.job_highlights_zh.length > 0 ? JSON.stringify(tr.job_highlights_zh) : crawled.job_highlights,
        crawled.apply_options,
      ).run();

      const newJobId = result.meta.last_row_id as number;
      const slug = await generateJobSlug(env.DB, crawled.title, crawled.company_name, newJobId);
      await env.DB.prepare('UPDATE jobs SET slug = ? WHERE id = ?').bind(slug, newJobId).run();

      await env.DB.prepare(
        'UPDATE jobs_crawled SET process_status = 1 WHERE id = ?'
      ).bind(crawled.id).run();

      saved++;
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).substring(0, 100);
      console.error(`Failed to process crawled job ${crawled.id}:`, err);
      await env.DB.prepare(
        'UPDATE jobs_crawled SET process_status = 44, failed_reason = ? WHERE id = ?'
      ).bind(reason, crawled.id).run();
    }
  }

  return saved;
}

export async function syncJobs(env: Env): Promise<{ fetched: number; saved: number }> {
  console.log('Starting job sync...');

  const countryRows = await env.DB.prepare(
    'SELECT code FROM countries WHERE is_active = 1 ORDER BY code'
  ).all();
  const countryCodes = (countryRows.results || []).map((r: Record<string, unknown>) => r.code as string);

  if (countryCodes.length === 0) {
    const fallback = (env.JOB_COUNTRIES || '').split(',').map(s => s.trim()).filter(Boolean);
    countryCodes.push(...fallback);
  }

  const plan = buildSearchPlan(env.JOB_POSITIONS, countryCodes);
  if (plan.length === 0) {
    console.error('No search plan — check JOB_POSITIONS and countries table');
    return { fetched: 0, saved: 0 };
  }
  console.log(`Search plan: ${plan.length} queries`);

  const seenIds = new Set<string>();
  let totalFetched = 0;
  let totalSaved = 0;

  for (let i = 0; i < plan.length; i++) {
    const { position, country } = plan[i];
    const query = `${position} remote`;
    console.log(`[${i + 1}/${plan.length}] "${query}" in ${country}`);

    try {
      const jobs = await fetchOneQuery(env.SERPAPI_KEY, position, country, seenIds);
      console.log(`  Fetched ${jobs.length} new unique jobs`);

      let crawledCount = 0;
      for (const job of jobs) {
        const id = await saveCrawledJob(env.DB, job, query, country);
        if (id !== null) crawledCount++;
      }
      totalFetched += crawledCount;
      console.log(`  Saved ${crawledCount} to jobs_crawled (${totalFetched} total crawled)`);

      const processed = await processUnprocessedJobs(env);
      totalSaved += processed;
      console.log(`  Processed ${processed} jobs (${totalSaved} total saved)`);

    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMIT') {
        console.error('SerpAPI rate limit hit, stopping fetch. Processing remaining...');
        break;
      }
      console.error(`Error on query "${query}" (${country}):`, err);
    }
  }

  let remaining = true;
  while (remaining) {
    const processed = await processUnprocessedJobs(env);
    if (processed === 0) {
      remaining = false;
    } else {
      totalSaved += processed;
      console.log(`Processed ${processed} more jobs (${totalSaved} total saved)`);
    }
  }

  console.log(`Sync complete: fetched ${totalFetched}, saved ${totalSaved}`);
  return { fetched: totalFetched, saved: totalSaved };
}
