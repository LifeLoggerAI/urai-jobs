

import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const scheduledDailyDigest = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
      try {
        const db = getFirestore();
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const applicationsSnap = await db
            .collection("applications")
            .where("submittedAt", ">=", yesterday)
            .get();

        const newApplicationsCount = applicationsSnap.size;

        const pendingSnap = await db
            .collection("applications")
            .where("status", "in", ["NEW", "SCREEN"])
            .get();
        const pendingCount = pendingSnap.size;

        const jobsSnap = await db
            .collection("jobs")
            .orderBy("stats.applicantsCount", "desc")
            .limit(5)
            .get();
        const topJobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const digest = {
            date: now.toISOString().split("T")[0], // YYYY-MM-DD
            newApplicationsCount,
            pendingCount,
            topJobs,
            createdAt: FieldValue.serverTimestamp(),
        };

        const digestId = digest.date;
        await db.collection("digests").doc(digestId).set(digest);
      } catch (error) {
        console.error("Daily digest failed", error);
      }
    });
