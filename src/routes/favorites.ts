import { Hono } from 'hono';
import { Env, AppVariables, Job } from '../types';
import { resolveThumbnail } from '../utils/helpers';
import { isFavoriteStatus } from '../constants/favorites';

const favorites = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const JOBS_HYDRATE = `
  SELECT j.*,
    co.name as company_name, co.slug as company_slug, co.thumbnail as company_thumbnail,
    lo.name as location_name, lo.name_cn as location_name_cn, lo.slug as location_slug,
    ct.code as country_code, ct.name_cn as country_name_cn, ct.flag_emoji as country_flag_emoji
  FROM jobs j
  LEFT JOIN companies co ON j.company_id = co.id
  LEFT JOIN locations lo ON j.location_id = lo.id
  LEFT JOIN countries ct ON j.country_id = ct.id`;

favorites.get('/api/favorites', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT id, job_id, status, notes, job_title, company_name, company_slug, job_slug, apply_url, job_posted_at, created_at, updated_at
     FROM favorites WHERE user_id = ? ORDER BY updated_at DESC`
  ).bind(user.id).all();
  const list = (rows.results || []) as Array<Record<string, unknown>>;
  const jobIds = list.map((r) => r.job_id).filter((v): v is number => typeof v === 'number');

  let jobMap = new Map<number, Job>();
  if (jobIds.length > 0) {
    const result = await c.env.DB.prepare(`${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')})`).all();
    jobMap = new Map((result.results as unknown as Job[]).map((job) => [job.id, {
      ...job,
      company_thumbnail: resolveThumbnail(job.company_thumbnail, c.env.STATIC_URL),
    }]));
  }

  return c.json({
    favorites: list.map((r) => ({
      ...r,
      job: typeof r.job_id === 'number' ? jobMap.get(r.job_id) || null : null,
    })),
  });
});

favorites.post('/api/favorites/:jobId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const jobId = parseInt(c.req.param('jobId'), 10);
  if (!Number.isFinite(jobId) || jobId <= 0) return c.json({ error: '无效职位' }, 400);

  const job = await c.env.DB.prepare(`
    SELECT j.id, j.title, j.slug, j.apply_options, COALESCE(j.posted_at, j.created_at) as posted_at,
      co.name as company_name, co.slug as company_slug
    FROM jobs j LEFT JOIN companies co ON co.id = j.company_id
    WHERE j.id = ?
  `).bind(jobId).first<{
    id: number; title: string; slug: string; apply_options: string | null; posted_at: string;
    company_name: string | null; company_slug: string | null;
  }>();
  if (!job) return c.json({ error: '职位不存在' }, 404);

  let applyUrl: string | null = null;
  if (job.apply_options) {
    try {
      const options = JSON.parse(job.apply_options) as Array<{ link?: string }>;
      applyUrl = options[0]?.link || null;
    } catch { applyUrl = null; }
  }

  await c.env.DB.prepare(`
    INSERT INTO favorites (user_id, job_id, job_title, company_name, company_slug, job_slug, apply_url, job_posted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, job_id) DO UPDATE SET
      job_title = excluded.job_title,
      company_name = excluded.company_name,
      company_slug = excluded.company_slug,
      job_slug = excluded.job_slug,
      apply_url = excluded.apply_url,
      job_posted_at = excluded.job_posted_at,
      updated_at = datetime('now')
  `).bind(user.id, jobId, job.title, job.company_name, job.company_slug, job.slug, applyUrl, job.posted_at).run();

  return c.json({ ok: true, favorited: true });
});

favorites.patch('/api/favorites/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效记录' }, 400);

  const body = await c.req.json<{ status?: string; notes?: string | null }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM favorites WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<{ id: number }>();
  if (!existing) return c.json({ error: '记录不存在' }, 404);

  const updates: string[] = [];
  const params: (string | null)[] = [];
  if (body.status !== undefined) {
    if (!isFavoriteStatus(body.status)) return c.json({ error: '状态无效' }, 400);
    updates.push('status = ?');
    params.push(body.status);
  }
  if (body.notes !== undefined) {
    const notes = (body.notes || '').trim();
    if (notes.length > 2000) return c.json({ error: '备注过长' }, 400);
    updates.push('notes = ?');
    params.push(notes || null);
  }
  if (updates.length === 0) return c.json({ error: '没有需要更新的字段' }, 400);

  await c.env.DB.prepare(
    `UPDATE favorites SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).bind(...params, id, user.id).run();

  return c.json({ ok: true });
});

favorites.delete('/api/favorites/:jobId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const jobId = parseInt(c.req.param('jobId'), 10);
  if (!Number.isFinite(jobId) || jobId <= 0) return c.json({ error: '无效职位' }, 400);

  await c.env.DB.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND job_id = ?'
  ).bind(user.id, jobId).run();

  return c.json({ ok: true, favorited: false });
});

favorites.delete('/api/favorites/record/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效记录' }, 400);

  await c.env.DB.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  return c.json({ ok: true });
});

export default favorites;
