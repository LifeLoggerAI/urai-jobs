import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {db} from '../lib/firebase';

const isAdmin = async (uid: string | undefined): Promise<boolean> => {
    if (!uid) return false;
    const adminDoc = await db.collection('admins').doc(uid).get();
    return adminDoc.exists;
}

export const adminsetapplicationstatus = onCall(async (request) => {
  if (!await isAdmin(request.auth?.uid)) {
    throw new HttpsError("unauthenticated", "You must be an admin to perform this action.");
  }

  const { applicationId, status, tags, rating } = request.data;

  if (!applicationId || !status) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const applicationRef = db.collection("applications").doc(applicationId);

  const updateData: any = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (tags) updateData.tags = tags;
  if (rating) updateData["internal.rating"] = rating;

  await applicationRef.update(updateData);

  await db.collection('events').add({
      type: 'status_changed',
      entityType: 'application',
      entityId: applicationId,
      metadata: { newStatus: status, adminId: request.auth?.uid },
      createdAt: FieldValue.serverTimestamp(),
  });

  logger.info(`Application ${applicationId} status changed to ${status}`);

  return { success: true };
});
