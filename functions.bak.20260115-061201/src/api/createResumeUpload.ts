import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";

interface CreateResumeUploadParams {
  applicantId: string;
  applicationId: string;
  filename: string;
  contentType: string;
  size: number;
}

const BUCKET_NAME = (process.env.GCLOUD_PROJECT || '') + ".appspot.com";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const createresumeupload = onCall(async (request) => {
  const {
    applicantId,
    applicationId,
    filename,
    contentType,
    size,
  }: CreateResumeUploadParams = request.data;

  // Basic validation
  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  if (size > MAX_FILE_SIZE) {
    throw new HttpsError(
      "invalid-argument",
      `File size exceeds the limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    );
  }

  const allowedContentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedContentTypes.includes(contentType)) {
    throw new HttpsError(
      "invalid-argument",
      `Content type '${contentType}' is not allowed.`
    );
  }

  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);
  const path = `resumes/${applicantId}/${applicationId}/${filename}`;
  const file = bucket.file(path);

  const [url] = await file.getSignedUrl({
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });

  logger.info(`Generated signed URL for ${path}`);

  return { url, path };
});
