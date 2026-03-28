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

const REMOTE_LOCATION_PATTERNS = /\banywhere\b|\bremote\b|\bwork from home\b/i;

function isRemoteJob(job: SerpApiJob): boolean {
  if (job.detected_extensions?.work_from_home === true) return true;

  if (job.extensions?.some(ext => /work from home/i.test(ext))) return true;

  if (REMOTE_LOCATION_PATTERNS.test(job.location || '')) return true;

  return false;
}

interface SerpApiFilter {
  name: string;
  uds?: string;
  q?: string;
  options?: Array<{ name: string; uds?: string; q?: string }>;
}

interface SerpApiResponse {
  jobs_results?: SerpApiJob[];
  filters?: SerpApiFilter[];
}

function findRemoteUds(filters: SerpApiFilter[] | undefined): string | null {
  if (!filters) return null;
  for (const f of filters) {
    if (/remote|work from home/i.test(f.name) && f.uds) return f.uds;
    if (f.options) {
      for (const opt of f.options) {
        if (/remote|work from home/i.test(opt.name) && opt.uds) return opt.uds;
      }
    }
  }
  return null;
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
    ltype: '1',
  });

  const data = await fetchSerpApi(params, query, country);
  if (!data) return [];

  const remoteUds = findRemoteUds(data.filters);
  let jobs = data.jobs_results || [];

  if (remoteUds) {
    params.set('uds', remoteUds);
    params.delete('ltype');
    const filtered = await fetchSerpApi(params, query, country);
    if (filtered?.jobs_results?.length) {
      jobs = filtered.jobs_results;
      console.log(`  Using uds remote filter, got ${jobs.length} jobs`);
    }
  }

  const newJobs: SerpApiJob[] = [];
  let skippedNonRemote = 0;

  for (const job of jobs) {
    const decoded = decodeJobId(job.job_id);
    const dedup = decoded?.htidocid || job.job_id;
    if (!dedup || seenIds.has(dedup)) continue;
    seenIds.add(dedup);

    if (!isRemoteJob(job)) {
      skippedNonRemote++;
      continue;
    }

    newJobs.push(job);
  }

  if (skippedNonRemote > 0) {
    console.log(`  Filtered out ${skippedNonRemote} non-remote jobs`);
  }

  return newJobs;
}

async function fetchSerpApi(
  params: URLSearchParams,
  query: string,
  country: string,
): Promise<SerpApiResponse | null> {
  const response = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`SerpAPI error for "${query}" (${country}): ${response.status} - ${body.substring(0, 200)}`);
    if (response.status === 401 || response.status === 403) throw new Error('INVALID_KEY');
    if (response.status === 429) throw new Error('RATE_LIMIT');
    return null;
  }
  return response.json() as Promise<SerpApiResponse>;
}
