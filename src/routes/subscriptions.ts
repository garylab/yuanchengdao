import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { createTelegramLinkToken } from '../services/auth';
import { sendSubscriptionAlertEmail } from '../services/email';
import { sendTelegramDirectMessage } from '../services/telegramDm';
import { isKnownSalaryRange } from '../constants/salary';
import { isSubscriptionKind, KEYWORD_QUERY_MAX_LENGTH, SubscriptionKind } from '../constants/subscriptions';
import { buildTelegramAlert, jobMatchesSubscriptionFilters, toAlertJob } from '../services/subscriptions';
import { searchByVector } from '../services/vectorSearch';
import { activeCutoff } from '../utils/helpers';

const subscriptions = new Hono<{ Bindings: Env; Variables: AppVariables }>();

type SubscriptionBody = {
  kind?: string;
  searchTermId?: number | null;
  queryText?: string | null;
  companyId?: number | null;
  locationId?: number | null;
  salaryRange?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
};

type ValidatedFields = {
  kind: SubscriptionKind;
  searchTermId: number | null;
  queryText: string | null;
  companyId: number | null;
  locationId: number | null;
  salaryRange: string | null;
  notifyEmail: number;
  notifyTelegram: number;
};

function toNullableId(value: unknown): number | null | 'invalid' {
  if (value == null || value === '' || value === 0) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'invalid';
  return n;
}

async function validateSubscriptionBody(
  db: D1Database,
  user: { telegram_chat_id: string | null },
  body: SubscriptionBody | null,
): Promise<{ ok: true; fields: ValidatedFields } | { ok: false; error: string; status: 400 }> {
  if (!body) return { ok: false, error: '无效请求', status: 400 };

  const kind: SubscriptionKind = isSubscriptionKind(body.kind) ? body.kind : 'category';

  let searchTermId: number | null = null;
  let queryText: string | null = null;
  let companyId: number | null = null;

  if (kind === 'category') {
    const parsed = toNullableId(body.searchTermId);
    if (parsed === null || parsed === 'invalid') return { ok: false, error: '请选择职位分类', status: 400 };
    searchTermId = parsed;
    const term = await db.prepare('SELECT id FROM search_terms WHERE id = ? AND is_active = 1').bind(searchTermId).first<{ id: number }>();
    if (!term) return { ok: false, error: '职位分类不存在', status: 400 };
  } else if (kind === 'keyword') {
    queryText = (body.queryText || '').trim().replace(/\s+/g, ' ');
    if (queryText.length < 2) return { ok: false, error: '关键词至少 2 个字符', status: 400 };
    if (queryText.length > KEYWORD_QUERY_MAX_LENGTH) return { ok: false, error: `关键词不超过 ${KEYWORD_QUERY_MAX_LENGTH} 个字符`, status: 400 };
  } else {
    const parsed = toNullableId(body.companyId);
    if (parsed === null || parsed === 'invalid') return { ok: false, error: '请选择公司', status: 400 };
    companyId = parsed;
    const company = await db.prepare('SELECT id FROM companies WHERE id = ?').bind(companyId).first<{ id: number }>();
    if (!company) return { ok: false, error: '公司不存在', status: 400 };
  }

  const locationParsed = toNullableId(body.locationId);
  if (locationParsed === 'invalid') return { ok: false, error: '地点无效', status: 400 };
  const locationId = locationParsed;
  if (locationId !== null) {
    const location = await db.prepare('SELECT id FROM locations WHERE id = ? AND is_active = 1').bind(locationId).first<{ id: number }>();
    if (!location) return { ok: false, error: '地点不存在', status: 400 };
  }

  const salaryRangeRaw = (body.salaryRange || '').trim();
  const salaryRange = salaryRangeRaw ? salaryRangeRaw : null;
  if (salaryRange && !isKnownSalaryRange(salaryRange)) return { ok: false, error: '薪资范围无效', status: 400 };

  const notifyEmail = body.notifyEmail !== false ? 1 : 0;
  const notifyTelegram = body.notifyTelegram === true ? 1 : 0;
  if (!notifyEmail && !notifyTelegram) return { ok: false, error: '请至少选择一种通知方式', status: 400 };
  if (notifyTelegram && !user.telegram_chat_id) return { ok: false, error: '请先绑定 Telegram', status: 400 };

  return {
    ok: true,
    fields: { kind, searchTermId, queryText, companyId, locationId, salaryRange, notifyEmail, notifyTelegram },
  };
}

