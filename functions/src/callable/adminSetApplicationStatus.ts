import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Must be an administrative user to fulfill this request."
    );
  }

  const { applicationId, status, tags, rating } = data;

  if (!applicationId || !status) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required parameters: applicationId and status."
    );
  }

  const applicationRef = db.collection("applications").doc(applicationId);

  const updateData = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tags) {
    updateData['tags'] = tags;
  }

  if (rating) {
    updateData['internal.rating'] = rating;
    updateData['internal.reviewerId'] = context.auth.uid;
    updateData['internal.reviewedAt'] = admin.firestore.FieldValue.serverTimestamp();
  }

  await applicationRef.update(updateData);

  await db.collection("events").add({
    type: "status_changed",
    entityType: "application",
    entityId: applicationId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      newStatus: status,
      adminId: context.auth.uid,
    },
  });

  return { success: true };
});
