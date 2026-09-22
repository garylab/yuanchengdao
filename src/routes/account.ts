import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { runWeeklyDigest } from '../services/weekly';
import { enrichCompanies } from '../services/companyEnrich';

const account = new Hono<{ Bindings: Env; Variables: AppVariables }>();

account.patch('/api/account/settings', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const body = await c.req.json<{ weeklyDigest?: boolean; name?: string | null }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  if (typeof body.weeklyDigest === 'boolean') {
    updates.push('weekly_digest = ?');
    params.push(body.weeklyDigest ? 1 : 0);
  }
  if (body.name !== undefined) {
    const name = (body.name || '').trim().slice(0, 40);
    updates.push('name = ?');
    params.push(name || null);
  }
  if (updates.length === 0) return c.json({ error: '没有需要更新的字段' }, 400);

  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params, user.id).run();
  return c.json({ ok: true });
});

account.post('/api/admin/weekly/run', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403);

  const body = await c.req.json<{ sendEmails?: boolean }>().catch(() => ({} as { sendEmails?: boolean }));
  const result = await runWeeklyDigest(c.env, { sendEmails: body?.sendEmails === true });
  return c.json({ ok: true, weekStart: result.report.weekStart, newJobs: result.report.newJobs, sent: result.sent });
});

account.post('/api/admin/companies/enrich', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403);

  const body = await c.req.json<{ limit?: number }>().catch(() => ({} as { limit?: number }));
  const limit = Math.min(Math.max(Number(body?.limit) || 3, 1), 10);
  const done = await enrichCompanies(c.env, limit);
  return c.json({ ok: true, enriched: done });
});

export default account;
