import { Env } from '../types';
import { formatSalary } from '../utils/helpers';
import { sendSubscriptionAlertEmail, SubscriptionJobAlert } from './email';
import { sendTelegramDirectMessage } from './telegramDm';

type NewJobRow = {
  id: number;
  slug: string;
  title: string;
  search_term_id: number | null;
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
  notify_email: number;
  notify_telegram: number;
  email: string;
  telegram_chat_id: string | null;
  search_term_id: number;
  location_id: number | null;
};

export type SubscriptionChannel = 'email' | 'telegram';

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
    SELECT j.id, j.slug, j.title, j.search_term_id, j.location_id,
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
  const jobsWithTerm = jobs.filter((job) => job.search_term_id != null);
  if (jobsWithTerm.length === 0) return;

  const searchTermIds = [...new Set(jobsWithTerm.map((job) => job.search_term_id as number))];
  const subscriptionIdResult = await env.DB.prepare(
    `SELECT id FROM subscriptions
     WHERE search_term_id IN (${searchTermIds.join(',')})
       AND ${notifyFlag} = 1`
  ).all<{ id: number }>();
  const subscriptionIds = (subscriptionIdResult.results || []).map((row) => row.id);
  if (subscriptionIds.length === 0) return;

  const subscriptionsResult = await env.DB.prepare(`
    SELECT s.id, s.user_id, s.search_term_id, s.location_id, s.notify_email, s.notify_telegram,
      u.email, u.telegram_chat_id
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id IN (${subscriptionIds.join(',')})
  `).all<MatchingSubscription>();

  const subscriptions = (subscriptionsResult.results || []) as MatchingSubscription[];

  const deliveredResult = await env.DB.prepare(
    `SELECT subscription_id, job_id FROM subscription_deliveries
     WHERE subscription_id IN (${subscriptionIds.join(',')})
       AND job_id IN (${jobIds.join(',')})
       AND ${channelColumn} IS NOT NULL`
  ).all<{ subscription_id: number; job_id: number }>();
  const deliveredSet = new Set(
    (deliveredResult.results || []).map((row) => `${row.subscription_id}:${row.job_id}`),
  );

  type PendingDelivery = {
    subscription: MatchingSubscription;
    job: NewJobRow;
  };

  const pending: PendingDelivery[] = [];
  for (const job of jobsWithTerm) {
    for (const subscription of subscriptions) {
      if (subscription.search_term_id !== job.search_term_id) continue;
      if (subscription.location_id != null && subscription.location_id !== job.location_id) continue;
      if (deliveredSet.has(`${subscription.id}:${job.id}`)) continue;
      if (channel === 'telegram' && !subscription.telegram_chat_id) continue;
      pending.push({ subscription, job });
    }
  }

  if (pending.length === 0) return;

  const byUser = new Map<number, {
    email: string;
    telegramChatId: string | null;
    jobs: Map<number, NewJobRow>;
    subscriptionJobPairs: Array<{ subscriptionId: number; jobId: number }>;
  }>();

  for (const item of pending) {
    let bucket = byUser.get(item.subscription.user_id);
    if (!bucket) {
      bucket = {
        email: item.subscription.email,
        telegramChatId: item.subscription.telegram_chat_id,
        jobs: new Map(),
        subscriptionJobPairs: [],
      };
      byUser.set(item.subscription.user_id, bucket);
    }
    bucket.jobs.set(item.job.id, item.job);
    bucket.subscriptionJobPairs.push({
      subscriptionId: item.subscription.id,
      jobId: item.job.id,
    });
  }

  const deliveryStatements = [];

  for (const [, bucket] of byUser) {
    const alertJobs: SubscriptionJobAlert[] = [...bucket.jobs.values()].map((job) => {
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
    });

    if (channel === 'email' && bucket.email) {
      await sendSubscriptionAlertEmail(env, bucket.email, alertJobs);
    } else if (channel === 'telegram' && bucket.telegramChatId) {
      const baseUrl = env.SITE_URL.replace(/\/$/, '');
      const lines = alertJobs.map((job) => {
        const url = `${baseUrl}/job/${encodeURIComponent(job.slug)}?utm_source=telegram&utm_medium=subscription`;
        return `<a href="${escapeTelegram(url)}"><b>${escapeTelegram(job.title)}</b></a>\n${escapeTelegram(job.companyName)} · ${escapeTelegram(job.locationLabel)}`;
      });
      await sendTelegramDirectMessage(
        env,
        bucket.telegramChatId,
        `远程岛订阅提醒\n\n${lines.join('\n\n')}`,
      );
    }

    for (const pair of bucket.subscriptionJobPairs) {
      deliveryStatements.push(
        env.DB.prepare(
          `INSERT INTO subscription_deliveries (subscription_id, job_id, ${channelColumn})
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(subscription_id, job_id) DO UPDATE SET ${channelColumn} = datetime('now')`
        ).bind(pair.subscriptionId, pair.jobId),
      );
    }
  }

  if (deliveryStatements.length > 0) {
    const chunkSize = 50;
    for (let index = 0; index < deliveryStatements.length; index += chunkSize) {
      await env.DB.batch(deliveryStatements.slice(index, index + chunkSize));
    }
  }
}

function escapeTelegram(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
