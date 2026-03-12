import { https, logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";

const BUCKET_NAME = `${process.env.GCLOUD_PROJECT}.appspot.com`;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const createResumeUpload = https.onCall(async (data, context) => {
  // 1. Validate input and auth
  if (!context.auth) {
    throw new https.HttpsError("unauthenticated", "Authentication is required.");
  }

  const { applicantId, applicationId, filename, contentType, size } = data;
  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (size > MAX_FILE_SIZE) {
    throw new https.HttpsError("invalid-argument", "File size exceeds the 10MB limit.");
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new https.HttpsError("invalid-argument", "Invalid file type.");
  }

  // 2. Construct the storage path
  const path = `resumes/${applicantId}/${applicationId}/${filename}`;

  // 3. Get a signed URL
  try {
    const bucket = getStorage().bucket(BUCKET_NAME);
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    logger.info(`Generated signed URL for ${path}`);
    return { url, path };

  } catch (error) {
    logger.error("Error creating signed URL:", error);
    throw new https.HttpsError("internal", "Could not create upload URL.");
  }
});
