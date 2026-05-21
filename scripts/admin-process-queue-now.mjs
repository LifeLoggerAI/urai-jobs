import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'urai-jobs';
const limit = Math.max(1, Math.min(25, Number(process.env.QUEUE_DRAIN_LIMIT || '10')));
const topicName = process.env.JOB_EXECUTION_TOPIC || 'job-execution';
const leaseMs = Math.max(30000, Number(process.env.QUEUE_LEASE_MS || '60000'));
const workerId = `admin-${ulid()}`;

if (getApps().length === 0) initializeApp({ projectId });

const db = getFirestore();
const pubsub = new PubSub({ projectId });

const nowDate = new Date();
const snapshot = await db
  .collection('jobQueue')
  .where('status', '==', 'PENDING')
  .where('availableAt', '<=', nowDate)
  .orderBy('availableAt')
  .limit(limit)
  .get();

const leased = [];
const skipped = [];
const published = [];

for (const doc of snapshot.docs) {
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
    await pubsub.topic(topicName).publishMessage({
      json: { jobId, leaseToken: lease.leaseToken },
    });
    published.push(jobId);
  }
}

const result = {
  projectId,
  topicName,
  workerId,
  requested: limit,
  found: snapshot.size,
  leased,
  published,
  skipped,
};

console.log(JSON.stringify(result, null, 2));
if (published.length > 0) console.log('[PASS] Queue drain messages published.');
else console.log('[PASS] No eligible pending jobs found.');
