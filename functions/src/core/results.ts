import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { ownerDeletionFenceRefs, ownerDeletionFenced } from "../privacy/ownerDeletionFence.js";
import { getApps, initializeApp } from "firebase-admin/app";
if (getApps().length === 0) initializeApp();

const db = getFirestore();

export async function updateJobResult(
  jobId: string,
  status: 'SUCCESS' | 'FAILED',
  result: any,
): Promise<void> {
  const jobRef = db.collection('jobs').doc(jobId);
  const jobResultRef = db.collection('jobResults').doc(jobId);

  // Bind a result to the server-owned job document. The prior writer stored
  // no owner, making a parentless result impossible to attribute at deletion.
  // Read the current job/fences transactionally so a late callback cannot
  // recreate output after an owner deletion fence is installed.
  await db.runTransaction(async transaction => {
    const job = await transaction.get(jobRef);
    if (!job.exists) throw new Error('job_result_parent_missing');
    const ownerUid = job.data()?.ownerUid;
    if (typeof ownerUid !== 'string' || !ownerUid.trim() || ownerUid.startsWith('deleted:')) {
      throw new Error('job_result_owner_unavailable');
    }
    const fences = await Promise.all(ownerDeletionFenceRefs(ownerUid).map(ref => transaction.get(ref)));
    if (ownerDeletionFenced(fences)) throw new Error('job_result_owner_deletion_fenced');

    transaction.update(jobRef, { status, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(jobResultRef, {
      jobId, ownerUid, status, result, createdAt: FieldValue.serverTimestamp(),
    });
  });
}
