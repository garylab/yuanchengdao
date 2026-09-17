import { Hono } from 'hono';
import { Env, AppVariables, Job } from '../types';
import { resolveThumbnail } from '../utils/helpers';

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

  const idResult = await c.env.DB.prepare(
    'SELECT job_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all<{ job_id: number }>();
  const jobIds = (idResult.results || []).map((row) => row.job_id);
  if (jobIds.length === 0) return c.json({ favorites: [] });

  const result = await c.env.DB.prepare(
    `${JOBS_HYDRATE} WHERE j.id IN (${jobIds.join(',')})`
  ).all();
  const jobMap = new Map((result.results as unknown as Job[]).map((job) => [job.id, job]));
  const jobs = jobIds
    .map((id) => jobMap.get(id))
    .filter((job): job is Job => job !== undefined)
    .map((job) => ({
      ...job,
      company_thumbnail: resolveThumbnail(job.company_thumbnail, c.env.STATIC_URL),
    }));

  return c.json({ favorites: jobs });
});

favorites.post('/api/favorites/:jobId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const jobId = parseInt(c.req.param('jobId'), 10);
  if (!Number.isFinite(jobId) || jobId <= 0) return c.json({ error: '无效职位' }, 400);

  const job = await c.env.DB.prepare('SELECT id FROM jobs WHERE id = ?').bind(jobId).first<{ id: number }>();
  if (!job) return c.json({ error: '职位不存在' }, 404);

  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO favorites (user_id, job_id) VALUES (?, ?)'
  ).bind(user.id, jobId).run();

  return c.json({ ok: true, favorited: true });
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

export default favorites;
