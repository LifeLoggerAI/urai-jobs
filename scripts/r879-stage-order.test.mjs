import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Execute the original orchestration segment in Bash with simulated stage bodies.
// This tests clean-install ordering and failure propagation, not native acceptance.
const source = readFileSync(new URL('./run-r879-unified-native-acceptance.sh', import.meta.url), 'utf8');
const segment = source.slice(source.indexOf('# R946 run five'), source.indexOf('# Separately rerun'));
function exercise(t, failStage = '') {
  const out = mkdtempSync(join(tmpdir(), 'r879-order-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const script = `set -Eeuo pipefail
hold() { echo "HOLD:$*" >&2; exit 2; }
stage() {
  local id="$1"
  echo "$id"
  [[ "$id" != "$FAIL_STAGE" ]] || hold "stage failed $id"
  case "$id" in
    r854_original)
      touch "$OUT/installed"
      printf '%s\n' URAI_R854_PRIVATE_STORAGE_P0_NEGATIVE_REPRODUCED 'privilegedBypassObserved=true storageLevelFenceVerified=false' > "$OUT/$id.log" ;;
    studio_producer_jobs_zod_10_source)
      [[ -f "$OUT/installed" ]] || hold 'dependency unavailable before frozen install'
      echo '# pass 10' > "$OUT/$id.log" ;;
    r946_source_pin_preflight_5) echo '# pass 5' > "$OUT/$id.log" ;;
    r951_worker_auth_emulator_precedence_4) echo '# pass 4' > "$OUT/$id.log" ;;
    *) hold "unexpected stage $id" ;;
  esac
}
` + segment;
  return spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, OUT: out, FAIL_STAGE: failStage } });
}
test('clean acceptance installs dependencies before real-Zod producer stage', t => {
  const r = exercise(t);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.split('studio_producer_jobs_zod_10_source').length - 1, 1);
});
test('failed prerequisite never runs producer acceptance', t => {
  const r = exercise(t, 'r854_original');
  assert.equal(r.status, 2);
  assert.doesNotMatch(r.stdout, /studio_producer_jobs_zod_10_source/);
});
test('failed producer acceptance remains fatal after successful install', t => {
  const r = exercise(t, 'studio_producer_jobs_zod_10_source');
  assert.equal(r.status, 2);
  assert.match(r.stdout, /r854_original/);
  assert.match(r.stderr, /stage failed studio_producer_jobs_zod_10_source/);
});
