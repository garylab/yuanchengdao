import { Env, SerpApiJob, CrawledJob } from '../types';
import { fetchOneQuery, decodeJobId } from './serpapi';
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
  searchCountry: string,
  searchTermId: number | null,
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
         search_country, search_term_id)
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
      searchCountry,
      searchTermId,
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
    const r2Key = await uploadThumbnail(env.R2, thumbnailUrl, slug);
    if (r2Key) thumbnail = r2Key;
  }

  const result = await env.DB.prepare(
    'INSERT INTO companies (name, slug, thumbnail, location_id) VALUES (?, ?, ?, ?)'
  ).bind(name, slug, thumbnail, locationId).run();
  return result.meta.last_row_id as number;
}

async function generateJobSlug(db: D1Database, title: string, companyName: string, crawledId: number): Promise<string> {
  const slugPart = toSlug(`${title}-${companyName}`).substring(0, 80);
  const base = slugPart.includes('remote') ? slugPart : `remote-${slugPart}`;
  let candidate = `${base}-${crawledId}`;
  let attempt = 0;
  while (attempt < 5) {
    const exists = await db.prepare('SELECT 1 FROM jobs WHERE slug = ?').bind(candidate).first();
    if (!exists) return candidate;
    attempt++;
    candidate = `${base}-${crawledId}-${attempt}`;
  }
  return `${base}-${crawledId}-${Date.now()}`;
}

