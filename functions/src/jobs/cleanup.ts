import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Scheduled function that runs daily to clean up old job runs.
export const cleanupOldRuns = functions.scheduler.onSchedule("every day 00:00", async () => {
    const configSnap = await db.collection("config").doc("jobs").get();
    const daysToKeep = configSnap.data()?.jobRunRetentionDays || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const oldRuns = await db.collection("jobRuns").where("endedAt", "<", cutoff).get();

    if (oldRuns.empty) {
        console.log("No old job runs to delete.");
        return;
    }

    const batch = db.batch();
    oldRuns.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Deleted ${oldRuns.size} old job runs.`);
});
