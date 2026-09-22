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

const EMAIL_LINK_STYLE = 'color:#dd4c0e;text-decoration:none';
const EMAIL_MUTED_STYLE = 'color:#78716c;font-size:13px';

function siteBase(env: Env): string {
  return env.SITE_URL.replace(/\/$/, '');
}

export type WeeklyDigestReport = {
  weekStart: string;
  weekEnd: string;
  newJobs: number;
  activeJobs: number;
  newCompanies: number;
  chineseFriendlyNew: number;
  noEnglishNew: number;
  topSalaryJobs: Array<{ slug: string; title: string; company_name: string; location_label: string; salary_label: string }>;
  newCompanyList: Array<{ name: string; slug: string; job_count: number }>;
  topCategories: Array<{ term_cn: string; slug: string; count: number }>;
};

export type WeeklyDigestPersonal = {
  favoritesTotal: number;
  favoritesExpired: number;
  favoritesApplied: number;
  deliveriesThisWeek: number;
  subscriptionsTotal: number;
};

export async function sendWeeklyDigestEmail(
  env: Env,
  email: string,
  report: WeeklyDigestReport,
  personal: WeeklyDigestPersonal,
): Promise<{ ok: boolean; error?: string }> {
  const base = siteBase(env);
  const salaryRows = report.topSalaryJobs.slice(0, 10).map((j) => {
    const url = `${base}/job/${encodeURIComponent(j.slug)}?utm_source=email&utm_medium=weekly`;
    return `<li style="margin-bottom:10px"><a href="${url}" style="${EMAIL_LINK_STYLE};font-weight:600">${escapeHtml(j.title)}</a><br><span style="${EMAIL_MUTED_STYLE}">${escapeHtml(j.company_name)} · ${escapeHtml(j.location_label)}${j.salary_label ? ` · ${escapeHtml(j.salary_label)}` : ''}</span></li>`;
  }).join('');
  const categoryRows = report.topCategories.slice(0, 6).map((c) =>
    `<a href="${base}/category/${encodeURIComponent(c.slug)}?utm_source=email&utm_medium=weekly" style="${EMAIL_LINK_STYLE}">${escapeHtml(c.term_cn)}</a>（${c.count}）`
  ).join('　');
  const companyRows = report.newCompanyList.slice(0, 6).map((c) =>
    `<a href="${base}/company/${encodeURIComponent(c.slug)}?utm_source=email&utm_medium=weekly" style="${EMAIL_LINK_STYLE}">${escapeHtml(c.name)}</a>`
  ).join('、');

  const personalLines: string[] = [];
  if (personal.favoritesTotal > 0) {
    personalLines.push(`你收藏了 <strong>${personal.favoritesTotal}</strong> 个职位${personal.favoritesApplied > 0 ? `，其中 <strong>${personal.favoritesApplied}</strong> 个已进入申请流程` : ''}。`);
    if (personal.favoritesExpired > 0) {
      personalLines.push(`有 <strong style="color:#b45309">${personal.favoritesExpired}</strong> 个收藏的职位已超过 30 天，建议尽快处理或归档。`);
    }
  }
  if (personal.subscriptionsTotal > 0) {
    personalLines.push(`本周你的 ${personal.subscriptionsTotal} 条订阅共推送了 <strong>${personal.deliveriesThisWeek}</strong> 个匹配职位。`);
  } else {
    personalLines.push(`你还没有订阅。<a href="${base}/account" style="${EMAIL_LINK_STYLE}">添加一条订阅</a>，新岗位会主动找到你。`);
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1c1917">
      <h2 style="margin:0 0 4px">远程岛周报</h2>
      <p style="${EMAIL_MUTED_STYLE};margin:0 0 20px">${escapeHtml(report.weekStart)} ~ ${escapeHtml(report.weekEnd)}</p>
      <div style="background:#fef3ec;border-radius:8px;padding:14px 16px;margin-bottom:20px">
        本周新增 <strong>${report.newJobs}</strong> 个远程职位，来自 <strong>${report.newCompanies}</strong> 家新雇主；
        其中 <strong>${report.noEnglishNew}</strong> 个未标明英语要求，<strong>${report.chineseFriendlyNew}</strong> 个中文优先。
        当前在招 <strong>${report.activeJobs}</strong> 个。
      </div>
      ${personalLines.length > 0 ? `<div style="border-left:3px solid #ec6517;padding:4px 12px;margin-bottom:20px">${personalLines.map((l) => `<p style="margin:4px 0">${l}</p>`).join('')}<p style="margin:6px 0 0"><a href="${base}/favorites" style="${EMAIL_LINK_STYLE}">查看我的收藏 →</a></p></div>` : ''}
      ${salaryRows ? `<h3 style="margin:20px 0 8px;font-size:16px">本周高薪 Top 10</h3><ol style="padding-left:20px;margin:0">${salaryRows}</ol>` : ''}
      ${categoryRows ? `<h3 style="margin:20px 0 8px;font-size:16px">本周活跃分类</h3><p style="margin:0;line-height:1.9">${categoryRows}</p>` : ''}
      ${companyRows ? `<h3 style="margin:20px 0 8px;font-size:16px">新入驻雇主</h3><p style="margin:0;line-height:1.9">${companyRows}</p>` : ''}
      <p style="margin:24px 0 0"><a href="${base}/weekly?utm_source=email&utm_medium=weekly" style="${EMAIL_LINK_STYLE}">查看完整周报</a>　·　<a href="${base}/account" style="${EMAIL_MUTED_STYLE}">管理订阅 / 退订周报</a></p>
    </div>`;

  const text = [
    `远程岛周报 ${report.weekStart} ~ ${report.weekEnd}`,
    `本周新增 ${report.newJobs} 个远程职位，${report.newCompanies} 家新雇主，${report.noEnglishNew} 个未标明英语要求。`,
    '',
    '本周高薪 Top 10：',
    ...report.topSalaryJobs.slice(0, 10).map((j, i) => `${i + 1}. ${j.title} - ${j.company_name} ${j.salary_label} ${base}/job/${j.slug}`),
    '',
    `完整周报：${base}/weekly`,
  ].join('\n');

  return sendResendEmail(env, {
    to: email,
    subject: `本周新增 ${report.newJobs} 个远程职位 · 远程岛周报`,
    html,
    text,
  });
}

export async function sendFeedbackResolvedEmail(
  env: Env,
  email: string,
  feedback: { id: number; category_label: string; message: string; admin_notes: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const base = siteBase(env);
  const excerpt = feedback.message.length > 200 ? `${feedback.message.slice(0, 200)}…` : feedback.message;
  return sendResendEmail(env, {
    to: email,
    subject: `你提交的反馈已处理（#${feedback.id}）`,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:600px;color:#1c1917">
        <p>感谢你的反馈，我们已经处理完毕。</p>
        <p style="${EMAIL_MUTED_STYLE}">类型：${escapeHtml(feedback.category_label)}</p>
        <blockquote style="border-left:3px solid #e7e5e4;margin:12px 0;padding:6px 12px;color:#57534e;white-space:pre-wrap">${escapeHtml(excerpt)}</blockquote>
        ${feedback.admin_notes ? `<p><strong>处理说明：</strong>${escapeHtml(feedback.admin_notes)}</p>` : ''}
        <p style="margin-top:20px"><a href="${base}/feedback" style="${EMAIL_LINK_STYLE}">继续提交其他建议</a></p>
      </div>`,
    text: `感谢你的反馈（#${feedback.id}，${feedback.category_label}），我们已处理。${feedback.admin_notes ? `\n处理说明：${feedback.admin_notes}` : ''}\n\n${base}/feedback`,
  });
}

