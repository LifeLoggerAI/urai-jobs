const workers = [
  ['narrator-worker', process.env.NARRATOR_WORKER_URL],
  ['asset-worker', process.env.ASSET_WORKER_URL],
  ['spatial-worker', process.env.SPATIAL_WORKER_URL],
  ['studio-worker', process.env.STUDIO_WORKER_URL],
];

let failed = false;

async function fetchEndpoint(name, url) {
  try {
    const response = await fetch(url, {
      headers: {
        'x-request-id': `worker-health-${Date.now()}`,
      },
    });

    const text = await response.text();

    if (response.ok) {
      console.log(`[PASS] ${name} ${url} ${response.status} ${text.slice(0, 120)}`);
      return { reachable: true, healthy: true };
    }

    if (response.status === 404 && /Cannot GET/.test(text)) {
      console.log(`[WARN] ${name} ${url} reachable but route is not exposed (${response.status})`);
      return { reachable: true, healthy: false };
    }

    console.error(`[FAIL] ${name} ${url} returned ${response.status}: ${text.slice(0, 120)}`);
    return { reachable: false, healthy: false };
  } catch (error) {
    console.error(`[FAIL] ${name} ${url} ${error instanceof Error ? error.message : String(error)}`);
    return { reachable: false, healthy: false };
  }
}

async function checkWorker(name, baseUrl) {
  if (!baseUrl) {
    console.error(`[FAIL] ${name} URL is missing`);
    failed = true;
    return;
  }

  const rootUrl = baseUrl.replace(/\/$/, '');
  const healthUrl = `${rootUrl}/healthz`;

  const root = await fetchEndpoint(name, rootUrl);
  const health = await fetchEndpoint(name, healthUrl);

  if (!root.reachable && !health.reachable) {
    console.error(`[FAIL] ${name} is not reachable on root or /healthz`);
    failed = true;
    return;
  }

  if (!root.healthy && !health.healthy) {
    console.log(`[WARN] ${name} is reachable but does not expose a health route yet`);
  }
}

for (const [name, url] of workers) {
  await checkWorker(name, url);
}

if (failed) process.exit(1);
console.log('[PASS] Worker reachability verification complete');
