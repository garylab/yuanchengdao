import { SerpApiJob, DecodedJobId } from '../types';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

export function decodeJobId(jobId: string): DecodedJobId | null {
  try {
    const json = atob(jobId);
    const parsed = JSON.parse(json) as {
      htidocid?: string;
      address_city?: string;
      gl?: string;
    };
    if (!parsed.htidocid) return null;
    return {
      htidocid: parsed.htidocid,
      address_city: parsed.address_city,
      gl: parsed.gl,
    };
  } catch {
    return null;
  }
}

export interface FetchBatchResult {
  jobs: SerpApiJob[];
  query: string;
  country: string;
  done: boolean;
}

export async function fetchOneQuery(
  apiKey: string,
  position: string,
  country: string,
  seenIds: Set<string>,
): Promise<SerpApiJob[]> {
  const query = `${position} remote`;
  const params = new URLSearchParams({
    engine: 'google_jobs',
    q: query,
    api_key: apiKey,
    gl: country,
    chips: 'date_posted:week',
    lr: 'lang_en',
    ltype: '1',
  });

  const response = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`SerpAPI error for "${query}" (${country}): ${response.status} - ${body.substring(0, 200)}`);
    if (response.status === 401 || response.status === 403) throw new Error('INVALID_KEY');
    if (response.status === 429) throw new Error('RATE_LIMIT');
    return [];
  }

  const data = await response.json() as { jobs_results?: SerpApiJob[] };
  const jobs = data.jobs_results || [];
  const newJobs: SerpApiJob[] = [];

  for (const job of jobs) {
    const decoded = decodeJobId(job.job_id);
    const dedup = decoded?.htidocid || job.job_id;
    if (dedup && !seenIds.has(dedup)) {
      seenIds.add(dedup);
      newJobs.push(job);
    }
  }

  return newJobs;
}
