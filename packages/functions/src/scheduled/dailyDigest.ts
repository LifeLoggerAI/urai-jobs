import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();

export const scheduleddailydigest = onSchedule("every 24 hours", async () => {
  const now = Timestamp.now();
  const yesterday = Timestamp.fromMillis(
    now.toMillis() - 24 * 60 * 60 * 1000
  );

  const newApplicationsSnap = await db
    .collection("applications")
    .where("submittedAt", ">=", yesterday)
    .get();
  const pendingApplicationsSnap = await db
    .collection("applications")
    .where("status", "in", ["NEW", "SCREEN"])
    .get();

  const jobsSnap = await db
    .collection("jobs")
    .orderBy("stats.applicantsCount", "desc")
    .limit(5)
    .get();

  const topJobs = jobsSnap.docs.map((doc) => {
    const {title, stats} = doc.data();
    return {
      id: doc.id,
      title,
      applicantsCount: stats?.applicantsCount || 0,
    };
  });

  const digest = {
    createdAt: now,
    newApplicationsCount: newApplicationsSnap.size,
    pendingApplicationsCount: pendingApplicationsSnap.size,
    topJobs,
  };

  const dateString = new Date().toISOString().split("T")[0];
  await db.collection("digests").doc(dateString).set(digest);

  console.log(`Daily digest for ${dateString} created successfully.`);
});
