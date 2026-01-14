import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { startOfDay, sub } from 'date-fns';

const db = admin.firestore();

export const httpHealth = functions.https.onRequest((request, response) => {
  response.status(200).send({ status: "ok", timestamp: new Date().toISOString() });
});

export const scheduledDailyDigest = functions.pubsub
  .schedule("0 9 * * 1-5") // 9 AM on weekdays
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const today = startOfDay(new Date());
    const yesterday = sub(today, { days: 1 });

    const newAppsSnap = await db
      .collection("applications")
      .where("submittedAt", ">=", yesterday)
      .where("submittedAt", "<", today)
      .get();

    const pendingAppsSnap = await db
      .collection("applications")
      .where("status", "in", ["NEW", "SCREEN"])
      .get();

    const digestId = today.toISOString().split("T")[0]; // YYYY-MM-DD

    await db.collection("digests").doc(digestId).set({
      createdAt: context.timestamp,
      newApplicationsLast24h: newAppsSnap.size,
      pendingReviewCount: pendingAppsSnap.size,
    }, { merge: true });

    functions.logger.info(`Daily digest ${digestId} created successfully.`);
  });
