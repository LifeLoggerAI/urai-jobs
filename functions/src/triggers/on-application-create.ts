import * as functions from "firebase-functions";

/**
 * Firestore trigger for application document creation.
 * Handles denormalization and event creation.
 */
export const onApplicationCreate = functions.firestore
    .document("applications/{applicationId}")
    .onCreate(async (snap, context) => {
        // TODO: Implement logic to:
        // 1. Create/merge applicant profile.
        // 2. Increment job stats.
        // 3. Increment referral stats if applicable.
        // 4. Create an 'application_submitted' event.
        console.log(`Application ${context.params.applicationId} created.`);
        return null;
    });
