import { Env } from '../types';
import { formatSalary } from '../utils/helpers';
import { sendSubscriptionAlertEmail, SubscriptionJobAlert } from './email';
import { sendTelegramDirectMessage } from './telegramDm';
import { jobMatchesSalaryRange } from '../constants/salary';
import { searchByVector } from './vectorSearch';
import { SubscriptionKind } from '../constants/subscriptions';

type NewJobRow = {
  id: number;
  slug: string;
  title: string;
  search_term_id: number | null;
  company_id: number | null;
  location_id: number | null;
  salary_lower: number;
  salary_upper: number;
  salary_currency: string;
  salary_pay_cycle: string;
  company_name: string | null;
  location_name_cn: string | null;
  country_name_cn: string | null;
};

type MatchingSubscription = {
  id: number;
  user_id: number;
  kind: SubscriptionKind;
  search_term_id: number | null;
  query_text: string | null;
  company_id: number | null;
  location_id: number | null;
  salary_range: string | null;
  notify_email: number;
  notify_telegram: number;
  email: string;
  telegram_chat_id: string | null;
};

export type SubscriptionChannel = 'email' | 'telegram';

export function jobMatchesSubscriptionFilters(
  subscription: { location_id: number | null; salary_range: string | null },
  job: { location_id: number | null; salary_lower: number; salary_upper: number },
): boolean {
  if (subscription.location_id != null && subscription.location_id !== job.location_id) return false;
  if (!jobMatchesSalaryRange(subscription.salary_range, job.salary_lower, job.salary_upper)) return false;
  return true;
}

async function keywordMatchIds(
  env: Env,
  queries: string[],
  candidateIds: Set<number>,
): Promise<Map<string, Set<number>>> {
  const result = new Map<string, Set<number>>();
  for (const query of queries) {
    try {
      const ids = await searchByVector(env.AI, env.VECTORIZE, query, 100);
      const hits = new Set<number>();
      for (const id of ids) if (candidateIds.has(id)) hits.add(id);
      result.set(query, hits);
    } catch (err) {
      console.error(`Keyword subscription search failed for "${query}":`, err instanceof Error ? err.message : err);
      result.set(query, new Set());
    }
  }
  return result;
}

