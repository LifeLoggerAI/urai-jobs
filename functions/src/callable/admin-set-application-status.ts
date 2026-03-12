import * as admin from "firebase-admin";
import { https, logger } from "firebase-functions";

// Initialize Firestore
const db = admin.firestore();

// Enum for application statuses
const VALID_STATUSES = ["NEW", "SCREEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];

export const adminSetApplicationStatus = https.onCall(async (data, context) => {
  // 1. Check for admin privileges
  if (!context.auth || !context.auth.token.admin) {
    throw new https.HttpsError("permission-denied", "Caller is not an admin.");
  }

  // 2. Validate input data
  const { applicationId, status, tags, rating } = data;
  if (!applicationId || !status) {
    throw new https.HttpsError("invalid-argument", "Missing required fields: applicationId and status.");
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new https.HttpsError("invalid-argument", `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  // 3. Prepare the update payload
  const updatePayload: { [key: string]: any } = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tags && Array.isArray(tags)) {
    updatePayload.tags = tags;
  }

  if (rating && typeof rating === 'number' && rating >= 1 && rating <= 5) {
    updatePayload['internal.rating'] = rating;
    updatePayload['internal.reviewedAt'] = admin.firestore.FieldValue.serverTimestamp();
    updatePayload['internal.reviewerId'] = context.auth.uid;
  }

  try {
    const applicationRef = db.collection("applications").doc(applicationId);

    // 4. Update the application document
    await applicationRef.update(updatePayload);

    // 5. Log the event
    await db.collection("events").add({
      type: "status_changed",
      entityType: "application",
      entityId: applicationId,
      metadata: {
        newStatus: status,
        changedBy: context.auth.uid,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Application ${applicationId} status updated to ${status} by ${context.auth.uid}`);
    return { success: true };

  } catch (error) {
    logger.error(`Error updating application ${applicationId}:`, error);
    throw new https.HttpsError("internal", "Failed to update application status.");
  }
});
