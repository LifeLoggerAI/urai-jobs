import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash } from 'node:crypto';

type Event = { eventId: string; ownerUid: string; purpose: string; revokedAt: string };
type EngineResponse = { ok?: boolean; artifactsDeleted?: boolean };

export async function deleteCapturedRealityEngineJob(jobId: string): Promise<void> {
  const raw = String(process.env.CAPTURED_REALITY_ENGINE_URL || '').trim();
  const token = String(process.env.CAPTURED_REALITY_ENGINE_TOKEN || '');
  if (!raw || !token || !/^[A-Za-z0-9._:-]{8,512}$/.test(jobId)) throw new Error('captured_reality_cleanup_unconfigured');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('captured_reality_cleanup_endpoint_invalid');
  const endpoint = `${url.toString().replace(/\/$/, '')}/delete`;
  // A cancelled engine can need a brief interval to terminate its subprocess.
  // A pending response never becomes a successful privacy acknowledgement.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jobId }) });
    if (response.status === 409 && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 1000)); continue; }
    const result = await response.json().catch(() => ({})) as EngineResponse;
    if (!response.ok || result.ok !== true || result.artifactsDeleted !== true) throw new Error('captured_reality_cleanup_not_acknowledged');
    return;
  }
  throw new Error('captured_reality_cleanup_pending');
}


