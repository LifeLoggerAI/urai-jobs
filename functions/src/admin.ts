import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import { Application, Event } from "./models";

interface AdminSetApplicationStatusParams {
  applicationId: string;
  status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
  tags?: string[];
  rating?: number;
}

export const adminSetApplicationStatus = functions.https.onCall(
  async (data: AdminSetApplicationStatusParams, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const db = firestore();
    const adminRef = db.collection("admins").doc(context.auth.uid);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "The function must be called by an admin user."
      );
    }

    const { applicationId, status, tags, rating } = data;

    const applicationRef = db.collection("applications").doc(applicationId);

    await db.runTransaction(async (transaction) => {
        const applicationDoc = await transaction.get(applicationRef);
        if (!applicationDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Application not found.");
        }

        const application = applicationDoc.data() as Application;

        const jobRef = db.collection("jobs").doc(application.jobId);
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Job not found.");
        }

        const oldStatus = application.status;
        const newStatus = status;

        const updateData: any = {
            status: newStatus,
            updatedAt: firestore.Timestamp.now(),
        };

        if (tags) {
            updateData.tags = tags;
        }

        if (rating) {
            updateData["internal.rating"] = rating;
            updateData["internal.reviewerId"] = context.auth?.uid;
            updateData["internal.reviewedAt"] = firestore.Timestamp.now();
        }

        transaction.update(applicationRef, updateData);

        // Update job stats
        const jobStatsUpdate: any = {};
        if (oldStatus) {
            jobStatsUpdate[`stats.statusCounts.${oldStatus}`] = firestore.FieldValue.increment(-1);
        }
        jobStatsUpdate[`stats.statusCounts.${newStatus}`] = firestore.FieldValue.increment(1);

        transaction.update(jobRef, jobStatsUpdate);
    });

    // Write an `events` entry: "status_changed"
    const event: Event = {
      type: "status_changed",
      entityType: "application",
      entityId: applicationId,
      metadata: { newStatus: status, adminId: context.auth?.uid },
      createdAt: firestore.Timestamp.now(),
    };
    await db.collection("events").add(event);

    return { success: true };
  }
);
