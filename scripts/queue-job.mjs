import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();
const jobId = `live-${Date.now()}`;
const jobType = process.env.URAI_JOB_TYPE || 'narrator.tts';
const text = process.env.URAI_JOB_TEXT || 'live worker test';
const maxAttempts = Number(process.env.URAI_MAX_ATTEMPTS || 3);

await db.collection('jobs').doc(jobId).set({
  jobId,
  jobType,
  status: 'PENDING',
  payload: { text },
  retryCount: 0,
  execution: {
    attemptCount: 0,
    maxAttempts
  },
  createdAt: now,
  updatedAt: now
});

await db.collection('jobQueue').doc(jobId).set({
  jobId,
  jobType,
  status: 'PENDING',
  attemptCount: 0,
  createdAt: now,
  availableAt: now
});

console.log(`[PASS] queued job ${jobId}`);
