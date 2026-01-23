
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

const db = admin.firestore();

export const verifyJobs = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  logger.log("Running job verifier...");

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const stalledJobs = await db.collection('jobs')
    .where('status', '==', 'processing')
    .where('updatedAt', '<', fiveMinutesAgo)
    .get();

  stalledJobs.forEach(async (doc) => {
    logger.warn(`Job ${doc.id} appears to be stalled. Re-queueing.`);
    await db.collection('jobs').doc(doc.id).update({
        status: 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
});
