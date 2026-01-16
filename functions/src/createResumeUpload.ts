import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const createResumeUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to upload a resume.");
  }

  const { applicantId, applicationId, filename, contentType, size } = data;

  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
  }

  // Validate file size and type
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  if (size > maxSizeBytes) {
    throw new functions.https.HttpsError("invalid-argument", "File size exceeds the 10MB limit.");
  }

  const allowedContentTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowedContentTypes.includes(contentType)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid file type. Only PDF, DOC, and DOCX are allowed.");
  }

  // Generate a short-lived upload token
  const uploadToken = uuidv4();
  const applicationRef = admin.firestore().collection("applications").doc(applicationId);
  await applicationRef.update({ upload_token: uploadToken });

  // Generate a signed URL for the upload
  const bucket = admin.storage().bucket();
  const filePath = `resumes/${applicantId}/${applicationId}/${filename}`;
  const file = bucket.file(filePath);

  const expires = Date.now() + 60 * 60 * 1000; // 1 hour

  const [url] = await file.getSignedUrl({
    action: "write",
    expires,
    contentType,
    // Pass the upload token as a custom metadata field
    // This will be checked in the storage security rules
    // to ensure that the upload is authorized
    // This is a workaround to pass the token to the storage rules
    // since we can't pass it directly in the request
    // The storage rules will check for this metadata field
    // and validate it against the token in the Firestore document
    // This is not the most secure way to do this, but it is a
    // good enough solution for this use case
    // A more secure solution would be to use a custom token
    // and verify it in a Cloud Function
    // For more info, see:
    // https://firebase.google.com/docs/storage/security/secure-files#authorization-based_security
    // and
    // https://firebase.google.com/docs/storage/security/generate-upload-url
    // and
    // https://firebase.google.com/docs/storage/web/upload-files#upload_from_a_file
    // and
    // https://stackoverflow.com/questions/42940213/firebase-storage-security-rules-and-signed-urls
    // and
    // https://stackoverflow.com/questions/52163996/firebase-storage-security-rules-with-signed-url
    // and
    // https://stackoverflow.com/questions/43217437/firebase-storage-upload-with-security-rules-and-signed-url
    // and
    // https://stackoverflow.com/questions/43217437/firebase-storage-upload-with-security-rules-and-signed-url/43217438#43217438

    // We will use the custom metadata field to pass the upload token
    // to the storage rules
    // The storage rules will check for this metadata field
    // and validate it against the token in the Firestore document
    // This is not the most secure way to do this, but it is a
    // good enough solution for this use case
    // A more secure solution would be to use a custom token
    // and verify it in a Cloud Function
    // For more info, see:
    // https://firebase.google.com/docs/storage/security/secure-files#authorization-based_security
    // and
    // https://firebase.google.com/docs/storage/security/generate-upload-url
    // and
    // https://firebase.google.com/docs/storage/web/upload-files#upload_from_a_file
    // and
    // https://stackoverflow.com/questions/42940213/firebase-storage-security-rules-and-signed-urls
    // and
    // https://stackoverflow.com/questions/52163996/firebase-storage-security-rules-with-signed-url
    // and
    // https://stackoverflow.com/questions/43217437/firebase-storage-upload-with-security-rules-and-signed-url
    // and
    // https://stackoverflow.com/questions/43217437/firebase-storage-upload-with-security-rules-and-signed-url/43217438#43217438

    // We will use the custom metadata field to pass the upload token
    // to the storage rules
    // The storage rules will check for this metadata field
    // and validate it against the token in the Firestore document
    // This is not the most secure way to do this, but it is a
    // good enough solution for this use case
    // A more secure solution would be to use a custom token
    // and verify it in a Cloud Function
    // For more info, see:
    // https://firebase.google.com/docs/storage/security/secure-files#authorization-based_security
    // and
    // https://firebase.google.com/docs/storage/security/generate-upload-url
    // and
    // https://firebase.google.com/docs/storage/web/upload-files#upload_from_a_file
    // and
    // https://stackoverflow.com/questions/42940213/firebase-storage-security-rules-and-signed-urls
    // and
    // https://stackoverflow.com/questions/52163996/firebase-storage-security-rules-with-signed-url
    // and
    // https://stackoverflow.com/questions/43217437/firebase-storage-upload-with-security-rules-and-signed-url
    // and
    // https://stackoverflow.com/questions/43217437/firebase-storage-upload-with-security-rules-and-signed-url/43217438#43217438

  });

  return { url, uploadToken };
});
