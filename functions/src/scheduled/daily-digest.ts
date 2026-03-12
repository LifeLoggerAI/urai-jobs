import * as admin from "firebase-admin";
import { logger, pubsub } from "firebase-functions";

const db = admin.firestore();

export const scheduledDailyDigest = pubsub.schedule("every 24 hours").onRun(async (context) => {
  logger.info("Running daily digest function.");

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    // 1. Get new applications in the last 24 hours
    const newApplicationsSnap = await db
      .collection("applications")
      .where("submittedAt", ">=", yesterday)
      .get();
    const newApplicationsCount = newApplicationsSnap.size;

    // 2. Get pending application counts
    const pendingNewSnap = await db.collection("applications").where("status", "==", "NEW").count().get();
    const pendingScreenSnap = await db.collection("applications").where("status", "==", "SCREEN").count().get();
    const pendingNewCount = pendingNewSnap.data().count;
    const pendingScreenCount = pendingScreenSnap.data().count;

    // 3. Get top 5 jobs by total applicant count
    const topJobsSnap = await db
      .collection("jobs")
      .orderBy("stats.applicantsCount", "desc")
      .limit(5)
      .get();
    const topJobs = topJobsSnap.docs.map(doc => ({
      jobId: doc.id,
      title: doc.data().title,
      applicantsCount: doc.data().stats?.applicantsCount || 0,
    }));

    // 4. Assemble the digest document
    const digest = {
      date: dateStr,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      newApplicationsLast24h: newApplicationsCount,
      pendingCounts: {
        new: pendingNewCount,
        screen: pendingScreenCount,
      },
      topJobsByApplicants: topJobs,
    };

    // 5. Write the digest to Firestore
    await db.collection("digests").doc(dateStr).set(digest);

    logger.info(`Successfully created daily digest for ${dateStr}.`, digest);

  } catch (error) {
    logger.error("Error creating daily digest:", error);
  }
});