subscriptions.get('/api/subscriptions', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const result = await c.env.DB.prepare(`
    SELECT s.*, st.term_cn, st.slug as term_slug, co.name as company_name, co.slug as company_slug,
      lo.name_cn as location_name_cn, lo.slug as location_slug
    FROM subscriptions s
    LEFT JOIN search_terms st ON s.search_term_id = st.id
    LEFT JOIN companies co ON s.company_id = co.id
    LEFT JOIN locations lo ON s.location_id = lo.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).bind(user.id).all();

  return c.json({ subscriptions: result.results || [] });
});

subscriptions.get('/api/companies/search', async (c) => {
  const q = (c.req.query('q') || '').trim();
  if (q.length < 1) return c.json({ companies: [] });
  const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const result = await c.env.DB.prepare(
    `SELECT id, name, slug, job_count FROM companies
     WHERE name LIKE ? ESCAPE '\\'
     ORDER BY job_count DESC, name ASC LIMIT 20`
  ).bind(pattern).all<{ id: number; name: string; slug: string; job_count: number }>();
  return c.json({ companies: result.results || [] });
});

subscriptions.post('/api/subscriptions', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const body = await c.req.json<SubscriptionBody>().catch(() => null);
  const validation = await validateSubscriptionBody(c.env.DB, user, body);
  if (!validation.ok) return c.json({ error: validation.error }, validation.status);

  const f = validation.fields;
  try {
    const inserted = await c.env.DB.prepare(`
      INSERT INTO subscriptions (user_id, kind, search_term_id, query_text, company_id, location_id, salary_range, notify_email, notify_telegram)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(user.id, f.kind, f.searchTermId, f.queryText, f.companyId, f.locationId, f.salaryRange, f.notifyEmail, f.notifyTelegram).first<{ id: number }>();
    return c.json({ ok: true, id: inserted?.id });
  } catch {
    return c.json({ error: '该订阅已存在' }, 409);
  }
});

subscriptions.patch('/api/subscriptions/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效订阅' }, 400);

  const body = await c.req.json<SubscriptionBody>().catch(() => null);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM subscriptions WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first<{ id: number }>();
  if (!existing) return c.json({ error: '订阅不存在' }, 404);

  const validation = await validateSubscriptionBody(c.env.DB, user, body);
  if (!validation.ok) return c.json({ error: validation.error }, validation.status);

  const f = validation.fields;
  try {
    await c.env.DB.prepare(`
      UPDATE subscriptions
      SET kind = ?, search_term_id = ?, query_text = ?, company_id = ?, location_id = ?, salary_range = ?, notify_email = ?, notify_telegram = ?
      WHERE id = ? AND user_id = ?
    `).bind(f.kind, f.searchTermId, f.queryText, f.companyId, f.locationId, f.salaryRange, f.notifyEmail, f.notifyTelegram, id, user.id).run();
    return c.json({ ok: true });
  } catch {
    return c.json({ error: '该订阅已存在' }, 409);
  }
});

