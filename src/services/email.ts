import { Env } from '../types';

export async function sendResendEmail(
  env: Env,
  options: { to: string; subject: string; html: string; text?: string },
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false, error: '邮件服务未配置' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend failed: ${response.status} ${body}`);
    return { ok: false, error: '发送邮件失败' };
  }
  return { ok: true };
}

export async function sendOtpEmail(env: Env, email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  return sendResendEmail(env, {
    to: email,
    subject: `${code} 是你的远程岛登录验证码`,
    text: `你的验证码是 ${code}，5 分钟内有效。如非本人操作请忽略。`,
    html: `<p>你的验证码是 <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>5 分钟内有效。如非本人操作请忽略。</p>`,
  });
}

export type SubscriptionJobAlert = {
  title: string;
  companyName: string;
  locationLabel: string;
  slug: string;
  salaryLabel: string;
};

export async function sendSubscriptionAlertEmail(
  env: Env,
  email: string,
  jobs: SubscriptionJobAlert[],
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = env.SITE_URL.replace(/\/$/, '');
  const items = jobs.map((job) => {
    const url = `${baseUrl}/job/${encodeURIComponent(job.slug)}?utm_source=email&utm_medium=subscription`;
    const salary = job.salaryLabel ? ` · ${job.salaryLabel}` : '';
    return `<li style="margin-bottom:12px"><a href="${url}" style="color:#dd4c0e;font-weight:600;text-decoration:none">${escapeHtml(job.title)}</a><br><span style="color:#78716c;font-size:14px">${escapeHtml(job.companyName)} · ${escapeHtml(job.locationLabel)}${escapeHtml(salary)}</span></li>`;
  }).join('');

  return sendResendEmail(env, {
    to: email,
    subject: `${jobs.length} 个新职位匹配你的订阅`,
    html: `<p>以下新职位匹配你的订阅：</p><ul>${items}</ul><p><a href="${baseUrl}/account" style="color:#dd4c0e">管理订阅</a></p>`,
    text: jobs.map((job) => `${job.title} - ${job.companyName} - ${baseUrl}/job/${job.slug}`).join('\n'),
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
