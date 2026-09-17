import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { createTelegramLinkToken } from '../services/auth';

const subscriptions = new Hono<{ Bindings: Env; Variables: AppVariables }>();

type SubscriptionRow = {
  id: number;
  user_id: number;
  search_term_id: number;
  location_id: number | null;
  notify_email: number;
  notify_telegram: number;
  created_at: string;
  term_cn?: string | null;
  term_slug?: string | null;
  location_name_cn?: string | null;
  location_slug?: string | null;
};

subscriptions.get('/api/subscriptions', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const idResult = await c.env.DB.prepare(
    'SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all<{ id: number }>();
  const ids = (idResult.results || []).map((row) => row.id);
  if (ids.length === 0) return c.json({ subscriptions: [] });

  const result = await c.env.DB.prepare(`
    SELECT s.*, st.term_cn, st.slug as term_slug, lo.name_cn as location_name_cn, lo.slug as location_slug
    FROM subscriptions s
    LEFT JOIN search_terms st ON s.search_term_id = st.id
    LEFT JOIN locations lo ON s.location_id = lo.id
    WHERE s.id IN (${ids.join(',')})
    ORDER BY s.created_at DESC
  `).all<SubscriptionRow>();

  return c.json({ subscriptions: result.results || [] });
});

subscriptions.post('/api/subscriptions', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const body = await c.req.json<{
    searchTermId?: number;
    locationId?: number | null;
    notifyEmail?: boolean;
    notifyTelegram?: boolean;
  }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const searchTermId = Number(body.searchTermId);
  if (!Number.isFinite(searchTermId) || searchTermId <= 0) {
    return c.json({ error: '请选择职位分类' }, 400);
  }

  const locationId = body.locationId == null || body.locationId === 0
    ? null
    : Number(body.locationId);
  if (locationId !== null && (!Number.isFinite(locationId) || locationId <= 0)) {
    return c.json({ error: '地点无效' }, 400);
  }

  const notifyEmail = body.notifyEmail !== false ? 1 : 0;
  const notifyTelegram = body.notifyTelegram === true ? 1 : 0;
  if (!notifyEmail && !notifyTelegram) {
    return c.json({ error: '请至少选择一种通知方式' }, 400);
  }
  if (notifyTelegram && !user.telegram_chat_id) {
    return c.json({ error: '请先绑定 Telegram' }, 400);
  }

  const term = await c.env.DB.prepare(
    'SELECT id FROM search_terms WHERE id = ? AND is_active = 1'
  ).bind(searchTermId).first<{ id: number }>();
  if (!term) return c.json({ error: '职位分类不存在' }, 400);

  if (locationId !== null) {
    const location = await c.env.DB.prepare(
      'SELECT id FROM locations WHERE id = ? AND is_active = 1'
    ).bind(locationId).first<{ id: number }>();
    if (!location) return c.json({ error: '地点不存在' }, 400);
  }

  try {
    const inserted = await c.env.DB.prepare(`
      INSERT INTO subscriptions (user_id, search_term_id, location_id, notify_email, notify_telegram)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `).bind(user.id, searchTermId, locationId, notifyEmail, notifyTelegram).first<{ id: number }>();
    return c.json({ ok: true, id: inserted?.id });
  } catch {
    return c.json({ error: '该订阅已存在' }, 409);
  }
});

subscriptions.delete('/api/subscriptions/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效订阅' }, 400);

  await c.env.DB.prepare(
    'DELETE FROM subscriptions WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).run();

  return c.json({ ok: true });
});

subscriptions.post('/api/telegram/link-token', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const token = createTelegramLinkToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM telegram_link_tokens WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare(
      'INSERT INTO telegram_link_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, user.id, expiresAt),
  ]);

  let botUsername = c.env.TELEGRAM_BOT_USERNAME || '';
  if (!botUsername && c.env.TELEGRAM_BOT_TOKEN) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/getMe`);
      if (response.ok) {
        const data = await response.json() as { result?: { username?: string } };
        botUsername = data.result?.username || '';
      }
    } catch (error) {
      console.error('Telegram getMe failed', error);
    }
  }

  if (!botUsername) return c.json({ error: 'Telegram Bot 未配置' }, 500);

  return c.json({
    ok: true,
    token,
    deepLink: `https://t.me/${botUsername}?start=${token}`,
  });
});

subscriptions.post('/api/telegram/unlink', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  await c.env.DB.prepare(
    'UPDATE users SET telegram_chat_id = NULL WHERE id = ?'
  ).bind(user.id).run();

  return c.json({ ok: true });
});

export default subscriptions;
