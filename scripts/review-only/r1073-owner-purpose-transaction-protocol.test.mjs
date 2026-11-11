import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {makeOwnerPurposeReservationProtocol,DENIED,OWNER_FENCES,SCOPES,ATTEMPTS} = require('../../workers/storage-broker/owner-purpose-reservation.js');
const denied=/life_movie_private_broker_reservation_unverified/;
const owner='owner-one',tenant='tenant-one',project='project-one',job='job-one';
const x=()=>({ownerUid:owner,tenantId:tenant,projectId:project,jobId:job,
 jobType:'studio.render.video',attemptId:'attempt-abc',purpose:'life-movie.render',
 expectedEpoch:1,destination:`tenants/${tenant}/life-movies/${project}/render/attempt-abc/life-movie.mp4`,
 expectedHash:'a'.repeat(64),consentReceiptId:'b'.repeat(64)});
class MemoryFirestoreTx {
 constructor(){this.docs=new Map();this.queue=Promise.resolve();this.writes=0;}
 collection(collection){return {doc:(id)=>({path:collection+'/'+id})};}
 seed(path,data){this.docs.set(path,structuredClone(data));}
 findPrefix(prefix){return [...this.docs.entries()].filter(([k])=>k.startsWith(prefix));}
 async runTransaction(fn){
  let release;const lock=new Promise(resolve=>{release=resolve});
  const prior=this.queue;this.queue=prior.then(()=>lock);await prior;
  const pending=new Map();
  const tx={get:async ref=>{const d=pending.has(ref.path)?pending.get(ref.path):this.docs.get(ref.path);
    return {exists:d!==undefined,data:()=>d===undefined?undefined:structuredClone(d)}},
    create:(ref,data)=>{if(this.docs.has(ref.path)||pending.has(ref.path))throw Error('duplicate');pending.set(ref.path,structuredClone(data));},
    update:(ref,patch)=>{const d=pending.has(ref.path)?pending.get(ref.path):this.docs.get(ref.path);
      if(d===undefined)throw Error('missing');pending.set(ref.path,{...structuredClone(d),...structuredClone(patch)})}};
  try{const result=await fn(tx);for(const [k,v] of pending)this.docs.set(k,v);this.writes+=pending.size;return result;}
  finally{release()}
 }
}
function fixture(opts={}){
 const db=new MemoryFirestoreTx(),c=x();
 db.seed('users/'+owner,{uid:owner,tenantId:tenant,accountStatus:'active',deleted:false,
  markedForDeletion:false,disabled:false,deletionPending:false});
 db.seed('jobs/'+job,{ownerUid:owner,tenantId:tenant,status:'RUNNING',sourceSystem:'urai-studio',
  jobType:c.jobType,payload:{projectId:project},consent:{purpose:c.purpose,decisionReceiptId:c.consentReceiptId}});
 // Scope IDs are private to this library. To seed test-only authoritative scope,
 // derive its exactly documented deterministic owner/purpose key.
 const {createHash}=require('node:crypto');
 const h=(s)=>createHash('sha256').update(s).digest('hex');
 const scopeId=h(`urai-owner-purpose-v1\n${owner}\nlife-movie.render`);
 const canonicalId=h(`urai-private-output-revocation-fence-v1\n${owner}\nlife-movie.render`);
 const blockId=h(`${owner}\nlife-movie.render`);
 db.seed(`${SCOPES}/${scopeId}`,{schema:'R1073_OWNER_PURPOSE_CANDIDATE_V1',ownerUid:owner,purpose:'life-movie.render',phase:'OPEN',epoch:1,version:1,attemptsEverReserved:0,unsettledAttemptCount:0,productionAuthorized:false});
 const protocol=makeOwnerPurposeReservationProtocol({db,verifyPositiveConsentReceipt:async({job,claim})=>(opts.throwIssuer ? (()=>{throw Error('synthetic_private_issuer_error')})() : opts.verified!==false) && job.consent.decisionReceiptId===claim.consentReceiptId,
  verifyRevocationEvent:async({eventId})=>opts.revokeVerified!==false && eventId.startsWith('withdrawal-')});
 return {db,protocol,scope:`${SCOPES}/${scopeId}`,canonical:`${OWNER_FENCES}/${canonicalId}`,block:`jobConsentBlocks/${blockId}`};
}
function seedCanonical(f,eventId){
  f.db.seed(f.block,{active:true,consumerId:'urai-jobs',status:'blocked',
    ownerUid:owner,purpose:'life-movie.render',eventId,policyVersion:'v1',integrityHash:'a'.repeat(64)});
  f.db.seed(f.canonical,{schemaVersion:'R1027_PRIVATE_OUTPUT_FENCE_V1',ownerUid:owner,
    purpose:'life-movie.render',eventId,phase:'FENCING',epoch:1,
    legacyLineageUnverified:true,storageWriteAuthorized:false,storageWriteFenceVerified:false,
    allWritersDrained:false,privateOutputDeletionAcknowledged:false});
}
const invalid = async p=>assert.rejects(p,denied);
const flagFalse=r=>{for(const k of ['productionAuthorized','storageWriteAuthorized','deletionAcknowledged','storageWriteFenceVerified'])assert.equal(r[k],false,k)};