export async function deliverSubscriptionAlerts(
  env: Env,
  channel: SubscriptionChannel,
): Promise<void> {
  const windowHours = channel === 'email' ? 24 : 1;
  const channelColumn = channel === 'email' ? 'email_delivered_at' : 'telegram_delivered_at';
  const notifyFlag = channel === 'email' ? 'notify_email' : 'notify_telegram';

  const idResult = await env.DB.prepare(
    `SELECT id FROM jobs WHERE created_at >= datetime('now', '-${windowHours} hours') ORDER BY created_at DESC`
  ).all<{ id: number }>();
  const jobIds = (idResult.results || []).map((row) => row.id);
  if (jobIds.length === 0) return;

  const jobsResult = await env.DB.prepare(`
    SELECT j.id, j.slug, j.title, j.search_term_id, j.company_id, j.location_id,
      j.salary_lower, j.salary_upper, j.salary_currency, j.salary_pay_cycle,
      co.name as company_name,
      lo.name_cn as location_name_cn,
      ct.name_cn as country_name_cn
    FROM jobs j
    LEFT JOIN companies co ON j.company_id = co.id
    LEFT JOIN locations lo ON j.location_id = lo.id
    LEFT JOIN countries ct ON j.country_id = ct.id
    WHERE j.id IN (${jobIds.join(',')})
  `).all<NewJobRow>();
  const jobs = (jobsResult.results || []) as NewJobRow[];
  if (jobs.length === 0) return;

  const termIds = [...new Set(jobs.map((j) => j.search_term_id).filter((v): v is number => v != null))];
  const companyIds = [...new Set(jobs.map((j) => j.company_id).filter((v): v is number => v != null))];

  const conditions: string[] = [];
  if (termIds.length > 0) conditions.push(`(s.kind = 'category' AND s.search_term_id IN (${termIds.join(',')}))`);
  if (companyIds.length > 0) conditions.push(`(s.kind = 'company' AND s.company_id IN (${companyIds.join(',')}))`);
  conditions.push(`(s.kind = 'keyword' AND s.query_text IS NOT NULL AND s.query_text != '')`);

  const subscriptionsResult = await env.DB.prepare(`
    SELECT s.id, s.user_id, s.kind, s.search_term_id, s.query_text, s.company_id, s.location_id, s.salary_range,
      s.notify_email, s.notify_telegram,
      u.email, u.telegram_chat_id
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.${notifyFlag} = 1 AND (${conditions.join(' OR ')})
  `).all<MatchingSubscription>();
  const subscriptions = (subscriptionsResult.results || []) as MatchingSubscription[];
  if (subscriptions.length === 0) return;

  const keywordQueries = [...new Set(
    subscriptions.filter((s) => s.kind === 'keyword').map((s) => (s.query_text || '').trim()).filter(Boolean),
  )];
  const keywordHits = keywordQueries.length > 0
    ? await keywordMatchIds(env, keywordQueries, new Set(jobs.map((j) => j.id)))
    : new Map<string, Set<number>>();

  type PendingDelivery = { subscription: MatchingSubscription; job: NewJobRow };
  const pending: PendingDelivery[] = [];
  for (const job of jobs) {
    for (const subscription of subscriptions) {
      if (channel === 'telegram' && !subscription.telegram_chat_id) continue;

      let baseMatch = false;
      if (subscription.kind === 'category') {
        baseMatch = subscription.search_term_id != null && subscription.search_term_id === job.search_term_id;
      } else if (subscription.kind === 'company') {
        baseMatch = subscription.company_id != null && subscription.company_id === job.company_id;
      } else if (subscription.kind === 'keyword') {
        const hits = keywordHits.get((subscription.query_text || '').trim());
        baseMatch = !!hits && hits.has(job.id);
      }
      if (!baseMatch) continue;
      if (!jobMatchesSubscriptionFilters(subscription, job)) continue;
      pending.push({ subscription, job });
    }
  }

  if (pending.length === 0) return;

  // Claim atomically so an at-least-once cron delivery never sends the same
  // (subscription, job, channel) twice. The row is inserted with the channel
  // timestamp set; if the row already exists we only flip the timestamp when
  // it was NULL. RETURNING id tells us which pairs we actually won.
  const claimed: PendingDelivery[] = [];
  for (const item of pending) {
    const result = await env.DB.prepare(
      `INSERT INTO subscription_deliveries (subscription_id, job_id, ${channelColumn})
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(subscription_id, job_id) DO UPDATE
         SET ${channelColumn} = excluded.${channelColumn}
         WHERE subscription_deliveries.${channelColumn} IS NULL
       RETURNING id`
    ).bind(item.subscription.id, item.job.id).first<{ id: number }>();
    if (result) claimed.push(item);
  }

  if (claimed.length === 0) return;

  const byUser = new Map<number, {
    email: string;
    telegramChatId: string | null;
    jobs: Map<number, NewJobRow>;
  }>();

  for (const item of claimed) {
    let bucket = byUser.get(item.subscription.user_id);
    if (!bucket) {
      bucket = {
        email: item.subscription.email,
        telegramChatId: item.subscription.telegram_chat_id,
        jobs: new Map(),
      };
      byUser.set(item.subscription.user_id, bucket);
    }
    bucket.jobs.set(item.job.id, item.job);
  }

  const runDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const [userId, bucket] of byUser) {
    const alertJobs: SubscriptionJobAlert[] = [...bucket.jobs.values()].map((job) => toAlertJob(job));

    if (channel === 'email' && bucket.email) {
      await sendSubscriptionAlertEmail(env, bucket.email, alertJobs, `sub-digest-${userId}-${runDate}`);
    } else if (channel === 'telegram' && bucket.telegramChatId) {
      await sendTelegramDirectMessage(env, bucket.telegramChatId, buildTelegramAlert(env, alertJobs));
    }
  }
}

export function toAlertJob(job: {
  title: string; slug: string; company_name: string | null;
  location_name_cn: string | null; country_name_cn: string | null;
  salary_lower: number; salary_upper: number; salary_currency: string; salary_pay_cycle: string;
}): SubscriptionJobAlert {
  const locationLabel = [job.location_name_cn, job.country_name_cn]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(', ') || '远程';
  return {
    title: job.title,
    companyName: job.company_name || '',
    locationLabel,
    slug: job.slug,
    salaryLabel: formatSalary(job.salary_lower, job.salary_upper, job.salary_currency, job.salary_pay_cycle) || '',
  };
}

export function buildTelegramAlert(env: Env, jobs: SubscriptionJobAlert[], heading?: string): string {
  const baseUrl = env.SITE_URL.replace(/\/$/, '');
  const lines = jobs.map((job) => {
    const url = `${baseUrl}/job/${encodeURIComponent(job.slug)}?utm_source=telegram&utm_medium=subscription`;
    return `<a href="${escapeTelegram(url)}"><b>${escapeTelegram(job.title)}</b></a>\n${escapeTelegram(job.companyName)} · ${escapeTelegram(job.locationLabel)}${job.salaryLabel ? ` · ${escapeTelegram(job.salaryLabel)}` : ''}`;
  });
  return heading ? `${heading}\n\n${lines.join('\n\n')}` : lines.join('\n\n');
}

export function escapeTelegram(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
