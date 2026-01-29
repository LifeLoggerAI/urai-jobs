import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import { Job, Application } from "./models.js";

export const scheduledDailyDigest = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const db = firestore();
    const now = firestore.Timestamp.now();
    const yesterday = new firestore.Timestamp(now.seconds - 24 * 60 * 60, 0);

    const applicationsSnapshot = await db
      .collection("applications")
      .where("submittedAt", ">=", yesterday)
      .get();

    const newApplicationsCount = applicationsSnapshot.size;

    const pendingApplicationsSnapshot = await db
      .collection("applications")
      .where("status", "in", ["NEW", "SCREEN"])
      .get();

    const pendingNewCount = pendingApplicationsSnapshot.docs.filter(
      (doc) => (doc.data() as Application).status === "NEW"
    ).length;
    const pendingScreenCount = pendingApplicationsSnapshot.docs.filter(
      (doc) => (doc.data() as Application).status === "SCREEN"
    ).length;

    const jobsSnapshot = await db.collection("jobs").orderBy("stats.applicantsCount", "desc").limit(5).get();

    const topJobs = jobsSnapshot.docs.map((doc) => {
        const job = doc.data() as Job;
        return {
            jobId: doc.id,
            title: job.title,
            applicantsCount: job.stats?.applicantsCount || 0,
        }
    });

    const date = new Date().toISOString().slice(0, 10);
    const digest = {
      date,
      newApplicationsLast24h: newApplicationsCount,
      pendingNewCount,
      pendingScreenCount,
      topJobs,
      createdAt: now,
    };

    await db.collection("digests").doc(date).set(digest);

    console.log(`Daily digest for ${date} created successfully.`);
  });
