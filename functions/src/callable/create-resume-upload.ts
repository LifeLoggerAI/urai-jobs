import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// --- Configuration ---
const BUCKET_NAME = process.env.GCLOUD_STORAGE_BUCKET || ""; // Will be auto-populated by Firebase
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

const db = admin.firestore();
const storage = admin.storage();

/**
 * A public callable function for generating a signed URL to upload a resume.
 *
 * This function provides a secure endpoint for clients to request permission to
 * upload a resume directly to a specific, sandboxed path in Cloud Storage.
 * It validates the request and returns a short-lived URL, offloading the actual
 * file transfer from the backend.
 *
 * The flow is:
 * 1. Client gets applicantId (e.g., deterministic hash of email).
 * 2. Client calls this function with file metadata.
 * 3. Function validates, generates a new applicationId, and creates a signed URL.
 * 4. Function returns the signed URL and applicationId to the client.
 * 5. Client uses the URL to PUT the file directly to Cloud Storage.
 * 6. Client then creates the application document in Firestore, including the
 *    final storagePath.
 */
export const createResumeUpload = functions.https.onCall(async (data, context) => {
  // Although public, we can use this to attribute uploads if user is signed in.
  const uid = context.auth?.uid;
  functions.logger.log(`[createResumeUpload] Called by uid: ${uid ?? "anonymous"}`);

  // --- Input Validation ---
  const { orgId, applicantId, filename, contentType, size } = data;
  if (!orgId || !applicantId || !filename || !contentType || !size) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required data: orgId, applicantId, filename, contentType, size."
    );
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Invalid content type. Allowed types are: ${ALLOWED_CONTENT_TYPES.join(", ")}`
    );
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `File size exceeds the limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  if (!BUCKET_NAME) {
      functions.logger.error("[createResumeUpload] GCLOUD_STORAGE_BUCKET env var not set.");
      throw new functions.https.HttpsError("internal", "Storage bucket not configured.");
  }

  // --- URL Generation ---
  try {
    // Generate a new, unique ID for this application submission.
    const applicationId = db.collection(`orgs/${orgId}/applications`).doc().id;

    const storagePath = `orgs/${orgId}/resumes/${applicantId}/${applicationId}/${filename}`;

    const signedUrlOptions: admin.storage.GetSignedUrlConfig = {
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    };

    const bucket = storage.bucket(BUCKET_NAME);
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl(signedUrlOptions);

    functions.logger.log(
      `[createResumeUpload] Generated signed URL for path: ${storagePath}`
    );

    // Return the URL and the generated ID to the client.
    return { signedUrl, applicationId, storagePath };

  } catch (error) {
    functions.logger.error("[createResumeUpload] Failed to generate signed URL", error);
    throw new functions.https.HttpsError(
      "internal",
      "Could not create upload URL. Please try again later."
    );
  }
});
