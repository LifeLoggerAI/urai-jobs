const expectedSha = String(process.env.TARGET_SHA || '');
const shaPattern = /^[0-9a-f]{40}$/;
if (!shaPattern.test(expectedSha)) {
  console.error('[FAIL] TARGET_SHA must be a full lowercase 40-character source SHA');
  process.exit(1);
}

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
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      // A health endpoint must return a structured payload; retain the body for diagnostics only.
    }

    const healthy = response.ok && payload?.ok === true;
    if (healthy) {
      console.log(`[PASS] ${name} ${url} ${response.status} source=${payload.sourceSha || '<missing>'}`);
      return { reachable: true, healthy: true, payload };
    }
    if (optional && response.status === 404) {
      console.log(`[WARN] ${name} optional endpoint ${url} is not exposed (${response.status})`);
      return { reachable: true, healthy: false, payload };
    }
    console.error(`[FAIL] ${name} ${url} returned ${response.status}: ${text.slice(0, 120)}`);
    return { reachable: response.status > 0, healthy: false, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (optional) {
      console.log(`[WARN] ${name} optional endpoint ${url} was not reachable: ${message}`);
      return { reachable: false, healthy: false, payload: null };
    }
    console.error(`[FAIL] ${name} ${url} ${message}`);
    return { reachable: false, healthy: false, payload: null };
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
  const health = await fetchEndpoint(name, `${rootUrl}/healthz`, { optional });
  const sourceSha = health.payload?.sourceSha;

  if (!health.healthy) {
    if (optional) {
      console.log(`[WARN] ${name} does not expose a successful structured health payload`);
      return;
    }
    console.error(`[FAIL] ${name} must expose HTTP 2xx /healthz with { ok: true }`);
    failed = true;
    return;
  }

  if (sourceSha !== expectedSha) {
    const message = `${name} runtime source SHA ${sourceSha || '<missing>'} does not match TARGET_SHA ${expectedSha}`;
    if (optional) {
      console.log(`[WARN] ${message}`);
      return;
    }
    console.error(`[FAIL] ${message}`);
    failed = true;
  }
}

for (const [name, url] of requiredWorkers) await checkWorker(name, url, false);
for (const [name, url] of optionalWorkers) await checkWorker(name, url, true);

if (failed) process.exit(1);
console.log(`[PASS] Canonical required workers are healthy and bound to ${expectedSha}`);
