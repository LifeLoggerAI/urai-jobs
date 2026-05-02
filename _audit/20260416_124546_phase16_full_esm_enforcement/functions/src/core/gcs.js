"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToGcs = uploadToGcs;
const storage_1 = require("@google-cloud/storage");
const storage = new storage_1.Storage();
async function uploadToGcs(buffer, destination, contentType) {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('GCS_BUCKET_NAME environment variable not set.');
    }
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);
    await file.save(buffer, {
        contentType,
        resumable: false,
    });
    return `gs://${bucketName}/${destination}`;
}
