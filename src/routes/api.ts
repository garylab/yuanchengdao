import { Hono } from 'hono';
import { Env, Job } from '../types';
import { syncJobs } from '../services/jobSync';

const api = new Hono<{ Bindings: Env }>();

api.get('/api/jobs', async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '30', 10)));
  const offset = (page - 1) * limit;
  const country = url.searchParams.get('country') || '';
  const q = url.searchParams.get('q') || '';

  let sql = `
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

  if (q) {
    sql += ' AND (j.title LIKE ? OR co.name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (country) {
    sql += ' AND ct.slug = ?';
    params.push(country);
  }

  sql += ' ORDER BY j.posted_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  const jobs = (result.results || []) as unknown as Job[];

  return c.json({ jobs, page, limit });
});

api.get('/api/countries', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT ct.*, COUNT(j.id) as job_count FROM countries ct
    JOIN jobs j ON j.country_id = ct.id AND j.is_active = 1
    WHERE ct.is_active = 1
    GROUP BY ct.id HAVING job_count > 0
    ORDER BY job_count DESC
  `).all();

  return c.json({ countries: result.results });
});

api.get('/api/locations', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT lo.*, ct.name_cn as country_name_cn, ct.code as country_code,
      COUNT(j.id) as job_count
    FROM locations lo
    LEFT JOIN countries ct ON lo.country_id = ct.id
    LEFT JOIN jobs j ON lo.id = j.location_id AND j.is_active = 1
    WHERE lo.is_active = 1
    GROUP BY lo.id HAVING job_count > 0
    ORDER BY job_count DESC
  `).all();

  return c.json({ locations: result.results });
});

api.get('/api/companies', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT co.*, lo.name_cn as location_name_cn, COUNT(j.id) as job_count
    FROM companies co
    LEFT JOIN locations lo ON co.location_id = lo.id
    LEFT JOIN jobs j ON co.id = j.company_id AND j.is_active = 1
    GROUP BY co.id HAVING job_count > 0
    ORDER BY job_count DESC
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
