import { spawnSync } from 'node:child_process';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ulid } from 'ulid';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'urai-jobs';
const limit = Math.max(1, Math.min(25, Number(process.env.QUEUE_DRAIN_LIMIT || '10')));
const topicName = process.env.JOB_EXECUTION_TOPIC || 'job-execution';
const leaseMs = Math.max(30000, Number(process.env.QUEUE_LEASE_MS || '60000'));
const workerId = `admin-${ulid()}`;

function publishExecutionMessage(message) {
  const result = spawnSync('gcloud', [
    'pubsub',
    'topics',
    'publish',
    topicName,
    '--project',
    projectId,
    '--message',
    JSON.stringify(message),
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`gcloud pubsub publish failed for ${message.jobId}: ${output}`);
  }
}

function dateValue(value) {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

if (getApps().length === 0) initializeApp({ projectId });

const db = getFirestore();
const nowDate = new Date();

const snapshot = await db
  .collection('jobQueue')
  .where('status', '==', 'PENDING')
  .limit(Math.max(limit * 5, 25))
  .get();

const eligibleDocs = snapshot.docs
  .filter((doc) => dateValue(doc.data().availableAt) <= nowDate)
  .sort((a, b) => dateValue(a.data().availableAt).getTime() - dateValue(b.data().availableAt).getTime())
  .slice(0, limit);

const leased = [];
const skipped = [];
const published = [];
const publishErrors = [];

for (const doc of eligibleDocs) {
  const data = doc.data();
  const jobId = data.jobId || doc.id;

  const lease = await db.runTransaction(async (tx) => {
    const queueRef = db.collection('jobQueue').doc(jobId);
    const jobRef = db.collection('jobs').doc(jobId);
    const queueDoc = await tx.get(queueRef);

    if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
      skipped.push(jobId);
      return null;
    }

    const newLease = {
      leaseId: ulid(),
      leaseToken: ulid(),
      workerId,
      expiresAt: new Date(Date.now() + leaseMs),
    };

    const update = {
      status: 'LEASED',
      lease: newLease,
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.update(queueRef, update);
    tx.update(jobRef, update);
    return newLease;
  });

  if (lease?.leaseToken) {
    leased.push(jobId);
    try {
      publishExecutionMessage({ jobId, leaseToken: lease.leaseToken });
      published.push(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      publishErrors.push({ jobId, message });
    }
  }
}

const result = {
  projectId,
  topicName,
  workerId,
  requested: limit,
  scanned: snapshot.size,
  found: eligibleDocs.length,
  leased,
  published,
  skipped,
  publishErrors,
};

console.log(JSON.stringify(result, null, 2));

if (publishErrors.length > 0) {
  console.error('[FAIL] One or more queue drain messages failed to publish.');
  process.exit(1);
}

if (published.length > 0) console.log('[PASS] Queue drain messages published.');
else console.log('[PASS] No eligible pending jobs found.');
