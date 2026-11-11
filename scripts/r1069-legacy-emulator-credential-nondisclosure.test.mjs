/** R1069 synthetic-only credential nondisclosure regression for legacy R1045 fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./life-movies-write-reservations.review-emulator.mjs', import.meta.url));
const source = readFileSync(fixture, 'utf8');
const base = {
  PATH: process.env.PATH || '/usr/bin:/bin',
  HOME: process.env.HOME || '/tmp',
  URAI_EMULATOR_PROJECT: 'urai-staging-test',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};

test('R1069 credential veto runs before Firebase SDK import and never interpolates secret values', () => {
  const check = source.indexOf("for (const name of ['GOOGLE_APPLICATION_CREDENTIALS'");
  const importSdk = source.indexOf("const require = createRequire(");
  assert.ok(check >= 0 && importSdk > check, 'environment guard must precede SDK imports');
  assert.match(source, /if \(process\.env\[name\]\) throw new Error\(name \+ ' must be absent'\)/);
  assert.doesNotMatch(source, /assert\.equal\(process\.env\[name\]\s*\|\|/);
});

for (const key of ['RUNPOD_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN']) {
  test('R1069 rejects synthetic ' + key + ' without logging the value', () => {
    const canary = 'R1069_SYNTHETIC_NEVER_PRINT_' + key;
    const result = spawnSync(process.execPath, [fixture], {
      env: { ...base, [key]: canary },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.notEqual(result.status, 0, 'inherited credential must cause failure');
    assert.match(result.stderr, new RegExp(key + ' must be absent'));
    assert.equal((result.stdout + result.stderr).includes(canary), false, 'synthetic credential leaked');
  });
}
