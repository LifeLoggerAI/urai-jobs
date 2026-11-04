import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = readFileSync(new URL('./bootstrap-managed-worker-iam.sh', import.meta.url), 'utf8');
const baseEnv = { ...process.env, GCS_BUCKET_NAME: 'synthetic-r524-private-bucket',
  GCLOUD_PROJECT: 'urai-r524-synthetic', FIREBASE_PROJECT_ID: 'urai-r524-synthetic',
  URAI_JOBS_DEPLOY_WORKERS: 'narrator-worker,asset-worker' };

function simulate(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r524-'));
  const log = join(dir, 'calls.log');
  const fake = `#!/bin/sh
printf '%s|%s\n' "${'${0##*/}'}" "$*" >> "$R524_FAKE_LOG"
if [ "${'${0##*/}'}" = gsutil ]; then
  [ "$1" = ls ] && [ "$2" = -b ] && [ "$R524_BUCKET_EXISTS" = 1 ] && exit 0
  exit 99
fi
exit 0
`;
  for (const cmd of ['gcloud', 'gsutil']) {
    const loc = join(dir, cmd);
    writeFileSync(loc, fake, { mode: 0o700 });
    chmodSync(loc, 0o700);
  }
  const env = { ...baseEnv, ...overrides,
    PATH: dir + ':' + process.env.PATH,
    R524_FAKE_LOG: log, R524_BUCKET_EXISTS: overrides.R524_BUCKET_EXISTS ?? '1' };
  for (const key of ['GCS_BUCKET_NAME', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    if (overrides[key] === null) delete env[key];
  }
  const result = spawnSync('bash', ['scripts/bootstrap-managed-worker-iam.sh'],
    { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  const lines = (() => { try { return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean); }
    catch { return []; } })();
  rmSync(dir, { recursive: true, force: true });
  return { ...result, calls: lines };
}

test('R524: original bootstrap is valid bash syntax', () => {
  const p = spawnSync('bash', ['-n', 'scripts/bootstrap-managed-worker-iam.sh'],
    { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
});

test('R524: no automatic bucket creation or object-admin grants remain', () => {
  assert.doesNotMatch(script, /gsutil\s+iam\s+ch|gsutil\s+mb|roles\/storage\.objectAdmin|gcloud\s+storage\s+buckets\s+create/);
  assert.match(script, /Storage permissions unchanged/);
});

test('R524: studio-only and mixed studio selections abort before any cloud call', () => {
  for (const workers of ['studio-worker', 'asset-worker,studio-worker', 'studio-worker,narrator-worker']) {
    const p = simulate({ URAI_JOBS_DEPLOY_WORKERS: workers });
    assert.notEqual(p.status, 0);
    assert.match(p.stderr, /STUDIO_WORKER_DEPLOY_HARD_OFF/);
    assert.deepEqual(p.calls, []);
  }
});

test('R524: missing or placeholder bucket fails before cloud operations', () => {
  for (const bucket of [null, 'replace-with-bucket', 'YOUR_BUCKET']) {
    const p = simulate({ GCS_BUCKET_NAME: bucket });
    assert.notEqual(p.status, 0);
    assert.deepEqual(p.calls, []);
  }
});

test('R524: unreadable or absent preapproved bucket prevents every cloud mutation', () => {
  const p = simulate({ R524_BUCKET_EXISTS: '0' });
  assert.notEqual(p.status, 0);
  assert.match(p.stderr, /Approved GCS bucket must exist/);
  assert.deepEqual(p.calls, ['gsutil|ls -b gs://synthetic-r524-private-bucket']);
});

test('R524: non-studio workers retain base IAM flow but no Storage mutation', () => {
  const p = simulate();
  assert.equal(p.status, 0, p.stderr);
  assert.ok(p.calls.some(s => s.startsWith('gcloud|config set project')));
  assert.ok(p.calls.some(s => s.startsWith('gcloud|projects add-iam-policy-binding')));
  assert.deepEqual(p.calls.filter(s => s.startsWith('gsutil|')),
    ['gsutil|ls -b gs://synthetic-r524-private-bucket']);
  assert.ok(p.calls.every(s => !/gsutil\|(mb|iam)|roles\/storage\.objectAdmin/.test(s)));
});

test('R524: malformed worker selections fail before first cloud operation', () => {
  for (const workers of ['bogus', 'asset-worker,asset-worker', ',asset-worker']) {
    const p = simulate({ URAI_JOBS_DEPLOY_WORKERS: workers });
    assert.notEqual(p.status, 0);
    assert.deepEqual(p.calls, []);
  }
});


test('R524: implicit or conflicting project IDs fail before cloud access', () => {
  const missing = simulate({ FIREBASE_PROJECT_ID: null, GCLOUD_PROJECT: null, GOOGLE_CLOUD_PROJECT: null });
  assert.notEqual(missing.status, 0);
  assert.deepEqual(missing.calls, []);
  const mismatch = simulate({ GOOGLE_CLOUD_PROJECT: 'wrong-project' });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /Conflicting project IDs/);
  assert.deepEqual(mismatch.calls, []);
});

test('R524: bucket path, wildcard, URI, and malformed names fail before cloud access', () => {
  for (const bucket of ['*', 'gs://synthetic-bucket', 'bucket/other', 'two..dots', 'with space', 'a']) {
    const p = simulate({ GCS_BUCKET_NAME: bucket });
    assert.notEqual(p.status, 0, bucket);
    assert.deepEqual(p.calls, [], bucket);
  }
});
