import { createHash } from 'node:crypto';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const MAX_ROOTS = 2000;
const MAX_EXPORT_RECORDS = 10000;
const ownerHash = (ownerUid: string) => createHash('sha256').update(ownerUid).digest('hex');

export async function assertPrivateDataRightsExportDestination() {
  const bucketName = String(process.env.GCS_BUCKET_NAME || '');
  if (!bucketName || bucketName !== process.env.URAI_JOBS_DATA_RIGHTS_ALLOWED_EXPORT_BUCKET) throw new Error('private_export_bucket_not_admitted');
  const [metadata] = await getStorage().bucket(bucketName).getMetadata();
  if (metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true
    || metadata.iamConfiguration?.publicAccessPrevention !== 'enforced') throw new Error('private_export_bucket_not_private');
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
    || proof.schemaVersion !== 'urai-private-source-receipt-v2' || proof.ownerUid !== ownerUid || proof.status !== 'ACTIVE'
    || proof.sourceReceiptRef !== job.payload?.sourceReceiptRef || proof.synthetic !== false
    || proof.sourceRevision !== result.sourceRevision || proof.sourceSha256 !== result.sourceSha256
    || proof.sourceFixityRef !== result.sourceFixityRef || result.historicalSourceAuthority !== false
    || result.reviewState !== 'OWNER_REVIEW_REQUIRED') return false;
  if ((job.type || job.jobType) === 'memory.private-source.index') {
    const transcript = (await transaction.get(source.ref.collection('transcripts').doc(ownerHash(String(job.payload?.transcriptRef || ''))))).data();
    if (!transcript || transcript.ownerUid !== ownerUid || transcript.status !== 'CURRENT' || transcript.synthetic !== false
      || transcript.transcriptRef !== job.payload?.transcriptRef || transcript.provenanceRef !== result.provenanceRef
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
  const records: Array<{ path: string; data: Record<string, unknown> }> = [];
  for (const collection of ['uraiPrivateLifeModel', 'uraiPrivateSourceReceipts']) {
    for (const root of await ownedRoots(db, collection, ownerUid)) {
      records.push({ path: root.ref.path, data: root.data() });
      for (const child of collection === 'uraiPrivateLifeModel' ? ['state', 'revisions', 'idempotency'] : ['transcripts', 'transcriptionAttempts']) {
        const snapshot = await root.ref.collection(child).limit(MAX_EXPORT_RECORDS + 1).get();
        if (snapshot.size + records.length > MAX_EXPORT_RECORDS) throw new Error('private_life_model_export_record_limit');
        for (const document of snapshot.docs) {
          if (document.data().ownerUid !== ownerUid) throw new Error('private_life_model_export_owner_mismatch');
          records.push({ path: document.ref.path, data: document.data() });
        }
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(records), 'utf8') > 16 * 1024 * 1024) throw new Error('private_life_model_export_byte_limit');
  return { schemaVersion: 'urai-private-life-model-owner-export-v2', records,
    completeEcosystemExport: false, unresolvedDomains: ['legacy-ownerless-life-model-records', 'external-transcription-provider-storage', 'original-private-source-storage'] };
}

export async function deleteOwnedPrivateLifeModel(db: Firestore, ownerUid: string, requestId: string) {
  // Permanent owner tombstone precedes enumeration. It also fences an unknown or
  // pre-admission source so a delayed extraction cannot recreate deleted data.
  const fence = db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash(ownerUid));
  await fence.set({ ownerHash: ownerHash(ownerUid), deleted: true, requestId, deletedAt: FieldValue.serverTimestamp() }, { merge: true });
  const roots = [
    ...await ownedRoots(db, 'uraiPrivateLifeModel', ownerUid),
    ...await ownedRoots(db, 'uraiPrivateSourceReceipts', ownerUid),
  ];
  for (const root of roots) await db.recursiveDelete(root.ref);
  await fence.set({ localRootDeletionsAcknowledged: roots.length, cleanupAcknowledgedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { localRootDeletionsAcknowledged: roots.length, ownerAdmissionPermanentlyBlocked: true,
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
