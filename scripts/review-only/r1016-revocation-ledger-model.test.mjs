import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DENIED, createReviewLedger, reserveForReview, startUploadForReview,
  withdrawForReview, observeDrainCandidate, inspectDrainForReview,
  acknowledgeDeletionForReview,
} from './r1016-revocation-ledger-model.mjs';

const scope = () => ({ownerUid:'owner1',tenantId:'tenant1',projectId:'project1',bucket:'privatebucket1',epoch:4});
const path = 'tenants/tenant1/life-movies/project1/attempt-attempt1/life-movie.mp4';
const request = () => ({...scope(),attemptId:'attempt1',objectPath:path});
const withdrawal = () => ({ownerUid:'owner1',tenantId:'tenant1',projectId:'project1',withdrawalId:'withdrawal1'});
const proof = () => ({attemptId:'attempt1',epoch:4,bucket:'privatebucket1',objectPath:path,
  generation:null,bytesCommitted:false,writerDrained:true,writerIncapable:true,
  objectAbsent:true,inventoryAfterFence:true,generationDeleted:false});
const denied = f => assert.throws(f,{message:DENIED});
const newLedger = () => createReviewLedger(scope());
const reserved = () => {const s=newLedger();return reserveForReview(s,request(),s.version);};
const fenced = (start = false) => {
  let s=reserved(); if (start) s=startUploadForReview(s,'attempt1',s.version);
  return withdrawForReview(s,withdrawal(),s.version);
};