async function runtimeCleanupAuthority(db: ReturnType<typeof getFirestore>, ownerUid: string, event?: Event) {
  const ownerHash = createHash('sha256').update(ownerUid).digest('hex');
  const fenceRef = db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash);
  let progressRef: FirebaseFirestore.DocumentReference;
  let validate: (tx: FirebaseFirestore.Transaction) => Promise<FirebaseFirestore.DocumentData>;
  if (event) {
    if (event.ownerUid !== ownerUid || !['memory.storage', 'location.context'].includes(event.purpose)) throw new Error('captured_reality_cleanup_event_authority_invalid');
    progressRef = db.collection('jobConsentEventReceipts').doc(createHash('sha256').update(event.eventId).digest('hex'));
    const blockRef = db.collection('jobConsentBlocks').doc(createHash('sha256').update(ownerUid + '\n' + event.purpose).digest('hex'));
    validate = async tx => {
      const [receipt, block] = await Promise.all([tx.get(progressRef), tx.get(blockRef)]);
      const data = receipt.data();
      if (!receipt.exists || data?.eventId !== event.eventId || data?.ownerUid !== ownerUid || data?.purpose !== event.purpose || data?.status !== 'blocked'
        || block.get('active') !== true || block.get('ownerUid') !== ownerUid || block.get('purpose') !== event.purpose || block.get('eventId') !== event.eventId) throw new Error('captured_reality_cleanup_event_authority_invalid');
      return data;
    };
  } else {
    // The governed DELETE executor installs its permanent owner fence before
    // invoking this helper. Derive its existing request receipt without changing
    // the separate private-source/finalizer executor or introducing a collection.
    const fence = await fenceRef.get();
    const requestId = fence.get('requestId');
    if (fence.get('deleted') !== true || typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 200 || requestId.includes('/')) throw new Error('captured_reality_cleanup_delete_authority_invalid');
    progressRef = db.collection('dataRightsRequests').doc(requestId);
    validate = async tx => {
      const [currentFence, request] = await Promise.all([tx.get(fenceRef), tx.get(progressRef)]);
      const data = request.data();
      if (currentFence.get('deleted') !== true || currentFence.get('requestId') !== requestId || !request.exists
        || data?.ownerUid !== ownerUid || data?.requestType !== 'DELETE' || data?.status !== 'IN_REVIEW'
        || !['PROTECTED_STAGING_EXECUTION_IN_PROGRESS', 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE'].includes(String(data?.executionState))) throw new Error('captured_reality_cleanup_delete_authority_invalid');
      return data;
    };
  }
  const data = await db.runTransaction(validate);
  return { progressRef, validate, data };
}

function cleanupTarget(data: FirebaseFirestore.DocumentData, ownerUid: string, collection: string) {
  if (data.ownerUid !== ownerUid) throw new Error('captured_reality_runtime_admission_owner_mismatch');
  const schema = collection === 'capturedRealityRuntimeAdmissions' ? 'urai-captured-reality-runtime-admission-v1' : 'urai-captured-reality-runtime-cleanup-v1';
  if (data.schemaVersion !== schema) throw new Error('captured_reality_runtime_admission_schema_invalid');
  const bucket = String(data.storageBucket || ''), objectPath = String(data.runtimeObject || ''), generation = String(data.storageGeneration || '');
  const expectedPrefix = `private-captured-reality/${ownerUid}/${String(data.assetId || '')}/runtime/`;
  if (!bucket || bucket.includes('/') || bucket.includes('..') || !objectPath.startsWith(expectedPrefix) || objectPath.includes('..')) throw new Error('captured_reality_runtime_admission_storage_boundary_invalid');
  if (!/^\d+$/.test(generation)) {
    // Only a server-owned pre-write publication intent may recover an unknown
    // generation. Legacy admissions never gain authority through this path.
    if (collection !== 'capturedRealityRuntimeCleanup' || data.publicationPending !== true
      || !/^[a-f0-9]{64}$/.test(String(data.runtimeAuthorityHash || ''))
      || !/^[a-f0-9]{64}$/.test(String(data.runtimeSha256 || ''))
      || !/^[a-f0-9]{40}$/.test(String(data.spatialAuthorityHead || ''))
      || !/^[A-Za-z0-9._:-]{8,512}$/.test(String(data.jobId || ''))
      || !/^[A-Za-z0-9._-]{1,128}$/.test(String(data.assetId || ''))
      || !Number.isSafeInteger(data.runtimeByteSize) || data.runtimeByteSize < 1 || data.runtimeByteSize > 512 * 1024 * 1024
      || objectPath !== `${expectedPrefix}${data.runtimeSha256}.splat`) throw new Error('captured_reality_runtime_admission_generation_invalid');
    return { bucket, objectPath, generation: '', publicationPending: true, runtimeAuthorityHash: data.runtimeAuthorityHash,
      runtimeSha256: data.runtimeSha256, spatialAuthorityHead: data.spatialAuthorityHead, jobId: data.jobId, runtimeByteSize: data.runtimeByteSize };
  }
  return { bucket, objectPath, generation, publicationPending: false };
}

export async function deleteCapturedRealityPublishedRuntimeForOwner(ownerUid: string, event?: Event) {
  const db = getFirestore();
  const authority = await runtimeCleanupAuthority(db, ownerUid, event);
  await db.runTransaction(async tx => {
    await authority.validate(tx);
    tx.set(authority.progressRef, { capturedRealityRuntimeCleanupState: 'PENDING', capturedRealityRuntimeCleanupUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  let publishedRuntimeDeletionsAcknowledged = 0, pages = 0;
  const deadline = Date.now() + 20000;
  for (const collection of ['capturedRealityRuntimeAdmissions', 'capturedRealityRuntimeCleanup']) {
    const cursorKey = collection === 'capturedRealityRuntimeAdmissions' ? 'capturedRealityAdmissionCleanupCursor' : 'capturedRealityCompensationCleanupCursor';
    const stateKey = collection === 'capturedRealityRuntimeAdmissions' ? 'capturedRealityAdmissionCleanupState' : 'capturedRealityCompensationCleanupState';
    if (authority.data[stateKey] === 'COMPLETE') continue;
    const cursor = authority.data[stateKey] === 'PENDING' ? authority.data[cursorKey] : undefined;
    if (cursor !== undefined && (typeof cursor !== 'string' || !/^[A-Za-z0-9._:-]{1,512}$/.test(cursor))) throw new Error('captured_reality_cleanup_cursor_invalid');
    let after: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (;;) {
      if (pages >= 10 || Date.now() >= deadline) throw new Error('captured_reality_runtime_cleanup_continuation_pending');
      let query = db.collection(collection).where('ownerUid', '==', ownerUid).orderBy(FieldPath.documentId()).limit(100);
      if (after) query = query.startAfter(after); else if (cursor) query = query.startAfter(cursor);
      const snapshots = await query.get(); pages++;
      for (const snapshot of snapshots.docs) {
        if (Date.now() >= deadline) throw new Error('captured_reality_runtime_cleanup_continuation_pending');
        const data = snapshot.data();
        if (data.ownerUid !== ownerUid) throw new Error('captured_reality_runtime_admission_owner_mismatch');
        if ((data.revokedAt || data.cleanupAcknowledgedAt) && data.cleanupPending !== true) continue;
        let target = cleanupTarget(data, ownerUid, collection);
        await db.runTransaction(async tx => {
          await authority.validate(tx);
          const fresh = await tx.get(snapshot.ref);
          if (!fresh.exists || JSON.stringify(cleanupTarget(fresh.data()!, ownerUid, collection)) !== JSON.stringify(target)) throw new Error('captured_reality_cleanup_target_changed');
          tx.set(snapshot.ref, { releaseState: 'revoked', reviewState: 'revoked', candidateAcceptance: false, publicReleaseAuthorized: false,
            revokedAt: FieldValue.serverTimestamp(), cleanupPending: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        });
        if (!target.generation) {
          let metadata;
          try { [metadata] = await getStorage().bucket(target.bucket).file(target.objectPath).getMetadata(); }
          catch (error: any) {
            // An unresolved writer may still finish. Absence at this instant
            // cannot issue an acknowledgement or discard its durable intent.
            if (error?.code === 404) throw new Error('captured_reality_runtime_cleanup_continuation_pending');
            throw error;
          }
          if (String(metadata.metadata?.uraiRuntimeSha256 || '') !== target.runtimeSha256
            || String(metadata.metadata?.uraiCapturedRealityJobId || '') !== target.jobId
            || String(metadata.metadata?.uraiSpatialAuthorityHead || '') !== target.spatialAuthorityHead
            || String(metadata.metadata?.uraiRuntimeAuthorityHash || '') !== target.runtimeAuthorityHash
            || Number(metadata.size) !== target.runtimeByteSize || !/^\d+$/.test(String(metadata.generation || ''))) {
            throw new Error('captured_reality_cleanup_publication_identity_changed');
          }
          const generation = String(metadata.generation);
          await db.runTransaction(async tx => {
            await authority.validate(tx);
            const fresh = await tx.get(snapshot.ref);
            if (!fresh.exists || JSON.stringify(cleanupTarget(fresh.data()!, ownerUid, collection)) !== JSON.stringify(target)) throw new Error('captured_reality_cleanup_target_changed');
            tx.set(snapshot.ref, { storageGeneration: generation, publicationPending: false,
              publicationGenerationRecoveredAt: FieldValue.serverTimestamp() }, { merge: true });
          });
          target = { bucket: target.bucket, objectPath: target.objectPath, generation, publicationPending: false };
        }
        await getStorage().bucket(target.bucket).file(target.objectPath, { generation: target.generation }).delete({ ignoreNotFound: true });
        await db.runTransaction(async tx => {
          await authority.validate(tx);
          const fresh = await tx.get(snapshot.ref);
          if (!fresh.exists || JSON.stringify(cleanupTarget(fresh.data()!, ownerUid, collection)) !== JSON.stringify(target)) throw new Error('captured_reality_cleanup_target_changed');
          tx.set(snapshot.ref, { cleanupPending: false, cleanupAcknowledgedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        });
        publishedRuntimeDeletionsAcknowledged++;
      }
      await db.runTransaction(async tx => {
        await authority.validate(tx);
        tx.set(authority.progressRef, { [stateKey]: snapshots.size < 100 ? 'COMPLETE' : 'PENDING',
          [cursorKey]: snapshots.size < 100 ? FieldValue.delete() : snapshots.docs[snapshots.docs.length - 1].id,
          capturedRealityRuntimeCleanupUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      if (snapshots.size < 100) break;
      after = snapshots.docs[snapshots.docs.length - 1];
    }
  }
  // Only the fully scanned pair resets its continuation fields. A later
  // canonical replay performs a fresh scan, including late compensation rows.
  await db.runTransaction(async tx => {
    await authority.validate(tx);
    tx.set(authority.progressRef, { capturedRealityAdmissionCleanupState: FieldValue.delete(), capturedRealityAdmissionCleanupCursor: FieldValue.delete(),
      capturedRealityCompensationCleanupState: FieldValue.delete(), capturedRealityCompensationCleanupCursor: FieldValue.delete(),
      capturedRealityRuntimeCleanupState: 'COMPLETE', capturedRealityRuntimeCleanupUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { publishedRuntimeDeletionsAcknowledged };
}

export async function invalidateCapturedRealityDerivativesForConsent(event: Event) {
  const summary = { jobsInvalidated: 0, engineDeletionsAcknowledged: 0, publishedRuntimeDeletionsAcknowledged: 0 };
  if (!['memory.storage', 'location.context'].includes(event.purpose)) return summary;
  const db = getFirestore();
  // Reuse the canonical consent event receipt for bounded delivery progress;
  // no new private lifecycle collection or release authority is introduced.
  const progressRef = db.collection('jobConsentEventReceipts').doc(createHash('sha256').update(event.eventId).digest('hex'));
  const progressReceipt = await progressRef.get();
  const progressData = progressReceipt.data();
  if (!progressReceipt.exists || progressData?.eventId !== event.eventId || progressData?.ownerUid !== event.ownerUid
    || progressData?.purpose !== event.purpose || progressData?.status !== 'blocked') throw new Error('captured_reality_cleanup_event_authority_invalid');
  const runtimeCleanup = await deleteCapturedRealityPublishedRuntimeForOwner(event.ownerUid, event);
  summary.publishedRuntimeDeletionsAcknowledged = runtimeCleanup.publishedRuntimeDeletionsAcknowledged;
  const deadline = Date.now() + 40000;
  const cursor = progressData.capturedRealityCleanupState === 'PENDING' ? progressData.capturedRealityCleanupCursor : undefined;
  if (cursor !== undefined && (typeof cursor !== 'string' || !/^[A-Za-z0-9._:-]{1,512}$/.test(cursor))) throw new Error('captured_reality_cleanup_cursor_invalid');
  let after: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (let page = 0; page < 10; page++) {
    let query = db.collection('jobs').where('ownerUid', '==', event.ownerUid).orderBy(FieldPath.documentId()).limit(100);
    if (after) query = query.startAfter(after);
    else if (cursor) query = query.startAfter(cursor);
    const snapshots = await query.get();
    for (const snapshot of snapshots.docs) {
    if (Date.now() >= deadline) throw new Error('captured_reality_cleanup_continuation_pending');
      const job = snapshot.data() as Record<string, any>;
      if (job.ownerUid !== event.ownerUid) throw new Error('captured_reality_revocation_owner_mismatch');
      if ((job.jobType || job.type) !== 'memory.private-source.reconstruct-place') continue;
      if (job.derivativeAccessState === 'REVOKED_ENGINE_CLEANUP_COMPLETE') continue;
      let engineMayHaveAccepted = false;
      const patch = {
        status: 'CANCELLED', derivativeAccessState: 'REVOKED_ENGINE_CLEANUP_PENDING',
        consentRevocationEventId: event.eventId, consentRevokedAt: event.revokedAt,
        output: FieldValue.delete(), result: FieldValue.delete(), lease: FieldValue.delete(),
        'execution.leaseToken': FieldValue.delete(), 'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(), 'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
        'execution.capturedRealityAcceptedCallbackHash': FieldValue.delete(),
      };
      await db.runTransaction(async tx => {
        const fresh = await tx.get(snapshot.ref);
        if (!fresh.exists || fresh.get('ownerUid') !== event.ownerUid) throw new Error('captured_reality_revocation_owner_mismatch');
        if ((fresh.get('jobType') || fresh.get('type')) !== 'memory.private-source.reconstruct-place') throw new Error('captured_reality_revocation_job_changed');
        engineMayHaveAccepted = fresh.get('status') === 'RUNNING' || fresh.get('status') === 'SUCCESS'
          || Boolean(fresh.get('output') || fresh.get('result') || fresh.get('execution')?.asyncCallbackPending)
          || fresh.get('derivativeAccessState') === 'REVOKED_ENGINE_CLEANUP_PENDING';
        tx.update(snapshot.ref, patch);
        tx.set(db.collection('jobQueue').doc(snapshot.id), { jobId: snapshot.id, status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      summary.jobsInvalidated++;
      if (engineMayHaveAccepted) { await deleteCapturedRealityEngineJob(snapshot.id); summary.engineDeletionsAcknowledged++; }
      // A provider acknowledgement cannot certify a changed or reassigned job.
      await db.runTransaction(async tx => {
        const fresh = await tx.get(snapshot.ref);
        if (!fresh.exists || fresh.get('ownerUid') !== event.ownerUid) throw new Error('captured_reality_revocation_owner_mismatch');
        if (fresh.get('status') !== 'CANCELLED' || fresh.get('derivativeAccessState') !== 'REVOKED_ENGINE_CLEANUP_PENDING'
          || fresh.get('consentRevocationEventId') !== event.eventId || fresh.get('output') || fresh.get('result')) throw new Error('captured_reality_cleanup_job_changed');
        tx.update(snapshot.ref, { derivativeAccessState: 'REVOKED_ENGINE_CLEANUP_COMPLETE', engineCleanupAcknowledgedAt: FieldValue.serverTimestamp() });
      });
    }
    if (snapshots.size < 100) {
      await progressRef.set({ capturedRealityCleanupState: 'COMPLETE', capturedRealityCleanupCursor: FieldValue.delete(),
        capturedRealityCleanupUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return summary;
    }
    after = snapshots.docs[snapshots.docs.length - 1];
    // Persist only a fully acknowledged page. A middle-page failure leaves the
    // previous cursor so retry visits the failed job and skips completed jobs.
    await progressRef.set({ capturedRealityCleanupState: 'PENDING', capturedRealityCleanupCursor: after.id,
      capturedRealityCleanupUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  // The authenticated canonical delivery returns failure and retains the
  // event/block/progress authority for retry, never a completed privacy ack.
  throw new Error('captured_reality_cleanup_continuation_pending');
}
