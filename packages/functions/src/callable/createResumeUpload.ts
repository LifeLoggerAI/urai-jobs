import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const BUCKET_NAME = process.env.GCLOUD_PROJECT + ".appspot.com";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const createresumeupload = onCall(async (request) => {
    const { applicantId, applicationId, filename, contentType, size } = request.data;

    if (!applicantId || !applicationId || !filename || !contentType || !size) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    if (size > MAX_FILE_SIZE_BYTES) {
        const maxSizeMB = MAX_FILE_SIZE_BYTES / 1024 / 1024;
        throw new HttpsError("invalid-argument", `File size exceeds ${maxSizeMB}MB.`);
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new HttpsError("invalid-argument", "Invalid file type.");
    }

    if (!process.env.GCLOUD_PROJECT) {
        throw new HttpsError("internal", "GCLOUD_PROJECT environment variable not set.");
    }

    const storagePath = `resumes/${applicantId}/${applicationId}/${filename}`;
    const bucket = getStorage().bucket(BUCKET_NAME);
    const file = bucket.file(storagePath);

    const [url] = await file.getSignedUrl({
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
        version: "v4",
    });

    return { url, storagePath };
});
