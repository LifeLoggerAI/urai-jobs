// @ts-nocheck
import {https} from "firebase-functions";
import {db, auth} from "../firebase";
import {HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const adminSetApplicationStatus = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const adminUser = await auth.getUser(context.auth.uid);
  if (!adminUser.customClaims || !adminUser.customClaims.admin) {
    throw new HttpsError("permission-denied", "You must be an admin.");
  }

  const {applicationId, status, tags, rating} = data;

  if (!applicationId || !status) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const applicationRef = db.collection("applications").doc(applicationId);

  const updateData: any = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tags) {
    updateData.tags = tags;
  }

  if (rating) {
    updateData["internal.rating"] = rating;
    updateData["internal.reviewerId"] = context.auth.uid;
    const reviewedAt = admin.firestore.FieldValue.serverTimestamp();
    updateData["internal.reviewedAt"] = reviewedAt;
  }

  await applicationRef.update(updateData);

  await db.collection("events").add({
    type: "status_changed",
    entityType: "application",
    entityId: applicationId,
    metadata: {
      newStatus: status,
      adminId: context.auth.uid,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {success: true};
});
