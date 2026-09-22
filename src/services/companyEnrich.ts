import OpenAI from 'openai';
import { Env } from '../types';

const AGGREGATOR_HOSTS = [
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com', 'simplyhired.com',
  'careerbuilder.com', 'dice.com', 'wellfound.com', 'angel.co', 'remoteok.com', 'remote.co', 'weworkremotely.com',
  'jobs.lever.co', 'lever.co', 'greenhouse.io', 'boards.greenhouse.io', 'workable.com', 'apply.workable.com',
  'ashbyhq.com', 'jobs.ashbyhq.com', 'smartrecruiters.com', 'bamboohr.com', 'myworkdayjobs.com', 'workday.com',
  'icims.com', 'jobvite.com', 'recruitee.com', 'breezy.hr', 'applytojob.com', 'rippling.com', 'ats.rippling.com',
  'teamtailor.com', 'personio.de', 'jobs.personio.com', 'join.com', 'welcometothejungle.com', 'otta.com',
  'himalayas.app', 'remotive.com', 'jobgether.com', 'adzuna.com', 'talent.com', 'jooble.org', 'neuvoo.com',
  'stepstone.de', 'xing.com', 'seek.com.au', 'jobstreet.com', 'reed.co.uk', 'totaljobs.com', 'cv-library.co.uk',
  'hellowork.com', 'apec.fr', 'infojobs.net', 'catho.com.br', 'vagas.com.br', 'jobindex.dk', 'bayt.com',
  'naukri.com', 'foundit.in', 'google.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'jobs.jobvite.com', 'workatastartup.com', 'ycombinator.com', 'builtin.com', 'nodesk.co', 'dailyremote.com',
  'jobspresso.co', 'flexjobs.com', 'upwork.com', 'freelancer.com', 'toptal.com',
];

const AGGREGATOR_LABELS = new Set([
  'indeed', 'glassdoor', 'linkedin', 'ziprecruiter', 'monster', 'careerjet', 'adzuna', 'jooble', 'jobrapido',
  'jobleads', 'lensa', 'whatjobs', 'talent', 'neuvoo', 'jobtome', 'trabajo', 'jobijoba', 'jobg8', 'jobisjob',
  'simplyhired', 'careerbuilder', 'dice', 'wellfound', 'remoteok', 'weworkremotely', 'remotive', 'himalayas',
  'jobgether', 'stepstone', 'xing', 'seek', 'jobstreet', 'reed', 'totaljobs', 'hellowork', 'apec', 'infojobs',
  'catho', 'vagas', 'jobindex', 'bayt', 'naukri', 'foundit', 'builtin', 'nodesk', 'dailyremote', 'jobspresso',
  'flexjobs', 'upwork', 'freelancer', 'toptal', 'learn4good', 'laimoon', 'snagajob', 'talentify', 'jobbank',
  'workopolis', 'eluta', 'jobboom', 'jobrapido', 'jobsora', 'jobatus', 'mitula', 'trovit', 'nuevoo', 'jobted',
  'jobkralle', 'kimeta', 'jobware', 'stellenanzeigen', 'meinestadt', 'ofertas-empleo', 'tecnoempleo',
  'remoterocketship', 'remotehub', 'workingnomads', 'europeremotely', 'justremote',
  'remotewoman', 'powertofly', 'otta', 'welcometothejungle',
  'facebook', 'twitter', 'instagram', 'google', 'youtube', 'tiktok',
]);

function hostMatches(host: string, pattern: string): boolean {
  return host === pattern || host.endsWith(`.${pattern}`);
}

function splitRegistrable(host: string): { label: string; root: string } {
  const labels = host.split('.');
  // Treat two-part public suffixes like co.uk / com.br / com.au as one TLD.
  const idx = labels.length >= 3 && labels[labels.length - 2].length <= 3
    ? labels.length - 3
    : Math.max(0, labels.length - 2);
  return { label: labels[idx], root: labels.slice(idx).join('.') };
}

