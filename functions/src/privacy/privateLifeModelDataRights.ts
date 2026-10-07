import { createHash } from 'node:crypto';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const MAX_ROOTS = 2000;
const MAX_EXPORT_RECORDS = 10000;
const DELETE_PAGE_SIZE = 500;
const MAX_DELETE_PAGES = 20;
const ownerHash = (ownerUid: string) => createHash('sha256').update(ownerUid).digest('hex');

function assertOwner(ownerUid: string) {
  if (typeof ownerUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid)) throw new Error('private_life_model_owner_invalid');
}

async function ownerEpoch(db: Firestore, ownerUid: string) {
  assertOwner(ownerUid);
  const snapshot = await db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash(ownerUid)).get();
  const record = snapshot.data() || {};
  const epoch = record.deletionEpoch ?? (record.deleted === true ? 1 : 0);
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('private_life_model_owner_epoch_invalid');
  return { epoch, deleted: record.deleted === true };
}

export async function assertPrivateLifeModelOwnerEpoch(db: Firestore, ownerUid: string, expected: number) {
  const current = await ownerEpoch(db, ownerUid);
  if (current.deleted) throw new Error('private_life_model_owner_deleted');
  if (current.epoch !== expected) throw new Error('private_life_model_owner_epoch_changed');
}

export async function assertPrivateDataRightsExportDestination() {
  const bucketName = String(process.env.GCS_BUCKET_NAME || '');
  if (!bucketName || bucketName !== process.env.URAI_JOBS_DATA_RIGHTS_ALLOWED_EXPORT_BUCKET) throw new Error('private_export_bucket_not_admitted');
  const [metadata] = await getStorage().bucket(bucketName).getMetadata();
  if (metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true
    || metadata.iamConfiguration?.publicAccessPrevention !== 'enforced') throw new Error('private_export_bucket_not_private');
}

export async function removePrivateDataRightsExportAttempt(ownerUid: string, requestId: string, attemptKey: string) {
  assertOwner(ownerUid);
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(requestId) || !/^[a-f0-9]{32}$/.test(attemptKey)) throw new Error('private_export_cleanup_identity_invalid');
  await assertPrivateDataRightsExportDestination();
  const object = `privacy/data-rights/${ownerHash(ownerUid)}/${requestId}/${attemptKey}/export.json`;
  await getStorage().bucket(String(process.env.GCS_BUCKET_NAME)).file(object).delete({ ignoreNotFound: true });
}

export async function canFinalizePrivateSource(db: Firestore, transaction: any, job: any, workerResponse: any) {
  const ownerUid = job.ownerUid;
  const consent = job.consent;
  if (!ownerUid || consent?.purpose !== 'memory.storage' || !consent.policyVersion || !consent.decisionReceiptId) return false;
  const [block, fence, source] = await Promise.all([
    transaction.get(db.collection('jobConsentBlocks').doc(ownerHash(ownerUid + '\n' + consent.purpose))),
    transaction.get(db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash(ownerUid))),
    transaction.get(db.collection('uraiPrivateSourceReceipts').doc(ownerHash(String(job.payload?.sourceReceiptRef || '')))),
  ]);
  const proof = source.data();
  const result = workerResponse?.result;
  if (block.data()?.active === true || fence.data()?.deleted === true || !proof || !result
    || result.ownerUid !== ownerUid || !job.jobId || result.jobId !== job.jobId
    || result.sourceReceiptRef !== job.payload?.sourceReceiptRef
    || result.requestedPurpose !== job.payload?.requestedPurpose
    || proof.schemaVersion !== 'urai-private-source-receipt-v2' || proof.ownerUid !== ownerUid || proof.status !== 'ACTIVE'
    || proof.sourceReceiptRef !== job.payload?.sourceReceiptRef || proof.synthetic !== false
    || proof.consent?.purpose !== consent.purpose || proof.consent?.policyVersion !== consent.policyVersion
    || proof.consent?.decisionReceiptId !== consent.decisionReceiptId
    || !Array.isArray(proof.purposes) || !proof.purposes.includes(job.payload?.requestedPurpose)
    || proof.sourceRevision !== result.sourceRevision || proof.sourceSha256 !== result.sourceSha256
    || proof.sourceFixityRef !== result.sourceFixityRef || result.historicalSourceAuthority !== false
    || result.reviewState !== 'OWNER_REVIEW_REQUIRED') return false;
  if ((job.type || job.jobType) === 'memory.private-source.index') {
    const transcript = (await transaction.get(source.ref.collection('transcripts').doc(ownerHash(String(job.payload?.transcriptRef || ''))))).data();
    if (!transcript || transcript.schemaVersion !== 'urai-private-source-transcript-v2'
      || transcript.ownerUid !== ownerUid || transcript.status !== 'CURRENT' || transcript.synthetic !== false
      || transcript.sourceReceiptRef !== proof.sourceReceiptRef || transcript.requestedPurpose !== job.payload?.requestedPurpose
      || transcript.sourceSha256 !== proof.sourceSha256
      || transcript.transcriptRef !== job.payload?.transcriptRef || transcript.provenanceRef !== result.provenanceRef
      || (result.transcriptRef !== undefined && result.transcriptRef !== job.payload?.transcriptRef) || result.provenanceRef !== job.payload?.provenanceRef
      || transcript.sourceRevision !== result.sourceRevision || transcript.transcriptSha256 !== result.transcriptSha256
      || transcript.provenanceSha256 !== result.provenanceSha256) return false;
  }
  return true;
}

