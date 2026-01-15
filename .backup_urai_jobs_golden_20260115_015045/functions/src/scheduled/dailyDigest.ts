import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {db} from '../lib/firebase';

export const dailydigest = onSchedule("every 24 hours", async () => {
  const now = Timestamp.now();
  const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

  const newApplications = await db
    .collection("applications")
    .where("submittedAt", ">=", twentyFourHoursAgo)
    .count()
    .get();

  const pendingNew = await db
    .collection("applications")
    .where("status", "==", "NEW")
    .count()
    .get();

  const pendingScreen = await db
    .collection("applications")
    .where("status", "==", "SCREEN")
    .count()
    .get();

  const topJobs = await db
    .collection("jobs")
    .orderBy("stats.applicantsCount", "desc")
    .limit(5)
    .get();

  const digest = {
    createdAt: now,
    newApplicationsLast24h: newApplications.data().count,
    pendingNewCount: pendingNew.data().count,
    pendingScreenCount: pendingScreen.data().count,
    topJobs: topJobs.docs.map((doc) => ({ id: doc.id, title: doc.data().title, applicants: doc.data().stats.applicantsCount })),
  };

  const date = new Date().toISOString().split("T")[0];
  await db.collection("digests").doc(date).set(digest);

  logger.info(`Daily digest for ${date} created successfully.`);
});
