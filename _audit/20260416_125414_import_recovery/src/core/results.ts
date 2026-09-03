import * as admin from 'firebase-admin';

const db = admin.firestore();

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
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.set(jobResultRef, {
    jobId,
    status,
    result,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