test('one positive verified synthetic signature is required to reserve; still no storage authority',async()=>{
 const {db,protocol}=fixture();const r=await protocol.reserve(x());flagFalse(r);
 assert.equal(r.attemptState,'RESERVED');assert.equal(db.findPrefix(ATTEMPTS+'/').length,1);
 assert.equal(db.docs.get(db.findPrefix(ATTEMPTS+'/')[0][0]).state,'RESERVED');
});
test('missing signature validation denies before durable reservation',async()=>{
 const {db,protocol}=fixture({verified:false});await invalid(protocol.reserve(x()));
 assert.equal(db.findPrefix(ATTEMPTS+'/').length,0);
});
test('concurrent reservations sharing attempt id accept at most one',async()=>{
 const {db,protocol}=fixture();const results=await Promise.allSettled([...Array(16)].map(()=>protocol.reserve(x())));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected').length,15);
 assert.equal(db.findPrefix(ATTEMPTS+'/').length,1);
});
test('owner deletion pending / disabled / unknown identity all deny',async()=>{
 for(const mutation of [{deletionPending:true},{disabled:true},{tenantId:'different'},{accountStatus:'suspended'}]){
  const f=fixture();f.db.seed('users/'+owner,{...f.db.docs.get('users/'+owner),...mutation});
  await invalid(f.protocol.reserve(x()));assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0);
 }
});
test('source job status, tenant, type, receipt and project mismatch each deny',async()=>{
 const variants=[{status:'CANCELLED'},{tenantId:'other'},{jobType:'studio.admin'},
  {payload:{projectId:'wrong'}},{consent:{purpose:'life-movie.render',decisionReceiptId:'c'.repeat(64)}}];
 for(const patch of variants){const f=fixture();f.db.seed('jobs/'+job,{...f.db.docs.get('jobs/'+job),...patch});
   await invalid(f.protocol.reserve(x()));assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0)}
});
test('canonical owner/purpose withdrawal denies new reservation across different project',async()=>{
 const f=fixture();f.db.seed(f.canonical,{phase:'FENCING',eventId:'synthetic-event'});
 await invalid(f.protocol.reserve(x()));await invalid(f.protocol.reserve({...x(),projectId:'project-two',destination:'tenants/tenant-one/life-movies/project-two/render/attempt-abc/life-movie.mp4'}));
});
test('active and malformed consent blocks deny',async()=>{
 for(const active of [true,'false',null,undefined]){const f=fixture();f.db.seed(f.block,{active});
  await invalid(f.protocol.reserve(x()));}
});
test('phase/epoch/version preconditions prevent reused or stale write attempts',async()=>{
 const f=fixture();await invalid(f.protocol.reserve({...x(),expectedEpoch:2}));
 await f.protocol.reserve(x());await invalid(f.protocol.reserve(x()));
 await invalid(f.protocol.begin({...x(),expectedEpoch:2}));
 const begin=await f.protocol.begin(x());flagFalse(begin);
 await invalid(f.protocol.begin(x()));
});
test('owner-wide withdrawal before begin permanently fences, no deletion acknowledgment',async()=>{
 const f=fixture();await f.protocol.reserve(x());seedCanonical(f,'withdrawal-a');const r=await f.protocol.fence(x(),'withdrawal-a');flagFalse(r);
 await invalid(f.protocol.begin(x()));await invalid(f.protocol.reserve({...x(),attemptId:'attempt-later',destination:'tenants/tenant-one/life-movies/project-one/render/attempt-later/life-movie.mp4'}));
 const state=f.db.docs.get(f.scope);assert.equal(state.phase,'FENCING');assert.equal(state.epoch,2);
 assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,1);await invalid(f.protocol.deletionAck());
});
test('same-event withdrawal replay idempotent; conflicting event denies',async()=>{
 const f=fixture();seedCanonical(f,'withdrawal-a');await f.protocol.fence(x(),'withdrawal-a');await f.protocol.fence(x(),'withdrawal-a');
 assert.equal(f.db.docs.get(f.scope).epoch,2);await invalid(f.protocol.fence(x(),'withdrawal-b'));
});
test('in-flight physical generation after withdrawal is retained as UNKNOWN not ACK',async()=>{
 const f=fixture();await f.protocol.reserve(x());await f.protocol.begin(x());seedCanonical(f,'withdrawal-a');await f.protocol.fence(x(),'withdrawal-a');
 const r=await f.protocol.observeLateGeneration(x(),'1234567');flagFalse(r);
 assert.equal(r.attemptState,'UNVERIFIED_GENERATION');
 assert.equal(f.db.findPrefix(ATTEMPTS+'/')[0][1].generationObservedUnverified,'1234567');
 await invalid(f.protocol.observeLateGeneration(x(),'999'));await invalid(f.protocol.deletionAck());
});
test('no cloud-writer capability, no deletion ACK, no dynamic privilege flags',async()=>{
 const f=fixture();await invalid(f.protocol.storageWrite());await invalid(f.protocol.deletionAck());
 await invalid(f.protocol.reserve({...x(),cloudIamVerified:true}));
 await invalid(f.protocol.reserve({...x(),destination:'tenants/tenant-one/life-movies/other/render/attempt-abc/life-movie.mp4'}));
 assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0);
});

