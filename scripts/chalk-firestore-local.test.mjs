import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = new URL('./chalk-firestore-local.mjs', import.meta.url);
function probe(args, env = {}) {
  return spawnSync(process.execPath, [fileURLToPath(script), ...args], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, ...env },
  });
}
test('local acceptance cannot start without an exact pinned source', () => {
  const noSha = probe([]);
  assert.equal(noSha.status, 2);
  assert.match(noSha.stderr, /CHALK_PINNED_SHA_REQUIRED/);
  const shortSha = probe(['--sha','abc123']);
  assert.equal(shortSha.status, 2);
  assert.match(shortSha.stderr, /CHALK_PINNED_SHA_REQUIRED/);
});
test('local acceptance refuses a parent-provided emulator endpoint', () => {
  const result = probe(['--sha','a'.repeat(40)], { FIRESTORE_EMULATOR_HOST: 'somewhere.invalid:8080' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CHALK_PARENT_EMULATOR_HOST_REFUSED/);
});
test('local acceptance refuses real cloud project bindings', () => {
  const result = probe(['--sha','a'.repeat(40)], {
    FIRESTORE_EMULATOR_HOST: '', GOOGLE_CLOUD_PROJECT: 'urai-4dc1d',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CHALK_REAL_CLOUD_PROJECT_REFUSED/);
});
