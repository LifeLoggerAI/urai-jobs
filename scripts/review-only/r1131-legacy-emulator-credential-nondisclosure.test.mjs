/**
 * ONE URAI R1131: synthetic-only regression for legacy R1045 Jobs #427
 * credential-handling fixture. Never uses, fetches, or prints real secrets.
 * Review-only. No provider calls, emulator launches, or private-media writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('../life-movies-write-reservations.review-emulator.mjs', import.meta.url));
const testEnv = {
  PATH: process.env.PATH || '/usr/bin:/bin',
  HOME: '/tmp',
  URAI_EMULATOR_PROJECT: 'urai-staging-test',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};

for (const key of ['RUNPOD_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN']) {
  test('R1131 legacy fixture rejects ' + key + ' without echoing synthetic secret', () => {
    const synthetic = 'R1131_SYNTHETIC_CANARY_DO_NOT_ECHO_' + key;
    const result = spawnSync(process.execPath, [fixture], {
      env: { ...testEnv, [key]: synthetic },
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    assert.notEqual(result.status, 0, 'credential-present fixture must fail closed');
    const output = String(result.stdout || '') + String(result.stderr || '');
    assert.match(output, new RegExp(key + ' must be absent'));
    assert.equal(output.includes(synthetic), false, 'synthetic credential was disclosed');
  });
}

test('R1131 checks credentials before loading Firebase and never compares secret values', () => {
  const source = readFileSync(fixture, 'utf8');
  const guard = source.indexOf("for (const name of ['GOOGLE_APPLICATION_CREDENTIALS'");
  const sdk = source.indexOf('const require = createRequire(');
  assert.ok(guard >= 0 && sdk > guard, 'credentials must be rejected before SDK import');
  assert.match(source, /if \(process\.env\[name\]\) throw new Error\(name \+ ' must be absent'\)/);
  const projectGuard = source.indexOf("for (const name of ['GCLOUD_PROJECT'", guard);
  assert.ok(projectGuard > guard && projectGuard < sdk, 'credential guard must end before project-name checks');
  const credentialGuardOnly = source.slice(guard, projectGuard);
  assert.doesNotMatch(credentialGuardOnly, /assert\.equal\(process\.env\[name\]/);
});
