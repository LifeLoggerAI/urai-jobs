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


export async function deleteCapturedRealityPublishedRuntimeForOwner(ownerUid: string) {
  const db = getFirestore();
  let publishedRuntimeDeletionsAcknowledged = 0;
  // Failed publisher compensation retains exact owner/object/generation retry
  // targets here without granting runtime admission. Both collections are
  // private server-owned records and are covered by the same privacy lifecycle.
  for (const collection of ['capturedRealityRuntimeAdmissions', 'capturedRealityRuntimeCleanup']) {
    let after: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (;;) {
      let query = db.collection(collection).where('ownerUid', '==', ownerUid).orderBy(FieldPath.documentId()).limit(100);
      if (after) query = query.startAfter(after);
      const snapshots = await query.get();
      for (const snapshot of snapshots.docs) {
        const data = snapshot.data() as Record<string, unknown>;
        if (data.ownerUid !== ownerUid) throw new Error('captured_reality_runtime_admission_owner_mismatch');
        if ((data.revokedAt || data.cleanupAcknowledgedAt) && data.cleanupPending !== true) continue;
        const bucket = String(data.storageBucket || '');
        const objectPath = String(data.runtimeObject || '');
        const expectedPrefix = `private-captured-reality/${ownerUid}/${String(data.assetId || '')}/runtime/`;
        if (!bucket || bucket.includes('/') || bucket.includes('..') || !objectPath.startsWith(expectedPrefix) || objectPath.includes('..')) {
          throw new Error('captured_reality_runtime_admission_storage_boundary_invalid');
        }
        const generation = String(data.storageGeneration || '');
        if (!/^\d+$/.test(generation)) throw new Error('captured_reality_runtime_admission_generation_invalid');
        // Fence access before any Storage await. If deletion fails, the next
        // canonical revocation/delete delivery retries this retained generation.
        await snapshot.ref.set({
          releaseState: 'revoked',
          reviewState: 'revoked',
          candidateAcceptance: false,
          publicReleaseAuthorized: false,
          revokedAt: FieldValue.serverTimestamp(),
          cleanupPending: true,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await getStorage().bucket(bucket).file(objectPath, { generation }).delete({ ignoreNotFound: true });
        await snapshot.ref.set({ cleanupPending: false, cleanupAcknowledgedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        publishedRuntimeDeletionsAcknowledged += 1;
      }
      if (snapshots.size < 100) break;
      after = snapshots.docs[snapshots.docs.length - 1];
    }
  }
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
  const runtimeCleanup = await deleteCapturedRealityPublishedRuntimeForOwner(event.ownerUid);
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
