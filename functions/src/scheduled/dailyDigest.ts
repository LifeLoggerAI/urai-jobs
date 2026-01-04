import { pubsub } from "firebase-functions";
import { db } from "../firebase";
import * as admin from "firebase-admin";

export const scheduledDailyDigest = pubsub.schedule("every 24 hours").onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const yesterday = admin.firestore.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

    const newApplicationsSnap = await db.collection("applications").where("submittedAt", ">=", yesterday).get();
    const pendingApplicationsSnap = await db.collection("applications").where("status", "in", ["NEW", "SCREEN"]).get();

    const jobsSnap = await db.collection("jobs").orderBy("stats.applicantsCount", "desc").limit(5).get();

    const topJobs = jobsSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title, applicantsCount: doc.data().stats.applicantsCount || 0 }));

    const digest = {
        createdAt: now,
        newApplicationsCount: newApplicationsSnap.size,
        pendingApplicationsCount: pendingApplicationsSnap.size,
        topJobs,
    };

    const dateString = new Date().toISOString().split('T')[0];
    await db.collection("digests").doc(dateString).set(digest);

    console.log(`Daily digest for ${dateString} created successfully.`);
});
