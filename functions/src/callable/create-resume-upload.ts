import * as functions from "firebase-functions";

/**
 * Callable function to generate a signed URL for resume uploads.
 */
export const createResumeUpload = functions.https.onCall(async (data, context) => {
    // TODO: Implement logic to:
    // 1. Validate input data (applicantId, applicationId, filename, etc.).
    // 2. Verify user is authorized (either admin or the applicant themselves).
    // 3. Generate a v4 signed URL for the specified storage path.
    // 4. Return the signed URL to the client.

    console.log("createResumeUpload called with data:", data);

    // This requires authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    // Placeholder response
    return { message: "Not implemented yet." };
});
