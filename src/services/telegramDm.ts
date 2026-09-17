import { Env } from '../types';

export async function sendTelegramDirectMessage(
  env: Env,
  chatId: string,
  text: string,
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const body = new URLSearchParams({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: 'false',
  });

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Telegram DM sendMessage failed: ${response.status} ${errText}`);
  }
}