test('missing or forged authoritative scope cannot initialize a usable writer',async()=>{
 for(const variant of [null,{productionAuthorized:true},{schema:'OTHER'}]){
  const f=fixture();if(variant===null)f.db.docs.delete(f.scope);
  else f.db.seed(f.scope,{...f.db.docs.get(f.scope),...variant});
  await invalid(f.protocol.reserve(x()));assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0);
 }
});
test('issuer errors are masked, leaving no credential in rejection',async()=>{
 const f=fixture({throwIssuer:true});await assert.rejects(f.protocol.reserve(x()),e=>{
  assert.equal(e.message,DENIED);return true;
 });assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0);
});
test('begin versus withdrawal races serialize; late result never provides ACK',async()=>{
 for(const order of ['begin-first','fence-first']){
  const f=fixture();await f.protocol.reserve(x());
  let result;
  if(order==='begin-first') {
    const first=await Promise.allSettled([f.protocol.begin(x())]);
    seedCanonical(f,'withdrawal-race');
    const second=await Promise.allSettled([f.protocol.fence(x(),'withdrawal-race')]);
    result=[...first,...second];
  } else {
    seedCanonical(f,'withdrawal-race');
    result=await Promise.allSettled([f.protocol.fence(x(),'withdrawal-race'),f.protocol.begin(x())]);
  }
  assert.equal(f.db.docs.get(f.scope).phase,'FENCING');
  assert.equal(f.db.docs.get(f.scope).epoch,2);
  assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,1);
  if(order==='fence-first')assert.equal(result[1].status,'rejected');
  await invalid(f.protocol.deletionAck());await invalid(f.protocol.storageWrite());
 }
});
test('one owner-purpose fence serializes multiple legitimate projects',async()=>{
 const f=fixture();const other={...x(),projectId:'project-two',jobId:'job-two',attemptId:'attempt-two',
   destination:'tenants/tenant-one/life-movies/project-two/render/attempt-two/life-movie.mp4'};
 f.db.seed('jobs/job-two',{...f.db.docs.get('jobs/'+job),payload:{projectId:'project-two'}});
 await f.protocol.reserve(x());await f.protocol.reserve(other);
 assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,2);
 seedCanonical(f,'withdrawal-wide');await f.protocol.fence(x(),'withdrawal-wide');
 await invalid(f.protocol.begin(x()));await invalid(f.protocol.begin(other));
 assert.equal(f.db.docs.get(f.scope).epoch,2);
});
test('withdrawal requires verified event; forged revoker cannot advance epoch',async()=>{
 const f=fixture({revokeVerified:false});await invalid(f.protocol.fence(x(),'withdrawal-forged'));
 assert.equal(f.db.docs.get(f.scope).phase,'OPEN');
 const g=fixture();await invalid(g.protocol.fence(x(),'fake-event'));
 assert.equal(g.db.docs.get(g.scope).epoch,1);
});
test('R1074 positive callback cannot fence without matching canonical Privacy state',async()=>{
 const missing=fixture();await invalid(missing.protocol.fence(x(),'withdrawal-a'));
 assert.equal(missing.db.docs.get(missing.scope).phase,'OPEN');
 for(const mutation of [{active:false},{eventId:'withdrawal-other'},{integrityHash:'bogus'}]){
  const f=fixture();seedCanonical(f,'withdrawal-a');f.db.seed(f.block,{...f.db.docs.get(f.block),...mutation});
  await invalid(f.protocol.fence(x(),'withdrawal-a'));
  assert.equal(f.db.docs.get(f.scope).epoch,1);
 }
 for(const mutation of [{eventId:'withdrawal-other'},{phase:'OPEN'},{allWritersDrained:true}]){
  const f=fixture();seedCanonical(f,'withdrawal-a');f.db.seed(f.canonical,{...f.db.docs.get(f.canonical),...mutation});
  await invalid(f.protocol.fence(x(),'withdrawal-a'));
  assert.equal(f.db.docs.get(f.scope).epoch,1);
 }
});

