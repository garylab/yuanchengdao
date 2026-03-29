import { Env, SerpApiJob, CrawledJob } from '../types';
import { fetchOneQuery, decodeJobId } from './serpapi';
import { translateBatch, TranslateInput } from './translate';
import { uploadThumbnail } from './thumbnail';

function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]+/;
const SEGMENT_RE = /([\u4e00-\u9fff\u3400-\u4dbf]+)/;

function segmentChinese(text: string): string {
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  return text
    .split(SEGMENT_RE)
    .flatMap((seg) => {
      if (CJK_RE.test(seg)) {
        return [...segmenter.segment(seg)]
          .filter((s) => s.isWordLike)
          .map((s) => s.segment);
      }
      const trimmed = seg.trim();
      return trimmed ? [trimmed] : [];
    })
    .join(' ');
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

async function findCountry(
  db: D1Database, code: string
): Promise<{ id: number; timezone: string } | null> {
  if (!code || code.length !== 2) return null;
  const lower = code.toLowerCase();
  return db.prepare('SELECT id, timezone FROM countries WHERE code = ? AND is_active = 1')
    .bind(lower).first<{ id: number; timezone: string }>();
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
  const base = !slugPart ? 'remote-job' : slugPart.includes('remote') ? slugPart : `remote-${slugPart}`;
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
      const country = await findCountry(env.DB, tr.country_code);
      if (!country) {
        console.log(`  Skipped crawled #${crawled.id} — country "${tr.country_code}" not in database`);
        await env.DB.prepare(
          "UPDATE jobs_crawled SET process_status = 44, failed_reason = ? WHERE id = ?"
        ).bind(`unknown country: ${tr.country_code}`, crawled.id).run();
        continue;
      }
      const countryId = country.id;
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

      const jobInsert = await env.DB.prepare(`
        INSERT INTO jobs
          (crawled_id, slug, title, description, company_id, location_id, country_id, search_term_id, posted_at,
           salary_lower, salary_upper, salary_currency, salary_pay_cycle,
           detected_extensions, job_highlights, apply_options, location_req)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        tr.location_req,
      ).run();

      const newJobId = jobInsert.meta.last_row_id;
      if (newJobId) {
        const titleSeg = segmentChinese(tr.title_zh);
        await env.DB.prepare(
          'INSERT INTO jobs_fts(rowid, title, posted_at) VALUES (?, ?, ?)'
        ).bind(newJobId, titleSeg, postedAt).run();
      }

      if (companyId) {
        await env.DB.prepare('UPDATE companies SET job_count = job_count + 1 WHERE id = ?').bind(companyId).run();
      }

      if (locationId) {
        await env.DB.prepare('UPDATE locations SET job_count = job_count + 1 WHERE id = ?').bind(locationId).run();
      }

      if (countryId) {
        await env.DB.prepare('UPDATE countries SET job_count = job_count + 1 WHERE id = ?').bind(countryId).run();
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

async function invalidateKey(keyUrl: string, apiKey: string): Promise<void> {
  try {
    const url = new URL(keyUrl);
    url.searchParams.set('api-key', apiKey);
    await fetch(url.toString(), { method: 'DELETE' });
    console.log('Invalidated API key via DELETE');
  } catch (err) {
    console.error('Failed to invalidate API key:', err);
  }
}

async function ensureCrawlPlan(db: D1Database): Promise<number> {
  const [termRows, countryRows] = await Promise.all([
    db.prepare('SELECT id FROM search_terms WHERE is_active = 1').all(),
    db.prepare('SELECT code FROM countries WHERE is_active = 1').all(),
  ]);
  const terms = (termRows.results || []) as unknown as Array<{ id: number }>;
  const countries = (countryRows.results || []).map((r: Record<string, unknown>) => r.code as string);

  if (terms.length === 0 || countries.length === 0) return 0;

  let inserted = 0;
  for (const t of terms) {
    for (const c of countries) {
      const res = await db.prepare(
        'INSERT OR IGNORE INTO crawl_plan (search_term_id, country_code) VALUES (?, ?)'
      ).bind(t.id, c).run();
      if (res.meta.changes > 0) inserted++;
    }
  }
  if (inserted > 0) {
    console.log(`Added ${inserted} new crawl plan entries`);
  }

  const total = await db.prepare('SELECT COUNT(*) as cnt FROM crawl_plan').first<{ cnt: number }>();
  return total?.cnt || 0;
}

async function deleteExpiredJobs(db: D1Database): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  const expired = await db.prepare(
    'SELECT id, company_id, location_id, country_id, search_term_id FROM jobs WHERE posted_at < ?'
  ).bind(cutoff).all();

  const rows = (expired.results || []) as unknown as Array<{
    id: number; company_id: number | null; location_id: number | null;
    country_id: number | null; search_term_id: number | null;
  }>;
  if (rows.length === 0) return 0;

  const ids = rows.map(r => r.id);

  const companyCount = new Map<number, number>();
  const locationCount = new Map<number, number>();
  const countryCount = new Map<number, number>();
  const termCount = new Map<number, number>();
  for (const r of rows) {
    if (r.company_id) companyCount.set(r.company_id, (companyCount.get(r.company_id) || 0) + 1);
    if (r.location_id) locationCount.set(r.location_id, (locationCount.get(r.location_id) || 0) + 1);
    if (r.country_id) countryCount.set(r.country_id, (countryCount.get(r.country_id) || 0) + 1);
    if (r.search_term_id) termCount.set(r.search_term_id, (termCount.get(r.search_term_id) || 0) + 1);
  }

  const BATCH = 50;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const placeholders = batch.join(',');
    await db.prepare(`DELETE FROM jobs_fts WHERE rowid IN (${placeholders})`).run();
    await db.prepare(`DELETE FROM jobs WHERE id IN (${placeholders})`).run();
  }

  const stmts: D1PreparedStatement[] = [];
  for (const [id, cnt] of companyCount) {
    stmts.push(db.prepare('UPDATE companies SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  for (const [id, cnt] of locationCount) {
    stmts.push(db.prepare('UPDATE locations SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  for (const [id, cnt] of countryCount) {
    stmts.push(db.prepare('UPDATE countries SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  for (const [id, cnt] of termCount) {
    stmts.push(db.prepare('UPDATE search_terms SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  if (stmts.length > 0) {
    await db.batch(stmts);
  }

  return rows.length;
}

async function deleteJobsFromInactiveCountries(db: D1Database): Promise<number> {
  const result = await db.prepare(`
    DELETE FROM jobs
    WHERE country_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM countries WHERE countries.id = jobs.country_id AND countries.is_active = 1)
  `).run();
  return result.meta.changes;
}

export async function syncJobs(env: Env): Promise<{ fetched: number; saved: number }> {
  console.log('Starting job sync...');

  const expiredDeleted = await deleteExpiredJobs(env.DB);
  if (expiredDeleted > 0) {
    console.log(`Cleaned up ${expiredDeleted} expired jobs (90+ days old)`);
  }

  const deleted = await deleteJobsFromInactiveCountries(env.DB);
  if (deleted > 0) {
    console.log(`Deleted ${deleted} jobs from inactive countries`);
  }

  const totalEntries = await ensureCrawlPlan(env.DB);
  if (totalEntries === 0) {
    console.log('No crawl plan entries — check search_terms and countries tables');
    return { fetched: 0, saved: 0 };
  }

  const task = await env.DB.prepare(
    `SELECT cp.id, cp.search_term_id, cp.country_code, cp.hit_count, cp.miss_count, st.term
     FROM crawl_plan cp
     JOIN search_terms st ON cp.search_term_id = st.id
     WHERE cp.processed_at IS NULL
        OR cp.processed_at <= datetime('now', '-' || MIN(cp.miss_count / (cp.hit_count + 1), 72) || ' hours')
     ORDER BY (cp.hit_count * 1.0 / (cp.hit_count + cp.miss_count + 1)) DESC, cp.processed_at ASC
     LIMIT 1`
  ).first<{ id: number; search_term_id: number; country_code: string; hit_count: number; miss_count: number; term: string }>();

  if (!task) {
    console.log('All crawl plan entries on cooldown');
    return { fetched: 0, saved: 0 };
  }

  const hitRate = task.hit_count + task.miss_count > 0
    ? Math.round(task.hit_count * 100 / (task.hit_count + task.miss_count))
    : 100;
  console.log(`[${hitRate}% hit, ${task.hit_count}/${task.hit_count + task.miss_count}] "${task.term} remote" in ${task.country_code}`);

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

    if (crawledCount > 0) {
      await env.DB.prepare(
        "UPDATE crawl_plan SET hit_count = hit_count + 1, processed_at = datetime('now') WHERE id = ?"
      ).bind(task.id).run();
    } else {
      await env.DB.prepare(
        "UPDATE crawl_plan SET miss_count = miss_count + 1, processed_at = datetime('now') WHERE id = ?"
      ).bind(task.id).run();
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`SerpAPI error for "${task.term} remote" (${task.country_code}): ${msg}`);

    await env.DB.prepare(
      "UPDATE crawl_plan SET miss_count = miss_count + 1, processed_at = datetime('now') WHERE id = ?"
    ).bind(task.id).run();

    if (keyIsUrl) {
      await invalidateKey(env.SERPAPI_KEY, serpApiKey);
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

  console.log(`Sync complete: fetched ${totalFetched}, saved ${totalSaved}`);
  return { fetched: totalFetched, saved: totalSaved };
}
