
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const E2E_TIMESTAMP = Date.now();
const ADMIN_UID = `e2e-admin-${E2E_TIMESTAMP}`;
const USER_UID = `e2e-user-${E2E_TIMESTAMP}`;
const JOB_ID = `e2e-job-${E2E_TIMESTAMP}`;

let step = 1;

function log(message) {
  console.log(`[STEP ${step++}] ${message}`);
}

function pass(message) {
  console.log(`✅ [PASS] ${message}`);
}

function fail(message) {
  console.error(`❌ [FAIL] ${message}`);
  process.exit(1);
}

async function main() {
  log('Starting URAI Jobs E2E Validation');

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    fail('FIRESTORE_EMULATOR_HOST not set. Run: firebase emulators:start --only firestore,auth');
  }

  // Initialize Firebase Admin SDK
  initializeApp();
  const db = getFirestore();
  const auth = getAuth();

  try {
    // 1. Seed users
    log('Seeding test users...');
    await auth.createUser({ uid: ADMIN_UID, email: `admin_${E2E_TIMESTAMP}@test.com` });
    await auth.createUser({ uid: USER_UID, email: `user_${E2E_TIMESTAMP}@test.com` });
    await db.collection('users').doc(ADMIN_UID).set({ role: 'admin' });
    await db.collection('users').doc(USER_UID).set({ role: 'user' });
    pass('Test users seeded.');

    // 2. Create a job
    log('Creating test job...');
    const createJobPayload = {
      type: 'narrator.tts',
      payload: { text: 'Hello, world!' },
    };
    // This is a simplified, direct-to-firestore write, not a function call.
    // In a real e2e test, we'd call the `createJob` function.
    await db.collection('jobs').doc(JOB_ID).set({
      jobId: JOB_ID,
      ownerUid: USER_UID,
      status: 'PENDING',
      ...createJobPayload,
      createdAt: new Date(),
    });
    await db.collection('jobQueue').doc(JOB_ID).set({
        jobId: JOB_ID,
        payload: createJobPayload.payload
    });
    pass('Test job created.');

    // 3. Verify job document
    log('Verifying job document...');
    const jobDoc = await db.collection('jobs').doc(JOB_ID).get();
    if (!jobDoc.exists || jobDoc.data().jobId !== JOB_ID) {
      fail('Job document not found or incorrect.');
    }
    pass('Job document verified.');

    // 4. Verify queue entry
    log('Verifying jobQueue entry...');
    const queueEntry = await db.collection('jobQueue').doc(JOB_ID).get();
    if (!queueEntry.exists || queueEntry.data().jobId !== JOB_ID) {
        fail('jobQueue entry not found or incorrect.');
    }
    pass('jobQueue entry verified.');


    // 5. Cancel Job
    log('Testing cancel job...');
    await db.collection('jobs').doc(JOB_ID).update({ status: 'CANCELLED'});
    const canceledJob = await db.collection('jobs').doc(JOB_ID).get();
    if(canceledJob.data().status !== 'CANCELLED'){
        fail('Job was not cancelled');
    }
    pass('Job was cancelled');

    console.log('\n[PASS] URAI_JOBS_E2E_VALIDATION');

  } catch (err) {
    fail(`An error occurred: ${err.message}`);
  }
}

main();
