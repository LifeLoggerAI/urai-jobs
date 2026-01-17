
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job } from "./types";
import { firestore } from "firebase-admin";

/**
 * A Firestore trigger that updates job metrics in real-time whenever a job document changes.
 * This allows for building live dashboards to monitor the health of the job queue.
 */
export const onJobUpdate = functions.firestore.document("jobs/{jobId}").onWrite(async (change, context) => {
    const db = admin.firestore();
    const metricsRef = db.collection("jobMetrics").doc("--stats--");

    // Use a transaction to ensure atomic updates to the metrics document.
    return db.runTransaction(async (transaction) => {
        const metricsDoc = await transaction.get(metricsRef);

        let currentMetrics: {[status: string]: number} = {};
        if (metricsDoc.exists) {
            currentMetrics = metricsDoc.data()?.statusCounts || {};
        }

        const beforeData = change.before.exists ? change.before.data() as Job : null;
        const afterData = change.after.exists ? change.after.data() as Job : null;

        // Decrement the count for the old status if the job is transitioning
        if (beforeData && beforeData.status) {
            const oldStatus = beforeData.status;
            currentMetrics[oldStatus] = (currentMetrics[oldStatus] || 1) - 1;
            if (currentMetrics[oldStatus] < 0) currentMetrics[oldStatus] = 0;
        }

        // Increment the count for the new status
        if (afterData && afterData.status) {
            const newStatus = afterData.status;
            currentMetrics[newStatus] = (currentMetrics[newEstatus] || 0) + 1;
        }
        
        // Handle total count
        let total = currentMetrics.total || 0;
        if (beforeData && !afterData) { // Job deleted
            total--;
        } else if (!beforeData && afterData) { // Job created
            total++;
        }

        const newMetrics = {
            statusCounts: currentMetrics,
            total: total,
            lastUpdated: firestore.Timestamp.now(),
        };

        transaction.set(metricsRef, newMetrics, { merge: true });
    });
});
