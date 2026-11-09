/** R890 source/owner cancellation admission regression; not Firebase runtime acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertOwnerDeletionFenceClear,assertLifeMovieOwnerTenantAuthorityClear} from '../functions/src/privacy/ownerDeletionFence.ts';
import {assertLifeMoviePlanCurrentOrg} from '../functions/src/jobs/lifeMovieLongformOwnerOrg.ts';

const source=readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformBridge.ts',import.meta.url),'utf8');
const start=source.indexOf('async function cancelPlan(');
const end=source.indexOf('\nexport const studioLifeMovieLongformBridge',start);
assert.ok(start>=0&&end>start,'exact source cancellation entrypoint required');
const cancel=source.slice(start,end);
const plan={orgId:'org-A'};
const base={uid:'owner',tenantId:'tenant',orgId:'org-A',accountStatus:'active',disabled:false,deleted:false,markedForDeletion:false,dataRightsDeletionPendingCentralPrivacy:false};
const snapshot=profile=>({exists:profile!==null,data:()=>profile});
const check=profile=>{
  const snap=snapshot(profile);
  assertOwnerDeletionFenceClear(snap);
  assertLifeMovieOwnerTenantAuthorityClear(snap,'owner','tenant');
  assertLifeMoviePlanCurrentOrg(plan,snap.data());
};
const denied=profile=>assert.throws(()=>check(profile));

test('R890 a live matching owner passes the cancellation authority preflight',()=>assert.doesNotThrow(()=>check(base)));
test('R890 deleted owner is denied',()=>denied({...base,deleted:true}));
test('R890 disabled owner is denied',()=>denied({...base,disabled:true}));
test('R890 suspended owner is denied',()=>denied({...base,accountStatus:'suspended'}));
test('R890 pending central privacy deletion is denied',()=>denied({...base,dataRightsDeletionPendingCentralPrivacy:true}));
test('R890 malformed privacy deletion field is denied',()=>denied({...base,dataRightsDeletionPendingCentralPrivacy:'false'}));
test('R890 missing owner document is denied',()=>denied(null));
test('R890 owner UID switch is denied',()=>denied({...base,uid:'foreign'}));
test('R890 tenant switch is denied',()=>denied({...base,tenantId:'tenant-B'}));
test('R890 organization switch is denied',()=>denied({...base,orgId:'org-B'}));
test('R890 malformed organization is denied',()=>denied({...base,orgId:{id:'org-A'}}));
test('R890 missing org cannot inherit scoped plan',()=>denied({...base,orgId:undefined}));
test('R890 source performs checks before reading any child jobs',()=>{
 const user=cancel.indexOf("transaction.get(db.collection('users').doc(userId))");
 const del=cancel.indexOf('assertOwnerDeletionFenceClear(ownerSnapshot)');
 const tenant=cancel.indexOf('assertLifeMovieOwnerTenantAuthorityClear(ownerSnapshot, userId, tenantId)');
 const org=cancel.indexOf('assertLifeMoviePlanCurrentOrg(plan, ownerSnapshot.data())');
 const children=cancel.indexOf('transaction.getAll(...childRefs)');
 assert.ok(user>0&&del>user&&tenant>del&&org>tenant&&children>org);
});
test('R890 source keeps user cancellation separate from central privacy deletion cleanup',()=>{
 assert.match(cancel,/Privacy-driven deletion uses its dedicated revocation\/cleanup flow/);
 assert.match(cancel,/transaction\.update\(ref,\s*\{\s*status: 'CANCELLED'/);
});