test('R1097 durable counters increment once with attempt creation and retain outstanding on withdrawal',async()=>{
 const f=fixture();const second={...x(),projectId:'project-two',jobId:'job-two',attemptId:'attempt-two',
   destination:'tenants/tenant-one/life-movies/project-two/render/attempt-two/life-movie.mp4'};
 f.db.seed('jobs/job-two',{...f.db.docs.get('jobs/'+job),payload:{projectId:'project-two'}});
 const initial=f.db.docs.get(f.scope);
 assert.equal(initial.attemptsEverReserved,0);assert.equal(initial.unsettledAttemptCount,0);
 await f.protocol.reserve(x());await f.protocol.reserve(second);
 let state=f.db.docs.get(f.scope);
 assert.equal(state.attemptsEverReserved,2);assert.equal(state.unsettledAttemptCount,2);
 await invalid(f.protocol.reserve(x()));
 state=f.db.docs.get(f.scope);assert.equal(state.unsettledAttemptCount,2);
 await f.protocol.begin(x());
 seedCanonical(f,'withdrawal-counters');await f.protocol.fence(x(),'withdrawal-counters');
 state=f.db.docs.get(f.scope);
 assert.equal(state.phase,'FENCING');assert.equal(state.epoch,2);
 assert.equal(state.unsettledAttemptCount,2);
 await f.protocol.observeLateGeneration(x(),'1234');
 assert.equal(f.db.docs.get(f.scope).unsettledAttemptCount,2);
 await invalid(f.protocol.deletionAck());await invalid(f.protocol.storageWrite());
});

