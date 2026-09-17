import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { sendTelegramDirectMessage } from '../services/telegramDm';

const telegram = new Hono<{ Bindings: Env; Variables: AppVariables }>();

telegram.post('/api/telegram/webhook', async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: '未配置' }, 500);

  const headerSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token') || '';
  if (headerSecret !== secret) return c.json({ error: 'Unauthorized' }, 401);

  const update = await c.req.json<{
    message?: {
      text?: string;
      chat?: { id?: number };
    };
  }>().catch(() => null);

  if (!update?.message?.text || update.message.chat?.id == null) {
    return c.json({ ok: true });
  }

  const text = update.message.text.trim();
  const chatId = String(update.message.chat.id);

  if (!text.startsWith('/start')) {
    return c.json({ ok: true });
  }

  const parts = text.split(/\s+/);
  const token = parts[1] || '';
  if (!token) {
    await sendTelegramDirectMessage(
      c.env,
      chatId,
      '请在远程岛账户页生成绑定链接后再点击开始。',
    );
    return c.json({ ok: true });
  }

  const link = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at FROM telegram_link_tokens WHERE token = ?`
  ).bind(token).first<{ id: number; user_id: number; expires_at: string }>();

  if (!link) {
    await sendTelegramDirectMessage(c.env, chatId, '绑定链接无效或已使用，请回到账户页重新生成。');
    return c.json({ ok: true });
  }

  const expiresMs = Date.parse(
    link.expires_at.includes('T') ? link.expires_at : link.expires_at.replace(' ', 'T') + 'Z',
  );
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) {
    await c.env.DB.prepare('DELETE FROM telegram_link_tokens WHERE id = ?').bind(link.id).run();
    await sendTelegramDirectMessage(c.env, chatId, '绑定链接已过期，请回到账户页重新生成。');
    return c.json({ ok: true });
  }

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').bind(chatId, link.user_id),
    c.env.DB.prepare('DELETE FROM telegram_link_tokens WHERE user_id = ?').bind(link.user_id),
  ]);

  await sendTelegramDirectMessage(
    c.env,
    chatId,
    '绑定成功！你将通过此对话收到远程岛订阅提醒。',
  );

  return c.json({ ok: true });
});

export default telegram;
