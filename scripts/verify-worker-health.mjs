const requiredWorkers = [
  ['narrator-worker', process.env.NARRATOR_WORKER_URL],
  ['asset-worker', process.env.ASSET_WORKER_URL],
];
const optionalWorkers = [
  ['spatial-worker', process.env.SPATIAL_WORKER_URL],
  ['studio-worker', process.env.STUDIO_WORKER_URL],
].filter(([, url]) => Boolean(url));

let failed = false;

async function fetchEndpoint(name, url, options = {}) {
  const { optional = false } = options;
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'x-request-id': `worker-health-${Date.now()}` },
    });
    const text = await response.text();
    if (response.ok) {
      console.log(`[PASS] ${name} ${url} ${response.status} ${text.slice(0, 120)}`);
      return { reachable: true, healthy: true };
    }
    if (optional && response.status === 404) {
      console.log(`[WARN] ${name} optional endpoint ${url} is not exposed (${response.status})`);
      return { reachable: true, healthy: false };
    }
    if (response.status === 404 && /Cannot GET/.test(text)) {
      console.log(`[WARN] ${name} ${url} reachable but route is not exposed (${response.status})`);
      return { reachable: true, healthy: false };
    }
    console.error(`[FAIL] ${name} ${url} returned ${response.status}: ${text.slice(0, 120)}`);
    return { reachable: false, healthy: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (optional) {
      console.log(`[WARN] ${name} optional endpoint ${url} was not reachable: ${message}`);
      return { reachable: false, healthy: false };
    }
    console.error(`[FAIL] ${name} ${url} ${message}`);
    return { reachable: false, healthy: false };
  }
}

async function checkWorker(name, baseUrl, optional = false) {
  if (!baseUrl) {
    if (optional) return;
    console.error(`[FAIL] ${name} URL is missing`);
    failed = true;
    return;
  }
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    console.error(`[FAIL] ${name} URL is invalid`);
    failed = true;
    return;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    console.error(`[FAIL] ${name} URL must be credential-free HTTPS`);
    failed = true;
    return;
  }
  const rootUrl = baseUrl.replace(/\/$/, '');
  const root = await fetchEndpoint(name, rootUrl, { optional });
  const health = await fetchEndpoint(name, `${rootUrl}/healthz`, { optional: true });
  if (!root.reachable && !health.reachable) {
    console.error(`[FAIL] ${name} is not reachable on root or /healthz`);
    failed = true;
  } else if (!root.healthy && !health.healthy) {
    console.log(`[WARN] ${name} is reachable but does not expose a healthy root or health route yet`);
  }
}

for (const [name, url] of requiredWorkers) await checkWorker(name, url, false);
for (const [name, url] of optionalWorkers) await checkWorker(name, url, true);

if (failed) process.exit(1);
console.log('[PASS] Canonical worker reachability verification complete');
