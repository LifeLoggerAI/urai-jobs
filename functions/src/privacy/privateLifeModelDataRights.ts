import { createHash } from 'node:crypto';
import { FieldPath, FieldValue, getFirestore, type Firestore, type Transaction, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const SOURCE_EVIDENCE_CLASSES = new Set(['SOURCE_CAPTURED', 'SOURCE_DERIVED', 'DIRECT_SUBJECT_TESTIMONY', 'ATTRIBUTED_TESTIMONY', 'CORROBORATED_INFERENCE', 'CONTEXTUAL_RESEARCH']);
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
    || !SOURCE_EVIDENCE_CLASSES.has(proof.sourceEvidenceClass) || result.sourceEvidenceClass !== proof.sourceEvidenceClass
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

type RightsCheckpoint = (transaction?: Transaction) => Promise<void>;
type RootAuthority = (snapshot: FirebaseFirestore.DocumentSnapshot) => void;

function assertRootVersion(snapshot: FirebaseFirestore.DocumentSnapshot, root: QueryDocumentSnapshot, ownerUid: string) {
  if (!snapshot.exists || snapshot.data()?.ownerUid !== ownerUid || !snapshot.updateTime?.isEqual(root.updateTime)) {
    throw new Error('private_life_model_root_owner_or_version_changed');
  }
}

// Query snapshots are discovery only. Current operation, parent authority and
// every exact child version join the same transaction as the bounded deletes.
async function purgePrivateRootChildren(db: Firestore, root: QueryDocumentSnapshot, ownerUid: string,
  children: string[], checkpoint: RightsCheckpoint, authority: RootAuthority, limitReason: string) {
  for (const child of children) {
    const ref = root.ref.collection(child);
    for (let page = 0; page < MAX_DELETE_PAGES; page++) {
      await checkpoint();
      const documents = await ref.limit(DELETE_PAGE_SIZE).get();
      if (!documents.size) break;
      await db.runTransaction(async transaction => {
        await checkpoint(transaction);
        authority(await transaction.get(root.ref));
        const targets = [];
        for (const document of documents.docs) {
          const current = await transaction.get(document.ref);
          if (!current.exists) continue;
          if (current.data()?.ownerUid !== ownerUid) throw new Error('private_life_model_delete_child_owner_mismatch');
          if (!current.updateTime?.isEqual(document.updateTime)) throw new Error('private_life_model_delete_child_version_changed');
          targets.push(current);
        }
        await checkpoint(transaction);
        for (const target of targets) transaction.delete(target.ref, { lastUpdateTime: target.updateTime! });
      });
    }
    if ((await ref.limit(1).get()).size) throw new Error(limitReason);
  }
}

async function deletePrivateRoot(db: Firestore, root: QueryDocumentSnapshot, children: string[],
  checkpoint: RightsCheckpoint, authority: RootAuthority, limitReason: string) {
  return db.runTransaction(async transaction => {
    await checkpoint(transaction);
    const current = await transaction.get(root.ref);
    authority(current);
    // Transactional emptiness reads also protect against registered late child
    // writers at commit. Never recursively erase an uninspected foreign child.
    for (const child of children) {
      if ((await transaction.get(root.ref.collection(child).limit(1))).size) throw new Error(limitReason);
    }
    await checkpoint(transaction);
    transaction.delete(root.ref, { lastUpdateTime: current.updateTime! });
  });
}

function stableSourceRevocationDigest(value: Record<string, unknown>) {
  const canonical = (entry: any): string => Array.isArray(entry) ? '[' + entry.map(canonical).join(',') + ']'
    : entry && typeof entry === 'object' ? '{' + Object.entries(entry).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => JSON.stringify(key) + ':' + canonical(child)).join(',') + '}' : JSON.stringify(entry);
  const { status: _status, revokedByEventId: _event, updatedAt: _updated, ...source } = value;
  return ownerHash(canonical(source));
}