subscriptions.post('/api/subscriptions/:id/test', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效订阅' }, 400);

  const subscription = await c.env.DB.prepare(
    `SELECT s.id, s.kind, s.search_term_id, s.query_text, s.company_id, s.location_id, s.salary_range, s.notify_email, s.notify_telegram,
       u.email, u.telegram_chat_id
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.user_id = ?`
  ).bind(id, user.id).first<{
    id: number; kind: SubscriptionKind; search_term_id: number | null; query_text: string | null; company_id: number | null;
    location_id: number | null; salary_range: string | null; notify_email: number; notify_telegram: number;
    email: string; telegram_chat_id: string | null;
  }>();
  if (!subscription) return c.json({ error: '订阅不存在' }, 404);

  const jobBaseSelect = `SELECT j.id, j.slug, j.title, j.location_id, j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle,
         co.name as company_name,
         lo.name_cn as location_name_cn,
         ct.name_cn as country_name_cn
       FROM jobs j
       LEFT JOIN companies co ON j.company_id = co.id
       LEFT JOIN locations lo ON j.location_id = lo.id
       LEFT JOIN countries ct ON j.country_id = ct.id`;

  type JobCandidate = {
    id: number; slug: string; title: string; location_id: number | null;
    salary_lower: number; salary_upper: number; salary_currency: string; salary_pay_cycle: string;
    company_name: string | null; location_name_cn: string | null; country_name_cn: string | null;
  };

  let candidates: JobCandidate[] = [];
  if (subscription.kind === 'category' && subscription.search_term_id) {
    const result = await c.env.DB.prepare(
      `${jobBaseSelect} WHERE j.search_term_id = ? ORDER BY j.created_at DESC LIMIT 60`
    ).bind(subscription.search_term_id).all<JobCandidate>();
    candidates = result.results || [];
  } else if (subscription.kind === 'company' && subscription.company_id) {
    const result = await c.env.DB.prepare(
      `${jobBaseSelect} WHERE j.company_id = ? ORDER BY j.created_at DESC LIMIT 60`
    ).bind(subscription.company_id).all<JobCandidate>();
    candidates = result.results || [];
  } else if (subscription.kind === 'keyword' && subscription.query_text) {
    const ids = await searchByVector(c.env.AI, c.env.VECTORIZE, subscription.query_text, 60).catch(() => [] as number[]);
    if (ids.length > 0) {
      const result = await c.env.DB.prepare(
        `${jobBaseSelect} WHERE j.id IN (${ids.join(',')}) AND j.posted_at >= ?`
      ).bind(activeCutoff()).all<JobCandidate>();
      const map = new Map((result.results || []).map((r) => [r.id, r]));
      candidates = ids.map((i) => map.get(i)).filter((r): r is JobCandidate => !!r);
    }
  }

  const job = candidates.find((candidate) => jobMatchesSubscriptionFilters(subscription, candidate));
  if (!job) return c.json({ error: '暂无匹配的职位可发送' }, 404);

  const alertJob = toAlertJob(job);
  const sent: string[] = [];
  const errors: string[] = [];

  if (subscription.notify_email && subscription.email) {
    const result = await sendSubscriptionAlertEmail(c.env, subscription.email, [alertJob]);
    if (result.ok) sent.push('邮件');
    else errors.push(`邮件：${result.error || '发送失败'}`);
  }

  if (subscription.notify_telegram && subscription.telegram_chat_id) {
    try {
      await sendTelegramDirectMessage(c.env, subscription.telegram_chat_id, buildTelegramAlert(c.env, [alertJob], '远程岛订阅测试'));
      sent.push('Telegram');
    } catch (err) {
      errors.push(`Telegram：${err instanceof Error ? err.message : '发送失败'}`);
    }
  }

  if (sent.length === 0 && errors.length === 0) return c.json({ error: '未启用任何通知渠道' }, 400);
  if (sent.length === 0) return c.json({ error: errors.join('；') }, 500);
  return c.json({ ok: true, channels: sent, jobTitle: alertJob.title, warning: errors.length > 0 ? errors.join('；') : undefined });
});

subscriptions.delete('/api/subscriptions/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效订阅' }, 400);

  await c.env.DB.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  return c.json({ ok: true });
});

subscriptions.post('/api/telegram/link-token', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);

  const token = createTelegramLinkToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM telegram_link_tokens WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('INSERT INTO telegram_link_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt),
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
  return c.json({ ok: true, token, deepLink: `https://t.me/${botUsername}?start=${token}` });
});

subscriptions.post('/api/telegram/unlink', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);
  await c.env.DB.prepare('UPDATE users SET telegram_chat_id = NULL WHERE id = ?').bind(user.id).run();
  return c.json({ ok: true });
});

export default subscriptions;
