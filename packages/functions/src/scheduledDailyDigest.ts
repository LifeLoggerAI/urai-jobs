import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const scheduledDailyDigest = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const newApplications = await admin
      .firestore()
      .collection("applications")
      .where("submittedAt", ">=", yesterday)
      .get();

    const pendingApplications = await admin
      .firestore()
      .collection("applications")
      .where("status", "in", ["NEW", "SCREEN"])
      .get();

    const topJobs = await admin
      .firestore()
      .collection("jobs")
      .orderBy("stats.applicantsCount", "desc")
      .limit(5)
      .get();

    const digest = {
      date: now.toISOString().split("T")[0],
      newApplicationsCount: newApplications.size,
      pendingApplicationsCount: pendingApplications.size,
      topJobs: topJobs.docs.map((doc) => ({
        jobId: doc.id,
        title: doc.data().title,
        applicantsCount: doc.data().stats.applicantsCount,
      })),
    };

    await admin
      .firestore()
      .collection("digests")
      .doc(digest.date)
      .set(digest);
  });