export async function exportOwnedPrivateLifeModel(db: Firestore, ownerUid: string, checkpoint: RightsCheckpoint = async () => {}) {
  await checkpoint();
  const before = await ownerEpoch(db, ownerUid);
  if (before.deleted) throw new Error('private_life_model_owner_deleted');
  const records: Array<{ path: string; data: Record<string, unknown> }> = [];
  const targets: QueryDocumentSnapshot[] = [];
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
      targets.push(root); records.push({ path: root.ref.path, data: root.data() });
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
          targets.push(document); records.push({ path: document.ref.path, data: document.data() });
        }
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(records), 'utf8') > 16 * 1024 * 1024) throw new Error('private_life_model_export_byte_limit');
  for (let offset = 0; offset < targets.length; offset += 400) {
    await db.runTransaction(async transaction => {
      await checkpoint(transaction);
      const fence = (await transaction.get(db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash(ownerUid)))).data();
      const epoch = fence?.deletionEpoch ?? (fence?.deleted === true ? 1 : 0);
      if (fence?.deleted === true || epoch !== before.epoch) throw new Error('private_life_model_owner_deleted_or_epoch_changed');
      for (const target of targets.slice(offset, offset + 400)) {
        const current = await transaction.get(target.ref);
        if (!current.exists || current.data()?.ownerUid !== ownerUid || !current.updateTime?.isEqual(target.updateTime)) {
          throw new Error('private_life_model_export_owner_or_version_changed');
        }
      }
      await checkpoint(transaction);
    });
  }
  await checkpoint();
  await assertPrivateLifeModelOwnerEpoch(db, ownerUid, before.epoch);
  return { schemaVersion: 'urai-private-life-model-owner-export-v2', ownerDeletionEpoch: before.epoch, records,
    completeEcosystemExport: false, unresolvedDomains: ['legacy-ownerless-life-model-records', 'external-transcription-provider-storage', 'original-private-source-storage'] };
}

