import admin from 'firebase-admin';
import http from 'node:http';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const POLL_MS = Number(process.env.URAI_WORKER_POLL_MS || 2000);
const JOB_TYPE_FILTER = process.env.URAI_JOB_TYPE || '';
const WORKER_NAME = process.env.URAI_WORKER_NAME || 'local-worker';
const LEASE_MS = Number(process.env.URAI_LEASE_MS || 60000);
const MAX_ATTEMPTS = Number(process.env.URAI_MAX_ATTEMPTS || 3);
const PORT = Number(process.env.PORT || 0);
let lastLoopAt = Date.now();
let lastClaimedJobId = '';
let completedCount = 0;
let failedCount = 0;

function startHealthServer() {
  if (!PORT) return null;

  const server = http.createServer((req, res) => {
    const payload = JSON.stringify({
      ok: true,
      workerName: WORKER_NAME,
      jobType: JOB_TYPE_FILTER || null,
      shuttingDown,
      lastLoopAt,
      lastClaimedJobId: lastClaimedJobId || null,
      completedCount,
      failedCount
    });

    if (req.url === '/healthz' || req.url === '/readyz' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(payload);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WORKER] health server listening port=${PORT}`);
  });

  return server;
}

const healthServer = startHealthServer();

console.log(
  `[WORKER] started name=${WORKER_NAME} pollMs=${POLL_MS} leaseMs=${LEASE_MS} maxAttempts=${MAX_ATTEMPTS}` +
  `${JOB_TYPE_FILTER ? ` jobType=${JOB_TYPE_FILTER}` : ''}`
);

function nowMillis() {
  return Date.now();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value._seconds === 'number') {
    return (value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1e6);
  }
  return 0;
}

function nextBackoffMs(attemptCount) {
  const base = 5000;
  const factor = Math.max(1, attemptCount);
  return Math.min(base * factor, 60000);
}

async function writeLog(jobId, level, message, extra = {}) {
  await db.collection('logs').add({
    jobId,
    level,
    source: 'worker',
    workerName: WORKER_NAME,
    message,
    ...extra,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function reclaimStaleLeases() {
  const runningSnap = await db.collection('jobQueue')
    .where('status', '==', 'RUNNING')
    .limit(50)
    .get();

  for (const doc of runningSnap.docs) {
    const queue = doc.data() || {};
    const leasedAtMs = toMillis(queue.leasedAt);
    if (!leasedAtMs) continue;

    const ageMs = nowMillis() - leasedAtMs;
    if (ageMs < LEASE_MS) continue;

    const jobId = doc.id;
    const jobRef = db.collection('jobs').doc(jobId);
    const queueRef = db.collection('jobQueue').doc(jobId);

    await db.runTransaction(async (tx) => {
      const [freshQueue, freshJob] = await Promise.all([
        tx.get(queueRef),
        tx.get(jobRef)
      ]);

      if (!freshQueue.exists || !freshJob.exists) return;

      const fq = freshQueue.data() || {};
      const fj = freshJob.data() || {};
      const freshLeasedAtMs = toMillis(fq.leasedAt);
      if (!freshLeasedAtMs) return;

      const freshAgeMs = nowMillis() - freshLeasedAtMs;
      if (fq.status !== 'RUNNING' || freshAgeMs < LEASE_MS) return;

      const attemptCount = Number((fj.execution && fj.execution.attemptCount) || fq.attemptCount || 0);
      const maxAttempts = Number((fj.execution && fj.execution.maxAttempts) || MAX_ATTEMPTS);

      if (attemptCount >= maxAttempts) {
        tx.update(jobRef, {
          status: 'DEAD',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: { message: `Lease expired after ${attemptCount} attempts` }
        });
        tx.update(queueRef, {
          status: 'DEAD',
          deadAt: admin.firestore.FieldValue.serverTimestamp(),
          error: { message: `Lease expired after ${attemptCount} attempts` }
        });
      } else {
        tx.update(jobRef, {
          status: 'PENDING',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        tx.update(queueRef, {
          status: 'PENDING',
          leaseToken: admin.firestore.FieldValue.delete(),
          workerName: admin.firestore.FieldValue.delete(),
          leasedAt: admin.firestore.FieldValue.delete(),
          availableAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    await writeLog(jobId, 'warn', `Reclaimed stale lease for ${jobId}`, { ageMs });
    console.log(`[WORKER] reclaimed stale lease job=${jobId} ageMs=${ageMs}`);
  }
}

async function claimNextJob() {
  let query = db.collection('jobQueue').where('status', '==', 'PENDING').limit(10);

  if (JOB_TYPE_FILTER) {
    query = db.collection('jobQueue')
      .where('status', '==', 'PENDING')
      .where('jobType', '==', JOB_TYPE_FILTER)
      .limit(10);
  }

  const snap = await query.get();
  if (snap.empty) return null;

  const now = nowMillis();

  for (const doc of snap.docs) {
    const queue = doc.data() || {};
    const availableAtMs = toMillis(queue.availableAt);
    if (availableAtMs && availableAtMs > now) continue;

    const jobId = doc.id;
    const leaseToken = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const queueRef = db.collection('jobQueue').doc(jobId);
    const jobRef = db.collection('jobs').doc(jobId);
    let claimed = false;
    let claimedJobType = queue.jobType || '';

    await db.runTransaction(async (tx) => {
      const [freshQueue, freshJob] = await Promise.all([
        tx.get(queueRef),
        tx.get(jobRef)
      ]);

      if (!freshQueue.exists || !freshJob.exists) return;

      const fq = freshQueue.data() || {};
      const fj = freshJob.data() || {};
      const freshAvailableAtMs = toMillis(fq.availableAt);

      if (fq.status !== 'PENDING') return;
      if (freshAvailableAtMs && freshAvailableAtMs > nowMillis()) return;

      const prevAttempts = Number((fj.execution && fj.execution.attemptCount) || fq.attemptCount || 0);
      const maxAttempts = Number((fj.execution && fj.execution.maxAttempts) || MAX_ATTEMPTS);

      if (prevAttempts >= maxAttempts) {
        tx.update(jobRef, {
          status: 'DEAD',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: { message: `Exceeded max attempts (${maxAttempts}) before claim` }
        });
        tx.update(queueRef, {
          status: 'DEAD',
          deadAt: admin.firestore.FieldValue.serverTimestamp(),
          error: { message: `Exceeded max attempts (${maxAttempts}) before claim` }
        });
        return;
      }

      claimed = true;
      claimedJobType = fq.jobType || fj.jobType || '';

      tx.update(queueRef, {
        status: 'RUNNING',
        leasedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaseToken,
        workerName: WORKER_NAME,
        attemptCount: prevAttempts + 1
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
          attemptCount: prevAttempts + 1,
          maxAttempts
        }
      });
    });

    if (claimed) {
      return { jobId, leaseToken, jobType: claimedJobType };
    }
  }

  return null;
}

async function executeJob(jobId) {
  const jobRef = db.collection('jobs').doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new Error(`job ${jobId} missing during execute`);

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

  await writeLog(jobId, 'info', `Job ${jobId} executed by ${WORKER_NAME}`, { jobType });
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
  const jobRef = db.collection('jobs').doc(jobId);
  const queueRef = db.collection('jobQueue').doc(jobId);

  await db.runTransaction(async (tx) => {
    const [jobSnap, queueSnap] = await Promise.all([
      tx.get(jobRef),
      tx.get(queueRef)
    ]);

    if (!jobSnap.exists || !queueSnap.exists) return;

    const job = jobSnap.data() || {};
    const queue = queueSnap.data() || {};
    const attemptCount = Number((job.execution && job.execution.attemptCount) || queue.attemptCount || 1);
    const maxAttempts = Number((job.execution && job.execution.maxAttempts) || MAX_ATTEMPTS);

    if (attemptCount >= maxAttempts) {
      tx.update(jobRef, {
        status: 'DEAD',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: { message }
      });
      tx.update(queueRef, {
        status: 'DEAD',
        deadAt: admin.firestore.FieldValue.serverTimestamp(),
        error: { message }
      });
    } else {
      const backoffMs = nextBackoffMs(attemptCount);
      const availableAt = admin.firestore.Timestamp.fromMillis(nowMillis() + backoffMs);

      tx.update(jobRef, {
        status: 'PENDING',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: { message }
      });

      tx.update(queueRef, {
        status: 'PENDING',
        error: { message },
        availableAt,
        leaseToken: admin.firestore.FieldValue.delete(),
        workerName: admin.firestore.FieldValue.delete(),
        leasedAt: admin.firestore.FieldValue.delete()
      });
    }
  });

  failedCount += 1;
  await writeLog(jobId, 'error', message);
  console.error(`[WORKER] failed job=${jobId} error=${message}`);
}

let shuttingDown = false;

async function loop() {
  while (!shuttingDown) {
    lastLoopAt = Date.now();
    try {
      await reclaimStaleLeases();

      const claimed = await claimNextJob();
      if (!claimed) {
        await sleep(POLL_MS);
        continue;
      }

      lastClaimedJobId = claimed.jobId;
      console.log(`[WORKER] picked job ${claimed.jobId}`);

      try {
        await executeJob(claimed.jobId);
        await completeJob(claimed.jobId, claimed.leaseToken);
        completedCount += 1;
        console.log(`[WORKER] completed job ${claimed.jobId}`);
      } catch (err) {
        await failJob(claimed.jobId, err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WORKER] loop error=${message}`);
      await sleep(POLL_MS);
    }
  }
}

process.on('SIGINT', () => {
  shuttingDown = true;
  console.log('[WORKER] stopping (SIGINT)');
  healthServer?.close();
});
process.on('SIGTERM', () => {
  shuttingDown = true;
  console.log('[WORKER] stopping (SIGTERM)');
  healthServer?.close();
});

await loop();
