/**
 * R884: test the real fail-closed dotenv preflight extracted from the original
 * Jobs native emulator runner. No Firebase CLI or cloud credentials required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = readFileSync(new URL('./run-r879-jobs-native-auth-acceptance.sh', import.meta.url), 'utf8');
const functionStart = runner.indexOf('assert_no_functions_local_configuration() {');
const functionEnd = runner.indexOf('\nassert_no_functions_local_configuration', functionStart);
assert.ok(functionStart > 0 && functionEnd > functionStart, 'Original env guard must exist');
const functionSource = runner.slice(functionStart, functionEnd);
assert.ok(runner.indexOf('assert_no_functions_local_configuration', functionEnd + 2) >
  runner.indexOf('pnpm build'), 'Runner must repeat the guard after build');

function checkFixture(filename, expectAccepted, symlink = false) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r884-'));
  try {
    mkdirSync(join(dir, 'functions'));
    if (filename) {
      const dest = join(dir, 'functions', filename);
      if (symlink) symlinkSync('/etc/hosts', dest);
      else writeFileSync(dest, 'TEST_ONLY_NO_CREDENTIALS=1\n');
    }
    const script = [
      'set -euo pipefail',
      'die() { printf "%s\\n" "$*" >&2; exit 19; }',
      functionSource,
      'assert_no_functions_local_configuration',
    ].join('\n');
    const proc = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', timeout: 5000 });
    assert.equal(proc.error, undefined);
    if (expectAccepted) assert.equal(proc.status, 0, filename || 'clean functions directory');
    else {
      assert.equal(proc.status, 19, filename);
      assert.match(proc.stderr, /Functions local environment\/secret configuration forbidden/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test('R884 accepts a clean Functions directory', () => checkFixture(null, true));
test('R884 accepts documentation .env.example only', () => checkFixture('.env.example', true));
for (const name of ['.env', '.env.local', '.env.demo-urai-jobs', '.env.other-project', '.secret.local', '.runtimeconfig.json']) {
  test('R884 denies inherited ' + name, () => checkFixture(name, false));
}
test('R884 denies a symlinked local secret', () => checkFixture('.env.local', false, true));
test('R884 rejects any missing pre/postbuild guard', () => {
  const positions = [...runner.matchAll(/assert_no_functions_local_configuration/g)].map(m => m.index);
  assert.ok(positions.length >= 3, 'Definition and two invocations required');
  assert.ok(positions[1] < runner.indexOf('pnpm install --frozen-lockfile'));
  assert.ok(positions[2] > runner.indexOf('pnpm build'));
  assert.ok(positions[2] < runner.indexOf('> "$ENV_FILE"'));
});
