import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { verifyTurnstile } from '../services/turnstile';
import { checkRateLimit, isValidEmail, normalizeEmail } from '../services/auth';
import { isKnownFeedbackCategory } from '../constants/feedback';

const feedback = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

feedback.post('/api/feedback', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    category?: string;
    message?: string;
    referenceUrl?: string | null;
    email?: string | null;
    pageUrl?: string | null;
    turnstileToken?: string;
  }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const category = (body.category || '').trim();
  if (!isKnownFeedbackCategory(category)) {
    return c.json({ error: '请选择反馈类型' }, 400);
  }

  const message = (body.message || '').trim();
  if (!message) return c.json({ error: '请填写详细描述' }, 400);
  if (message.length > 2000) return c.json({ error: '内容过长' }, 400);

  const referenceUrl = (body.referenceUrl || '').trim() || null;
  if (referenceUrl && referenceUrl.length > 500) {
    return c.json({ error: '相关链接过长' }, 400);
  }

  const pageUrl = (body.pageUrl || '').trim() || null;

  const rawEmail = (body.email || '').trim();
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (email && !isValidEmail(email)) {
    return c.json({ error: '邮箱格式不正确' }, 400);
  }

  const ip = clientIp(c);

  if (!user) {
    const turnstileOk = await verifyTurnstile(c.env, body.turnstileToken || '', ip);
    if (!turnstileOk) return c.json({ error: '人机验证失败' }, 400);
  }

  const allowed = await checkRateLimit(c.env.DB, `feedback:${ip}`, 20, 60);
  if (!allowed) return c.json({ error: '提交过于频繁，请稍后再试' }, 429);

  const userAgent = c.req.header('User-Agent') || null;

  await c.env.DB.prepare(
    `INSERT INTO feedback (user_id, email, category, message, reference_url, page_url, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    user?.id ?? null,
    email ?? user?.email ?? null,
    category,
    message,
    referenceUrl,
    pageUrl,
    ip,
    userAgent,
  ).run();

  return c.json({ ok: true });
});

feedback.post('/api/feedback/:id/toggle', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效反馈' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT resolved_at FROM feedback WHERE id = ?'
  ).bind(id).first<{ resolved_at: string | null }>();
  if (!existing) return c.json({ error: '反馈不存在' }, 404);

  if (existing.resolved_at) {
    await c.env.DB.prepare('UPDATE feedback SET resolved_at = NULL WHERE id = ?').bind(id).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE feedback SET resolved_at = datetime('now') WHERE id = ?"
    ).bind(id).run();
  }

  return c.json({ ok: true });
});

export default feedback;
