import { Env } from '../types';
import {
  formatEnglishLevelPlainText,
  formatLocationRequirementPlainText,
  formatSalary,
} from '../utils/helpers';

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

type FeishuRichTextNode =
  | { tag: 'text'; text: string }
  | { tag: 'a'; text: string; href: string };

export async function postNewJobToFeishu(
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
  const webhookUrl = env.FEISHU_BOT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const baseUrl = env.SITE_URL.replace(/\/$/, '');
  const jobUrlObject = new URL(`${baseUrl}/job/${encodeURIComponent(payload.slug)}`);
  jobUrlObject.searchParams.set('utm_source', 'feishu');
  jobUrlObject.searchParams.set('utm_medium', 'social');
  jobUrlObject.searchParams.set('utm_campaign', 'feishu_job_alert');
  const jobUrl = jobUrlObject.toString();

  const place = formatLocationLine(
    payload.locationNameCn,
    payload.countryNameCn,
    payload.countryFlagEmoji,
  );
  const salaryLine = formatSalary(
    payload.salaryLower,
    payload.salaryUpper,
    payload.salaryCurrency,
    payload.salaryPayCycle,
  );
  const locationRequirementLine = formatLocationRequirementPlainText(payload.locationRequirement);
  const englishRequirementLine = formatEnglishLevelPlainText(payload.englishLevelRequired);

  const paragraphs: FeishuRichTextNode[][] = [
    [{ tag: 'a', text: payload.titleZh, href: jobUrl }],
    [{ tag: 'text', text: `公司：${payload.companyName}` }],
    [{ tag: 'text', text: `地点：${place}` }],
  ];
  if (locationRequirementLine) {
    paragraphs.push([{ tag: 'text', text: `限制：${locationRequirementLine}` }]);
  }
  if (englishRequirementLine) {
    paragraphs.push([{ tag: 'text', text: `英语：${englishRequirementLine}` }]);
  }
  if (salaryLine) {
    paragraphs.push([{ tag: 'text', text: `薪资：${salaryLine}` }]);
  }

  const body = {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: '',
          content: paragraphs,
        },
      },
    },
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Feishu webhook failed: ${response.status} ${errorText}`);
  }
}

type JobFeishuRow = {
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

export async function postHourlyFeishuDigest(env: Env): Promise<void> {
  const webhookUrl = env.FEISHU_BOT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const idResult = await env.DB.prepare(
    `SELECT id FROM jobs WHERE created_at >= datetime('now', '-1 hour') AND salary_upper > 0 AND location_requirement = 0 ORDER BY created_at DESC`
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
  `).all<JobFeishuRow>();

  const rows = [...(hydrated.results || [])] as JobFeishuRow[];
  const order = new Map(jobIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  for (const row of rows) {
    await postNewJobToFeishu(env, {
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
