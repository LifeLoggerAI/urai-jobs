import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * Storytime narrator upload journal. A Firestore reservation is persisted
 * BEFORE the GCS write. A failed worker or lost HTTP response cannot erase
 * this inventory obligation. No reservation is a permission to bypass an
 * owner/consent/lease veto; the live authority is rechecked after upload.
 *
 * This is not a GCS+Firestore atomic transaction and is NOT a deletion ACK.
 * A separate, independently reviewed reconciler must drain unresolved items
 * before production owner-deletion completion can be acknowledged.
 */
export const STORYTIME_NARRATOR_WRITES = 'storytimeNarratorWriteReservations';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const UUID_AUDIO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:mp3|ogg)$/i;
const GENERATION = /^[1-9][0-9]{0,19}$/;
const PURPOSE = 'storytime.voiceover';

type RecordLike = Record<string, unknown>;
export type NarratorWriteIdentity = {
  reservationId: string;
  jobId: string;
  ownerUid: string;
  sessionId: string;
  narratorScriptId: string;
  bucket: string;
  objectPath: string;
  uploadId: string;
  leaseToken: string;
  consentReceiptId: string;
  consentPolicyVersion: string;
};

function record(value: unknown): RecordLike {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : {};
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}
function safeGeneration(value: unknown): value is string {
  return typeof value === 'string' && GENERATION.test(value) && Number.isSafeInteger(Number(value));
}

/** Only source-bound Storytime jobs use this ledger. Fail closed if they are malformed. */
export function storytimeNarratorWriteIdentity(job: unknown, objectPath: unknown, uploadId: unknown): NarratorWriteIdentity | null {
  const source = record(job);
  const payload = record(source.payload);
  const consent = record(source.consent);
  // A malformed source marker cannot silently downgrade private Storytime
  // outputs to the unjournaled generic-narrator path. All recognizable
  // Storytime provenance must be bound, even when a job field was stripped.
  const candidatePrefix = payload.outputPrefix;
  const storytimePath = (value: unknown) => typeof value === 'string'
    && (value === 'storytime' || value.startsWith('storytime/'));
  const protectedStorytime = storytimePath(candidatePrefix) || storytimePath(objectPath)
    || source.sourceSessionId !== undefined || source.sourceNarratorScriptId !== undefined
    || consent.purpose === PURPOSE;
  if (source.sourceSystem !== 'urai-storytime') {
    if (protectedStorytime) throw new Error('storytime_narrator_write_identity_unverified');
    return null;
  }
  const bucket = String(process.env.GCS_BUCKET_NAME || '').trim();
  const jobId = source.jobId;
  const ownerUid = source.ownerUid;
  const sessionId = source.sourceSessionId;
  const narratorScriptId = source.sourceNarratorScriptId;
  const leaseToken = source.leaseToken;
  if (!bucket || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,220}$/.test(bucket)
    || (source.type ?? source.jobType) !== 'narrator.tts'
    || !validId(jobId) || !validId(ownerUid) || !validId(sessionId) || !validId(narratorScriptId)
    || typeof leaseToken !== 'string' || !leaseToken || leaseToken.length > 256
    || !validId(uploadId) || typeof objectPath !== 'string'
    || consent.purpose !== PURPOSE || !validId(consent.decisionReceiptId)
    || !validId(consent.policyVersion)) {
    throw new Error('storytime_narrator_write_identity_unverified');
  }
  const prefix = 'storytime/' + ownerUid + '/' + sessionId + '/' + narratorScriptId;
  if (payload.outputPrefix !== prefix || !objectPath.startsWith(prefix + '/')
    || !UUID_AUDIO.test(objectPath.slice(prefix.length + 1))) {
    throw new Error('storytime_narrator_write_path_unverified');
  }
  const reservationId = createHash('sha256')
    .update(['storytime-narrator-write-v1', jobId, leaseToken, uploadId].join('\n')).digest('hex');
  return {
    reservationId, jobId, ownerUid, sessionId, narratorScriptId,
    bucket, objectPath, uploadId, leaseToken,
    consentReceiptId: consent.decisionReceiptId as string,
    consentPolicyVersion: consent.policyVersion as string,
  };
}
function db() {
  if (!getApps().length) initializeApp();
  return getFirestore();
}
function refs(identity: NarratorWriteIdentity) {
  const database = db();
  const blockId = createHash('sha256').update(identity.ownerUid + '\n' + PURPOSE).digest('hex');
  return {
    database,
    reservationRef: database.collection(STORYTIME_NARRATOR_WRITES).doc(identity.reservationId),
    jobRef: database.collection('jobs').doc(identity.jobId),
    ownerRef: database.collection('users').doc(identity.ownerUid),
    consentRef: database.collection('jobConsentBlocks').doc(blockId),
  };
}
/** Keep the worker revocation veto as strict as Jobs' consentBlocks policy.
 * This is not an affirmative consent grant. Any unreadable or malformed block
 * fails closed without invoking an accessor supplied as a field value. */
