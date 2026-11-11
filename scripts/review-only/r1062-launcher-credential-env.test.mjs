/** R1062 fail-closed credential environment preflight: synthetic variables only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../run-four-emulator-acceptance.sh', import.meta.url));
const source = readFileSync(runner, 'utf8');
const base = {PATH: process.env.PATH || '/usr/bin:/bin', HOME: '/tmp'};
const canary = 'R1062_SYNTHETIC_DO_NOT_ECHO_PRIVATE_VALUE';
const candidates = [
  'NPM_TOKEN', 'VERCEL_TOKEN', 'GITLAB_TOKEN', 'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY', 'NEW_VENDOR_API_KEY', 'CUSTOM_SESSION_TOKEN',
  'WORKER_PRIVATE_KEY', 'ALT_PASSWORD', 'EXTERNAL_CREDENTIAL',
];

test('R1062 credential name check happens before git, node, pnpm or npm', () => {
  const guard = source.indexOf('Inherited credential variable forbidden:');
  for (const token of ['command -v git', 'command -v node', 'command -v pnpm', 'pnpm install --frozen-lockfile']) {
    assert.ok(guard >= 0 && guard < source.indexOf(token), 'guard must precede ' + token);
  }
  assert.ok(source.includes('done < <(compgen -e)'), 'all exported environment keys must be inspected');
});

test('R1062 each inherited synthetic credential is rejected without echoing value', () => {
  for (const key of candidates) {
    const result = spawnSync('bash', [runner], {
      env: { ...base, [key]: canary }, encoding: 'utf8', timeout: 3000,
    });
    assert.equal(result.status, 1, key + ' should be rejected');
    assert.match(result.stderr, new RegExp('Inherited credential variable forbidden: ' + key));
    assert.equal((result.stdout + result.stderr).includes(canary), false, 'must never echo synthetic value');
  }
});

test('R1062 safe environment reaches existing immutable source-SHA preflight', () => {
  const result = spawnSync('bash', [runner], { env: base, encoding: 'utf8', timeout: 3000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Externally reviewed URAI_ACCEPTANCE_SHA is required/);
  assert.doesNotMatch(result.stderr, /Inherited credential variable forbidden/);
});

test('R1062 empty credential variables do not grant authority or bypass SHA', () => {
  const result = spawnSync('bash', [runner], {
    env: {...base, NPM_TOKEN: '', NEW_VENDOR_API_KEY: ''}, encoding: 'utf8', timeout: 3000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Externally reviewed URAI_ACCEPTANCE_SHA is required/);
});