export async function deleteOwnedPrivateLifeModel(db: Firestore, ownerUid: string, requestId: string, checkpoint: RightsCheckpoint = async () => {}) {
  // Permanent owner tombstone precedes enumeration. It also fences an unknown or
  // pre-admission source so a delayed extraction cannot recreate deleted data.
  const fence = db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash(ownerUid));
  assertOwner(ownerUid);
  await checkpoint();
  await db.runTransaction(async transaction => {
    await checkpoint(transaction);
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
        const children = collection === 'uraiPrivateLifeModel' ? ['state', 'revisions', 'idempotency'] : ['transcripts', 'transcriptionAttempts'];
        const authority: RootAuthority = snapshot => assertRootVersion(snapshot, root, ownerUid);
        await purgePrivateRootChildren(db, root, ownerUid, children, checkpoint, authority, 'private_life_model_delete_child_limit');
        await deletePrivateRoot(db, root, children, checkpoint, authority, 'private_life_model_delete_child_limit');
        rootDeletions++;
      }
    }
    if ((await db.collection(collection).where('ownerUid', '==', ownerUid).limit(1).get()).size) throw new Error('private_life_model_delete_scope_limit');
  }
  await checkpoint();
  await db.runTransaction(async transaction => {
    await checkpoint(transaction);
    const current = (await transaction.get(fence)).data();
    if (current?.ownerHash !== ownerHash(ownerUid) || current.deleted !== true) throw new Error('private_life_model_deletion_fence_changed');
    transaction.set(fence, { localRootDeletionsAcknowledged: rootDeletions, cleanupAcknowledgedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { localRootDeletionsAcknowledged: rootDeletions, ownerAdmissionPermanentlyBlocked: true,
    completeEcosystemDeletion: false, unresolvedDomains: ['legacy-ownerless-life-model-records', 'external-transcription-provider-storage', 'original-private-source-storage'] };
}

export async function invalidatePrivateLifeModelForConsent(event: { ownerUid: string; purpose: string; eventId: string }) {
  const empty = { jobsInvalidated: 0, localRootDeletionsAcknowledged: 0, completePrivateSourceRevocation: false };
  if (event.purpose !== 'memory.storage') return empty;
  assertOwner(event.ownerUid);
  const db = getFirestore();
  const receiptRef = db.collection('jobConsentEventReceipts').doc(ownerHash(event.eventId));
  const blockRef = db.collection('jobConsentBlocks').doc(ownerHash(event.ownerUid + '\n' + event.purpose));
  const schemaVersion = 'urai-private-life-model-consent-cleanup-v1';
  type Progress = { schemaVersion: string; phase: 'jobs' | 'sources' | 'models' | 'DONE'; cursor: string;
    jobsInvalidated: number; localRootDeletionsAcknowledged: number };
  const validate = (receipt: any, block: any) => {
    if (receipt?.consumerId !== 'urai-jobs' || receipt.eventId !== event.eventId || receipt.ownerUid !== event.ownerUid
      || receipt.purpose !== event.purpose || receipt.status !== 'blocked'
      || receipt.eventBindingVersion !== 'urai-jobs-consent-event-binding-v1' || !/^[a-f0-9]{64}$/.test(receipt.eventBindingHash || '')
      || block?.active !== true || block.ownerUid !== event.ownerUid || block.purpose !== event.purpose) {
      throw new Error('private_life_model_revocation_authority_changed');
    }
  };
  const initial = await db.runTransaction(async transaction => {
    const [receipt, block] = await Promise.all([transaction.get(receiptRef), transaction.get(blockRef)]);
    validate(receipt.data(), block.data());
    const prior = receipt.data()?.privateLifeModelInvalidationProgress as Progress | undefined;
    if (prior && (prior.schemaVersion !== schemaVersion || !['jobs','sources','models','DONE'].includes(prior.phase)
      || typeof prior.cursor !== 'string' || !Number.isSafeInteger(prior.jobsInvalidated) || prior.jobsInvalidated < 0
      || !Number.isSafeInteger(prior.localRootDeletionsAcknowledged) || prior.localRootDeletionsAcknowledged < 0)) {
      throw new Error('private_life_model_revocation_progress_invalid');
    }
    const progress = prior || { schemaVersion, phase: 'jobs' as const, cursor: '', jobsInvalidated: 0, localRootDeletionsAcknowledged: 0 };
    if (!prior) transaction.set(receiptRef, { privateLifeModelInvalidationProgress: progress }, { merge: true });
    return progress;
  });
  let progress = initial;
  const current = async (transaction: any) => {
    const [receipt, block] = await Promise.all([transaction.get(receiptRef), transaction.get(blockRef)]);
    validate(receipt.data(), block.data());
    const stored = receipt.data()?.privateLifeModelInvalidationProgress;
    if (stored?.schemaVersion !== schemaVersion || stored.phase !== progress.phase || stored.cursor !== progress.cursor
      || stored.jobsInvalidated !== progress.jobsInvalidated
      || stored.localRootDeletionsAcknowledged !== progress.localRootDeletionsAcknowledged) {
      throw new Error('private_life_model_revocation_concurrent_continuation');
    }
  };
  const checkpoint: RightsCheckpoint = async transaction => { if (transaction) await current(transaction); else await db.runTransaction(current); };
  const advance = async (next: Progress) => {
    await db.runTransaction(async transaction => {
      await current(transaction);
      transaction.set(receiptRef, { privateLifeModelInvalidationProgress: next }, { merge: true });
    });
    progress = next;
  };
  const pageQuery = (collection: string, cursor: string, limit: number) => {
    let query = db.collection(collection).where('ownerUid', '==', event.ownerUid).orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) query = query.startAfter(cursor);
    return query;
  };
  while (progress.phase !== 'DONE') {
    const phase = progress.phase;
    const collection = phase === 'jobs' ? 'jobs' : phase === 'sources' ? 'uraiPrivateSourceReceipts' : 'uraiPrivateLifeModel';
    let complete = false;
    for (let page = 0; page < MAX_DELETE_PAGES; page++) {
      await checkpoint();
      const roots = await pageQuery(collection, progress.cursor, phase === 'jobs' ? 200 : 100).get();
      if (!roots.size) { complete = true; break; }
      if (phase === 'jobs') {
        const increment = await db.runTransaction(async transaction => {
          await current(transaction);
          const snapshots = await Promise.all(roots.docs.map(document => transaction.get(document.ref)));
          const queues = await Promise.all(snapshots.map(snapshot => transaction.get(db.collection('jobQueue').doc(snapshot.id))));
          let count = 0;
          for (const [index, snapshot] of snapshots.entries()) {
            const job = snapshot.data();
            if (!job || job.ownerUid !== event.ownerUid) throw new Error('private_life_model_revocation_owner_mismatch');
            if (!['memory.private-source.index','memory.private-source.transcribe'].includes(job.type || job.jobType)) continue;
            const queue = queues[index];
            if (queue.exists && ((queue.data()?.ownerUid !== undefined && queue.data()?.ownerUid !== event.ownerUid)
              || (queue.data()?.jobId !== undefined && queue.data()?.jobId !== snapshot.id))) throw new Error('private_life_model_revocation_queue_owner_mismatch');
            transaction.update(snapshot.ref, { status: 'CANCELLED', output: FieldValue.delete(), result: FieldValue.delete(), lease: FieldValue.delete(),
              'execution.leaseToken': FieldValue.delete(), 'execution.asyncCallbackPending': false,
              consentRevocationEventId: event.eventId, derivativeAccessState: 'REVOKED', updatedAt: FieldValue.serverTimestamp() });
            if (queue.exists) transaction.update(queue.ref, { status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
            count++;
          }
          transaction.set(receiptRef, { privateLifeModelInvalidationProgress: { ...progress,
            cursor: roots.docs.at(-1)!.id, jobsInvalidated: progress.jobsInvalidated + count } }, { merge: true });
          return count;
        });
        progress = { ...progress, cursor: roots.docs.at(-1)!.id, jobsInvalidated: progress.jobsInvalidated + increment };
      } else {
        for (const root of roots.docs) {
          if (root.data().ownerUid !== event.ownerUid) throw new Error('private_life_model_revocation_owner_mismatch');
          await checkpoint();
          if (phase === 'sources') {
            const sourceDigest = stableSourceRevocationDigest(root.data());
            await db.runTransaction(async transaction => {
              await current(transaction);
              const observed = await transaction.get(root.ref);
              assertRootVersion(observed, root, event.ownerUid);
              transaction.update(root.ref, { status: 'REVOKED', revokedByEventId: event.eventId, updatedAt: FieldValue.serverTimestamp() });
            });
            const authority: RootAuthority = snapshot => {
              const value = snapshot.data();
              if (!value || value.ownerUid !== event.ownerUid || value.status !== 'REVOKED' || value.revokedByEventId !== event.eventId
                || stableSourceRevocationDigest(value) !== sourceDigest) throw new Error('private_life_model_revocation_source_owner_or_version_changed');
            };
            await purgePrivateRootChildren(db, root, event.ownerUid, ['transcripts','transcriptionAttempts'], checkpoint,
              authority, 'private_life_model_revocation_child_continuation');
          } else {
            const children = ['state','revisions','idempotency'], authority: RootAuthority = snapshot => assertRootVersion(snapshot, root, event.ownerUid);
            await purgePrivateRootChildren(db, root, event.ownerUid, children, checkpoint, authority, 'private_life_model_revocation_child_continuation');
            await deletePrivateRoot(db, root, children, checkpoint, authority, 'private_life_model_revocation_child_continuation');
          }
          await advance({ ...progress, cursor: root.id,
            localRootDeletionsAcknowledged: progress.localRootDeletionsAcknowledged + (phase === 'models' ? 1 : 0) });
        }
      }
    }
    if (!complete && (await pageQuery(collection, progress.cursor, 1).get()).size) {
      // Cursor and counters are durable. The same bound event resumes here;
      // exhaustion never creates a successful privacy propagation receipt.
      throw new Error('private_life_model_revocation_scope_continuation');
    }
    await advance({ ...progress, phase: phase === 'jobs' ? 'sources' : phase === 'sources' ? 'models' : 'DONE', cursor: '' });
  }
  return { jobsInvalidated: progress.jobsInvalidated, localRootDeletionsAcknowledged: progress.localRootDeletionsAcknowledged,
    completePrivateSourceRevocation: false };
}

