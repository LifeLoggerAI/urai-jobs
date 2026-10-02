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
const requireStudioWorker = String(process.env.REQUIRE_STUDIO_WORKER || '').toLowerCase() === 'true'
  || process.env.REQUIRE_STUDIO_WORKER === '1';
const optionalWorkers = [
  ['spatial-worker', process.env.SPATIAL_WORKER_URL],
  ...(!requireStudioWorker ? [['studio-worker', process.env.STUDIO_WORKER_URL]] : []),
].filter(([, url]) => Boolean(url));
if (requireStudioWorker) {
  requiredWorkers.push(['studio-worker', process.env.STUDIO_WORKER_URL]);
}

let failed = false;

async function fetchEndpoint(name, url, endpoint, options = {}) {
  const { optional = false } = options;
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'x-request-id': `worker-${endpoint}-${Date.now()}` },
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      // Runtime verification requires structured JSON; body is retained only for diagnostics.
    }

    const healthy = response.ok && payload?.ok === true;
    if (healthy) {
      console.log(`[PASS] ${name} ${endpoint} ${url} ${response.status} source=${payload.sourceSha || '<missing>'}`);
      return { reachable: true, healthy: true, payload };
    }
    if (optional && response.status === 404) {
      console.log(`[WARN] ${name} optional ${endpoint} ${url} is not exposed (${response.status})`);
      return { reachable: true, healthy: false, payload };
    }
    console.error(`[FAIL] ${name} ${endpoint} ${url} returned ${response.status}: ${text.slice(0, 160)}`);
    return { reachable: response.status > 0, healthy: false, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (optional) {
      console.log(`[WARN] ${name} optional ${endpoint} ${url} was not reachable: ${message}`);
      return { reachable: false, healthy: false, payload: null };
    }
    console.error(`[FAIL] ${name} ${endpoint} ${url} ${message}`);
    return { reachable: false, healthy: false, payload: null };
  }
}

function exactShaOrFail(name, endpoint, payload, optional) {
  const sourceSha = payload?.sourceSha;
  if (sourceSha !== expectedSha) {
    const message = `${name} ${endpoint} runtime source SHA ${sourceSha || '<missing>'} does not match TARGET_SHA ${expectedSha}`;
    if (optional) {
      console.log(`[WARN] ${message}`);
      return false;
    }
    console.error(`[FAIL] ${message}`);
    failed = true;
    return false;
  }
  return true;
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
  const health = await fetchEndpoint(name, `${rootUrl}/healthz`, 'health', { optional });
  if (!health.healthy) {
    if (optional) {
      console.log(`[WARN] ${name} does not expose a successful structured health payload`);
      return;
    }
    console.error(`[FAIL] ${name} must expose HTTP 2xx /healthz with { ok: true }`);
    failed = true;
    return;
  }
  if (!exactShaOrFail(name, 'health', health.payload, optional) && optional) return;

  const readiness = await fetchEndpoint(name, `${rootUrl}/readyz`, 'readiness', { optional });
  if (!readiness.healthy) {
    if (optional) {
      console.log(`[WARN] ${name} does not expose a successful structured readiness payload`);
      return;
    }
    console.error(`[FAIL] ${name} must expose HTTP 2xx /readyz with { ok: true }`);
    failed = true;
    return;
  }
  exactShaOrFail(name, 'readiness', readiness.payload, optional);
}

for (const [name, url] of requiredWorkers) await checkWorker(name, url, false);
for (const [name, url] of optionalWorkers) await checkWorker(name, url, true);

if (failed) process.exit(1);
console.log(`[PASS] Canonical required workers are healthy, ready, and bound to ${expectedSha}`);
