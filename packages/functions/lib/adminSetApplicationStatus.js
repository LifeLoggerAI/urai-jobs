"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSetApplicationStatus = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
exports.adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const adminRef = admin.firestore().collection("admins").doc(context.auth.uid);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "The function must be called by an admin user.");
    }
    const { applicationId, status, tags, rating } = data;
    const applicationRef = admin
        .firestore()
        .collection("applications")
        .doc(applicationId);
    const updateData = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (tags) {
        updateData.tags = tags;
    }
    if (rating) {
        updateData["internal.rating"] = rating;
    }
    await applicationRef.update(updateData);
    await admin.firestore().collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: {
            newStatus: status,
            changedBy: context.auth.uid,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=adminSetApplicationStatus.js.map