export type SubmissionEmailInfo = {
  id: number;
  title: string;
  company_name: string;
};

export async function sendSubmissionReceivedEmail(
  env: Env,
  email: string,
  submission: SubmissionEmailInfo,
): Promise<{ ok: boolean; error?: string }> {
  const base = siteBase(env);
  return sendResendEmail(env, {
    to: email,
    subject: `已收到职位投递：${submission.title}`,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:600px;color:#1c1917">
        <p>我们已收到 <strong>${escapeHtml(submission.company_name)}</strong> 的职位「${escapeHtml(submission.title)}」（编号 #${submission.id}）。</p>
        <p>审核通常在 1–2 个工作日内完成，通过后会上线到远程岛并推送给订阅了相关分类的求职者，我们会再发邮件通知你。</p>
        <p style="${EMAIL_MUTED_STYLE}">如需补充信息，直接回复此邮件即可。</p>
        <p style="margin-top:20px"><a href="${base}" style="${EMAIL_LINK_STYLE}">远程岛</a></p>
      </div>`,
    text: `已收到 ${submission.company_name} 的职位「${submission.title}」（#${submission.id}）。审核通常 1–2 个工作日，通过后会邮件通知你。`,
  });
}

export async function sendSubmissionDecisionEmail(
  env: Env,
  email: string,
  submission: SubmissionEmailInfo,
  approved: boolean,
  options?: { jobSlug?: string; adminNotes?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const base = siteBase(env);
  const jobUrl = options?.jobSlug ? `${base}/job/${encodeURIComponent(options.jobSlug)}` : base;
  if (approved) {
    return sendResendEmail(env, {
      to: email,
      subject: `职位已上线：${submission.title}`,
      html: `
        <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:600px;color:#1c1917">
          <p><strong>${escapeHtml(submission.company_name)}</strong> 的职位「${escapeHtml(submission.title)}」已审核通过并上线。</p>
          <p><a href="${jobUrl}" style="${EMAIL_LINK_STYLE};font-weight:600">查看职位页面 →</a></p>
          <p style="${EMAIL_MUTED_STYLE}">职位会展示 30 天，并推送给订阅了相关分类的求职者。若需修改或下架，回复此邮件即可。</p>
        </div>`,
      text: `「${submission.title}」已上线：${jobUrl}`,
    });
  }
  return sendResendEmail(env, {
    to: email,
    subject: `职位未通过审核：${submission.title}`,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:600px;color:#1c1917">
        <p>很抱歉，<strong>${escapeHtml(submission.company_name)}</strong> 的职位「${escapeHtml(submission.title)}」暂未通过审核。</p>
        ${options?.adminNotes ? `<p><strong>原因：</strong>${escapeHtml(options.adminNotes)}</p>` : '<p>常见原因：非远程岗位、信息不完整、或申请链接无法访问。</p>'}
        <p>修改后可以<a href="${base}/post-job" style="${EMAIL_LINK_STYLE}">重新提交</a>，或回复此邮件与我们沟通。</p>
      </div>`,
    text: `「${submission.title}」暂未通过审核。${options?.adminNotes ? `原因：${options.adminNotes}` : ''}\n重新提交：${base}/post-job`,
  });
}

export async function sendAdminNewSubmissionEmail(
  env: Env,
  email: string,
  submission: SubmissionEmailInfo & { contact_email: string },
): Promise<{ ok: boolean; error?: string }> {
  const base = siteBase(env);
  return sendResendEmail(env, {
    to: email,
    subject: `[待审核] 新职位投递：${submission.company_name} - ${submission.title}`,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:600px;color:#1c1917">
        <p>有新的雇主投递（#${submission.id}）：<strong>${escapeHtml(submission.company_name)}</strong> · ${escapeHtml(submission.title)}</p>
        <p style="${EMAIL_MUTED_STYLE}">联系邮箱：${escapeHtml(submission.contact_email)}</p>
        <p><a href="${base}/admin/submissions" style="${EMAIL_LINK_STYLE};font-weight:600">前往审核 →</a></p>
      </div>`,
    text: `新职位投递 #${submission.id}：${submission.company_name} - ${submission.title}\n${base}/admin/submissions`,
  });
}
