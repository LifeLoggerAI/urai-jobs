'use strict';
/**
 * R1074: verify canonical Privacy veto before advancing a review-only broker
 * fence. Read both documents in the caller's SAME Firestore transaction.
 * This is NOT consent issuance, Storage IAM, transfer drain, or deletion ACK.
 */
const DENIED = 'life_movie_canonical_privacy_revocation_unverified';
const deny = () => { throw new Error(DENIED); };
const own = (o, k) => {
  const d = Object.getOwnPropertyDescriptor(o, k);
  if (!d || !Object.hasOwn(d, 'value')) deny();
  return d.value;
};
const object = o => o !== null && typeof o === 'object' && !Array.isArray(o) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(o));
function snapshotData(s) {
  if (!s || s.exists !== true || typeof s.data !== 'function') deny();
  const v = s.data();
  if (!object(v)) deny();
  return v;
}
function assertCanonicalPrivacyRevocation(blockSnap, fenceSnap, event) {
  try {
    if (!object(event) ||
        !['ownerUid','purpose','eventId'].every(k => Object.hasOwn(event,k)) ||
        typeof event.ownerUid !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(event.ownerUid) ||
        event.purpose !== 'life-movie.render' ||
        typeof event.eventId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(event.eventId)) deny();
    const b = snapshotData(blockSnap), f = snapshotData(fenceSnap);
    if (own(b,'active') !== true || own(b,'consumerId') !== 'urai-jobs' ||
        own(b,'status') !== 'blocked' || own(b,'ownerUid') !== event.ownerUid ||
        own(b,'purpose') !== event.purpose || own(b,'eventId') !== event.eventId ||
        typeof own(b,'policyVersion') !== 'string' || !own(b,'policyVersion') ||
        typeof own(b,'integrityHash') !== 'string' || !/^[a-f0-9]{64}$/.test(own(b,'integrityHash'))) deny();
    if (own(f,'schemaVersion') !== 'R1027_PRIVATE_OUTPUT_FENCE_V1' ||
        own(f,'ownerUid') !== event.ownerUid || own(f,'purpose') !== event.purpose ||
        own(f,'eventId') !== event.eventId || own(f,'phase') !== 'FENCING' ||
        !Number.isSafeInteger(own(f,'epoch')) || own(f,'epoch') < 1 ||
        own(f,'legacyLineageUnverified') !== true ||
        own(f,'storageWriteAuthorized') !== false ||
        own(f,'storageWriteFenceVerified') !== false ||
        own(f,'allWritersDrained') !== false ||
        own(f,'privateOutputDeletionAcknowledged') !== false) deny();
    return Object.freeze({ canonicalPrivacyVetoObserved: true, productionAuthorized: false,
      storageWriteAuthorized: false, allWritersDrained: false, deletionAcknowledged: false });
  } catch { deny(); }
}
module.exports = { assertCanonicalPrivacyRevocation, DENIED };
