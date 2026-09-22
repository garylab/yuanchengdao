import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { Env, AuthUser, AppVariables } from '../types';
import { SESSION_COOKIE, resolveSessionUser } from '../services/auth';

export const sessionMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    c.set('user', null);
    const token = getCookie(c, SESSION_COOKIE);
    const sessionSecret = c.env.SESSION_SECRET;
    if (token && sessionSecret) {
      try {
        const row = await resolveSessionUser(c.env.DB, token, sessionSecret);
        if (row) {
          const user: AuthUser = {
            id: row.id,
            email: row.email,
            name: row.name,
            avatar_url: row.avatar_url,
            telegram_chat_id: row.telegram_chat_id,
            role: row.role === 'admin' ? 'admin' : 'user',
            weekly_digest: row.weekly_digest !== 0,
          };
          c.set('user', user);
        }
      } catch (error) {
        console.error('Session resolve failed', error);
      }
    }
    await next();
  },
);

export function requireUser(user: AuthUser | null): user is AuthUser {
  return user !== null;
}
