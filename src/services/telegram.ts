import { Env } from '../types';
import {
  formatEnglishLevelPlainText,
  formatLocationRequirementPlainText,
  formatSalary,
} from '../utils/helpers';

function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatLocationLine(
  locationNameCn: string,
  countryNameCn: string,
  countryFlagEmoji: string,
): string {
  const parts = [locationNameCn, countryNameCn]
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  const label = parts.length > 0 ? parts.join(', ') : '全球';
  const flag = countryFlagEmoji.trim() || '🌍';
  return `${flag} ${label}`;
}

export async function postNewJobToTelegram(
  env: Env,
  payload: {
    titleZh: string;
    companyName: string;
    locationNameCn: string;
    countryNameCn: string;
    countryFlagEmoji: string;
    slug: string;
    salaryLower: number;
    salaryUpper: number;
    salaryCurrency: string;
    salaryPayCycle: string;
    locationRequirement: number;
    englishLevelRequired: string;
  },
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const chatId = env.TELEGRAM_CHANNEL_CHAT_ID ?? '@yuanchengdao';
  const baseUrl = env.SITE_URL.replace(/\/$/, '');
  const jobUrlObject = new URL(`${baseUrl}/job/${encodeURIComponent(payload.slug)}`);
  jobUrlObject.searchParams.set('utm_source', 'telegram');
  jobUrlObject.searchParams.set('utm_medium', 'social');
  jobUrlObject.searchParams.set('utm_campaign', 'telegram_job_alert');
  const jobUrl = jobUrlObject.toString();

  const title = escapeTelegramHtml(payload.titleZh);
  const jobUrlEscaped = escapeTelegramHtml(jobUrl);
  const company = escapeTelegramHtml(payload.companyName);
  const place = escapeTelegramHtml(
    formatLocationLine(payload.locationNameCn, payload.countryNameCn, payload.countryFlagEmoji),
  );
  const salaryLine = formatSalary(
    payload.salaryLower,
    payload.salaryUpper,
    payload.salaryCurrency,
    payload.salaryPayCycle,
  );

  const locationRequirementLine = formatLocationRequirementPlainText(payload.locationRequirement);
  const englishRequirementLine = formatEnglishLevelPlainText(payload.englishLevelRequired);

  const lines = [
    `<a href="${jobUrlEscaped}"><b>${title}</b></a>`,
    `公司：${company}`,
    `地点：${place}`,
  ];
  if (locationRequirementLine) {
    lines.push(`限制：${escapeTelegramHtml(locationRequirementLine)}`);
  }
  if (englishRequirementLine) {
    lines.push(`英语：${escapeTelegramHtml(englishRequirementLine)}`);
  }
  if (salaryLine) {
    lines.push(`薪资：${escapeTelegramHtml(salaryLine)}`);
  }

  const text = lines.join('\n');

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
    console.error(`Telegram sendMessage failed: ${response.status} ${errText}`);
  }
}

type JobTelegramRow = {
  id: number;
  slug: string;
  title: string;
  salary_lower: number;
  salary_upper: number;
  salary_currency: string;
  salary_pay_cycle: string;
  company_name: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
  country_flag_emoji: string | null;
  location_requirement: number;
  english_level_required: string;
};

export async function postHourlyTelegramDigest(env: Env): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const idResult = await env.DB.prepare(
    `SELECT id FROM jobs WHERE created_at >= datetime('now', '-1 hour') ORDER BY created_at DESC`
  ).all<{ id: number }>();
  const jobIds = (idResult.results || []).map((row) => row.id);
  if (jobIds.length === 0) return;

  const placeholders = jobIds.join(',');
  const hydrated = await env.DB.prepare(`
    SELECT j.id, j.slug, j.title, j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle,
      j.location_requirement, j.english_level_required,
      co.name as company_name,
      lo.name_cn as location_name_cn,
      ct.name_cn as country_name_cn,
      ct.flag_emoji as country_flag_emoji
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE j.id IN (${placeholders})
  `).all<JobTelegramRow>();

  const rows = [...(hydrated.results || [])] as JobTelegramRow[];
  const order = new Map(jobIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  for (const row of rows) {
    await postNewJobToTelegram(env, {
      titleZh: row.title,
      companyName: row.company_name ?? '',
      locationNameCn: row.location_name_cn ?? '',
      countryNameCn: row.country_name_cn ?? '',
      countryFlagEmoji: row.country_flag_emoji ?? '',
      slug: row.slug,
      salaryLower: row.salary_lower,
      salaryUpper: row.salary_upper,
      salaryCurrency: row.salary_currency,
      salaryPayCycle: row.salary_pay_cycle,
      locationRequirement: row.location_requirement,
      englishLevelRequired: row.english_level_required,
    });
  }
}
