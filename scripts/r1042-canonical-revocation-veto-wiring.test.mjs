import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../functions/src/privacy/lifeMovieWriteReservationsReview.ts',import.meta.url),'utf8');
const e=readFileSync(new URL('./life-movies-write-reservations.review-emulator.mjs',import.meta.url),'utf8');
const off=readFileSync(new URL('../workers/studio-worker/private-output-write-authority.js',import.meta.url),'utf8');
test('both simulator admissions consult canonical revocation transactionally',()=>{
 assert.equal((s.match(/transaction\.get\(canonicalRevocation\)/g)||[]).length,3);
 assert.equal((s.match(/if \(canonicalSnap\.exists\) throw new Error\('life_movie_review_write_canonical_revocation_fenced'\)/g)||[]).length,3);
 assert.match(s,/PRIVATE_OUTPUT_FENCE_COLLECTION, privateOutputFenceId/);
});
test('malformed, owner-wide and in-flight cases enrolled in real emulator runner',()=>{
 assert.match(e,/R1042 malformed or privilege-injected canonical fence still denies/);
 assert.match(e,/R1042 same owner other tenant blocked/);
 assert.match(e,/R1042 canonical withdrawal denies new reservation and pending start/);
});
test('production hard-off and all ACK-denied conditions preserved',()=>{
 assert.match(off,/return false;/);
 assert.doesNotMatch(s,/storageWriteAuthorized:\s*true/);
 assert.match(s,/productionAuthorized: false/);
});
test('R1043: simulated pre-byte check and begin both re-read canonical owner revocation and live consent block',()=>{
 const begin=s.slice(s.indexOf('export async function beginReviewOnlySimulatedUpload'),s.indexOf('export async function revokeReviewOnlyOutputScope'));
 const pre=s.slice(s.indexOf('export async function assertReviewOnlyBrokerPreByte'),s.indexOf('export async function recordReviewOnlyBrokerPhysicalGeneration'));
 for(const fragment of [begin,pre]){
   assert.match(fragment,/transaction\.get\(canonicalRevocation\)/);
   assert.match(fragment,/transaction\.get\(block\)/);
   assert.match(fragment,/transaction\.get\(owner\)/);
   assert.match(fragment,/transaction\.get\(job\)/);
   assert.match(fragment,/assertReviewOnlyCurrentOwnerAndJob\(ownerSnap, jobSnap, s\)/);
   assert.match(fragment,/if \(canonicalSnap\.exists\)/);
   assert.match(fragment,/blockSnap\.exists && blockSnap\.data\(\)\?\.active !== false/);
 }
 for(const name of ['R1043 canonical revocation after simulated upload start vetoes pre-byte',
  'R1043 active consent block added after reservation vetoes begin',
  'R1043 active or malformed consent block after in-flight start vetoes pre-byte']) {
   assert.ok(e.includes(name),name);
 }
 for(const name of ['R1043 cancelled job is denied after reservation and after simulated begin',
  'R1043 owner disabled or deletion-pending is denied at both later stages']) {
   assert.ok(e.includes(name),name);
 }
 assert.match(off,/return false;/);
});

test('R1046 retains distinct R1044 residual attempt and owner/job drift regressions',()=>{
 assert.match(e,/R1046 preserve R1044 open review fence and unresolved in-flight attempt on canonical veto/);
 assert.match(e,/R1046 job owner, tenant and consent purpose drift deny begin\/prebyte/);
 assert.match(e,/x\.activeOrUnproven,1/);
 for(const field of ['ownerUid','tenantId','consent']) assert.ok(e.includes(field),field);
 assert.match(off,/return false;/);
});

// R1050: verify three independent donor fixture regressions survive convergence.
test('R1050 preserves peer R1045 owner and job mutation regressions in hermetic simulator',()=>{
 for(const name of [
  'R1045 job cancellation after reservation vetoes simulated begin and pre-byte',
  'R1045 owner disable and deletion after reservation veto later stages',
  'R1045 mutated job owner, tenant, source, project, purpose deny after reserve and begin',
 ]) assert.ok(e.includes(name),name);
 const start=s.indexOf('function assertReviewOnlyCurrentOwnerAndJob(');
 const end=s.indexOf('export async function beginReviewOnlySimulatedUpload',start);
 assert.ok(start>=0&&end>start);
 const helper=s.slice(start,end);
 for(const invariant of ['user.disabled !== false','user.deletionPending !== false',
  "currentJob.status !== 'RUNNING'",'currentJob.ownerUid !== scope.ownerUid',
  'currentJob.tenantId !== scope.tenantId','currentJob.sourceSystem',
  'payload.projectId !== scope.projectId','currentJob.consent?.purpose !== PURPOSE'])
  assert.ok(helper.includes(invariant),invariant);
 const begin=s.slice(s.indexOf('export async function beginReviewOnlySimulatedUpload'),s.indexOf('export async function revokeReviewOnlyOutputScope'));
 const pre=s.slice(s.indexOf('export async function assertReviewOnlyBrokerPreByte'),s.indexOf('export async function recordReviewOnlyBrokerPhysicalGeneration'));
 for(const part of [begin,pre])assert.match(part,/assertReviewOnlyCurrentOwnerAndJob\(ownerSnap, jobSnap, s\)/);
 assert.match(off,/return false;/);
});

test('R1061: first scope seed atomically refuses canonical withdrawal and owner consent block',()=>{
  const start=s.indexOf('export async function seedReviewOnlyOutputScope');
  const end=s.indexOf('export async function reserveReviewOnlyOutputAttempt', start);
  assert.ok(start>=0 && end>start);
  const seed=s.slice(start,end);
  assert.match(seed,/transaction\.get\(ownerFence\)/);
  assert.match(seed,/transaction\.get\(block\)/);
  assert.match(seed,/transaction\.get\(fence\)/);
  assert.match(seed,/if \(canonicalSnap\.exists\) throw new Error\('life_movie_review_write_canonical_revocation_fenced'\)/);
  assert.match(seed,/blockSnap\.exists && blockSnap\.data\(\)\?\.active !== false/);
  assert.ok(seed.indexOf('transaction.get(ownerFence)') < seed.indexOf('transaction.create(fence,'));
  assert.ok(seed.indexOf('transaction.get(block)') < seed.indexOf('transaction.create(fence,'));
  assert.match(e,/R1061 withdrawal before first scope seed cannot create OPEN project/);
  assert.match(e,/R1061 active or malformed consent block vetoes first scope seed/);
  assert.match(off,/return false;/);
});