async function processUnprocessedJobs(env: Env): Promise<number> {
  const BATCH_SIZE = 5;
  const unprocessed = await env.DB.prepare(
    'SELECT * FROM jobs_crawled WHERE process_status = 0 ORDER BY id LIMIT ?'
  ).bind(BATCH_SIZE).all();

  const crawledJobs = (unprocessed.results || []) as unknown as CrawledJob[];
  if (crawledJobs.length === 0) return 0;

  // Skip crawled jobs that already have a processed job (from a previous partial run)
  const toTranslate: CrawledJob[] = [];
  for (const crawled of crawledJobs) {
    const existing = await env.DB.prepare(
      'SELECT 1 FROM jobs WHERE crawled_id = ?'
    ).bind(crawled.id).first();
    if (existing) {
      await env.DB.prepare(
        'UPDATE jobs_crawled SET process_status = 1 WHERE id = ?'
      ).bind(crawled.id).run();
      console.log(`  Skipped crawled #${crawled.id} — already in jobs table`);
    } else {
      toTranslate.push(crawled);
    }
  }

  if (toTranslate.length === 0) return 0;

  console.log(`  Translating ${toTranslate.length} unprocessed jobs...`);

  const inputs: TranslateInput[] = toTranslate.map(crawled => {
    const decoded = decodeJobId(crawled.job_id) || { htidocid: crawled.htidocid };
    return { crawled, decoded };
  });

  const translations = await translateBatch(inputs, {
    apiKey: env.OPENAI_API_KEY,
    apiBase: env.OPENAI_API_BASE,
    model: env.OPENAI_MODEL,
    cfAigToken: env.CF_AIG_TOKEN,
  });

  let saved = 0;
  for (const tr of translations) {
    const crawled = toTranslate[tr.index];
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
      const slug = await generateJobSlug(env.DB, crawled.title, crawled.company_name, crawled.id);

      const searchTermId = crawled.search_term_id;

      await env.DB.prepare(`
        INSERT INTO jobs
          (crawled_id, slug, title, description, company_id, location_id, country_id, search_term_id, posted_at,
           salary_lower, salary_upper, salary_currency, salary_pay_cycle,
           detected_extensions, job_highlights, apply_options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crawled.id,
        slug,
        tr.title_zh,
        tr.description_zh,
        companyId,
        locationId,
        countryId,
        searchTermId,
        postedAt,
        tr.salary_lower,
        tr.salary_upper,
        tr.salary_currency,
        tr.salary_pay_cycle,
        crawled.detected_extensions,
        tr.job_highlights_zh.length > 0 ? JSON.stringify(tr.job_highlights_zh) : crawled.job_highlights,
        crawled.apply_options,
      ).run();

      if (companyId) {
        await env.DB.prepare('UPDATE companies SET job_count = job_count + 1 WHERE id = ?').bind(companyId).run();
      }

      if (searchTermId) {
        await env.DB.prepare('UPDATE search_terms SET job_count = job_count + 1 WHERE id = ?').bind(searchTermId).run();
      }

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

function isKeyUrl(key: string): boolean {
  return key.startsWith('http://') || key.startsWith('https://');
}

async function fetchKeyFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch API key from ${url}: ${res.status}`);
  return (await res.text()).trim();
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function ensureCrawlPlan(db: D1Database): Promise<number> {
  const pending = await db.prepare(
    'SELECT COUNT(*) as cnt FROM crawl_plan WHERE status = 0'
  ).first<{ cnt: number }>();

  if (pending && pending.cnt > 0) {
    return pending.cnt;
  }

  // No pending entries — generate a fresh plan
  const [termRows, countryRows] = await Promise.all([
    db.prepare('SELECT id, term FROM search_terms WHERE is_active = 1').all(),
    db.prepare('SELECT code FROM countries WHERE is_active = 1').all(),
  ]);
  const terms = (termRows.results || []) as unknown as Array<{ id: number; term: string }>;
  const countries = (countryRows.results || []).map((r: Record<string, unknown>) => r.code as string);

  if (terms.length === 0 || countries.length === 0) return 0;

  const entries: Array<{ termId: number; country: string }> = [];
  for (const t of terms) {
    for (const c of countries) {
      entries.push({ termId: t.id, country: c });
    }
  }
  shuffle(entries);

  // Delete old completed/failed rows, then insert new plan
  await db.prepare('DELETE FROM crawl_plan').run();

  for (const e of entries) {
    await db.prepare(
      'INSERT INTO crawl_plan (search_term_id, country_code) VALUES (?, ?)'
    ).bind(e.termId, e.country).run();
  }

  console.log(`Generated new crawl plan: ${entries.length} queries`);
  return entries.length;
}

export async function syncJobs(env: Env): Promise<{ fetched: number; saved: number }> {
  console.log('Starting job sync...');

  const pendingCount = await ensureCrawlPlan(env.DB);
  if (pendingCount === 0) {
    console.log('No crawl plan entries — check search_terms and countries tables');
    return { fetched: 0, saved: 0 };
  }

  // Pick the next pending entry
  const task = await env.DB.prepare(
    `SELECT cp.id, cp.search_term_id, cp.country_code, st.term
     FROM crawl_plan cp
     JOIN search_terms st ON cp.search_term_id = st.id
     WHERE cp.status = 0
     ORDER BY cp.id
     LIMIT 1`
  ).first<{ id: number; search_term_id: number; country_code: string; term: string }>();

  if (!task) {
    console.log('No pending crawl tasks');
    return { fetched: 0, saved: 0 };
  }

  console.log(`[${pendingCount} pending] "${task.term} remote" in ${task.country_code}`);

  const keyIsUrl = isKeyUrl(env.SERPAPI_KEY);
  let serpApiKey = keyIsUrl ? await fetchKeyFromUrl(env.SERPAPI_KEY) : env.SERPAPI_KEY;

  const seenIds = new Set<string>();
  let totalFetched = 0;
  let totalSaved = 0;

  try {
    const jobs = await fetchOneQuery(serpApiKey, task.term, task.country_code, seenIds);
    console.log(`  Fetched ${jobs.length} new unique jobs`);

    let crawledCount = 0;
    for (const job of jobs) {
      const id = await saveCrawledJob(env.DB, job, task.country_code, task.search_term_id);
      if (id !== null) crawledCount++;
    }
    totalFetched = crawledCount;
    console.log(`  Saved ${crawledCount} to jobs_crawled`);

    // Mark as done
    await env.DB.prepare(
      "UPDATE crawl_plan SET status = 1, processed_at = datetime('now') WHERE id = ?"
    ).bind(task.id).run();

  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_KEY' && keyIsUrl) {
      console.warn('SerpAPI key invalid, refreshing from URL...');
      try {
        serpApiKey = await fetchKeyFromUrl(env.SERPAPI_KEY);
        const jobs = await fetchOneQuery(serpApiKey, task.term, task.country_code, seenIds);
        let crawledCount = 0;
        for (const job of jobs) {
          const id = await saveCrawledJob(env.DB, job, task.country_code, task.search_term_id);
          if (id !== null) crawledCount++;
        }
        totalFetched = crawledCount;
        await env.DB.prepare(
          "UPDATE crawl_plan SET status = 1, processed_at = datetime('now') WHERE id = ?"
        ).bind(task.id).run();
      } catch (retryErr) {
        console.error('Retry after key refresh failed:', retryErr);
        await env.DB.prepare(
          'UPDATE crawl_plan SET status = 2 WHERE id = ?'
        ).bind(task.id).run();
      }
    } else if (err instanceof Error && err.message === 'RATE_LIMIT') {
      console.error('SerpAPI rate limit — will retry this task next run');
      // Leave status = 0 so it retries next time
    } else {
      console.error(`Error crawling "${task.term} remote" (${task.country_code}):`, err);
      await env.DB.prepare(
        'UPDATE crawl_plan SET status = 2 WHERE id = ?'
      ).bind(task.id).run();
    }
  }

  // Process unprocessed crawled jobs
  let remaining = true;
  while (remaining) {
    const processed = await processUnprocessedJobs(env);
    if (processed === 0) {
      remaining = false;
    } else {
      totalSaved += processed;
      console.log(`Processed ${processed} jobs (${totalSaved} total saved)`);
    }
  }

  console.log(`Sync complete: fetched ${totalFetched}, saved ${totalSaved}, ${pendingCount - 1} pending`);
  return { fetched: totalFetched, saved: totalSaved };
}
