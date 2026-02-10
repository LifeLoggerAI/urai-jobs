
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const MAX_UPLOAD_SIZE_MB = 10;
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const createresumeupload = onCall(async (request) => {
  // For this simplified flow, we are assuming the client has created an application
  // document and has the necessary IDs. In a production system, you would add
  // a security token to the application document to verify ownership before
  // generating an upload URL.
  const {
    applicantId,
    applicationId,
    filename,
    contentType,
    size,
  } = request.data;

  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  // Validate file size
  if (size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    throw new HttpsError(
      "invalid-argument",
      `File size exceeds the limit of ${MAX_UPLOAD_SIZE_MB}MB.`
    );
  }

  // Validate content type
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new HttpsError("invalid-argument", `Content type '${contentType}' is not allowed.`);
  }

  const bucket = getStorage().bucket();
  const filePath = `resumes/${applicantId}/${applicationId}/${filename}`;
  const file = bucket.file(filePath);

  logger.info(`Generating signed URL for: ${filePath}`);

  try {
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    });

    return { signedUrl: url, filePath };
  } catch (error) {
    logger.error("Error creating signed URL", { error });
    throw new HttpsError("internal", "Could not create upload URL.");
  }
});