function looksLikeAggregator(host: string): boolean {
  if (AGGREGATOR_HOSTS.some((p) => hostMatches(host, p))) return true;
  return AGGREGATOR_LABELS.has(splitRegistrable(host).label);
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function domainMatchesCompany(label: string, companyName: string): boolean {
  const domain = compactName(label);
  const full = compactName(companyName);
  if (!domain || !full) return false;
  if (domain === full) return true;
  if (domain.length >= 4 && (full.includes(domain) || domain.includes(full))) return true;
  // First word of the company name (e.g. "Acme" in "Acme Robotics Inc")
  const firstWord = compactName(companyName.split(/[\s,|/-]+/)[0] || '');
  return firstWord.length >= 4 && domain === firstWord;
}

export function guessCompanyWebsite(applyOptionsJson: string | null | undefined, companyName?: string | null): string | null {
  if (!applyOptionsJson) return null;
  let options: Array<{ title?: string; link?: string }>;
  try {
    options = JSON.parse(applyOptionsJson);
  } catch {
    return null;
  }
  if (!Array.isArray(options)) return null;
  for (const opt of options) {
    if (!opt?.link) continue;
    try {
      const url = new URL(opt.link);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (looksLikeAggregator(host)) continue;
      const { label, root } = splitRegistrable(host);
      if (!companyName || !domainMatchesCompany(label, companyName)) continue;
      return `https://${root}`;
    } catch {
      continue;
    }
  }
  return null;
}

type EnrichCandidate = { id: number; name: string; website: string | null };

export async function enrichCompanies(env: Env, limit = 1): Promise<number> {
  if (!env.OPENAI_API_KEY) return 0;

  const candidates = await env.DB.prepare(
    `SELECT id, name, website FROM companies
     WHERE description IS NULL AND enriched_at IS NULL AND job_count >= 2
     ORDER BY job_count DESC, id ASC
     LIMIT ?`
  ).bind(limit).all<EnrichCandidate>();
  const rows = candidates.results || [];
  if (rows.length === 0) return 0;

  const defaultHeaders: Record<string, string> = {};
  if (env.CF_AIG_TOKEN) defaultHeaders['cf-aig-authorization'] = `Bearer ${env.CF_AIG_TOKEN}`;
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    defaultHeaders,
  });

  let done = 0;
  for (const company of rows) {
    const jobs = await env.DB.prepare(
      `SELECT title, substr(description, 1, 600) as excerpt, apply_options
       FROM jobs WHERE company_id = ? ORDER BY created_at DESC LIMIT 3`
    ).bind(company.id).all<{ title: string; excerpt: string; apply_options: string | null }>();
    const jobRows = jobs.results || [];

    let website = company.website;
    if (!website) {
      for (const j of jobRows) {
        website = guessCompanyWebsite(j.apply_options, company.name);
        if (website) break;
      }
    }

    const prompt = `你是一名招聘网站的编辑。根据以下某公司在招的远程职位信息，用简体中文写一段 1-3 句、不超过 100 字的公司简介。

严格要求：
- 只写职位内容里能直接看出来的事实：做什么产品/服务、面向什么客户或行业、团队工作方式（如全远程、跨时区）。
- 禁止任何评价性或宣传性词语：领先、知名、顶尖、致力于、创新、改变、赋能、优秀、专业 等一律不要。
- 不要出现"我们"；不要编造成立时间、规模、融资、总部。
- 如果职位内容看不出公司具体业务（例如只是招聘中介、职位描述很泛），返回空字符串 ""。

公司名称：${company.name}
${website ? `官网（推测）：${website}` : ''}

在招职位：
${jobRows.map((j, i) => `${i + 1}. ${j.title}\n${j.excerpt}`).join('\n\n')}

只返回 JSON：{"description_zh": "..."}`;

    let description: string | null = null;
    try {
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as { description_zh?: string };
      const text = (parsed.description_zh || '').trim();
      description = text.length >= 10 ? text.slice(0, 400) : null;
    } catch (err) {
      console.error(`Company enrich failed for ${company.name}:`, err instanceof Error ? err.message : err);
    }

    await env.DB.prepare(
      `UPDATE companies
       SET description = COALESCE(?, description),
           website = COALESCE(website, ?),
           enriched_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(description, website, company.id).run();
    done++;
  }
  return done;
}
