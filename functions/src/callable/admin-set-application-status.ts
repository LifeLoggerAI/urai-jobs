import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Callable function for admins to change an application's status.
 */
export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    // 1. Check for admin authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called by an authenticated user."
        );
    }

    const adminDoc = await getFirestore().collection("admins").doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "The function must be called by an admin."
        );
    }

    // TODO: Implement logic to:
    // 2. Validate input data (applicationId, status, etc.).
    // 3. Update the application document.
    // 4. Create an 'status_changed' event.

    console.log("adminSetApplicationStatus called with data:", data);

    // Placeholder response
    return { message: "Not implemented yet." };
});
