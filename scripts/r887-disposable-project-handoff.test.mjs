/** R887 source contract for two isolated disposable Firebase emulator projects.
 * Source inspection only; does not certify native emulator or production IAM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const outer=readFileSync(new URL('./run-r879-unified-native-acceptance.sh',import.meta.url),'utf8');
const inner=readFileSync(new URL('./run-r879-jobs-native-auth-acceptance.sh',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('R887 outer negative storage phase retains separate staging project',()=>{
  assert.match(outer,/PROJECT='urai-staging-test'/);
  assert.match(outer,/stage r854_original 5400s bash scripts\/run-r854-private-storage-p0-negative-native\.sh/);
});
test('R887 inner native phase overrides or clears every project environment inherited from outer',()=>{
  assert.match(outer,/stage jobs_authority_quota_native 7200s env \\\n\s+-u FIREBASE_PROJECT_ID -u CLOUDSDK_CORE_PROJECT \\\n\s+URAI_EMULATOR_PROJECT=demo-urai-jobs GCLOUD_PROJECT=demo-urai-jobs GOOGLE_CLOUD_PROJECT=demo-urai-jobs/);
  assert.match(inner,/PROJECT="demo-urai-jobs"/);
  assert.match(inner,/for variable in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT FIREBASE_PROJECT_ID CLOUDSDK_CORE_PROJECT;/);
});
test('R887 inner runner denies untrusted Functions secret files both before and after build',()=>{
  assert.match(inner,/assert_no_functions_local_configuration\(\) \{/);
  const uses=[...inner.matchAll(/^assert_no_functions_local_configuration$/gm)].map(m=>m.index);
  assert.equal(uses.length,2);
  assert.ok(uses[0]<inner.indexOf('pnpm install --frozen-lockfile'));
  assert.ok(uses[1]>inner.indexOf('pnpm build'));
});
test('R887 original R884 env test is enrolled in main verify and source-pinned native gate',()=>{
  assert.ok(pkg.scripts['urai-jobs:verify'].includes('node --test scripts/r884-emulator-env-isolation.test.mjs'));
  assert.match(outer,/check_blob 'scripts\/r884-emulator-env-isolation\.test\.mjs' 'edbb4fc44f026d1d972021020ca4198d0561c79b'/);
  assert.match(outer,/stage emulator_env_10_source 120s node --test scripts\/r884-emulator-env-isolation\.test\.mjs/);
  assert.match(outer,/grep -q '# pass 10' "\$OUT\/emulator_env_10_source\.log"/);
});
