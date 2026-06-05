const SITE_URL = process.env.SITE_URL || 'https://yuanchengdao.com';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const BATCH_SIZE = 100;
const DELAY_MS = 500;

interface BuildResponse {
  processed: number;
  offset: number;
  nextOffset: number;
  total: number;
  done: boolean;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildRemote() {
  if (!AUTH_TOKEN) {
    console.error('Set AUTH_TOKEN env var (same value as SERPAPI_KEY in .dev.vars or Cloudflare secrets)');
    process.exit(1);
  }

  console.log(`Building vectors via ${SITE_URL}/api/build-vectors ...`);

  let offset = 0;
  let done = false;
  let totalVectorized = 0;

  while (!done) {
    const response = await fetch(`${SITE_URL}/api/build-vectors`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset, batchSize: BATCH_SIZE }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as BuildResponse;
    totalVectorized += data.processed;
    offset = data.nextOffset;
    done = data.done;

    console.log(`  Vectorized ${totalVectorized}/${data.total}`);

    if (!done) await sleep(DELAY_MS);
  }

  console.log(`Done — vectorized ${totalVectorized} jobs`);
}

buildRemote();
