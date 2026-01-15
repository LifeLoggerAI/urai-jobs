"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createresumeupload = void 0;
const https_1 = require("firebase-functions/v2/https");
const storage_1 = require("firebase-admin/storage");
const v2_1 = require("firebase-functions/v2");
const BUCKET_NAME = (process.env.GCLOUD_PROJECT || '') + ".appspot.com";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
exports.createresumeupload = (0, https_1.onCall)(async (request) => {
    const { applicantId, applicationId, filename, contentType, size, } = request.data;
    // Basic validation
    if (!applicantId || !applicationId || !filename || !contentType || !size) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters.");
    }
    if (size > MAX_FILE_SIZE) {
        throw new https_1.HttpsError("invalid-argument", `File size exceeds the limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }
    const allowedContentTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedContentTypes.includes(contentType)) {
        throw new https_1.HttpsError("invalid-argument", `Content type '${contentType}' is not allowed.`);
    }
    const storage = (0, storage_1.getStorage)();
    const bucket = storage.bucket(BUCKET_NAME);
    const path = `resumes/${applicantId}/${applicationId}/${filename}`;
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
    });
    v2_1.logger.info(`Generated signed URL for ${path}`);
    return { url, path };
});
