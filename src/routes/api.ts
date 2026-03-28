import { Hono } from 'hono';
import { Env, Job } from '../types';
import { syncJobs } from '../services/jobSync';
import { resolveThumbnail } from '../utils/helpers';
import { tokenizeForFtsMatch } from '../utils/tokenizer';

const api = new Hono<{ Bindings: Env }>();

api.get('/api/jobs', async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '30', 10)));
  const offset = (page - 1) * limit;
  const country = url.searchParams.get('country') || '';
  const q = url.searchParams.get('q') || '';

  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  let ftsIds: number[] | null = null;
  if (q) {
    const ftsQuery = tokenizeForFtsMatch(q);
    const ftsResult = await c.env.DB.prepare(
      'SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ? AND posted_at >= ? ORDER BY posted_at DESC LIMIT ? OFFSET ?'
    ).bind(ftsQuery, cutoff, limit, offset).all();
    ftsIds = (ftsResult.results || []).map((r: Record<string, unknown>) => r.rowid as number);
  }

  if (ftsIds !== null && ftsIds.length === 0) {
    return c.json({ jobs: [], page, limit });
  }

  let sql = `
    SELECT j.*,
      co.name as company_name, co.thumbnail as company_thumbnail,
      lo.name as location_name, lo.name_cn as location_name_cn, lo.slug as location_slug,
      ct.code as country_code, ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (ftsIds !== null) {
    sql += ` AND j.id IN (${ftsIds.join(',')})`;
  } else {
    sql += ' AND j.posted_at >= ?';
    params.push(cutoff);
    if (country) {
      sql += ' AND ct.slug = ?';
      params.push(country);
    }
    sql += ' ORDER BY j.posted_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  const jobs = ((result.results || []) as unknown as Job[]).map(j => ({
    ...j,
    company_thumbnail: resolveThumbnail(j.company_thumbnail, c.env.STATIC_URL),
  }));

  return c.json({ jobs, page, limit });
});

api.get('/api/countries', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT ct.id, ct.code, ct.name, ct.name_cn, ct.slug, ct.flag_emoji, ct.job_count
    FROM countries ct
    WHERE ct.is_active = 1 AND ct.job_count > 0
    ORDER BY ct.job_count DESC
  `).all();

  return c.json({ countries: result.results });
});

api.get('/api/locations', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT lo.id, lo.name, lo.name_cn, lo.slug, lo.country_id, lo.job_count,
      ct.name_cn as country_name_cn, ct.code as country_code
    FROM locations lo
    LEFT JOIN countries ct ON lo.country_id = ct.id
    WHERE lo.is_active = 1 AND lo.job_count > 0
    ORDER BY lo.job_count DESC
  `).all();

  return c.json({ locations: result.results });
});

api.get('/api/companies', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT co.id, co.name, co.slug, co.thumbnail, co.job_count,
      lo.name_cn as location_name_cn
    FROM companies co
    LEFT JOIN locations lo ON co.location_id = lo.id
    WHERE co.job_count > 0
    ORDER BY co.job_count DESC
  `).all();

  return c.json({ companies: result.results });
});

api.post('/api/sync', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || authHeader !== `Bearer ${c.env.SERPAPI_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await syncJobs(c.env);
  return c.json(result);
});


export default api;
