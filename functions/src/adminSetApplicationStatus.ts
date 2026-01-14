import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { requireAdmin } from "./admin";
import { Application } from "./models";

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
  const adminUid = requireAdmin(context);

  const { applicationId, status, tags, rating } = data;
  if (!applicationId || !status) {
    throw new functions.https.HttpsError("invalid-argument", "Missing applicationId or status.");
  }

  const appRef = db.collection("applications").doc(applicationId);

  await db.runTransaction(async (transaction) => {
    const appDoc = await transaction.get(appRef);
    if (!appDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Application not found.");
    }

    const currentApp = appDoc.data() as Application;
    const oldStatus = currentApp.status;

    const updatePayload: Record<string, any> = {
      status: status,
      updatedAt: FieldValue.serverTimestamp(),
      "internal.reviewerId": adminUid,
      "internal.reviewedAt": FieldValue.serverTimestamp(),
    };

    if (tags) updatePayload.tags = tags;
    if (rating) updatePayload["internal.rating"] = rating;

    transaction.update(appRef, updatePayload);

    // If status changed, decrement old status count and increment new one on the job.
    if (oldStatus !== status) {
      const jobRef = db.collection("jobs").doc(currentApp.jobId);
      transaction.update(jobRef, {
        [`stats.statusCounts.${oldStatus}`]: FieldValue.increment(-1),
        [`stats.statusCounts.${status}`]: FieldValue.increment(1),
      });
    }
  });

  // Add tracking event outside of transaction
  await db.collection("events").add({
    type: "status_changed",
    entityType: "application",
    entityId: applicationId,
    metadata: { newStatus: status, adminId: adminUid },
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
