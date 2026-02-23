
import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v1/https";

export const adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
    }

    const db = getFirestore();
    const adminRef = db.collection("admins").doc(context.auth.uid);
    const adminSnap = await adminRef.get();

    if (!adminSnap.exists) {
        throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }

    const { applicationId, status, tags, rating } = data;

    if (!applicationId || !status) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    const applicationRef = db.collection("applications").doc(applicationId);

    const updateData: { [key: string]: any } = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        'internal.reviewerId': context.auth.uid,
        'internal.reviewedAt': FieldValue.serverTimestamp(),
    };

    if (tags) {
        updateData.tags = tags;
    }
    if (rating) {
        updateData['internal.rating'] = rating;
    }

    await applicationRef.update(updateData);

    await db.collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { newStatus: status, reviewerId: context.auth.uid },
        createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
});
