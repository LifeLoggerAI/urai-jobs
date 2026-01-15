
import * as functions from "firebase-functions";
import { firestore } from "../lib/firebase";

export const scheduledDailyDigest = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const newApplications = await firestore
      .collection("applications")
      .where("submittedAt", ">=", yesterday)
      .get();

    const pendingApplications = await firestore
      .collection("applications")
      .where("status", "in", ["NEW", "SCREEN"])
      .get();

    const topJobs = await firestore
      .collection("jobs")
      .orderBy("stats.applicantsCount", "desc")
      .limit(5)
      .get();

    const digest = {
      date: now.toISOString().split("T")[0],
      newApplications: newApplications.size,
      pendingApplications: pendingApplications.size,
      topJobs: topJobs.docs.map((doc) => doc.data()),
    };

    await firestore.collection("digests").add(digest);
  });
