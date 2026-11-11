'use strict';
/**
 * R1073 candidate durable Firestore owner/purpose reservation protocol.
 * Real Firestore runTransaction/create/update semantics (not an in-memory
 * reservation table); tests use a deterministic transaction adapter.
 *
 * IMPORTANT: NOT A STORAGE WRITER OR RELEASE GRANT. This module does not
 * authenticate network callers, verify Privacy signatures itself, issue
 * upload credentials, create GCS objects or acknowledge deletion. The
 * trusted deployable broker must supply independently reviewed signature
 * verification, exclusive bucket IAM, stream lifecycle control and live
 * provider tests. The current Studio private write hard-off is UNCHANGED.
 *
 * All outcomes are diagnostic and productionAuthorized:false. The scope
 * and attempt documents are exclusively server-owned and never constructed
 * from a worker's arbitrary Firestore path.
 */
const {createHash} = require('node:crypto');
const {assertCanonicalPrivacyRevocation} = require('./canonical-privacy-revocation');
const DENIED = 'life_movie_private_broker_reservation_unverified';
const PURPOSE = 'life-movie.render';
const OWNER_FENCES = 'lifeMoviePrivateOutputRevocationFences';
const SCOPES = 'lifeMovieBrokerOwnerPurposeScopesCandidate';
const ATTEMPTS = 'lifeMovieBrokerAttemptsCandidate';
const BLOCKS = 'jobConsentBlocks';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const GEN = /^[1-9][0-9]{0,19}$/;
const STAGES = new Set(['RESERVED','IN_FLIGHT','UNVERIFIED_GENERATION']);
const deny = () => { throw new Error(DENIED); };
const hash = s => createHash('sha256').update(s).digest('hex');
const goodId = s => typeof s === 'string' && ID.test(s) && s !== '.' && s !== '..';
const exact = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k) &&
   Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'));
const checked = (raw) => {
  const keys=['ownerUid','tenantId','projectId','jobId','jobType','attemptId','purpose','expectedEpoch','destination','expectedHash','consentReceiptId'];
  if (!exact(raw,keys) || !['ownerUid','tenantId','projectId','jobId','attemptId'].every(k=>goodId(raw[k])) ||
      !['studio.render.video','studio.assemble.video'].includes(raw.jobType) || raw.purpose!==PURPOSE ||
      !Number.isSafeInteger(raw.expectedEpoch) || raw.expectedEpoch<1 ||
      !HASH.test(raw.expectedHash) || !HASH.test(raw.consentReceiptId) ||
      typeof raw.destination!=='string') deny();
  const prefix=`tenants/${raw.tenantId}/life-movies/${raw.projectId}/`;
  // Render and assembly outputs must have an attempt-scoped path and no
  // traversal. Full output layout is separately checked at worker boundary.
  const rest=raw.destination.startsWith(prefix)?raw.destination.slice(prefix.length):'';
  const segments=rest.split('/');
  if (segments.length<3 || segments.length>6 || segments.some(s=>!goodId(s)) ||
      !segments.some(s=>s===raw.attemptId)) deny();
  return Object.freeze({...raw});
};
const ids = x => ({scope:hash(`urai-owner-purpose-v1\n${x.ownerUid}\n${PURPOSE}`),
  block:hash(`${x.ownerUid}\n${PURPOSE}`),
  revocation:hash(`urai-private-output-revocation-fence-v1\n${x.ownerUid}\n${PURPOSE}`),
  attempt:hash(['urai-broker-attempt-v1',x.ownerUid,x.tenantId,x.projectId,x.jobId,x.attemptId].join('\n'))});
const data = snap => snap?.exists===true && typeof snap.data==='function' ? snap.data():null;
const snapValid = (obj) => !!obj && typeof obj==='object' && !Array.isArray(obj) &&
  [Object.prototype,null].includes(Object.getPrototypeOf(obj));
const read = async(tx,ref)=>{const snap=await tx.get(ref);return {exists:snap?.exists===true,data:data(snap)};};
const ownerValid=(o,x)=>snapValid(o) && o.uid===x.ownerUid && o.tenantId===x.tenantId &&
  o.accountStatus==='active' && o.deleted===false && o.markedForDeletion===false &&
  o.disabled===false && o.deletionPending===false &&
  (o.dataRightsDeletionPendingCentralPrivacy===false || !Object.hasOwn(o,'dataRightsDeletionPendingCentralPrivacy'));
const jobValid=(j,x)=>snapValid(j) && j.ownerUid===x.ownerUid && j.tenantId===x.tenantId &&
  j.status==='RUNNING' && j.sourceSystem==='urai-studio' &&
  j.jobType===x.jobType && j?.payload?.projectId===x.projectId &&
  j.consent?.purpose===PURPOSE && j.consent?.decisionReceiptId===x.consentReceiptId;
