import * as functions from "firebase-functions";

/**
 * Firestore trigger for job document writes.
 * Manages the public-facing `jobPublic` collection.
 */
export const onJobWrite = functions.firestore
    .document("jobs/{jobId}")
    .onWrite(async (change, context) => {
        // TODO: Implement logic to sync with `jobPublic` collection.
        // If job is open, create/update `jobPublic` document.
        // If job is not open, delete `jobPublic` document.
        console.log(`Job ${context.params.jobId} written.`);
        return null;
    });
