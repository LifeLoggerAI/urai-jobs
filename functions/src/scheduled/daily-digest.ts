
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { format } from "date-fns";

const db = getFirestore();

export const scheduleddailydigest = onSchedule("every 24 hours", async () => {
  logger.info("Running daily digest function.");

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // 1. Get new applications in the last 24 hours
    const newApplicationsSnap = await db
      .collection("applications")
      .where("submittedAt", ">=", yesterday)
      .count()
      .get();
    const newApplicationsCount = newApplicationsSnap.data().count;

    // 2. Get pending NEW/SCREEN counts
    const newStatusSnap = await db
      .collection("applications")
      .where("status", "==", "NEW")
      .count()
      .get();
    const screenStatusSnap = await db
      .collection("applications")
      .where("status", "==", "SCREEN")
      .count()
      .get();
    const pendingNewCount = newStatusSnap.data().count;
    const pendingScreenCount = screenStatusSnap.data().count;

    // 3. Get top jobs by applicant count
    const topJobsSnap = await db
      .collection("jobs")
      .orderBy("stats.applicantsCount", "desc")
      .limit(5)
      .get();
    const topJobs = topJobsSnap.docs.map(doc => ({
      jobId: doc.id,
      title: doc.data().title,
      applicants: doc.data().stats?.applicantsCount || 0,
    }));

    // 4. Create the digest document
    const digestId = format(now, "yyyy-MM-dd");
    const digestRef = db.collection("digests").doc(digestId);

    await digestRef.set({
      createdAt: now,
      newApplicationsLast24h: newApplicationsCount,
      pendingReview: {
        new: pendingNewCount,
        screen: pendingScreenCount,
      },
      topJobsByApplicants: topJobs,
    });

    logger.info(`Successfully created daily digest with ID: ${digestId}`);
  } catch (error) {
    logger.error("Error creating daily digest", { error });
  }
});
