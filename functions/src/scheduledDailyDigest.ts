import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as dayjs from "dayjs";

export const scheduledDailyDigest = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
  const now = dayjs();
  const yesterday = now.subtract(1, "day").toDate();

  const newApplicationsSnapshot = await admin.firestore().collection("applications").where("submittedAt", ">=", yesterday).get();
  const pendingApplicationsSnapshot = await admin.firestore().collection("applications").where("status", "in", ["NEW", "SCREEN"]).get();
  const jobsSnapshot = await admin.firestore().collection("jobs").orderBy("stats.applicantsCount", "desc").limit(5).get();

  const digest = {
    date: now.format("YYYY-MM-DD"),
    newApplications: newApplicationsSnapshot.size,
    pendingApplications: pendingApplicationsSnapshot.size,
    topJobs: jobsSnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title, applicants: doc.data().stats.applicantsCount || 0 })),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await admin.firestore().collection("digests").doc(digest.date).set(digest);
});
