import { getFirestore, FieldValue } from "firebase-admin/firestore";
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

  const batch = db.batch();

  batch.update(jobRef, {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(jobResultRef, {
    jobId,
    status,
    result,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
