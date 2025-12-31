import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const scheduledDailyDigest = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10);

  const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
    now.getTime() - 24 * 60 * 60 * 1000
  );

  const newApplications = await db
    .collection("applications")
    .where("submittedAt", ">=", twentyFourHoursAgo)
    .get();

  const pendingApplications = await db
    .collection("applications")
    .where("status", "in", ["NEW", "SCREEN"])
    .get();

  const jobs = await db.collection("jobs").get();
  const topJobs = jobs.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.stats?.applicantsCount || 0) - (a.stats?.applicantsCount || 0))
    .slice(0, 5);

  const digest = {
    date: yyyymmdd,
    newApplications: newApplications.size,
    pendingApplications: pendingApplications.size,
    topJobs: topJobs.map((job) => ({ 
      id: job.id, 
      title: job.title,
      applicantsCount: job.stats?.applicantsCount || 0
    })),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("digests").doc(yyyymmdd).set(digest);
});
