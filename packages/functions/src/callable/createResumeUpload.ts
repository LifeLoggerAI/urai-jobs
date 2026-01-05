// @ts-nocheck
import {https} from "firebase-functions";
import {storage} from "../firebase";
import {HttpsError} from "firebase-functions/v2/https";

const BUCKET_NAME = process.env.GCLOUD_PROJECT + ".appspot.com";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const createResumeUpload = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const {applicantId, applicationId, filename, contentType, size} = data;

  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  if (context.auth.uid !== applicantId) {
    throw new HttpsError("permission-denied", "Permission denied.");
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    const maxSizeMB = MAX_FILE_SIZE_BYTES / 1024 / 1024;
    throw new HttpsError("invalid-argument", `File size exceeds ${maxSizeMB}MB.`);
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new HttpsError("invalid-argument", "Invalid file type.");
  }

  const storagePath = `resumes/${applicantId}/${applicationId}/${filename}`;

  const [url] = await storage
    .bucket(BUCKET_NAME)
    .file(storagePath)
    .getSignedUrl({
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      version: "v4",
    });

  return {url, storagePath};
});
