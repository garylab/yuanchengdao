import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Env, AppVariables } from '../types';
import { verifyTurnstile } from '../services/turnstile';
import { sendOtpEmail } from '../services/email';
import {
  SESSION_COOKIE,
  checkRateLimit,
  clearSessionCookieHeader,
  createEmailOtp,
  createOrLinkGoogleUser,
  createSession,
  createUserWithPassword,
  destroySession,
  findOrCreateUserByEmailOtp,
  findUserByEmail,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  sessionCookieHeader,
  verifyEmailOtp,
  verifyPassword,
} from '../services/auth';

const auth = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

function safeNextPath(next: string | undefined | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

auth.post('/api/auth/register', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; name?: string; turnstileToken?: string }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const email = normalizeEmail(body.email || '');
  const password = body.password || '';
  const name = (body.name || '').trim() || null;

  if (!isValidEmail(email)) return c.json({ error: '邮箱格式不正确' }, 400);
  if (password.length < 8) return c.json({ error: '密码至少 8 位' }, 400);

  const turnstileOk = await verifyTurnstile(c.env, body.turnstileToken || '', clientIp(c));
  if (!turnstileOk) return c.json({ error: '人机验证失败' }, 400);

  const allowed = await checkRateLimit(c.env.DB, `register:${clientIp(c)}:${email}`);
  if (!allowed) return c.json({ error: '请求过于频繁，请稍后再试' }, 429);

  const existing = await findUserByEmail(c.env.DB, email);
  if (existing?.password_hash) return c.json({ error: '该邮箱已注册，请直接登录' }, 409);

  if (!c.env.SESSION_SECRET) return c.json({ error: '服务未配置' }, 500);

  let userId: number;
  if (existing) {
    const passwordHash = await hashPassword(password);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, name = COALESCE(?, name) WHERE id = ?'
    ).bind(passwordHash, name, existing.id).run();
    userId = existing.id;
  } else {
    const user = await createUserWithPassword(c.env.DB, email, password, name);
    userId = user.id;
  }

  const session = await createSession(c.env.DB, userId, c.env.SESSION_SECRET);
  c.header('Set-Cookie', sessionCookieHeader(session.token, session.expiresAt));
  return c.json({ ok: true });
});

auth.post('/api/auth/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; turnstileToken?: string }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const email = normalizeEmail(body.email || '');
  const password = body.password || '';
  if (!isValidEmail(email) || !password) return c.json({ error: '请输入邮箱和密码' }, 400);

  const turnstileOk = await verifyTurnstile(c.env, body.turnstileToken || '', clientIp(c));
  if (!turnstileOk) return c.json({ error: '人机验证失败' }, 400);

  const allowed = await checkRateLimit(c.env.DB, `login:${clientIp(c)}:${email}`);
  if (!allowed) return c.json({ error: '请求过于频繁，请稍后再试' }, 429);

  const user = await findUserByEmail(c.env.DB, email);
  if (!user?.password_hash) return c.json({ error: '邮箱或密码错误' }, 401);

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) return c.json({ error: '邮箱或密码错误' }, 401);

  if (!c.env.SESSION_SECRET) return c.json({ error: '服务未配置' }, 500);
  const session = await createSession(c.env.DB, user.id, c.env.SESSION_SECRET);
  c.header('Set-Cookie', sessionCookieHeader(session.token, session.expiresAt));
  return c.json({ ok: true });
});

auth.post('/api/auth/otp/send', async (c) => {
  const body = await c.req.json<{ email?: string; turnstileToken?: string }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const email = normalizeEmail(body.email || '');
  if (!isValidEmail(email)) return c.json({ error: '邮箱格式不正确' }, 400);

  const turnstileOk = await verifyTurnstile(c.env, body.turnstileToken || '', clientIp(c));
  if (!turnstileOk) return c.json({ error: '人机验证失败' }, 400);

  const allowed = await checkRateLimit(c.env.DB, `otp-send:${clientIp(c)}:${email}`, 10, 15);
  if (!allowed) return c.json({ error: '请求过于频繁，请稍后再试' }, 429);

  const otp = await createEmailOtp(c.env.DB, email);
  if (otp.error) return c.json({ error: otp.error }, 429);

  const sent = await sendOtpEmail(c.env, email, otp.code);
  if (!sent.ok) return c.json({ error: sent.error || '发送失败' }, 500);

  return c.json({ ok: true });
});

auth.post('/api/auth/otp/verify', async (c) => {
  const body = await c.req.json<{ email?: string; code?: string; turnstileToken?: string }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const email = normalizeEmail(body.email || '');
  const code = (body.code || '').trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return c.json({ error: '请输入邮箱和 6 位验证码' }, 400);

  const turnstileOk = await verifyTurnstile(c.env, body.turnstileToken || '', clientIp(c));
  if (!turnstileOk) return c.json({ error: '人机验证失败' }, 400);

  const allowed = await checkRateLimit(c.env.DB, `otp-verify:${clientIp(c)}:${email}`);
  if (!allowed) return c.json({ error: '请求过于频繁，请稍后再试' }, 429);

  const verified = await verifyEmailOtp(c.env.DB, email, code);
  if (!verified.ok) return c.json({ error: verified.error || '验证失败' }, 400);

  if (!c.env.SESSION_SECRET) return c.json({ error: '服务未配置' }, 500);
  const user = await findOrCreateUserByEmailOtp(c.env.DB, email);
  const session = await createSession(c.env.DB, user.id, c.env.SESSION_SECRET);
  c.header('Set-Cookie', sessionCookieHeader(session.token, session.expiresAt));
  return c.json({ ok: true });
});

auth.get('/api/auth/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.text('Google 登录未配置', 500);

  const next = safeNextPath(c.req.query('next'));
  const state = btoa(JSON.stringify({ next, nonce: crypto.randomUUID() }));
  const redirectUri = `${c.env.SITE_URL.replace(/\/$/, '')}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);

  setCookie(c, 'oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
  });

  return c.redirect(url.toString(), 302);
});

auth.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state') || '';
  const storedState = getCookie(c, 'oauth_state') || '';
  deleteCookie(c, 'oauth_state', { path: '/' });

  if (!code || !state || state !== storedState) {
    return c.redirect('/login?error=google', 302);
  }

  let next = '/';
  try {
    const parsed = JSON.parse(atob(state)) as { next?: string };
    next = safeNextPath(parsed.next);
  } catch {
    next = '/';
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = c.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !sessionSecret) {
    return c.redirect('/login?error=config', 302);
  }

  const redirectUri = `${c.env.SITE_URL.replace(/\/$/, '')}/api/auth/google/callback`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenResponse.ok) {
    console.error('Google token exchange failed', await tokenResponse.text());
    return c.redirect('/login?error=google', 302);
  }

  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return c.redirect('/login?error=google', 302);

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) return c.redirect('/login?error=google', 302);

  const profile = await profileResponse.json() as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email || profile.email_verified === false) {
    return c.redirect('/login?error=google', 302);
  }

  const user = await createOrLinkGoogleUser(c.env.DB, {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name || null,
    avatarUrl: profile.picture || null,
  });

  const session = await createSession(c.env.DB, user.id, sessionSecret);
  c.header('Set-Cookie', sessionCookieHeader(session.token, session.expiresAt));
  return c.redirect(next, 302);
});

auth.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token && c.env.SESSION_SECRET) {
    await destroySession(c.env.DB, token, c.env.SESSION_SECRET);
  }
  c.header('Set-Cookie', clearSessionCookieHeader());
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    return c.redirect('/', 302);
  }
  return c.json({ ok: true });
});

export default auth;