test('R1097 untrusted or missing scope drain counters deny all new admissions',async()=>{
 for(const patch of [
  {attemptsEverReserved:undefined},{unsettledAttemptCount:undefined},
  {attemptsEverReserved:-1},{unsettledAttemptCount:-1},
  {attemptsEverReserved:'0'},{unsettledAttemptCount:0.5},
  {attemptsEverReserved:0,unsettledAttemptCount:1},
  {attemptsEverReserved:Number.MAX_SAFE_INTEGER,unsettledAttemptCount:0},
  {attemptsEverReserved:0,unsettledAttemptCount:Number.MAX_SAFE_INTEGER},
 ]) {
  const f=fixture();const current=f.db.docs.get(f.scope);f.db.seed(f.scope,{...current,...patch});
  await invalid(f.protocol.reserve(x()));
  assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0);
 }
});

test('R1097 one contested reservation creates exactly one counted attempt',async()=>{
 const f=fixture();
 const out=await Promise.allSettled([...Array(16)].map(()=>f.protocol.reserve(x())));
 assert.equal(out.filter(v=>v.status==='fulfilled').length,1);
 assert.equal(f.db.docs.get(f.scope).attemptsEverReserved,1);
 assert.equal(f.db.docs.get(f.scope).unsettledAttemptCount,1);
});

test('R1097 zero unsettled is never broker-write or deletion-ACK authorization',async()=>{
 const f=fixture();
 seedCanonical(f,'withdrawal-empty');
 await f.protocol.fence(x(),'withdrawal-empty');
 assert.equal(f.db.docs.get(f.scope).unsettledAttemptCount,0);
 await invalid(f.protocol.deletionAck());
 await invalid(f.protocol.storageWrite());
});

test('R1098 malformed revocation counters fail closed before fencing epoch or deletion ACK',async()=>{
 for(const patch of [
  {attemptsEverReserved:-1,unsettledAttemptCount:0},
  {attemptsEverReserved:Number.MAX_SAFE_INTEGER,unsettledAttemptCount:0},
  {attemptsEverReserved:0,unsettledAttemptCount:Number.MAX_SAFE_INTEGER},
  {attemptsEverReserved:0,unsettledAttemptCount:-1},
  {attemptsEverReserved:0.5,unsettledAttemptCount:0},
  {epoch:0},{epoch:-1},{version:0},{version:-1},
 ]) {
  const f=fixture();
  const prior=f.db.docs.get(f.scope);
  f.db.seed(f.scope,{...prior,...patch});
  const stateBefore=structuredClone(f.db.docs.get(f.scope));
  seedCanonical(f,'withdrawal-counter-invalid');
  await invalid(f.protocol.fence(x(),'withdrawal-counter-invalid'));
  assert.deepEqual(f.db.docs.get(f.scope),stateBefore);
  await invalid(f.protocol.storageWrite());
  await invalid(f.protocol.deletionAck());
 }
});

test('R1102 an unadvanceable maximum-safe-integer epoch denies new reservations', async()=>{
  const f=fixture();
  const state=f.db.docs.get(f.scope);
  f.db.seed(f.scope,{...state,epoch:Number.MAX_SAFE_INTEGER});
  await invalid(f.protocol.reserve({...x(),expectedEpoch:Number.MAX_SAFE_INTEGER}));
  assert.equal(f.db.findPrefix(ATTEMPTS+'/').length,0);
  await invalid(f.protocol.storageWrite());
  await invalid(f.protocol.deletionAck());
});
