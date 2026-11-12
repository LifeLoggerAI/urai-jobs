'use strict';

/**
 * R1167 - review-only connector between the existing durable Firestore
 * reservation candidate and the *real GCS client interface*.
 *
 * This is NOT a private-output broker. It never accepts customer media,
 * never authorizes a Studio write, never decrements the outstanding-attempt
 * counter and never acknowledges deletion. It is limited to a fixed,
 * disposable, synthetic-only canary bucket and an explicitly named review
 * owner/project. It has NO production Studio/Jobs import or endpoint.
 *
 * A real provider test requires separately approved keyless identity and
 * independent IAM review. An injected fake GCS client proves only logic.
 */
const { createHash } = require('node:crypto');
const { Buffer } = require('node:buffer');

const CANARY_BUCKET = 'urai-security-canary-r1128-private';
const OWNER = 'synthetic-r1167-owner';
const TENANT = 'synthetic-r1167-tenant';
const PROJECT = 'synthetic-r1167-project';
const PURPOSE = 'life-movie.render';
const PREFIX = 'tenants/'+TENANT+'/life-movies/'+PROJECT+'/review-only/';
const PAYLOAD = Buffer.from('{"oneUraiCanary":"R1167_DISPOSABLE_SYNTHETIC_ONLY"}\n', 'ascii');
const GEN = /^[1-9][0-9]{0,19}$/;
const IDENT = /^attempt-[a-f0-9]{8}$/;
const DENIED = 'r1167_synthetic_gcs_bridge_unverified';
const deny = () => { throw new Error(DENIED); };

function plain(x) {
  try { return !!x && typeof x === 'object' && !Array.isArray(x) &&
    (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null); }
  catch { return false; }
}
function readOwn(x,k) {
  const d=Object.getOwnPropertyDescriptor(x,k);
  return d && Object.hasOwn(d,'value') ? d.value : undefined;
}
function exactClaim(claim) {
  try {
  const fields = ['ownerUid','tenantId','projectId','jobId','jobType','attemptId',
    'purpose','expectedEpoch','destination','expectedHash','consentReceiptId'];
  if (!plain(claim) || Reflect.ownKeys(claim).length!==fields.length ||
      fields.some(k=>!Object.hasOwn(claim,k) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(claim,k),'value'))) deny();
  const x=Object.fromEntries(fields.map(k=>[k,readOwn(claim,k)]));
  if (x.ownerUid!==OWNER || x.tenantId!==TENANT || x.projectId!==PROJECT ||
    x.jobType!=='studio.render.video' || x.purpose!==PURPOSE ||
    typeof x.jobId!=='string' || !/^synthetic-r1167-job-[a-f0-9]{8}$/.test(x.jobId) ||
    !IDENT.test(x.attemptId) || !Number.isSafeInteger(x.expectedEpoch) || x.expectedEpoch<1 ||
    x.destination!==PREFIX+x.attemptId+'/life-movie.render-manifest.json' ||
    x.expectedHash!==createHash('sha256').update(PAYLOAD).digest('hex') ||
    typeof x.consentReceiptId!=='string' || !/^[a-f0-9]{64}$/.test(x.consentReceiptId)) deny();
  return Object.freeze(x);
  } catch { deny(); } // Never expose untrusted getter/proxy errors.
}
function checkedGeneration(raw) {
  if (typeof raw==='number' && (!Number.isSafeInteger(raw) || raw<=0)) deny();
  const value = typeof raw==='string'||typeof raw==='number' ? String(raw) : '';
  if (!GEN.test(value)) deny();
  return value;
}
function fakeSafeReport(stage) {
  return Object.freeze({stage,productionAuthorized:false,storageWriteAuthorized:false,
    privateOutputDeletionAcknowledged:false,allWritersDrained:false,liveIamCertified:false});
}

/** A testable canary data-plane call, never the worker's production uploader.
 * Requires explicit invocation by an approved operator on a disposable GCP
 * identity. Does not create or distribute tokens, URLs, or credentials.
 * The protocol itself must validate current *server-owned* Firestore authority.
 */
function makeR1167SyntheticGcsBridge({protocol,storage}) {
  if (!protocol || !['reserve','begin','observeLateGeneration'].every(x=>typeof protocol[x]==='function') ||
      !storage || typeof storage.bucket!=='function') deny();

  async function probe(raw) {
    const claim=exactClaim(raw);
    let file, generation;
    let objectMayExist=false;
    // Server-owned Firestore transaction admission happens before the first byte.
    try {
      const reserved=await protocol.reserve(claim);
      if (!reserved || reserved.attemptState!=='RESERVED' ||
          reserved.storageWriteAuthorized!==false || reserved.productionAuthorized!==false) deny();
      const started=await protocol.begin(claim);
      if (!started || started.attemptState!=='IN_FLIGHT' ||
          started.storageWriteAuthorized!==false || started.productionAuthorized!==false) deny();
      file=storage.bucket(CANARY_BUCKET).file(claim.destination);
      if (!file || typeof file.save!=='function' ||
          typeof file.getMetadata!=='function' || typeof file.delete!=='function') deny();
      objectMayExist=true;
      // Deliberately nonresumable; no delegated resumable upload URI survives.
      await file.save(PAYLOAD,{resumable:false,validation:'crc32c',
        preconditionOpts:{ifGenerationMatch:0},
        metadata:{contentType:'application/json',cacheControl:'no-store'}});
      const [metadata]=await file.getMetadata();
      generation=checkedGeneration(metadata?.generation);
      // Persist even a post-withdrawal generation for strict reconciliation;
      // this NEVER means the epoch is still writable.
      const observed=await protocol.observeLateGeneration(claim,generation);
      if (!observed || observed.attemptState!=='UNVERIFIED_GENERATION' ||
        observed.storageWriteAuthorized!==false || observed.deletionAcknowledged!==false) deny();
      // Exact-generation cleanup, not a prefix sweep or user-data deletion.
      await file.delete({ifGenerationMatch:generation});
      objectMayExist=false;
      try { await file.getMetadata(); }
      catch (e) { if (e?.code===404) return fakeSafeReport('LIVE_VERSION_404_OBSERVED_SOFT_DELETE_UNVERIFIED'); throw e; }
      deny(); // Replacement/new generation means no trusted absence.
    } catch {
      if (objectMayExist && file && generation) {
        try { await file.delete({ifGenerationMatch:generation}); }
        catch { /* retain durable unverified-attempt; never claim cleanup */ }
      }
      deny(); // Do not expose provider messages, identities or object names.
    }
  }
  return Object.freeze({probe,canaryBucket:CANARY_BUCKET,
    privateOutputBrokerCertified:false,productionAuthorized:false});
}

module.exports={makeR1167SyntheticGcsBridge,DENIED,CANARY_BUCKET,PAYLOAD};