function checkedNarratorConsentBlockClear(snapshot: unknown): boolean {
  try {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
    const block = snapshot as { exists?: unknown; data?: () => unknown };
    if (block.exists === false) return true;
    if (block.exists !== true || typeof block.data !== 'function') return false;
    const data = block.data();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const field = Object.getOwnPropertyDescriptor(data, 'active');
    return !!field && Object.prototype.hasOwnProperty.call(field, 'value')
      && field.value === false;
  } catch {
    return false;
  }
}

function authorizedLive(identity: NarratorWriteIdentity, snapshots: any[]): boolean {
  const [jobSnap, ownerSnap, blockSnap] = snapshots;
  if (!jobSnap?.exists || !ownerSnap?.exists) return false;
  const job = record(jobSnap.data());
  const owner = record(ownerSnap.data());
  const execution = record(job.execution);
  const lease = record(job.lease);
  const payload = record(job.payload);
  const consent = record(job.consent);
  const deleted = owner.dataRightsDeletionPendingCentralPrivacy;
  const ownerClear = (deleted === undefined || deleted === false)
    && (owner.disabled === undefined || owner.disabled === false)
    && (owner.deletionPending === undefined || owner.deletionPending === false);
  // Mirror Jobs checkedJobConsentBlockState: a missing block is clear, but
  // an existing block must supply an own literal boolean. Inherited and
  // accessor-backed values never prove consent-revocation clearance.
  const consentClear = checkedNarratorConsentBlockClear(blockSnap);
  return ownerClear && consentClear
    && job.jobId === identity.jobId && job.ownerUid === identity.ownerUid
    && job.sourceSystem === 'urai-storytime'
    && job.sourceSessionId === identity.sessionId
    && job.sourceNarratorScriptId === identity.narratorScriptId
    && (job.jobType ?? job.type) === 'narrator.tts'
    && job.status === 'RUNNING'
    && execution.leaseToken === identity.leaseToken
    && lease.leaseToken === identity.leaseToken
    && payload.outputPrefix === 'storytime/' + identity.ownerUid + '/' + identity.sessionId + '/' + identity.narratorScriptId
    && consent.purpose === PURPOSE
    && consent.policyVersion === identity.consentPolicyVersion
    && consent.decisionReceiptId === identity.consentReceiptId;
}
function authoritySnapshots(transaction: any, _identity: NarratorWriteIdentity, refsValue: ReturnType<typeof refs>) {
  return [
    transaction.get(refsValue.jobRef),
    transaction.get(refsValue.ownerRef),
    transaction.get(refsValue.consentRef),
  ];
}

/** Pre-byte reservation: Firestore transactions conflict with concurrent
 * owner deletion, job lease changes and consent block updates. */
