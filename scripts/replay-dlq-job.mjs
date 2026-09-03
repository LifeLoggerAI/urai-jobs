import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const FAILED_JOB_ID = process.env.FAILED_JOB_ID || process.argv[2];
const DRY_RUN = process.env.DRY_RUN !== 'false';

if (!PROJECT_ID) {
  console.error('[FAIL] FIREBASE_PROJECT_ID, GCLOUD_PROJECT, or GOOGLE_CLOUD_PROJECT is required.');
  process.exit(1);
}

if (!FAILED_JOB_ID) {
  console.error('[FAIL] FAILED_JOB_ID or first CLI argument is required.');
  process.exit(1);
}

if (admin.apps.length === 0) admin.initializeApp({ projectId: PROJECT_ID });

const db = admin.firestore();

const failedRef = db.collection('failedJobs').doc(FAILED_JOB_ID);
const failedSnap = await failedRef.get();

if (!failedSnap.exists) {
  console.error(`[FAIL] failedJobs/${FAILED_JOB_ID} not found.`);
  process.exit(1);
}

const failedJob = failedSnap.data();
const originalJob = failedJob?.job || failedJob;

const replayPayload = {
  ...originalJob,
  status: 'QUEUED',
  retryCount: 0,
  replay: {
    sourceFailedJobId: FAILED_JOB_ID,
    replayedAt: admin.firestore.FieldValue.serverTimestamp(),
    replayedBy: process.env.USER || process.env.GITHUB_ACTOR || 'operator',
  },
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

delete replayPayload.lease;
delete replayPayload.execution?.leaseToken;

const targetJobId = process.env.REPLAY_JOB_ID || `${FAILED_JOB_ID}-replay-${Date.now()}`;

if (DRY_RUN) {
  console.log('[DRY_RUN] Would replay failed job');
  console.log(JSON.stringify({ targetJobId, replayPayload }, null, 2));
  process.exit(0);
}

await db.collection('jobs').doc(targetJobId).set(replayPayload, { merge: true });
await failedRef.update({
  replayedAt: admin.firestore.FieldValue.serverTimestamp(),
  replayJobId: targetJobId,
});

console.log(`[PASS] Replayed failed job ${FAILED_JOB_ID} as jobs/${targetJobId}`);
