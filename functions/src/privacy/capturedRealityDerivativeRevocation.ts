import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

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
  const runtimeCleanup = await deleteCapturedRealityPublishedRuntimeForOwner(event.ownerUid);
  summary.publishedRuntimeDeletionsAcknowledged = runtimeCleanup.publishedRuntimeDeletionsAcknowledged;
  const db = getFirestore();
  const snapshots = await db.collection('jobs').where('ownerUid', '==', event.ownerUid).limit(2001).get();
  if (snapshots.size > 2000) throw new Error('captured_reality_revocation_job_limit');
  for (const snapshot of snapshots.docs) {
    const job = snapshot.data() as Record<string, any>;
    if (job.ownerUid !== event.ownerUid) throw new Error('captured_reality_revocation_owner_mismatch');
    if ((job.jobType || job.type) !== 'memory.private-source.reconstruct-place') continue;
    if (job.derivativeAccessState === 'REVOKED_ENGINE_CLEANUP_COMPLETE') continue;
    const engineMayHaveAccepted = job.status === 'RUNNING' || job.status === 'SUCCESS' || Boolean(job.output || job.result)
      || Boolean(job.execution?.asyncCallbackPending) || job.derivativeAccessState === 'REVOKED_ENGINE_CLEANUP_PENDING';
    const patch = {
      status: 'CANCELLED', derivativeAccessState: 'REVOKED_ENGINE_CLEANUP_PENDING',
      consentRevocationEventId: event.eventId, consentRevokedAt: event.revokedAt,
      output: FieldValue.delete(), result: FieldValue.delete(), lease: FieldValue.delete(),
      'execution.leaseToken': FieldValue.delete(), 'execution.asyncCallbackPending': false,
      'execution.callbackTokenHash': FieldValue.delete(), 'execution.callbackLeaseToken': FieldValue.delete(),
      'execution.callbackDeadlineAt': FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
      'execution.capturedRealityAcceptedCallbackHash': FieldValue.delete(),
    };
    const batch = db.batch(); batch.update(snapshot.ref, patch);
    batch.set(db.collection('jobQueue').doc(snapshot.id), { jobId: snapshot.id, status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit(); summary.jobsInvalidated++;
    if (engineMayHaveAccepted) { await deleteCapturedRealityEngineJob(snapshot.id); summary.engineDeletionsAcknowledged++; }
    await snapshot.ref.update({ derivativeAccessState: 'REVOKED_ENGINE_CLEANUP_COMPLETE', engineCleanupAcknowledgedAt: FieldValue.serverTimestamp() });
  }
  return summary;
}
