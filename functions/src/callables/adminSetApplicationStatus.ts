import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError("permission-denied", "You must be an admin to change an application status.");
  }

  const { applicationId, newStatus, oldStatus } = data;

  const applicationRef = firestore().collection("applications").doc(applicationId);

  await applicationRef.update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });

  const application = (await applicationRef.get()).data();

  if (application && application.jobId) {
    const jobRef = firestore().collection("jobs").doc(application.jobId);

    const updates: {[key: string]: any} = {};
    updates[`stats.statusCounts.${oldStatus}`] = FieldValue.increment(-1);
    updates[`stats.statusCounts.${newStatus}`] = FieldValue.increment(1);

    await jobRef.update(updates);
  }

  return { success: true };
});
