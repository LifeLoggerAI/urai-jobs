import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const POLL_MS = Number(process.env.URAI_WORKER_POLL_MS || 2000);
const JOB_TYPE_FILTER = process.env.URAI_JOB_TYPE || '';
const WORKER_NAME = process.env.URAI_WORKER_NAME || 'local-worker';

console.log(`[WORKER] started name=${WORKER_NAME} pollMs=${POLL_MS}${JOB_TYPE_FILTER ? ` jobType=${JOB_TYPE_FILTER}` : ''}`);

async function claimNextJob() {
  let query = db.collection('jobQueue').where('status', '==', 'PENDING').limit(1);
  if (JOB_TYPE_FILTER) {
    query = db.collection('jobQueue')
      .where('status', '==', 'PENDING')
      .where('jobType', '==', JOB_TYPE_FILTER)
      .limit(1);
  }

  const snap = await query.get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const jobId = doc.id;
  const queueData = doc.data() || {};
  const leaseToken = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await db.runTransaction(async (tx) => {
    const queueRef = db.collection('jobQueue').doc(jobId);
    const jobRef = db.collection('jobs').doc(jobId);

    const [freshQueue, freshJob] = await Promise.all([
      tx.get(queueRef),
      tx.get(jobRef)
    ]);

    if (!freshQueue.exists) {
      throw new Error(`queue doc missing for ${jobId}`);
    }
    if (!freshJob.exists) {
      throw new Error(`job doc missing for ${jobId}`);
    }

    const fq = freshQueue.data() || {};
    const fj = freshJob.data() || {};

    if (fq.status !== 'PENDING') {
      throw new Error(`job ${jobId} no longer pending`);
    }

    tx.update(queueRef, {
      status: 'RUNNING',
      leasedAt: admin.firestore.FieldValue.serverTimestamp(),
      leaseToken,
      workerName: WORKER_NAME
    });

    tx.update(jobRef, {
      status: 'RUNNING',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lease: {
        leaseToken,
        workerName: WORKER_NAME,
        leasedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      execution: {
        ...(fj.execution || {}),
        attemptCount: Number((fj.execution && fj.execution.attemptCount) || 0) + 1
      }
    });
  });

  return {
    jobId,
    leaseToken,
    queueData
  };
}

async function executeJob(jobId) {
  const jobRef = db.collection('jobs').doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) {
    throw new Error(`job ${jobId} missing during execute`);
  }
  const job = snap.data() || {};
  const jobType = job.jobType || 'unknown';

  console.log(`[WORKER] executing job=${jobId} type=${jobType}`);

  await sleep(1000);

  await db.collection('jobResults').doc(jobId).set({
    jobId,
    ok: true,
    workerName: WORKER_NAME,
    result: {
      ok: true,
      simulated: true,
      jobType
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection('logs').add({
    jobId,
    level: 'info',
    source: 'worker',
    message: `Job ${jobId} executed by ${WORKER_NAME}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function completeJob(jobId, leaseToken) {
  await db.runTransaction(async (tx) => {
    const queueRef = db.collection('jobQueue').doc(jobId);
    const jobRef = db.collection('jobs').doc(jobId);

    const [queueSnap, jobSnap] = await Promise.all([
      tx.get(queueRef),
      tx.get(jobRef)
    ]);

    if (!queueSnap.exists || !jobSnap.exists) {
      throw new Error(`missing docs during completion for ${jobId}`);
    }

    const queueData = queueSnap.data() || {};
    if (queueData.leaseToken && queueData.leaseToken !== leaseToken) {
      throw new Error(`lease mismatch completing ${jobId}`);
    }

    tx.update(jobRef, {
      status: 'COMPLETED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.update(queueRef, {
      status: 'COMPLETED',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function failJob(jobId, err) {
  const message = err instanceof Error ? err.message : String(err);

  await db.collection('jobs').doc(jobId).set({
    status: 'FAILED',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: { message }
  }, { merge: true });

  await db.collection('jobQueue').doc(jobId).set({
    status: 'FAILED',
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: { message }
  }, { merge: true });

  await db.collection('logs').add({
    jobId,
    level: 'error',
    source: 'worker',
    message,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.error(`[WORKER] failed job=${jobId} error=${message}`);
}

let shuttingDown = false;

async function loop() {
  while (!shuttingDown) {
    try {
      const claimed = await claimNextJob();
      if (!claimed) {
        await sleep(POLL_MS);
        continue;
      }

      console.log(`[WORKER] picked job ${claimed.jobId}`);

      try {
        await executeJob(claimed.jobId);
        await completeJob(claimed.jobId, claimed.leaseToken);
        console.log(`[WORKER] completed job ${claimed.jobId}`);
      } catch (err) {
        await failJob(claimed.jobId, err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('no longer pending')) {
        console.error(`[WORKER] loop error=${message}`);
      }
      await sleep(POLL_MS);
    }
  }
}

process.on('SIGINT', () => {
  shuttingDown = true;
  console.log('[WORKER] stopping (SIGINT)');
});
process.on('SIGTERM', () => {
  shuttingDown = true;
  console.log('[WORKER] stopping (SIGTERM)');
});

await loop();
