import { Env, SerpApiJob, CrawledJob } from '../types';
import { fetchOneQuery, decodeJobId } from './serpapi';
import { translateBatch, TranslateInput } from './translate';
import { uploadThumbnail } from './thumbnail';
import { upsertJobVector, deleteJobVectors } from './vectorSearch';

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

const REMOTE_KEYWORDS = [
  'remote',
  '远程',
  'fernarbeit',
  'homeoffice',
  'fjernarbejde',
  'trabajo remoto',
  'teletrabajo',
  'trabalho remoto',
  'teletrabalho',
  'télétravail',
  'travail à distance',
  'thuiswerken',
  'op afstand',
  'リモート',
  'テレワーク',
  'عن بعد',
  'عمل عن بُعد',
];

function isLikelyRemoteJob(crawled: CrawledJob): boolean {
  const title = crawled.title || '';
  const description = crawled.description || '';
  const highlights = crawled.job_highlights || '';
  const extensions = crawled.extensions || '';
  const detectedExtensions = crawled.detected_extensions || '';
  const combined = `${title}\n${description}\n${highlights}\n${extensions}\n${detectedExtensions}`.toLowerCase();
  return REMOTE_KEYWORDS.some((keyword) => combined.includes(keyword));
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
      if (!isLikelyRemoteJob(crawled)) {
        await env.DB.prepare(
          'UPDATE jobs_crawled SET process_status = 44, failed_reason = ? WHERE id = ?'
        ).bind('not remote', crawled.id).run();
        console.log(`  Skipped crawled #${crawled.id} — not a remote job`);
      } else {
        toTranslate.push(crawled);
      }
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

  const translatedIndices = new Set(translations.map(tr => tr.index));
  for (let i = 0; i < toTranslate.length; i++) {
    if (!translatedIndices.has(i)) {
      const skipped = toTranslate[i];
      await env.DB.prepare(
        "UPDATE jobs_crawled SET process_status = 44, failed_reason = ? WHERE id = ?"
      ).bind('empty content or translation failed', skipped.id).run();
      console.log(`  Marked crawled #${skipped.id} as failed — no translation result`);
    }
  }

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
           detected_extensions, job_highlights, apply_options, location_requirement, english_level_required)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        tr.location_requirement,
        tr.english_level_required,
      ).run();

      const newJobId = jobInsert.meta.last_row_id;
      if (newJobId) {
        try {
          await upsertJobVector(env.AI, env.VECTORIZE, newJobId as number, tr.title_zh, tr.description_zh);
        } catch (vectorError) {
          console.error(`Vector upsert failed for job ${newJobId}:`, vectorError);
        }
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

async function refreshCrawlPlan(db: D1Database): Promise<void> {
  const [termRows, countryRows] = await Promise.all([
    db.prepare('SELECT id FROM search_terms WHERE is_active = 1').all(),
    db.prepare('SELECT code FROM countries WHERE is_active = 1').all(),
  ]);
  const terms = (termRows.results || []) as unknown as Array<{ id: number }>;
  const countries = (countryRows.results || []).map((r: Record<string, unknown>) => r.code as string);

  if (terms.length === 0 || countries.length === 0) return;

  const stmts: D1PreparedStatement[] = [];
  for (const term of terms) {
    for (const countryCode of countries) {
      stmts.push(
        db.prepare('INSERT OR IGNORE INTO crawl_plan (search_term_id, country_code) VALUES (?, ?)').bind(term.id, countryCode),
      );
    }
  }

  if (stmts.length === 0) return;

  const BATCH_LIMIT = 80;
  for (let i = 0; i < stmts.length; i += BATCH_LIMIT) {
    await db.batch(stmts.slice(i, i + BATCH_LIMIT));
  }
  console.log(`Refreshed crawl plan (${stmts.length} new entries)`);
}

function crawlPlanCooldownHours(hit_count: number, miss_count: number): number {
  return Math.min(miss_count / (hit_count + 1), 72);
}

function isCrawlPlanEligible(
  processed_at: string | null,
  hit_count: number,
  miss_count: number,
): boolean {
  if (processed_at === null) return true;
  const hours = crawlPlanCooldownHours(hit_count, miss_count);
  const cutoffMs = Date.now() - hours * 3600000;
  const processedMs = Date.parse(processed_at.replace(' ', 'T') + 'Z');
  return processedMs <= cutoffMs;
}

async function pickNextCrawlTask(db: D1Database): Promise<{
  id: number;
  search_term_id: number;
  country_code: string;
  hit_count: number;
  miss_count: number;
  term: string;
} | null> {
  const picked = await db.prepare(
    `SELECT id, search_term_id, country_code, hit_count, miss_count
     FROM crawl_plan
     WHERE processed_at IS NULL
        OR julianday(processed_at) <= julianday('now') - (MIN(miss_count * 1.0 / (hit_count + 1), 72) / 24.0)
     ORDER BY
       CASE WHEN processed_at IS NULL THEN 0 ELSE 1 END,
       processed_at ASC,
       miss_count ASC,
       id ASC
     LIMIT 1`,
  ).first<{ id: number; search_term_id: number; country_code: string; hit_count: number; miss_count: number }>();

  if (!picked) return null;

  const termRow = await db.prepare('SELECT term FROM search_terms WHERE id = ?')
    .bind(picked.search_term_id)
    .first<{ term: string }>();
  if (!termRow) return null;

  return {
    id: picked.id,
    search_term_id: picked.search_term_id,
    country_code: picked.country_code,
    hit_count: picked.hit_count,
    miss_count: picked.miss_count,
    term: termRow.term,
  };
}

async function deleteExpiredJobs(env: Env): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  const expired = await env.DB.prepare(
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

  try {
    await deleteJobVectors(env.VECTORIZE, ids);
  } catch (vectorError) {
    console.error('Vector delete failed for expired jobs:', vectorError);
  }

  const BATCH = 50;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const placeholders = batch.join(',');
    await env.DB.prepare(`DELETE FROM jobs WHERE id IN (${placeholders})`).run();
  }

  const stmts: D1PreparedStatement[] = [];
  for (const [id, cnt] of companyCount) {
    stmts.push(env.DB.prepare('UPDATE companies SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  for (const [id, cnt] of locationCount) {
    stmts.push(env.DB.prepare('UPDATE locations SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  for (const [id, cnt] of countryCount) {
    stmts.push(env.DB.prepare('UPDATE countries SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  for (const [id, cnt] of termCount) {
    stmts.push(env.DB.prepare('UPDATE search_terms SET job_count = MAX(0, job_count - ?) WHERE id = ?').bind(cnt, id));
  }
  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return rows.length;
}

export async function syncJobs(env: Env): Promise<{ fetched: number; saved: number }> {
  console.log('Starting job sync...');

  const expiredDeleted = await deleteExpiredJobs(env);
  if (expiredDeleted > 0) {
    console.log(`Cleaned up ${expiredDeleted} expired jobs (90+ days old)`);
  }

  await refreshCrawlPlan(env.DB);

  const task = await pickNextCrawlTask(env.DB);

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

  const processed = await processUnprocessedJobs(env);
  totalSaved = processed;

  console.log(`Sync complete: fetched ${totalFetched}, saved ${totalSaved}`);
  return { fetched: totalFetched, saved: totalSaved };
}
