/**
 * R528: source-backed IAM approval tripwire for the protected Jobs workflow.
 * No cloud calls, service-account tokens, private bucket names or real grants.
 * All inlined policy decisions are executed against disposable fake policies.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(new URL('../.github/workflows/urai-jobs-production-deploy.yml', import.meta.url), 'utf8');
const contract = readFileSync(new URL('./check-secure-worker-deploy.mjs', import.meta.url), 'utf8');
const begin = 'PROJECT_POLICY_JSON="$project_policy" BUCKET_POLICY_JSON="$bucket_policy" EXPECTED_MEMBER="$worker_member" node <<\'NODE\'\n';
const start = workflow.indexOf(begin);
assert.ok(start >= 0, 'exact original protected IAM authority block must exist');
assert.equal(workflow.indexOf(begin, start + begin.length), -1, 'exactly one private IAM authority block');
const end = workflow.indexOf('\n          NODE', start + begin.length);
assert.ok(end > start, 'bounded original IAM heredoc must close');
const policySource = workflow.slice(start + begin.length, end);
const member = 'serviceAccount:synthetic-worker@example.invalid';
const binding = role => ({role, members:[member]});
const check = (bucketBindings, projectBindings=[binding('roles/datastore.user')]) =>
  spawnSync(process.execPath, ['-e', policySource], {
    encoding:'utf8', timeout:5000,
    env:{ ...process.env, EXPECTED_MEMBER:member,
      PROJECT_POLICY_JSON:JSON.stringify({bindings:projectBindings}),
      BUCKET_POLICY_JSON:JSON.stringify({bindings:bucketBindings}),
    },
  });
function denied(output, marker) {
  assert.equal(output.status, 1, output.stderr);
  assert.match(output.stderr, new RegExp(marker));
  assert.doesNotMatch(output.stdout + output.stderr, /synthetic-worker@example\.invalid|GCS_BUCKET_NAME|APPROVED/);
}

test('R528 broad objectAdmin grant never unlocks worker release', () => {
  denied(check([binding('roles/storage.objectAdmin')]), 'WORKER_SHARED_BUCKET_OBJECTADMIN_HOLD');
});
test('R528 removing broad grant cannot silently certify an unreviewed broker', () => {
  denied(check([]), 'WORKER_PRIVATE_STORAGE_BROKER_IAM_UNVERIFIED');
});
test('R528 narrow objectViewer cannot substitute for broker approval', () => {
  denied(check([binding('roles/storage.objectViewer')]), 'WORKER_PRIVATE_STORAGE_BROKER_IAM_UNVERIFIED');
});
test('R528 conditional broad grant and inherited authority are not certified by a bucket snapshot', () => {
  denied(check([{...binding('roles/storage.objectAdmin'),condition:{title:'unknown',expression:'true'}}]),
    'WORKER_PRIVATE_STORAGE_BROKER_IAM_UNVERIFIED');
});
test('R528 approved workflow also requires project Firestore authority', () => {
  const out=check([], []);
  assert.equal(out.status,1);
  assert.match(out.stderr, /lacks an unconditional project-level roles\/datastore\.user/);
});
test('R528 Studio source buckets cannot treat objectAdmin as read-only approval', () => {
  assert.match(workflow, /const allowed = new Set\(\['roles\/storage\.objectViewer'\]\);/);
  assert.doesNotMatch(workflow, /const allowed = new Set\(\['roles\/storage\.objectViewer',\s*'roles\/storage\.objectAdmin'/);
});
test('R528 maintainer contract explicitly protects both fail-closed IAM paths', () => {
  assert.match(contract, /WORKER_SHARED_BUCKET_OBJECTADMIN_HOLD/);
  assert.match(contract, /WORKER_PRIVATE_STORAGE_BROKER_IAM_UNVERIFIED/);
  assert.doesNotMatch(contract, /workflow must verify bucket data-plane authority/);
});
