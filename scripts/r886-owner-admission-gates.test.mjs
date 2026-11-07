/** R886 original source-level owner-admission regression.
 * NOT Firebase emulator, GCS IAM, or end-to-end execution proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentJobOwnerEligibleForDispatch as allowed } from '../functions/src/jobs/currentJobCallerAuthority.ts';

const root=new URL('../',import.meta.url);
const owner={uid:'owner-1',role:'user',disabled:false,tenantId:'tenant-a',orgId:'org-a'};
const job={ownerUid:'owner-1',status:'PENDING',type:'web.fetch',tenantId:'tenant-a',orgId:'org-a'};
const source=path=>readFileSync(new URL(path,root),'utf8');

test('R886 active original owner with current tenant and org is eligible',()=>assert.equal(allowed(job,owner),true));
test('R886 legitimate legacy unscoped owner and job are compatible',()=>{
  assert.equal(allowed({ownerUid:'owner-1'}, {uid:'owner-1',role:'user'}),true);
});
for(const [name,account] of [
 ['account deleted', {...owner,deleted:true}],
 ['account disabled', {...owner,disabled:true}],
 ['privacy deletion pending', {...owner,dataRightsDeletionPendingCentralPrivacy:true}],
 ['marked for deletion', {...owner,markedForDeletion:true}],
 ['account suspended', {...owner,accountStatus:'suspended'}],
 ['owner removed', null],
 ['owner role revoked', {...owner,role:'none'}],
 ['tenant changed', {...owner,tenantId:'tenant-b'}],
 ['organization changed', {...owner,orgId:'org-b'}],
 ['malformed tenant', {...owner,tenantId:{id:'tenant-a'}}],
 ['malformed organization', {...owner,orgId:42}],
 ['foreign UID', {...owner,uid:'other'}],
]) {
 test('R886 disallow worker admission: '+name,()=>assert.equal(allowed(job,account),false));
}
test('R886 owner UID absent or malformed cannot pass',()=>{
 assert.equal(allowed({...job,ownerUid:undefined},owner),false);
 assert.equal(allowed({...job,ownerUid:'owner-1 '},owner),false);
 assert.equal(allowed({...job,ownerUid:0},owner),false);
});

for(const [label,path,leaseAnchor] of [
 ['scheduler','functions/src/jobs/processQueueTick.ts',"const newLease = createLease(tickWorkerId);"],
 ['manual','functions/src/jobs/processQueueNow.ts',"const newLease = createLease(workerId);"],
 ['worker','functions/src/jobs/executeJob.ts',"status: 'RUNNING',"],
]) {
 test('R886 '+label+' reads current owner and denies before protected state transition',()=>{
   const code=source(path);
   assert.match(code,/currentJobOwnerEligibleForDispatch\(job,\s*(?:ownerSnapshot|currentOwner)\.data\(\)\)/);
   assert.match(code,/transaction\.get\(db\.collection\('users'\)\.doc\(ownerUid\)\)/);
   const gate=code.indexOf("currentJobOwnerEligibleForDispatch(job,");
   const target=code.indexOf(leaseAnchor);
   assert.ok(gate>=0 && target>gate,'owner gate must precede lease/start write');
   assert.match(code,/job_owner_authority_unavailable/);
 });
}
test('R886 worker denial cannot re-create private logs for missing owner',()=>{
 const code=source('functions/src/jobs/executeJob.ts');
 assert.match(code,/prepared\.reason !== 'owner-authority-unavailable'/);
});
