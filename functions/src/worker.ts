import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { JobRun } from './models';
import { firestore } from 'firebase-admin';

const db = admin.firestore();

export const worker = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const now = firestore.Timestamp.now();
  const query = db.collection('jobRuns')
    .where('status', '==', 'queued')
    .orderBy('queuedAt', 'asc')
    .limit(10);

  const runs = await query.get();

  const promises = runs.docs.map(async (doc) => {
    const run = doc.data() as JobRun;
    const runRef = doc.ref;

    try {
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(runRef);
        if (doc.data()?.status !== 'queued') {
          return;
        }

        const jobRef = db.collection('jobs').doc(run.jobId);
        const jobDoc = await transaction.get(jobRef);
        const job = jobDoc.data()!;

        const leaseSeconds = job.leaseSeconds || 60;
        const leaseExpiresAt = firestore.Timestamp.fromMillis(now.toMillis() + leaseSeconds * 1000);

        transaction.update(runRef, {
          status: 'leased',
          leaseExpiresAt,
          workerId: context.eventId,
        });
      });

      await executeRun(runRef.id, run);

    } catch (error) {
      console.error(`Error leasing run ${runRef.id}:`, error);
    }
  });

  await Promise.all(promises);
});

async function executeRun(runId: string, run: JobRun) {
  const runRef = db.collection('jobRuns').doc(runId);

  try {
    await runRef.update({
      status: 'running',
      startedAt: firestore.Timestamp.now(),
    });

    // Execute the job handler
    const handler = await import(`./jobs/handlers/${run.jobId}`);
    await handler.default(run);

    await runRef.update({
      status: 'succeeded',
      finishedAt: firestore.Timestamp.now(),
    });

  } catch (error: any) {
    console.error(`Error executing run ${runId}:`, error);

    const runDoc = await runRef.get();
    const currentRun = runDoc.data() as JobRun;
    const jobDoc = await db.collection('jobs').doc(currentRun.jobId).get();
    const job = jobDoc.data()!;

    if (currentRun.attempt >= job.maxRetries) {
      await runRef.update({
        status: 'failed',
        finishedAt: firestore.Timestamp.now(),
        error: { message: error.message },
      });
      // TODO: Add to deadletter queue
    } else {
      await runRef.update({
        status: 'queued',
        attempt: firestore.FieldValue.increment(1),
      });
    }
  }
}
