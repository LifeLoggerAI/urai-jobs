import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

/**
 * A job in the queue.
 */
interface Job {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  runAfter: admin.firestore.Timestamp;
  leaseExpiresAt: admin.firestore.Timestamp | null;
  priority: number;
  createdAt: admin.firestore.Timestamp;
  [key: string]: any;
}

/**
 * A handler for a job type.
 */
interface JobHandler {
  (job: Job): Promise<void>;
}

/**
 * A map of job types to their handlers.
 */
const jobHandlers: { [key: string]: JobHandler } = {
  // Add your job handlers here.
  // Example:
  // 'myJobType': async (job) => {
  //   console.log(`Processing job ${job.id} with data:`, job.data);
  //   // Do something with the job data.
  //   await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work.
  // },
};

/**
 * The main function that processes jobs.
 */
export const processJobs = functions.runWith({ memory: '1GB' }).pubsub
  .schedule('every 1 minutes').onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    // 1. Find and lease jobs.
    const query = db.collection('jobs')
      .where('status', '==', 'queued')
      .where('runAfter', '<', now)
      .orderBy('runAfter', 'asc')
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'asc')
      .limit(10);

    const jobs = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(query);
      const leasedJobs: Job[] = [];

      for (const doc of snapshot.docs) {
        const job = doc.data() as Job;
        const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + 60 * 1000, // 1 minute lease
        );
        transaction.update(doc.ref, { status: 'processing', leaseExpiresAt });
        leasedJobs.push({ id: doc.id, ...job });
      }

      return leasedJobs;
    });

    // 2. Process leased jobs.
    for (const job of jobs) {
      const handler = jobHandlers[job.type];
      if (handler) {
        try {
          await handler(job);
          await db.collection('jobs').doc(job.id).update({ status: 'completed' });
        } catch (error) {
          console.error(`Job ${job.id} failed:`, error);
          await db.collection('jobs').doc(job.id).update({ status: 'failed' });
        }
      } else {
        console.error(`No handler for job type: ${job.type}`);
        await db.collection('jobs').doc(job.id).update({ status: 'failed' });
      }
    }
  });

/**
 * A function to clean up stale jobs.
 */
export const cleanupStaleJobs = functions.pubsub.schedule('every 1 hours').onRun(async () => {
  const now = admin.firestore.Timestamp.now();
  const query = db.collection('jobs')
    .where('status', '==', 'processing')
    .where('leaseExpiresAt', '<', now);

  const snapshot = await query.get();
  const updates: Promise<any>[] = [];

  snapshot.forEach(doc => {
    updates.push(doc.ref.update({ status: 'queued', leaseExpiresAt: null }));
  });

  await Promise.all(updates);
});
