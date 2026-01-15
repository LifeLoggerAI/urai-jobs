"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminsetapplicationstatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const firebase_1 = require("../lib/firebase");
const isAdmin = async (uid) => {
    if (!uid)
        return false;
    const adminDoc = await firebase_1.db.collection('admins').doc(uid).get();
    return adminDoc.exists;
};
exports.adminsetapplicationstatus = (0, https_1.onCall)(async (request) => {
    if (!await isAdmin(request.auth?.uid)) {
        throw new https_1.HttpsError("unauthenticated", "You must be an admin to perform this action.");
    }
    const { applicationId, status, tags, rating } = request.data;
    if (!applicationId || !status) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters.");
    }
    const applicationRef = firebase_1.db.collection("applications").doc(applicationId);
    const updateData = {
        status,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (tags)
        updateData.tags = tags;
    if (rating)
        updateData["internal.rating"] = rating;
    await applicationRef.update(updateData);
    await firebase_1.db.collection('events').add({
        type: 'status_changed',
        entityType: 'application',
        entityId: applicationId,
        metadata: { newStatus: status, adminId: request.auth?.uid },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Application ${applicationId} status changed to ${status}`);
    return { success: true };
});
