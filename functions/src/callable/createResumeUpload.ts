
import * as functions from "firebase-functions";
import { storage } from "../lib/firebase";

export const createResumeUpload = functions.https.onCall(
  async (data, context) => {
    const { applicantId, applicationId, filename, contentType, size } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to upload a resume."
      );
    }

    const bucket = storage.bucket();
    const path = `resumes/${applicantId}/${applicationId}/${filename}`;
    const file = bucket.file(path);

    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    const [url] = await file.getSignedUrl({
      action: "write",
      expires,
      contentType,
    });

    return { url, path };
  }
);
