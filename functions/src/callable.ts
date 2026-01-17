import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { Application, ApplicationStatus } from "./jobs/types";

const storage = getStorage();
const db = getFirestore();

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// A helper function to ensure the user is an admin.
// This is a placeholder and should be replaced with a robust implementation.
const ensureAdmin = (context: { auth?: { token?: { admin?: boolean } } }) => {
    if (process.env.FUNCTIONS_EMULATOR && !context.auth) {
        logger.warn("Auth check skipped in emulator without auth context");
        return;
    }
    if (!context.auth?.token.admin) {
        throw new HttpsError("permission-denied", "Must be an admin to call this function.");
    }
};

export const createResumeUploadUrl = onCall({ enforceAppCheck: false }, async (request) => {
  // For a real app, you MUST implement robust authentication and authorization.
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to upload a resume.");
  }

  const { applicantId, applicationId, filename, contentType, size } = request.data;

  // Validate required fields
  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  // Validate file type
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new HttpsError("invalid-argument", `Invalid content type. Allowed types are: ${ALLOWED_CONTENT_TYPES.join(", ")}`
    );
  }

  // Validate file size
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new HttpsError("invalid-argument", `File size exceeds the limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`);
  }

  // Construct the storage path
  const path = `resumes/${applicantId}/${applicationId}/${filename}`;

  const bucket = storage.bucket(); // Default bucket
  const file = bucket.file(path);

  // Set options for the signed URL
  const options = {
    version: "v4" as const,
    action: "write" as const,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: contentType,
  };

  try {
    // Generate the signed URL
    const [url] = await file.getSignedUrl(options);
    logger.info(`Generated signed URL for ${path}`);

    return { 
      url,
      path,
      method: "PUT",
     };
  } catch (error) {
    logger.error(`Error generating signed URL for ${path}`, error);
    throw new HttpsError("internal", "Could not create upload URL.", error);
  }
});

export const adminSetApplicationStatus = onCall({ enforceAppCheck: false }, async (request) => {
    ensureAdmin(request);

    const { applicationId, status, tags, rating } = request.data;

    if (!applicationId || !status) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    const applicationRef = db.collection("applications").doc(applicationId);
    const batch = db.batch();

    const updateData: Partial<Application> & { updatedAt: FieldValue } = {
        status: status as ApplicationStatus,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (tags) {
        updateData.tags = tags;
    }

    if (rating) {
        updateData["internal.rating"] = rating;
    }

    batch.update(applicationRef, updateData);

    const eventRef = db.collection("events").doc();
    batch.set(eventRef, {
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { newStatus: status },
        createdAt: FieldValue.serverTimestamp(),
    });

    try {
        await batch.commit();
        logger.info(`Application ${applicationId} status updated to ${status}`);
        return { success: true };
    } catch (error) {
        logger.error(`Error updating application ${applicationId} status`, error);
        throw new HttpsError("internal", "Could not update application status.", error);
    }
});