test('starts review-only with no write or deletion authority',()=>{
  const s=newLedger(); const info=inspectDrainForReview(s);
  assert.equal(info.deletionAcknowledged,false);
  assert.equal(info.modelDrainCandidate,false);
  assert.equal(s.storageWriteAuthorized,false);
  assert.equal(s.releaseAuthorized,false);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.scope));
});
test('reserve canonical same-scope attempt before withdrawal',()=>{
  const s=reserved();
  assert.equal(s.reservations[0].state,'RESERVED');
  assert.equal(s.scope.epoch,4);
  assert.equal(s.version,2);
});
test('stale compare-and-swap version denies competing admission',()=>{
  const s=reserved();denied(()=>reserveForReview(s,request(),1));
});
test('old consent epoch denied',()=>{const s=newLedger();const r=request();r.epoch=3;denied(()=>reserveForReview(s,r,s.version));});
test('future consent epoch denied',()=>{const s=newLedger();const r=request();r.epoch=5;denied(()=>reserveForReview(s,r,s.version));});
test('unknown attempt upload denied',()=>{const s=newLedger();denied(()=>startUploadForReview(s,'unreserved',s.version));});
test('reservation starts at most once',()=>{const s=reserved();const next=startUploadForReview(s,'attempt1',s.version);denied(()=>startUploadForReview(next,'attempt1',next.version));});
test('duplicate attempt reservation denied',()=>{const s=reserved();denied(()=>reserveForReview(s,request(),s.version));});
test('cross owner denied',()=>{const s=newLedger(),r=request();r.ownerUid='owner2';denied(()=>reserveForReview(s,r,s.version));});
test('cross tenant denied',()=>{const s=newLedger(),r=request();r.tenantId='tenant2';denied(()=>reserveForReview(s,r,s.version));});
test('cross project denied',()=>{const s=newLedger(),r=request();r.projectId='project2';denied(()=>reserveForReview(s,r,s.version));});
test('alternate bucket denied',()=>{const s=newLedger(),r=request();r.bucket='alternate1';denied(()=>reserveForReview(s,r,s.version));});
test('path traversal denied',()=>{const s=newLedger(),r=request();r.objectPath='../'+path;denied(()=>reserveForReview(s,r,s.version));});
test('different canonical attempt path denied',()=>{const s=newLedger(),r=request();r.objectPath=path.replace('attempt-attempt1','attempt-attempt2');denied(()=>reserveForReview(s,r,s.version));});
test('unsupported output extension denied',()=>{const s=newLedger(),r=request();r.objectPath=path.replace('.mp4','.exe');denied(()=>reserveForReview(s,r,s.version));});
test('caller-injected authority field denied',()=>{const s=newLedger(),r=request();r.storageWriteAuthorized=true;denied(()=>reserveForReview(s,r,s.version));});
test('withdraw bumps monotonic epoch, fences attempts and is immutable',()=>{
  const s=fenced(true);
  assert.equal(s.scope.epoch,5);assert.equal(s.phase,'FENCING');
  assert.equal(s.reservations[0].epoch,4);assert.equal(s.reservations[0].state,'IN_FLIGHT');
  assert.equal(s.deletionAcknowledged,false);
});
test('withdrawal is idempotent for exact same event',()=>{const s=fenced();assert.equal(withdrawForReview(s,withdrawal(),s.version),s);});
test('new withdrawal identity cannot reset an in-progress fence',()=>{const s=fenced(),e=withdrawal();e.withdrawalId='other1';denied(()=>withdrawForReview(s,e,s.version));});
test('unauthorized cross-owner withdrawal denied',()=>{const s=reserved(),e=withdrawal();e.ownerUid='owner2';denied(()=>withdrawForReview(s,e,s.version));});
test('new admission after withdrawal denied even with new epoch',()=>{const s=fenced(),r=request();r.epoch=5;denied(()=>reserveForReview(s,r,s.version));});
test('stale retry after withdrawal denied',()=>{const s=fenced();denied(()=>reserveForReview(s,request(),s.version));});
test('upload start paused before withdrawal cannot resume',()=>{const s=fenced();denied(()=>startUploadForReview(s,'attempt1',s.version));});
test('in-flight upload cannot be restarted after withdrawal',()=>{const s=fenced(true);denied(()=>startUploadForReview(s,'attempt1',s.version));});
test('with zero attempts drain model is candidate only, never deletion ACK',()=>{
  let s=newLedger();s=withdrawForReview(s,withdrawal(),s.version);
  const x=inspectDrainForReview(s);assert.equal(x.modelDrainCandidate,true);
  assert.equal(x.deletionAcknowledged,false);assert.equal(x.allWritersStorageFenced,false);
});
test('in-flight attempt blocks candidate drain',()=>{
  const s=fenced(true),x=inspectDrainForReview(s);
  assert.equal(x.modelDrainCandidate,false);assert.equal(x.unresolvedReservations,1);
});
test('candidate reconciliation still cannot ACK or authorize release',()=>{
  const s=fenced(true),v=observeDrainCandidate(s,proof(),s.version),x=inspectDrainForReview(v);
  assert.equal(x.modelDrainCandidate,true);
  assert.equal(x.providerProofAuthenticated,false);assert.equal(x.allWritersStorageFenced,false);
  assert.equal(x.deletionAcknowledged,false);assert.equal(x.releaseAuthorized,false);
});
test('missing writer drain denies candidate closure',()=>{const s=fenced(true),p=proof();p.writerDrained=false;denied(()=>observeDrainCandidate(s,p,s.version));});
test('storage writer not incapable denies candidate closure',()=>{const s=fenced(true),p=proof();p.writerIncapable=false;denied(()=>observeDrainCandidate(s,p,s.version));});
test('object still present denies candidate closure',()=>{const s=fenced(true),p=proof();p.objectAbsent=false;denied(()=>observeDrainCandidate(s,p,s.version));});
test('inventory before fence denies candidate closure',()=>{const s=fenced(true),p=proof();p.inventoryAfterFence=false;denied(()=>observeDrainCandidate(s,p,s.version));});
test('unknown generation with committed bytes denies candidate closure',()=>{const s=fenced(true),p=proof();p.bytesCommitted=true;denied(()=>observeDrainCandidate(s,p,s.version));});
test('generation known but not deleted denies candidate closure',()=>{const s=fenced(true),p=proof();Object.assign(p,{bytesCommitted:true,generation:'42',generationDeleted:false});denied(()=>observeDrainCandidate(s,p,s.version));});
test('generation-bound deleted observation remains non-authoritative',()=>{
  const s=fenced(true),p=proof();Object.assign(p,{bytesCommitted:true,generation:'42',generationDeleted:true});
  const next=observeDrainCandidate(s,p,s.version);
  assert.equal(next.reservations[0].observedGeneration,'42');
  assert.equal(inspectDrainForReview(next).deletionAcknowledged,false);
});
test('generation zero denied',()=>{const s=fenced(true),p=proof();Object.assign(p,{bytesCommitted:true,generation:'0',generationDeleted:true});denied(()=>observeDrainCandidate(s,p,s.version));});
test('unknown attempt cannot be reconciled',()=>{const s=fenced(),p=proof();p.attemptId='unknown1';denied(()=>observeDrainCandidate(s,p,s.version));});
test('alternate bucket observation denied',()=>{const s=fenced(),p=proof();p.bucket='anotherBucket';denied(()=>observeDrainCandidate(s,p,s.version));});
test('cross-attempt object observation denied',()=>{const s=fenced(),p=proof();p.objectPath=path.replace('attempt-attempt1','attempt-attempt2');denied(()=>observeDrainCandidate(s,p,s.version));});
test('old epoch may be reconciled ONLY as an old admitted reservation',()=>{const s=fenced(),p=proof();p.epoch=5;denied(()=>observeDrainCandidate(s,p,s.version));});
test('cannot reconcile before withdrawal',()=>{const s=reserved();denied(()=>observeDrainCandidate(s,proof(),s.version));});
test('duplicate drain observation denied',()=>{let s=fenced();s=observeDrainCandidate(s,proof(),s.version);denied(()=>observeDrainCandidate(s,proof(),s.version));});
test('forged extra provider authority field rejected',()=>{const s=fenced(),p=proof();p.verifiedByCloud=true;denied(()=>observeDrainCandidate(s,p,s.version));});
test('direct deletion acknowledgement is impossible',()=>denied(()=>acknowledgeDeletionForReview()));
test('malformed scope rejected',()=>{const s=scope();s.projectId='../project';denied(()=>createReviewLedger(s));});
test('invalid epoch rejected',()=>{const s=scope();s.epoch=0;denied(()=>createReviewLedger(s));});
test('version mismatch on withdrawal fails closed',()=>{const s=reserved();denied(()=>withdrawForReview(s,withdrawal(),1));});
test('a forged unfrozen ledger fails mutation guards',()=>{const s={...reserved()};denied(()=>reserveForReview(s,request(),s.version));});
