import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const storage = admin.storage();

export const createResumeUpload = functions.https.onCall(async (data, context) => {
  const { applicantId, applicationId, filename, contentType, size } = data;

  // Validate input
  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required parameters."
    );
  }

  // Validate file type and size
  const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowedTypes.includes(contentType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid file type. Only PDF, DOC, and DOCX are allowed."
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (size > maxSize) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `File size exceeds the limit of ${maxSize / (1024 * 1024)}MB.`
    );
  }

  // Define the storage path
  const path = `resumes/${applicantId}/${applicationId}/${filename}`;

  // Create a signed URL for the upload
  const [url] = await storage.bucket().file(path).getSignedUrl({
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });

  return { url, path };
});
