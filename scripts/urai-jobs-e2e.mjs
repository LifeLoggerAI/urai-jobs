import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const E2E_TIMESTAMP = Date.now();
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-urai-jobs';
const ADMIN_UID = `e2e-admin-${E2E_TIMESTAMP}`;
const USER_UID = `e2e-user-${E2E_TIMESTAMP}`;
const ADMIN_EMAIL = `admin_${E2E_TIMESTAMP}@test.local`;
const USER_EMAIL = `user_${E2E_TIMESTAMP}@test.local`;
const ADMIN_PASSWORD = `Admin-${E2E_TIMESTAMP}!`;
const USER_PASSWORD = `User-${E2E_TIMESTAMP}!`;
const FUNCTIONS_EMULATOR_ORIGIN = process.env.FUNCTIONS_EMULATOR_ORIGIN || `http://127.0.0.1:5001`;

let step = 1;

function log(message) {
  console.log(`[STEP ${step++}] ${message}`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function authOrigin() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) return '';
  return host.startsWith('http://') || host.startsWith('https://') ? host : `http://${host}`;
}

async function signInWithPassword(email, password) {
  const origin = authOrigin();
  if (!origin) fail('FIREBASE_AUTH_EMULATOR_HOST not set. Run: firebase emulators:start --only firestore,auth,functions');

  const response = await fetch(`${origin}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Auth emulator sign-in failed for ${email}: ${JSON.stringify(body)}`);
  }

  if (!body.idToken) {
    throw new Error(`Auth emulator did not return idToken for ${email}.`);
  }

  return body.idToken;
}

async function callCallable(name, idToken, data) {
  const response = await fetch(`${FUNCTIONS_EMULATOR_ORIGIN}/${PROJECT_ID}/us-central1/${name}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(`${name} callable failed: ${JSON.stringify(body)}`);
  }

  return body.result;
}

async function main() {
  log('Starting URAI Jobs callable E2E validation');

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    fail('FIRESTORE_EMULATOR_HOST not set. Run: firebase emulators:start --only firestore,auth,functions');
  }

  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    fail('FIREBASE_AUTH_EMULATOR_HOST not set. Run: firebase emulators:start --only firestore,auth,functions');
  }

  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();
  const auth = getAuth();

  try {
    log('Seeding emulator auth users and URAI role documents...');
    await auth.createUser({ uid: ADMIN_UID, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    await auth.createUser({ uid: USER_UID, email: USER_EMAIL, password: USER_PASSWORD });
    await auth.setCustomUserClaims(ADMIN_UID, { role: 'admin', roles: ['admin'], uraiJobsAdmin: true });
    await db.collection('users').doc(ADMIN_UID).set({ role: 'admin', email: ADMIN_EMAIL });
    await db.collection('users').doc(USER_UID).set({ role: 'user', email: USER_EMAIL });
    pass('Test users and roles seeded.');

    log('Signing in through the Auth emulator to get callable ID tokens...');
    const adminToken = await signInWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    const userToken = await signInWithPassword(USER_EMAIL, USER_PASSWORD);
    pass('Emulator ID tokens acquired.');

    log('Calling createJob callable as normal user...');
    const createResult = await callCallable('createJob', userToken, {
      jobType: 'narrator.tts',
      payload: {
        text: 'Hello from URAI Jobs callable E2E.',
        format: 'MP3',
      },
    });

    const jobId = createResult?.jobId;
    if (!jobId) fail(`createJob did not return a jobId: ${JSON.stringify(createResult)}`);
    pass(`createJob returned ${jobId}.`);

    log('Verifying job document was created by createJob...');
    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) fail('Job document not found after createJob callable.');
    const job = jobSnap.data() || {};
    if (job.jobId !== jobId) fail(`Job document jobId mismatch: ${JSON.stringify(job)}`);
    if (job.status !== 'PENDING') fail(`Expected job.status PENDING, got ${job.status}`);
    if (job.type !== 'narrator.tts') fail(`Expected job.type narrator.tts, got ${job.type}`);
    if (job.ownerUid !== USER_UID) fail(`Expected ownerUid ${USER_UID}, got ${job.ownerUid}`);
    pass('Job document verified.');

    log('Verifying jobQueue entry was created by createJob...');
    const queueSnap = await db.collection('jobQueue').doc(jobId).get();
    if (!queueSnap.exists) fail('jobQueue entry not found after createJob callable.');
    const queue = queueSnap.data() || {};
    if (queue.jobId !== jobId) fail(`Queue entry jobId mismatch: ${JSON.stringify(queue)}`);
    if (queue.status !== 'PENDING') fail(`Expected queue.status PENDING, got ${queue.status}`);
    pass('jobQueue entry verified.');

    log('Calling listJobsV2 callable as admin for PENDING jobs...');
    const listResult = await callCallable('listJobsV2', adminToken, { status: 'PENDING', limit: 100 });
    const listedJobs = Array.isArray(listResult?.jobs) ? listResult.jobs : [];
    if (!listedJobs.some((listedJob) => String(listedJob.jobId || listedJob.id) === jobId)) {
      fail(`listJobsV2 did not return created job ${jobId}.`);
    }
    pass('Admin listJobsV2 can see the created PENDING job.');

    log('Calling cancelJob callable as job owner...');
    const cancelResult = await callCallable('cancelJob', userToken, { jobId });
    if (cancelResult?.status !== 'CANCELLED') {
      fail(`cancelJob did not return CANCELLED: ${JSON.stringify(cancelResult)}`);
    }

    const canceledJobSnap = await jobRef.get();
    const canceledJob = canceledJobSnap.data() || {};
    if (canceledJob.status !== 'CANCELLED') fail(`Expected canceled job.status CANCELLED, got ${canceledJob.status}`);
    const canceledQueueSnap = await db.collection('jobQueue').doc(jobId).get();
    const canceledQueue = canceledQueueSnap.data() || {};
    if (canceledQueue.status !== 'CANCELLED') fail(`Expected canceled queue.status CANCELLED, got ${canceledQueue.status}`);
    pass('cancelJob callable updates job and queue to CANCELLED.');

    console.log('\n[PASS] URAI_JOBS_E2E_VALIDATION');
  } catch (err) {
    fail(`An error occurred: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main();
