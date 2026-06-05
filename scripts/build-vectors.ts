import { readFileSync, writeFileSync, unlinkSync } from 'fs';

const SITE_URL = process.env.SITE_URL || 'https://yuanchengdao.com';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const BATCH_SIZE = 100;
const DELAY_MS = 1000;
const MAX_RETRIES = 5;
const PROGRESS_FILE = '.vectors-progress';

interface BuildResponse {
  processed: number;
  offset: number;
  nextOffset: number;
  total: number;
  done: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress(): number {
  try {
    return parseInt(readFileSync(PROGRESS_FILE, 'utf-8').trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function saveProgress(offset: number): void {
  writeFileSync(PROGRESS_FILE, String(offset));
}

function clearProgress(): void {
  try { unlinkSync(PROGRESS_FILE); } catch {}
}

async function callWithRetry(offset: number): Promise<BuildResponse> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${SITE_URL}/api/build-vectors`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset, batchSize: BATCH_SIZE }),
    });

    if (response.ok) {
      return (await response.json()) as BuildResponse;
    }

    const body = await response.text();

    if (attempt === MAX_RETRIES) {
      throw new Error(`API error ${response.status} after ${MAX_RETRIES} retries (offset=${offset}): ${body.slice(0, 300)}`);
    }

    const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
    console.warn(`  Retry ${attempt}/${MAX_RETRIES} after ${response.status} (waiting ${backoff}ms)...`);
    await sleep(backoff);
  }
  throw new Error('unreachable');
}

async function buildRemote() {
  if (!AUTH_TOKEN) {
    console.error('Set AUTH_TOKEN env var (same value as SERPAPI_KEY)');
    process.exit(1);
  }

  const startOffset = loadProgress();
  if (startOffset > 0) {
    console.log(`Resuming from offset ${startOffset} (progress file: ${PROGRESS_FILE})`);
  }
  console.log(`Building vectors via ${SITE_URL}/api/build-vectors ...`);

  let offset = startOffset;
  let done = false;
  let totalVectorized = 0;

  while (!done) {
    const data = await callWithRetry(offset);
    totalVectorized += data.processed;
    offset = data.nextOffset;
    done = data.done;

    saveProgress(offset);
    console.log(`  Vectorized ${offset}/${data.total}`);

    if (!done) await sleep(DELAY_MS);
  }

  clearProgress();
  console.log(`Done — vectorized ${totalVectorized} jobs`);
}

buildRemote();
