import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boundJobMatchesCurrentOwnerScope as sameJobScope, checkedCurrentJobCaller } from '../functions/src/jobs/currentJobCallerAuthority.ts';

const root = new URL('../', import.meta.url);
const owner = {uid:'owner-a',role:'user',disabled:false,tenantId:'tenant-current',orgId:'org-current'};
const original = {ownerUid:'owner-a',tenantId:'tenant-current',orgId:'org-current',status:'RUNNING'};
const credential = {uid:'owner-a',token:{role:'operator',uraiJobsAdmin:true}};

for (const [name,path] of [
  ['getJob','functions/src/jobs/getJob.ts'],
  ['cancelJob','functions/src/jobs/cancelJob.ts'],
  ['getJobStatus','functions/src/jobs/getJobStatus.ts']
]) {
  test(`R878 ${name} binds nonoperator owner to current tenant/org within transaction`,()=>{
    const code=readFileSync(new URL(path,root),'utf8');
    assert.match(code,/runTransaction\s*\(/);
    assert.match(code,/checkedCurrentJobCaller\s*\(/);
    assert.match(code,/if\s*\(!caller\.operator\s*&&\s*!boundJobMatchesCurrentOwnerScope\s*\(job,\s*user(?:Snap|Snapshot)\.data\(\),\s*caller\.uid\)\)/);
    assert.doesNotMatch(code,/ownerUid\s*!==\s*caller\.uid/);
  });
}

test('R878 a stale operator claim cannot override a current user profile',()=>{
  assert.deepEqual(checkedCurrentJobCaller(credential,owner),{uid:'owner-a',operator:false});
});
test('R878 owner can read their current-scope job',()=>{
  assert.equal(sameJobScope(original,owner,'owner-a'),true);
});
test('R878 a prior-tenant job must not be owned in current tenant',()=>{
  assert.equal(sameJobScope({...original,tenantId:'tenant-old'},owner,'owner-a'),false);
});
test('R878 a prior-organization job must not be owned in current organization',()=>{
  assert.equal(sameJobScope({...original,orgId:'org-old'},owner,'owner-a'),false);
});
test('R878 neither a foreign owner nor missing job can pass scope binding',()=>{
  assert.equal(sameJobScope({...original,ownerUid:'other'},owner,'owner-a'),false);
  assert.equal(sameJobScope(null,owner,'owner-a'),false);
});
test('R878 missing account or deletion pending denies even correctly scoped jobs',()=>{
  assert.equal(checkedCurrentJobCaller(credential,null),null);
  assert.equal(checkedCurrentJobCaller(credential,{...owner,deleted:true}),null);
  assert.equal(checkedCurrentJobCaller(credential,{...owner,dataRightsDeletionPendingCentralPrivacy:true}),null);
});
