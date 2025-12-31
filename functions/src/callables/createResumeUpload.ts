import * as functions from "firebase-functions";
import { storage } from "firebase-admin";

export const createResumeUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to upload a resume.");
  }

  const { applicantId, applicationId, filename, contentType } = data;
  const uid = context.auth.uid;

  if (uid !== applicantId) {
    throw new functions.https.HttpsError("permission-denied", "You can only upload a resume for yourself.");
  }

  const bucket = storage().bucket();
  const filePath = `resumes/${applicantId}/${applicationId}/${filename}`;
  const file = bucket.file(filePath);

  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

  const [url] = await file.getSignedUrl({
    action: "write",
    expires,
    contentType,
  });

  return { url, filePath };
});
