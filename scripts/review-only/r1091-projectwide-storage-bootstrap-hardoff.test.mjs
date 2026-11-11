import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bootstrap = fileURLToPath(new URL('../../scripts/bootstrap-gcp-deploy-iam.sh', import.meta.url));
const source = readFileSync(bootstrap, 'utf8');
const marker = 'GCP_PROJECTWIDE_STORAGE_BOOTSTRAP_HARD_OFF';

function exercise(extraEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r1091-'));
  try {
    const bin = join(dir, 'bin');
    const sentinel = join(dir, 'cloud-was-called');
    mkdirSync(bin);
    const fake = join(bin, 'gcloud');
    writeFileSync(fake, '#!/bin/sh\nprintf called >> "$URAI_TEST_CLOUD_SENTINEL"\nexit 0\n');
    chmodSync(fake, 0o755);
    const output = spawnSync('/bin/bash', [bootstrap], {
      encoding: 'utf8', timeout: 5000,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: dir,
        URAI_TEST_CLOUD_SENTINEL: sentinel,
        PROJECT_ID: 'urai-security-canary-test',
        DEPLOY_SA: 'synthetic@example.invalid',
        ...extraEnv,
      },
    });
    assert.equal(output.status, 1, `unexpected status: ${output.status}`);
    assert.equal(output.signal, null);
    assert.match(output.stderr, new RegExp(marker));
    assert.equal(output.stdout, '');
    assert.equal(existsSync(sentinel), false, 'bootstrap must not invoke even a fake gcloud');
    assert.doesNotMatch(output.stderr, /synthetic@example\.invalid|urai-security-canary-test/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('legacy projectwide Storage IAM bootstrap hard-stops before any provider read or write', () => {
  assert.match(source, /roles\/storage\.admin/);
  assert.match(source, /gcloud projects add-iam-policy-binding/);
  const guard = source.indexOf(marker);
  assert.ok(guard >= 0);
  assert.ok(guard < source.indexOf('command -v gcloud'));
  assert.ok(guard < source.indexOf('gcloud services enable'));
  exercise();
});

test('caller flags cannot turn the dangerous legacy bootstrap back on', () => {
  for (const extraEnv of [
    { FORCE: '1', APPROVED: 'true', ENABLE_PRIVATE_MEMORY_WRITES: 'true' },
    { PROJECT_ID: 'urai-4dc1d', DEPLOY_SA: 'pretend-production@example.invalid' },
    { CI: 'true', URAI_SKIP_IAM_GUARD: '1' },
  ]) exercise(extraEnv);
});
