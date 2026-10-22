// Explicit, fail-closed acceptance gate for a REAL local Firestore emulator.
// A skipped suite, an open TCP port, and a mock do not count as acceptance.
import { spawnSync } from 'node:child_process';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const match = /^(localhost|127\.0\.0\.1):([0-9]{2,5})$/.exec(host);
const port = match ? Number(match[2]) : 0;
if (!match || port > 65535 || port < 1) {
  console.error('CHALK_FIRESTORE_EMULATOR_REQUIRED: supply loopback FIRESTORE_EMULATOR_HOST, e.g. 127.0.0.1:8080');
  process.exit(2);
}
// Probe Firestore's actual REST API. A responding local service is NOT proof
// that the Firestore emulator is running (other tools also bind port 8080).
const endpoint = "http://" + host + "/v1/projects/demo-urai-chalk-checkpoint/databases/(default)/documents";
let ready = false;
try {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
  if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
    const body = await response.json();
    ready = body !== null && typeof body === 'object' && !Array.isArray(body) && !('detail' in body) && !('error' in body);
  }
} catch { /* explicitly require real emulator availability */ }
if (!ready) {
  console.error('CHALK_FIRESTORE_EMULATOR_UNVERIFIED: no Firestore documents API response on loopback target');
  process.exit(3);
}
const child = spawnSync(process.execPath, ['--test', 'scripts/chalk-firestore-emulator.test.mjs'], {
  stdio: 'inherit', timeout: 60000,
  env: {
    PATH: process.env.PATH || '/usr/bin:/bin',
    HOME: process.env.HOME || '/tmp',
    SystemRoot: process.env.SystemRoot || '',
    FIRESTORE_EMULATOR_HOST: host,
    CHALK_REQUIRE_FIRESTORE_EMULATOR: '1',
    GOOGLE_CLOUD_PROJECT: 'demo-urai-chalk-checkpoint',
    GCLOUD_PROJECT: 'demo-urai-chalk-checkpoint',
    NODE_ENV: 'test',
  },
});
if (child.error) console.error('CHALK_FIRESTORE_TEST_ERROR:', child.error.message);
process.exit(child.status === null ? 4 : child.status);
