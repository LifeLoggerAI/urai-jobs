import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = getFirestore();

export const scheduledDailyDigest = onSchedule({ schedule: "every 24 hours" }, async () => {
    logger.info("Running daily digest...");

    const now = Timestamp.now();
    const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

    const newApplicationsPromise = db.collection("applications")
        .where("submittedAt", ">=", twentyFourHoursAgo)
        .get();

    const pendingApplicationsPromise = db.collection("applications")
        .where("status", "in", ["NEW", "SCREEN"])
        .get();

    const topJobsPromise = db.collection("jobs")
        .orderBy("stats.applicantsCount", "desc")
        .limit(5)
        .get();

    const [newApplicationsSnap, pendingApplicationsSnap, topJobsSnap] = await Promise.all([
        newApplicationsPromise,
        pendingApplicationsPromise,
        topJobsPromise,
    ]);

    const digest = {
        createdAt: now,
        newApplicationsLast24h: newApplicationsSnap.size,
        pendingApplications: pendingApplicationsSnap.size,
        topJobsByApplicantCount: topJobsSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title, count: doc.data().stats.applicantsCount })),
    };

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const digestRef = db.collection("digests").doc(date);

    try {
        await digestRef.set(digest);
        logger.info(`Daily digest for ${date} created successfully.`);
    } catch (error) {
        logger.error(`Error creating daily digest for ${date}`, error);
    }
});
