import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const storage = admin.storage();
const BUCKET_NAME = process.env.GCLOUD_PROJECT + ".appspot.com";

export const createResumeUploadUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }

  const { uid } = context.auth;
  const { applicationId, filename, contentType } = data;

  if (!applicationId || !filename || !contentType) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
  }

  // Validate file type and size on the client, but enforce here too.
  if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(contentType)) {
    throw new functions.https.HttpsError("invalid-argument", "Unsupported file type.");
  }

  const filePath = `resumes/${uid}/${applicationId}/${filename}`;
  const file = storage.bucket(BUCKET_NAME).file(filePath);

  const options = {
    version: "v4" as const,
    action: "write" as const,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  };

  try {
    const [url] = await file.getSignedUrl(options);
    return { url, storagePath: filePath };
  } catch (error) {
    functions.logger.error("Error creating signed URL:", error);
    throw new functions.https.HttpsError("internal", "Could not create upload URL.");
  }
});
