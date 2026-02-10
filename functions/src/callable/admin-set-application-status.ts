
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const db = getFirestore();

// Helper function to check for admin privileges
const isAdmin = async (uid: string): Promise<boolean> => {
  if (!uid) return false;
  const adminDoc = await db.collection("admins").doc(uid).get();
  return adminDoc.exists;
};

export const adminsetapplicationstatus = onCall(async (request) => {
  const { auth, data } = request;
  const { applicationId, status, tags, rating } = data;

  // 1. Authentication check
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
  }

  // 2. Authorization check
  const isUserAdmin = await isAdmin(auth.uid);
  if (!isUserAdmin) {
    throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
  }

  // 3. Input validation
  if (!applicationId || !status) {
    throw new HttpsError("invalid-argument", "Missing required parameters: applicationId and status.");
  }

  const applicationRef = db.collection("applications").doc(applicationId);
  logger.info(`Admin ${auth.uid} is updating application ${applicationId} to status ${status}`);

  try {
    // 4. Update the application document
    const updatePayload: { [key: string]: any } = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (tags && Array.isArray(tags)) {
      updatePayload.tags = tags;
    }

    if (rating !== undefined) {
      updatePayload["internal.rating"] = rating;
      updatePayload["internal.reviewerId"] = auth.uid;
      updatePayload["internal.reviewedAt"] = FieldValue.serverTimestamp();
    }

    await applicationRef.update(updatePayload);

    // 5. Write an event for the status change
    await db.collection("events").add({
      type: "status_changed",
      entityType: "application",
      entityId: applicationId,
      metadata: { newStatus: status, adminId: auth.uid },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Successfully updated application ${applicationId}`);
    return { success: true };

  } catch (error) {
    logger.error("Error updating application status", { applicationId, error });
    throw new HttpsError("internal", "An error occurred while updating the application.");
  }
});
