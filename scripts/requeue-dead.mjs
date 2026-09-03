import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const jobId = process.env.URAI_JOB_ID;
if (!jobId) {
  console.error('Missing URAI_JOB_ID');
  process.exit(1);
}

await db.collection('jobs').doc(jobId).set({
  status: 'PENDING',
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  error: admin.firestore.FieldValue.delete()
}, { merge: true });

await db.collection('jobQueue').doc(jobId).set({
  jobId,
  status: 'PENDING',
  availableAt: admin.firestore.FieldValue.serverTimestamp(),
  error: admin.firestore.FieldValue.delete(),
  leaseToken: admin.firestore.FieldValue.delete(),
  workerName: admin.firestore.FieldValue.delete(),
  leasedAt: admin.firestore.FieldValue.delete()
}, { merge: true });

console.log(`[PASS] requeued dead job ${jobId}`);
