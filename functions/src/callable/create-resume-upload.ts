import * as functions from "firebase-functions";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v1/https";
import { getFunctions } from "firebase-admin/functions";

const BUCKET_NAME = process.env.GCLOUD_PROJECT + ".appspot.com";

async function logError(message: string, data: any, source: string) {
    try {
        const logErrorCallable = getFunctions().task("logError");
        await logErrorCallable.enqueue({ message, data, source });
    } catch (e) {
        console.error("Failed to log error:", e);
        console.error("Original error:", message, data);
    }
}

export const createResumeUpload = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to upload a resume.");
    }

    const { applicationId, filename, contentType, size } = data;

    if (!applicationId || !filename || !contentType || !size) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    // Validate file size and type
    const MAX_SIZE_MB = 10;
    if (size > MAX_SIZE_MB * 1024 * 1024) {
        await logError("File size exceeds limit", { size, MAX_SIZE_MB }, "callable.createResumeUpload");
        throw new HttpsError("invalid-argument", `File size exceeds ${MAX_SIZE_MB}MB.`);
    }

    const ALLOWED_CONTENT_TYPES = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        await logError("Invalid file type", { contentType }, "callable.createResumeUpload");
        throw new HttpsError("invalid-argument", "Invalid file type.");
    }

    const applicantId = context.auth.uid;
    const path = `resumes/${applicantId}/${applicationId}/${filename}`;

    const bucket = getStorage().bucket(BUCKET_NAME);
    const file = bucket.file(path);

    const expires = Date.now() + 60 * 1000; // 1 minute to upload
    const options = {
        version: "v4" as const,
        action: "write" as const,
        expires,
        contentType,
    };

    try {
        const [url] = await file.getSignedUrl(options);
        return { url, path };
    } catch (error) {
        await logError("Error creating signed URL", { error }, "callable.createResumeUpload");
        throw new HttpsError("internal", "Could not create upload URL.");
    }
});