export async function reserveStorytimeNarratorWrite(identity: NarratorWriteIdentity | null): Promise<void> {
  if (!identity) return;
  const r = refs(identity);
  await r.database.runTransaction(async (transaction) => {
    const [reservation, ...snapshots] = await Promise.all([
      transaction.get(r.reservationRef),
      ...authoritySnapshots(transaction, identity, r),
    ]);
    if (reservation.exists) throw new Error('storytime_narrator_write_replayed_reservation');
    if (!authorizedLive(identity, snapshots)) {
      throw new Error('storytime_narrator_write_authority_revoked');
    }
    transaction.create(r.reservationRef, {
      schema: 'storytime-narrator-write-v1',
      ownerUid: identity.ownerUid,
      jobId: identity.jobId,
      sessionId: identity.sessionId,
      narratorScriptId: identity.narratorScriptId,
      bucket: identity.bucket,
      objectPath: identity.objectPath,
      uploadId: identity.uploadId,
      leaseHash: createHash('sha256').update(identity.leaseToken).digest('hex'),
      consentReceiptHash: createHash('sha256').update(identity.consentReceiptId).digest('hex'),
      state: 'RESERVED',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/** Revalidate after synthesis but before GCS upload. The transaction is not a
 * GCS atomic fence: a revocation can still race an upload. A rejected check
 * leaves a durable journal entry for independent reconciliation. */
export async function assertStorytimeNarratorWriteActiveBeforeUpload(identity: NarratorWriteIdentity | null): Promise<void> {
  if (!identity) return;
  const r = refs(identity);
  const accepted = await r.database.runTransaction(async (transaction) => {
    const [reservation, ...snapshots] = await Promise.all([
      transaction.get(r.reservationRef),
      ...authoritySnapshots(transaction, identity, r),
    ]);
    const existing = record(reservation.data());
    if (!reservation.exists || existing.schema !== 'storytime-narrator-write-v1'
      || existing.state !== 'RESERVED'
      || existing.jobId !== identity.jobId || existing.ownerUid !== identity.ownerUid
      || existing.sessionId !== identity.sessionId || existing.narratorScriptId !== identity.narratorScriptId
      || existing.bucket !== identity.bucket || existing.objectPath !== identity.objectPath
      || existing.uploadId !== identity.uploadId
      || existing.leaseHash !== createHash('sha256').update(identity.leaseToken).digest('hex')) {
      throw new Error('storytime_narrator_write_reservation_unverified');
    }
    if (authorizedLive(identity, snapshots)) return true;
    transaction.update(r.reservationRef, {
      state: 'RECONCILE_REQUIRED',
      reason: 'pre_upload_authority_changed',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return false;
  });
  if (!accepted) throw new Error('storytime_narrator_write_authority_revoked_before_upload');
}

/** Post-byte authorization recheck. A revoked lease becomes an independently
 * discoverable reconciliation obligation, never a successful worker result. */
export async function sealStorytimeNarratorWrite(identity: NarratorWriteIdentity | null, artifactGeneration: unknown): Promise<void> {
  if (!identity) return;
  if (!safeGeneration(artifactGeneration)) throw new Error('storytime_narrator_write_generation_unverified');
  const r = refs(identity);
  const accepted = await r.database.runTransaction(async (transaction) => {
    const [reservation, ...snapshots] = await Promise.all([
      transaction.get(r.reservationRef),
      ...authoritySnapshots(transaction, identity, r),
    ]);
    const existing = record(reservation.data());
    if (!reservation.exists || existing.schema !== 'storytime-narrator-write-v1'
      || existing.ownerUid !== identity.ownerUid || existing.jobId !== identity.jobId
      || existing.bucket !== identity.bucket || existing.objectPath !== identity.objectPath
      || existing.uploadId !== identity.uploadId || existing.state !== 'RESERVED') {
      throw new Error('storytime_narrator_write_reservation_unverified');
    }
    const live = authorizedLive(identity, snapshots);
    transaction.update(r.reservationRef, {
      state: live ? 'STORED_PENDING_JOB' : 'RECONCILE_REQUIRED',
      artifactGeneration,
      ...(live ? {} : { reason: 'post_write_authority_changed' }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return live;
  });
  if (!accepted) throw new Error('storytime_narrator_write_authority_revoked_after_upload');
}

/** Only the exact writer can report its own verified compensating deletion.
 * An absent object now is not proof of owner-wide deletion completion. */
export async function noteStorytimeNarratorWriteCompensation(
  identity: NarratorWriteIdentity | null, generation: unknown, clean: boolean,
): Promise<void> {
  if (!identity) return;
  if (!safeGeneration(generation)) throw new Error('storytime_narrator_write_generation_unverified');
  const r = refs(identity);
  await r.database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(r.reservationRef);
    const value = record(snapshot.data());
    if (!snapshot.exists || value.jobId !== identity.jobId || value.ownerUid !== identity.ownerUid
      || value.uploadId !== identity.uploadId || value.objectPath !== identity.objectPath
      || (value.artifactGeneration !== undefined && value.artifactGeneration !== generation)) {
      throw new Error('storytime_narrator_write_reservation_unverified');
    }
    transaction.update(r.reservationRef, {
      state: clean ? 'COMPENSATED' : 'RECONCILE_REQUIRED',
      artifactGeneration: generation,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
