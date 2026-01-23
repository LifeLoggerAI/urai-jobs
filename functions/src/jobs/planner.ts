
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

const db = admin.firestore();

const MAX_RETRIES = 3;

export const planner = functions.pubsub.schedule('every 1 minute').onRun(async () => {
  logger.log("Running planner...");

  const pendingJobs = await db.collection('jobs')
    .where('status', '==', 'pending')
    .where('retries', '<', MAX_RETRIES)
    .get();

  pendingJobs.forEach(async (doc) => {
    logger.log(`Moving job ${doc.id} to processing.`);
    await db.collection('jobs').doc(doc.id).update({
        status: 'processing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
});
