import * as functions from "firebase-functions";
import { storage } from "firebase-admin";

interface CreateResumeUploadParams {
  applicantId: string;
  applicationId: string;
  filename: string;
  contentType: string;
  size: number;
}

const BUCKET_NAME = process.env.GCLOUD_PROJECT + ".appspot.com";

export const createResumeUpload = functions.https.onCall(
  async (data: CreateResumeUploadParams, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const { applicantId, applicationId, filename, contentType, size } = data;

    // Validate file type and size
    const allowedContentTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedContentTypes.includes(contentType)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid content type."
      );
    }

    const MAX_SIZE_MB = 10;
    if (size > MAX_SIZE_MB * 1024 * 1024) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `File size exceeds the maximum limit of ${MAX_SIZE_MB}MB.`
      );
    }

    const filePath = `resumes/${applicantId}/${applicationId}/${filename}`;

    const [url] = await storage()
      .bucket(BUCKET_NAME)
      .file(filePath)
      .getSignedUrl({
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
      });

    return { url, filePath };
  }
);
