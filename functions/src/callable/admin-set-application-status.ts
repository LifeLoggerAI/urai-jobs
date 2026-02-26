import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Application } from "../../../packages/model/src/lib/model";

const db = admin.firestore();

/**
 * An admin-only callable function for updating the status of an application.
 *
 * This function is a critical part of the admin dashboard, allowing authorized
 * users to move candidates through the hiring pipeline.
 *
 * It performs the following actions:
 * 1.  **Authorization:** Verifies that the caller is an admin for the org.
 * 2.  **Transaction:** Atomically updates the application, logs an event, and
 *     adjusts the denormalized status counters on the associated job.
 */
export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
  const { orgId, applicationId, status, tags, rating } = data;
  const uid = context.auth?.uid;

  // --- Authorization ---
  if (!uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to perform this action."
    );
  }

  const adminRef = db.doc(`orgs/${orgId}/admins/${uid}`);
  const adminDoc = await adminRef.get();

  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You do not have permission to perform this action."
    );
  }

  // --- Input Validation ---
  if (!orgId || !applicationId || !status) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required data: orgId, applicationId, status."
    );
  }

  // --- Transactional Update ---
  const appRef = db.doc(`orgs/${orgId}/applications/${applicationId}`);

  try {
    await db.runTransaction(async (transaction) => {
      const appDoc = await transaction.get(appRef);
      if (!appDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Application not found.");
      }

      const application = appDoc.data() as Application;
      const oldStatus = application.status;

      // 1. Update the Application
      const updateData: Partial<Application> & { [key: string]: any } = {
        status: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (tags !== undefined) updateData.tags = tags;
      if (rating !== undefined) updateData["internal.rating"] = rating;
      transaction.update(appRef, updateData);

      // 2. Log Status Change Event
      const eventRef = db.collection(`orgs/${orgId}/events`).doc();
      transaction.set(eventRef, {
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: {
          jobId: application.jobId,
          oldStatus: oldStatus,
          newStatus: status,
          changedBy: uid,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3. Update Job Stats (if status has changed)
      if (oldStatus !== status) {
        const jobRef = db.doc(`orgs/${orgId}/jobs/${application.jobId}`);
        const statsUpdate: { [key: string]: admin.firestore.FieldValue } = {};
        // Decrement the old status count, if it existed
        if (oldStatus) {
          statsUpdate[`stats.statusCounts.${oldStatus}`] = admin.firestore.FieldValue.increment(-1);
        }
        // Increment the new status count
        statsUpdate[`stats.statusCounts.${status}`] = admin.firestore.FieldValue.increment(1);
        transaction.update(jobRef, statsUpdate);
      }
    });

    functions.logger.log(
      `[adminSetApplicationStatus] Successfully updated status for application ${applicationId} to ${status} by user ${uid}.`
    );
    return { success: true };

  } catch (error) {
    functions.logger.error(
      `[adminSetApplicationStatus] Failed to update status for application ${applicationId}.`,
      error
    );
    // Re-throw HttpsError to be sent to the client
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred while updating the application."
    );
  }
});