const scopeValid=(s,x)=>snapValid(s) && s.schema==='R1073_OWNER_PURPOSE_CANDIDATE_V1' &&
  s.ownerUid===x.ownerUid && s.purpose===PURPOSE && s.phase==='OPEN' &&
  s.epoch===x.expectedEpoch && s.productionAuthorized===false &&
  Number.isSafeInteger(s.version) && s.version>=1 && s.version<Number.MAX_SAFE_INTEGER &&
  Number.isSafeInteger(s.attemptsEverReserved) && s.attemptsEverReserved>=0 &&
  s.attemptsEverReserved<Number.MAX_SAFE_INTEGER &&
  Number.isSafeInteger(s.unsettledAttemptCount) && s.unsettledAttemptCount>=0 &&
  s.unsettledAttemptCount<=s.attemptsEverReserved &&
  s.unsettledAttemptCount<Number.MAX_SAFE_INTEGER;
const attemptValid=(a,x)=>snapValid(a) && a.ownerUid===x.ownerUid &&
  a.tenantId===x.tenantId && a.projectId===x.projectId && a.jobId===x.jobId &&
  a.attemptId===x.attemptId && a.destination===x.destination &&
  a.epoch===x.expectedEpoch && STAGES.has(a.state) &&
  a.productionAuthorized===false;
const noRevocation=(v)=>v.exists===false;
const noBlock=(v)=>v.exists===false || (snapValid(v.data) && v.data.active===false);
const requireIssuer=(fn)=>{if(typeof fn!=='function')deny();return fn;};
const noCapability=()=>Object.freeze({productionAuthorized:false,storageWriteAuthorized:false,
  deletionAcknowledged:false,storageWriteFenceVerified:false});

/** Caller may not seed an OPEN scope using this interface. Initialization
 * requires a separate, security-reviewed Privacy issuer/owner transaction. */
