const workers = [
  ['narrator-worker', process.env.NARRATOR_WORKER_URL],
  ['asset-worker', process.env.ASSET_WORKER_URL],
  ['spatial-worker', process.env.SPATIAL_WORKER_URL],
  ['studio-worker', process.env.STUDIO_WORKER_URL],
];

let failed = false;

async function checkWorker(name, baseUrl) {
  if (!baseUrl) {
    console.error(`[FAIL] ${name} URL is missing`);
    failed = true;
    return;
  }

  const rootUrl = baseUrl.replace(/\/$/, '');
  const healthUrl = `${rootUrl}/healthz`;

  for (const url of [rootUrl, healthUrl]) {
    try {
      const response = await fetch(url, {
        headers: {
          'x-request-id': `worker-health-${Date.now()}`,
        },
      });

      if (!response.ok) {
        console.error(`[FAIL] ${name} ${url} returned ${response.status}`);
        failed = true;
        continue;
      }

      const text = await response.text();
      console.log(`[PASS] ${name} ${url} ${response.status} ${text.slice(0, 120)}`);
    } catch (error) {
      console.error(`[FAIL] ${name} ${url} ${error instanceof Error ? error.message : String(error)}`);
      failed = true;
    }
  }
}

for (const [name, url] of workers) {
  await checkWorker(name, url);
}

if (failed) process.exit(1);
console.log('[PASS] Worker health verification complete');
