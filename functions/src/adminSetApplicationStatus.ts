import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth || !await isAdmin(context.auth.uid)) {
    throw new functions.https.HttpsError("unauthenticated", "You must be an admin to perform this action.");
  }

  const { applicationId, status, tags, rating } = data;

  if (!applicationId || !status) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
  }

  const applicationRef = admin.firestore().collection("applications").doc(applicationId);

  const updateData: { [key: string]: any } = { status, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (tags) {
    updateData.tags = tags;
  }
  if (rating) {
    updateData["internal.rating"] = rating;
  }

  await applicationRef.update(updateData);

  await admin.firestore().collection("events").add({
    type: "status_changed",
    entityType: "application",
    entityId: applicationId,
    metadata: { newStatus: status, adminId: context.auth.uid },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

async function isAdmin(uid: string): Promise<boolean> {
  const adminDoc = await admin.firestore().collection("admins").doc(uid).get();
  return adminDoc.exists;
}
