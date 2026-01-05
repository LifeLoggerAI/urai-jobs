import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = getFirestore();

export const adminsetapplicationstatus = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const adminRef = db.collection("admins").doc(request.auth.uid);
    const adminSnap = await adminRef.get();

    if (!adminSnap.exists) {
        throw new HttpsError("permission-denied", "You must be an admin.");
    }

    const { applicationId, status, tags, rating } = request.data;

    if (!applicationId || !status) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    const applicationRef = db.collection("applications").doc(applicationId);

    const updateData: any = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (tags) {
        updateData.tags = tags;
    }

    if (rating) {
        updateData["internal.rating"] = rating;
        updateData["internal.reviewerId"] = request.auth.uid;
        updateData["internal.reviewedAt"] = FieldValue.serverTimestamp();
    }

    await applicationRef.update(updateData);

    await db.collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: {
            newStatus: status,
            adminId: request.auth.uid,
        },
        createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
});
