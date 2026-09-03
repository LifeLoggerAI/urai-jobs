import { Storage } from '@google-cloud/storage';
const storage = new Storage();
export async function uploadToGcs(buffer, destination, contentType) {
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
