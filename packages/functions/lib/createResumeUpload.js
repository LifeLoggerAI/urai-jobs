"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResumeUpload = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const BUCKET_NAME = `${process.env.GCLOUD_PROJECT}.appspot.com`;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
exports.createResumeUpload = functions.https.onCall(async (data, context) => {
    const { applicantId, applicationId, filename, contentType, size } = data;
    if (!applicantId || !applicationId || !filename || !contentType || !size) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters.");
    }
    if (size > MAX_SIZE_BYTES) {
        throw new functions.https.HttpsError("invalid-argument", `File size exceeds limit of ${MAX_SIZE_BYTES} bytes.`);
    }
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new functions.https.HttpsError("invalid-argument", `Invalid content type. Allowed types are: ${ALLOWED_CONTENT_TYPES.join(", ")}`);
    }
    const path = `resumes/${applicantId}/${applicationId}/${filename}`;
    const [url] = await admin
        .storage()
        .bucket(BUCKET_NAME)
        .file(path)
        .getSignedUrl({
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
    });
    return { url };
});
//# sourceMappingURL=createResumeUpload.js.map