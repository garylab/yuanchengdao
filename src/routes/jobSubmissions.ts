import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { verifyTurnstile } from '../services/turnstile';
import { checkRateLimit, isValidEmail, normalizeEmail } from '../services/auth';
import { parseEnglishLevel } from '../constants/englishLevel';
import {
  sendAdminNewSubmissionEmail,
  sendSubmissionDecisionEmail,
  sendSubmissionReceivedEmail,
} from '../services/email';
import { loadSubmission, publishSubmission } from '../services/jobSubmissions';

const jobSubmissions = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

function normalizeUrl(raw: string | null | undefined): string | null | 'invalid' {
  const value = (raw || '').trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!['http:', 'https:'].includes(url.protocol)) return 'invalid';
    return url.toString();
  } catch {
    return 'invalid';
  }
}

const LOCATION_REQUIREMENTS = new Set([0, 1, 2, 3, 4]);
const SCHEDULE_TYPES = new Set(['全职', '兼职', '合同制', '实习']);
const PAY_CYCLES = new Set(['hour', 'day', 'week', 'month', 'year']);

jobSubmissions.post('/api/job-submissions', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    companyName?: string;
    companyWebsite?: string;
    title?: string;
    description?: string;
    applyUrl?: string;
    applyEmail?: string;
    locationText?: string;
    locationRequirement?: number;
    englishLevel?: string;
    scheduleType?: string;
    salaryText?: string;
    salaryLower?: number;
    salaryUpper?: number;
    salaryPayCycle?: string;
    contactEmail?: string;
    turnstileToken?: string;
  }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const companyName = (body.companyName || '').trim();
  const title = (body.title || '').trim();
  const description = (body.description || '').trim();
  if (companyName.length < 2 || companyName.length > 120) return c.json({ error: '请填写公司名称' }, 400);
  if (title.length < 2 || title.length > 120) return c.json({ error: '请填写职位名称' }, 400);
  if (description.length < 50) return c.json({ error: '职位描述至少 50 个字符，请补充职责与要求' }, 400);
  if (description.length > 8000) return c.json({ error: '职位描述过长' }, 400);

  const companyWebsite = normalizeUrl(body.companyWebsite);
  if (companyWebsite === 'invalid') return c.json({ error: '公司官网链接格式不正确' }, 400);
  const applyUrl = normalizeUrl(body.applyUrl);
  if (applyUrl === 'invalid') return c.json({ error: '申请链接格式不正确' }, 400);

  const applyEmailRaw = (body.applyEmail || '').trim();
  const applyEmail = applyEmailRaw ? normalizeEmail(applyEmailRaw) : null;
  if (applyEmail && !isValidEmail(applyEmail)) return c.json({ error: '申请邮箱格式不正确' }, 400);
  if (!applyUrl && !applyEmail) return c.json({ error: '请提供申请链接或申请邮箱' }, 400);

  const contactEmailRaw = (body.contactEmail || user?.email || '').trim();
  const contactEmail = contactEmailRaw ? normalizeEmail(contactEmailRaw) : '';
  if (!contactEmail || !isValidEmail(contactEmail)) return c.json({ error: '请填写有效的联系邮箱' }, 400);

  const locationText = (body.locationText || '').trim().slice(0, 120) || null;
  const locationRequirement = Number(body.locationRequirement ?? 0);
  if (!LOCATION_REQUIREMENTS.has(locationRequirement)) return c.json({ error: '地点要求无效' }, 400);
  const englishLevel = parseEnglishLevel(body.englishLevel);
  const scheduleType = (body.scheduleType || '').trim();
  if (scheduleType && !SCHEDULE_TYPES.has(scheduleType)) return c.json({ error: '工作类型无效' }, 400);
  const salaryText = (body.salaryText || '').trim().slice(0, 80) || null;
  const salaryLower = Math.max(0, Math.round(Number(body.salaryLower) || 0));
  const salaryUpper = Math.max(0, Math.round(Number(body.salaryUpper) || 0));
  if (salaryLower > 0 && salaryUpper > 0 && salaryLower > salaryUpper) return c.json({ error: '薪资下限不能高于上限' }, 400);
  const salaryPayCycle = PAY_CYCLES.has(body.salaryPayCycle || '') ? (body.salaryPayCycle as string) : 'month';

  const ip = clientIp(c);
  if (!user) {
    const turnstileOk = await verifyTurnstile(c.env, body.turnstileToken || '', ip);
    if (!turnstileOk) return c.json({ error: '人机验证失败' }, 400);
  }

  const allowed = await checkRateLimit(c.env.DB, `job-submit:${ip}`, 5, 60);
  if (!allowed) return c.json({ error: '提交过于频繁，请稍后再试' }, 429);

  const inserted = await c.env.DB.prepare(`
    INSERT INTO job_submissions
      (user_id, company_name, company_website, title, description, apply_url, apply_email, location_text,
       location_requirement, english_level, schedule_type, salary_text, salary_lower, salary_upper, salary_pay_cycle,
       contact_email, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    user?.id ?? null, companyName, companyWebsite, title, description, applyUrl, applyEmail, locationText,
    locationRequirement, englishLevel, scheduleType || null, salaryText, salaryLower, salaryUpper, salaryPayCycle,
    contactEmail, ip, c.req.header('User-Agent') || null,
  ).first<{ id: number }>();

  const submissionId = inserted?.id ?? 0;
  const info = { id: submissionId, title, company_name: companyName };

  const notify = async () => {
    await sendSubmissionReceivedEmail(c.env, contactEmail, info).catch(() => null);
    const admins = await c.env.DB.prepare("SELECT email FROM users WHERE role = 'admin'").all<{ email: string }>();
    for (const admin of admins.results || []) {
      await sendAdminNewSubmissionEmail(c.env, admin.email, { ...info, contact_email: contactEmail }).catch(() => null);
    }
  };
  c.executionCtx.waitUntil(notify());

  return c.json({ ok: true, id: submissionId });
});

jobSubmissions.post('/api/job-submissions/:id/approve', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效记录' }, 400);

  const body = await c.req.json<{
    searchTermId?: number;
    countryCode?: string | null;
    locationName?: string | null;
    locationNameCn?: string | null;
    adminNotes?: string | null;
  }>().catch(() => null);
  if (!body) return c.json({ error: '无效请求' }, 400);

  const searchTermId = Number(body.searchTermId);
  if (!Number.isFinite(searchTermId) || searchTermId <= 0) return c.json({ error: '请选择职位分类' }, 400);
  const term = await c.env.DB.prepare('SELECT id FROM search_terms WHERE id = ? AND is_active = 1').bind(searchTermId).first<{ id: number }>();
  if (!term) return c.json({ error: '职位分类不存在' }, 400);

  const submission = await loadSubmission(c.env, id);
  if (!submission) return c.json({ error: '记录不存在' }, 404);
  if (submission.status !== 'pending') return c.json({ error: '该投递已处理' }, 409);

  const countryCode = (body.countryCode || '').trim().toLowerCase() || null;
  const locationName = (body.locationName || '').trim() || null;
  const locationNameCn = (body.locationNameCn || '').trim() || null;

  const published = await publishSubmission(c.env, submission, { searchTermId, countryCode, locationName, locationNameCn });

  if (body.adminNotes !== undefined) {
    await c.env.DB.prepare('UPDATE job_submissions SET admin_notes = ? WHERE id = ?')
      .bind((body.adminNotes || '').trim() || null, id).run();
  }

  c.executionCtx.waitUntil(
    sendSubmissionDecisionEmail(c.env, submission.contact_email, {
      id: submission.id, title: submission.title, company_name: submission.company_name,
    }, true, { jobSlug: published.slug }).catch(() => null),
  );

  return c.json({ ok: true, jobId: published.jobId, slug: published.slug });
});

jobSubmissions.post('/api/job-submissions/:id/reject', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '请先登录' }, 401);
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403);

  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: '无效记录' }, 400);

  const body = await c.req.json<{ adminNotes?: string | null }>().catch(() => ({} as { adminNotes?: string | null }));
  const adminNotes = (body?.adminNotes || '').trim() || null;

  const submission = await loadSubmission(c.env, id);
  if (!submission) return c.json({ error: '记录不存在' }, 404);
  if (submission.status !== 'pending') return c.json({ error: '该投递已处理' }, 409);

  await c.env.DB.prepare(
    `UPDATE job_submissions SET status = 'rejected', admin_notes = ?, reviewed_at = datetime('now') WHERE id = ?`
  ).bind(adminNotes, id).run();

  c.executionCtx.waitUntil(
    sendSubmissionDecisionEmail(c.env, submission.contact_email, {
      id: submission.id, title: submission.title, company_name: submission.company_name,
    }, false, { adminNotes }).catch(() => null),
  );

  return c.json({ ok: true });
});

export default jobSubmissions;