function makeOwnerPurposeReservationProtocol({db, verifyPositiveConsentReceipt, verifyRevocationEvent}) {
  if(!db || typeof db.runTransaction!=='function' || typeof db.collection!=='function')deny();
  const verify=requireIssuer(verifyPositiveConsentReceipt);
  const verifyWithdrawal=requireIssuer(verifyRevocationEvent);
  const refs=x=>{const k=ids(x);return {
    scope:db.collection(SCOPES).doc(k.scope),
    attempt:db.collection(ATTEMPTS).doc(k.attempt),
    owner:db.collection('users').doc(x.ownerUid),
    job:db.collection('jobs').doc(x.jobId),
    consentBlock:db.collection(BLOCKS).doc(k.block),
    revocation:db.collection(OWNER_FENCES).doc(k.revocation),
  };};
  // Read all authorities inside ONE transaction; write scope.version as a
  // CAS contention point shared with withdrawal. Do not trust worker claims.
  async function readAuthorities(tx,x,ref) {
    const [scope,owner,job,block,revocation,attempt]=await Promise.all([
      read(tx,ref.scope),read(tx,ref.owner),read(tx,ref.job),
      read(tx,ref.consentBlock),read(tx,ref.revocation),read(tx,ref.attempt),
    ]);
    if (!scope.exists || !scopeValid(scope.data,x) || !ownerValid(owner.data,x) ||
        !jobValid(job.data,x) || !noBlock(block) || !noRevocation(revocation))deny();
    let accepted=false;
    try {accepted=await verify({owner:owner.data,job:job.data,claim:x,transaction:tx});}
    catch {deny();} // Never echo issuer errors, signed receipts or credentials.
    if(accepted!==true)deny();
    return {scope:scope.data,attempt};
  }
  const reserve=async raw=>{
    const x=checked(raw),r=refs(x);
    return db.runTransaction(async tx=>{
      const {scope,attempt}=await readAuthorities(tx,x,r);
      if(attempt.exists)deny();
      tx.create(r.attempt,{
        ownerUid:x.ownerUid,tenantId:x.tenantId,projectId:x.projectId,
        jobId:x.jobId,attemptId:x.attemptId,epoch:x.expectedEpoch,
        destination:x.destination,expectedHash:x.expectedHash,
        consentReceiptId:x.consentReceiptId,state:'RESERVED',
        productionAuthorized:false,generationObservedUnverified:null,
      });
      // Count all admitted attempts in the same durable transaction as create.
      // This counter is deliberately monotonic/unsettled: never infer a drain
      // or release the last outstanding writer from a timeout or callback.
      tx.update(r.scope,{version:scope.version+1,
        attemptsEverReserved:scope.attemptsEverReserved+1,
        unsettledAttemptCount:scope.unsettledAttemptCount+1});
      return Object.freeze({...noCapability(),attemptState:'RESERVED',epoch:scope.epoch});
    });
  };
  const begin=async raw=>{
    const x=checked(raw),r=refs(x);
    return db.runTransaction(async tx=>{
      const {scope,attempt}=await readAuthorities(tx,x,r);
      if(!attempt.exists || !attemptValid(attempt.data,x) || attempt.data.state!=='RESERVED' ||
         attempt.data.expectedHash!==x.expectedHash ||
         attempt.data.consentReceiptId!==x.consentReceiptId)deny();
      tx.update(r.attempt,{state:'IN_FLIGHT'});
      tx.update(r.scope,{version:scope.version+1});
      return Object.freeze({...noCapability(),attemptState:'IN_FLIGHT',epoch:scope.epoch});
    });
  };
  // A physical upload can finish AFTER withdrawal. Permit a trusted broker
  // to record its unverified generation, but NEVER turn it into an ACK.
  // Future integration must verify generation with provider-readback.
  const observeLateGeneration=async(raw,generation)=>{
    const x=checked(raw),r=refs(x);
    if(typeof generation!=='string' || !GEN.test(generation))deny();
    return db.runTransaction(async tx=>{
      const v=await read(tx,r.attempt);
      if(!v.exists || !attemptValid(v.data,x) ||
         !['IN_FLIGHT','UNVERIFIED_GENERATION'].includes(v.data.state) ||
         (v.data.generationObservedUnverified!==null && v.data.generationObservedUnverified!==generation))deny();
      tx.update(r.attempt,{state:'UNVERIFIED_GENERATION',generationObservedUnverified:generation});
      return Object.freeze({...noCapability(),attemptState:'UNVERIFIED_GENERATION'});
    });
  };
  // Fences the same aggregate document; never clears attempts, and never
  // returns a deletion receipt. Only the Privacy service may call this after
  // authenticating its signed event (not provided by this library).
  const fence=async (raw,eventId)=>{
    const x=checked(raw),r=refs(x);
    if(!goodId(eventId))deny();
    return db.runTransaction(async tx=>{
      // Both records are canonical Jobs/Privacy authority. Observe them in
      // the SAME transaction as the owner/purpose fence update.
      const [sc, privacyBlock, canonicalFence] = await Promise.all([
        read(tx,r.scope),read(tx,r.consentBlock),read(tx,r.revocation),
      ]);
      if(!sc.exists || !snapValid(sc.data) || sc.data.ownerUid!==x.ownerUid ||
         sc.data.purpose!==PURPOSE || sc.data.schema!=='R1073_OWNER_PURPOSE_CANDIDATE_V1' ||
         sc.data.productionAuthorized!==false || !Number.isSafeInteger(sc.data.epoch) ||
         !Number.isSafeInteger(sc.data.version) ||
         !Number.isSafeInteger(sc.data.attemptsEverReserved) ||
         sc.data.attemptsEverReserved<0 ||
         sc.data.attemptsEverReserved>=Number.MAX_SAFE_INTEGER ||
         !Number.isSafeInteger(sc.data.unsettledAttemptCount) ||
         sc.data.unsettledAttemptCount<0 ||
         sc.data.unsettledAttemptCount>=Number.MAX_SAFE_INTEGER ||
         sc.data.unsettledAttemptCount>sc.data.attemptsEverReserved)deny();
      let authenticated=false;
      try {authenticated=await verifyWithdrawal({ownerUid:x.ownerUid,purpose:PURPOSE,
        eventId,transaction:tx,scope:sc.data});} catch {deny();}
      if(authenticated!==true)deny();
      // Do not treat a callback, a worker-provided event ID, or a synthetic
      // signature-shaped object as a verified canonical Privacy decision.
      try { assertCanonicalPrivacyRevocation(
        {exists:privacyBlock.exists,data:()=>privacyBlock.data},
        {exists:canonicalFence.exists,data:()=>canonicalFence.data},
        {ownerUid:x.ownerUid,purpose:PURPOSE,eventId}); } catch { deny(); }
      if(sc.data.phase==='FENCING' && sc.data.eventId===eventId)return noCapability();
      if(sc.data.phase!=='OPEN' || sc.data.epoch>=Number.MAX_SAFE_INTEGER ||
         sc.data.version>=Number.MAX_SAFE_INTEGER)deny();
      // Preserve unsettledAttemptCount unchanged; even zero is not provider
      // proof of terminated streams, effective IAM, or generation absence.
      tx.update(r.scope,{phase:'FENCING',eventId,epoch:sc.data.epoch+1,version:sc.data.version+1});
      return noCapability();
    });
  };
  const deletionAck=async()=>deny();
  const storageWrite=async()=>deny();
  return Object.freeze({reserve,begin,observeLateGeneration,fence,deletionAck,storageWrite});
}
module.exports={makeOwnerPurposeReservationProtocol,DENIED,OWNER_FENCES,SCOPES,ATTEMPTS};
