import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
const db = admin.firestore();

export const scheduleTick = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const q = await db.collection("jobs")
      .where("status", "==", "queued")
      .where("scheduledFor", "<=", new Date())
      .orderBy("scheduledFor")
      .orderBy("priority")
      .limit(25)
      .get();

    // Touch to trigger onUpdate path
    await Promise.all(q.docs.map(d => d.ref.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() })));
  });