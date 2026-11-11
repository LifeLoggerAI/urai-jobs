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
   assert.match(fragment,/if \(canonicalSnap\.exists\)/);
   assert.match(fragment,/blockSnap\.exists && blockSnap\.data\(\)\?\.active !== false/);
 }
 for(const name of ['R1043 canonical revocation after simulated upload start vetoes pre-byte',
  'R1043 active consent block added after reservation vetoes begin',
  'R1043 active or malformed consent block after in-flight start vetoes pre-byte']) {
   assert.ok(e.includes(name),name);
 }
 assert.match(off,/return false;/);
});