async function ownedRoots(db: Firestore, collection: string, ownerUid: string) {
  const snapshot = await db.collection(collection).where('ownerUid', '==', ownerUid).limit(MAX_ROOTS + 1).get();
  if (snapshot.size > MAX_ROOTS) throw new Error('private_life_model_owner_scope_limit');
  for (const document of snapshot.docs) {
    if (document.data().ownerUid !== ownerUid) throw new Error('private_life_model_owner_mismatch');
  }
  return snapshot.docs;
}

export async function exportOwnedPrivateLifeModel(db: Firestore, ownerUid: string) {
  const before = await ownerEpoch(db, ownerUid);
  if (before.deleted) throw new Error('private_life_model_owner_deleted');
  const records: Array<{ path: string; data: Record<string, unknown> }> = [];
  const sourceRoots = await ownedRoots(db, 'uraiPrivateSourceReceipts', ownerUid);
  const sources = new Map(sourceRoots.map(root => [root.id, root.data()]));
  for (const root of sourceRoots) {
    const data = root.data();
    if (data.schemaVersion !== 'urai-private-source-receipt-v2' || typeof data.sourceReceiptRef !== 'string'
      || !/^psr_[A-Za-z0-9_-]{16,128}$/.test(data.sourceReceiptRef) || root.id !== ownerHash(data.sourceReceiptRef)
      || typeof data.sourceHandle !== 'string' || !/^psh_[A-Za-z0-9_-]{16,256}$/.test(data.sourceHandle)
      || data.synthetic !== false || !Number.isSafeInteger(data.sourceRevision) || data.sourceRevision < 1) {
      throw new Error('private_source_receipt_lineage_invalid');
    }
  }
  for (const collection of ['uraiPrivateLifeModel', 'uraiPrivateSourceReceipts']) {
    for (const root of collection === 'uraiPrivateSourceReceipts' ? sourceRoots : await ownedRoots(db, collection, ownerUid)) {
      if (collection === 'uraiPrivateLifeModel' && (root.data().sourceHandleHash !== root.id || root.data().historicalSourceAuthority !== false)) throw new Error('private_life_model_root_lineage_invalid');
      records.push({ path: root.ref.path, data: root.data() });
      for (const child of collection === 'uraiPrivateLifeModel' ? ['state', 'revisions', 'idempotency'] : ['transcripts', 'transcriptionAttempts']) {
        const snapshot = await root.ref.collection(child).limit(MAX_EXPORT_RECORDS + 1).get();
        if (snapshot.size + records.length > MAX_EXPORT_RECORDS) throw new Error('private_life_model_export_record_limit');
        for (const document of snapshot.docs) {
          if (document.data().ownerUid !== ownerUid) throw new Error('private_life_model_export_owner_mismatch');
          if (collection === 'uraiPrivateLifeModel' && child === 'revisions') {
            const data = document.data(), lineage = data.lineage, source = sources.get(ownerHash(String(lineage?.sourceReceiptRef || '')));
            if (data.schemaVersion !== 'urai-life-model-v1' || data.historicalSourceAuthority !== false || data.sourceHandleHash !== root.id
              || lineage?.schemaVersion !== 'urai-private-source-receipt-v2' || lineage.ownerUid !== ownerUid || lineage.jobId !== data.jobId
              || !source || source.ownerUid !== ownerUid || source.sourceReceiptRef !== lineage.sourceReceiptRef
              || lineage.sourceHandleHash !== ownerHash(String(source.sourceHandle || ''))
              || root.id !== ownerHash(ownerUid + '\n' + source.sourceHandle).slice(0, 40)) throw new Error('private_life_model_source_lineage_invalid');
          }
          if (collection === 'uraiPrivateSourceReceipts' && child === 'transcripts') {
            const data = document.data();
            if (data.schemaVersion !== 'urai-private-source-transcript-v2' || data.sourceReceiptRef !== root.data().sourceReceiptRef
              || typeof data.transcriptRef !== 'string' || document.id !== ownerHash(data.transcriptRef)) throw new Error('private_source_transcript_lineage_invalid');
          }
          records.push({ path: document.ref.path, data: document.data() });
        }
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(records), 'utf8') > 16 * 1024 * 1024) throw new Error('private_life_model_export_byte_limit');
  await assertPrivateLifeModelOwnerEpoch(db, ownerUid, before.epoch);
  return { schemaVersion: 'urai-private-life-model-owner-export-v2', ownerDeletionEpoch: before.epoch, records,
    completeEcosystemExport: false, unresolvedDomains: ['legacy-ownerless-life-model-records', 'external-transcription-provider-storage', 'original-private-source-storage'] };
}

export async function deleteOwnedPrivateLifeModel(db: Firestore, ownerUid: string, requestId: string, checkpoint: () => Promise<void> = async () => {}) {
  // Permanent owner tombstone precedes enumeration. It also fences an unknown or
  // pre-admission source so a delayed extraction cannot recreate deleted data.
  const fence = db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash(ownerUid));
  assertOwner(ownerUid);
  await checkpoint();
  await db.runTransaction(async transaction => {
    const old = (await transaction.get(fence)).data() || {};
    const epoch = old.deletionEpoch ?? (old.deleted === true ? 1 : 0);
    if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch >= Number.MAX_SAFE_INTEGER) throw new Error('private_life_model_owner_epoch_invalid');
    if (old.deleted === true && old.deletionEpoch !== undefined) return;
    transaction.set(fence, { schemaVersion: 'urai-private-life-model-owner-fence-v1', ownerHash: ownerHash(ownerUid), deleted: true,
      deletionEpoch: old.deleted === true ? epoch : epoch + 1, requestId, deletedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  let rootDeletions = 0;
  for (const collection of ['uraiPrivateLifeModel', 'uraiPrivateSourceReceipts']) {
    for (let page = 0; page < MAX_DELETE_PAGES; page++) {
      await checkpoint();
      const roots = await db.collection(collection).where('ownerUid', '==', ownerUid).limit(DELETE_PAGE_SIZE).get();
      if (!roots.size) break;
      for (const root of roots.docs) {
        if (root.data().ownerUid !== ownerUid) throw new Error('private_life_model_owner_mismatch');
        for (const child of collection === 'uraiPrivateLifeModel' ? ['state', 'revisions', 'idempotency'] : ['transcripts', 'transcriptionAttempts']) {
          const ref = root.ref.collection(child);
          for (let childPage = 0; childPage < MAX_DELETE_PAGES; childPage++) {
            await checkpoint();
            const documents = await ref.limit(DELETE_PAGE_SIZE).get();
            if (!documents.size) break;
            const batch = db.batch();
            for (const document of documents.docs) {
              if (document.data().ownerUid !== ownerUid) throw new Error('private_life_model_delete_child_owner_mismatch');
              batch.delete(document.ref);
            }
            await batch.commit();
          }
          if ((await ref.limit(1).get()).size) throw new Error('private_life_model_delete_child_limit');
        }
        await checkpoint();
        await db.recursiveDelete(root.ref); rootDeletions++;
      }
    }
    if ((await db.collection(collection).where('ownerUid', '==', ownerUid).limit(1).get()).size) throw new Error('private_life_model_delete_scope_limit');
  }
  await checkpoint();
  await fence.set({ localRootDeletionsAcknowledged: rootDeletions, cleanupAcknowledgedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { localRootDeletionsAcknowledged: rootDeletions, ownerAdmissionPermanentlyBlocked: true,
    completeEcosystemDeletion: false, unresolvedDomains: ['legacy-ownerless-life-model-records', 'external-transcription-provider-storage', 'original-private-source-storage'] };
}

export async function invalidatePrivateLifeModelForConsent(event: { ownerUid: string; purpose: string; eventId: string }) {
  const summary = { jobsInvalidated: 0, localRootDeletionsAcknowledged: 0, completePrivateSourceRevocation: false };
  if (event.purpose !== 'memory.storage') return summary;
  const db = getFirestore();
  const jobs = await db.collection('jobs').where('ownerUid', '==', event.ownerUid).limit(2001).get();
  if (jobs.size > 2000) throw new Error('private_life_model_revocation_job_limit');
  for (const document of jobs.docs) {
    const job = document.data();
    if (job.ownerUid !== event.ownerUid) throw new Error('private_life_model_revocation_owner_mismatch');
    if (!['memory.private-source.index','memory.private-source.transcribe'].includes(job.type || job.jobType)) continue;
    const batch = db.batch();
    batch.update(document.ref, { status: 'CANCELLED', output: FieldValue.delete(), result: FieldValue.delete(), lease: FieldValue.delete(),
      'execution.leaseToken': FieldValue.delete(), 'execution.asyncCallbackPending': false,
      consentRevocationEventId: event.eventId, derivativeAccessState: 'REVOKED', updatedAt: FieldValue.serverTimestamp() });
    batch.set(db.collection('jobQueue').doc(document.id), { status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit(); summary.jobsInvalidated++;
  }
  // Canonical consent block is already active before this helper runs. Index
  // transactions cannot commit across that block, including while cleanup awaits.
  for (const receipt of await ownedRoots(db, 'uraiPrivateSourceReceipts', event.ownerUid)) {
    await receipt.ref.update({ status: 'REVOKED', revokedByEventId: event.eventId, updatedAt: FieldValue.serverTimestamp() });
    await db.recursiveDelete(receipt.ref.collection('transcripts'));
    await db.recursiveDelete(receipt.ref.collection('transcriptionAttempts'));
  }
  for (const root of await ownedRoots(db, 'uraiPrivateLifeModel', event.ownerUid)) {
    await db.recursiveDelete(root.ref); summary.localRootDeletionsAcknowledged++;
  }
  return summary;
}
