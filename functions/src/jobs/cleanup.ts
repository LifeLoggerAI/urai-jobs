import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Delete succeeded jobs older than 30 days
export const cleanupOldJobs = functions.pubsub.schedule("every 24 hours").onRun(async () => {
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const oldJobs = await db.collection("jobs")
    .where("status", "==", "succeeded")
    .where("updatedAt", "<", monthAgo)
    .limit(250)
    .get();

  if (oldJobs.empty) return;

  const batch = db.batch();
  oldJobs.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
});