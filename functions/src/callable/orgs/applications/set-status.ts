import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v1/https";

export const setStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
    }

    const { orgId, applicationId, status, tags, rating } = data;

    if (!orgId || !applicationId || !status) {
        throw new HttpsError("invalid-argument", "Missing required parameters: orgId, applicationId, and status are required.");
    }

    const db = getFirestore();
    const adminRef = db.collection("orgs").doc(orgId).collection("admins").doc(context.auth.uid);
    const adminSnap = await adminRef.get();

    if (!adminSnap.exists) {
        throw new HttpsError("permission-denied", "You must be an admin of this organization to perform this action.");
    }

    const applicationRef = db.collection("orgs").doc(orgId).collection("applications").doc(applicationId);

    const updateData: { [key: string]: any } = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        "internal.reviewerId": context.auth.uid,
        "internal.reviewedAt": FieldValue.serverTimestamp(),
    };

    if (tags) {
        updateData.tags = tags;
    }
    if (rating) {
        updateData["internal.rating"] = rating;
    }

    await applicationRef.update(updateData);

    await db.collection("orgs").doc(orgId).collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { newStatus: status, reviewerId: context.auth.uid },
        createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
});
