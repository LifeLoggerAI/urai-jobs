'use strict';

/**
 * R1066 review-only schema for UNTRUSTED worker output claims.
 * Validation is NOT authenticated consent, identity, revocation, IAM, a
 * reservation, an upload permission, or a deletion acknowledgment. The future
 * isolated writer MUST independently establish these from server-owned state.
 * There is deliberately no GCS client, network, credential or success branch.
 */
const { isAbsolute } = require('node:path');
const ERROR = 'life_movie_exclusive_storage_broker_intent_unverified';
const FIELDS = [
  'ownerUid','tenantId','projectId','jobId','jobType','purpose',
  'consentReceiptId','renderPlanDigest','sceneTruthDigest','sceneTruthReceiptRef',
  'attemptPrefix','bucketName','destination','localPath','contentType',
  'expectedHash','signal',
];
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const RECEIPT = /^str_[A-Za-z0-9_-]{16,64}_[a-z0-9]{8,16}_[A-Za-z0-9_-]{40,64}$/;
const UUID = /^attempt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BUCKET = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;
const OUTPUTS = Object.freeze({
  'studio.render.video': Object.freeze({
    'life-movie.mp4':'video/mp4',
    'life-movie.srt':'application/x-subrip',
    'life-movie.render-manifest.json':'application/json',
  }),
  'studio.assemble.video': Object.freeze({
    'life-movie-final.mp4':'video/mp4',
    'life-movie-final.srt':'application/x-subrip',
    'life-movie-final.assembly-manifest.json':'application/json',
  }),
});
function deny() { throw new Error(ERROR); }
function segment(s) { return typeof s === 'string' && SEGMENT.test(s) && s !== '.' && s !== '..'; }
/** Pure structural classifier only; all authority flags always false. */
function inspectUntrustedPrivateOutputIntent(raw) {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(raw))) deny();
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Reflect.ownKeys(descriptors).length !== FIELDS.length ||
      FIELDS.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k],'value'))) deny();
    const x = Object.fromEntries(FIELDS.map(k=>[k,descriptors[k].value]));
    if (!['ownerUid','tenantId','projectId','jobId'].every(k=>segment(x[k])) ||
      !Object.hasOwn(OUTPUTS,x.jobType) || x.purpose !== 'life-movie.render' ||
      !HASH.test(x.consentReceiptId) || !HASH.test(x.renderPlanDigest) ||
      !HASH.test(x.sceneTruthDigest) || !RECEIPT.test(x.sceneTruthReceiptRef) ||
      !BUCKET.test(x.bucketName) || x.bucketName.includes('..') ||
      typeof x.localPath !== 'string' || !isAbsolute(x.localPath) ||
      /[\u0000-\u001f]/.test(x.localPath) || !HASH.test(x.expectedHash) ||
      !(x.signal instanceof AbortSignal) || x.signal.aborted) deny();
    const root = 'tenants/'+x.tenantId+'/life-movies/'+x.projectId+'/';
    if (typeof x.attemptPrefix !== 'string' || !x.attemptPrefix.startsWith(root)) deny();
    const segments = x.attemptPrefix.slice(root.length).split('/');
    if (segments.length < 2 || !segments.every(segment) || !UUID.test(segments.at(-1))) deny();
    if (x.jobType === 'studio.assemble.video' && segments[0] !== 'final') deny();
    if (x.jobType === 'studio.render.video' && segments[0] === 'final') deny();
    if (typeof x.destination !== 'string' ||
      !x.destination.startsWith(x.attemptPrefix+'/')) deny();
    const suffix = x.destination.slice(x.attemptPrefix.length+1);
    if (!Object.hasOwn(OUTPUTS[x.jobType],suffix) ||
      x.contentType !== OUTPUTS[x.jobType][suffix]) deny();
    return Object.freeze({
      evidenceClass:'REVIEW_ONLY_UNTRUSTED_WORKER_CLAIMS',
      declaredObjectPath:x.destination,
      productionAuthorized:false,
      storageWriteAuthorized:false,
      ownerConsentVerified:false,
      currentRevocationEpochVerified:false,
      effectiveIamVerified:false,
      generationAcknowledged:false,
    });
  } catch { deny(); } // No raw token, pathname, receipt or supplied data in error.
}
function privateOutputBrokerCertified() { return false; }
async function submitPrivateOutputToExclusiveBroker(_intent) {
  throw new Error('life_movie_exclusive_storage_broker_unavailable');
}
module.exports={
  inspectUntrustedPrivateOutputIntent,
  privateOutputBrokerCertified,
  submitPrivateOutputToExclusiveBroker,
};
