"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSetApplicationStatus = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const admin_1 = require("./admin");
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
exports.adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    const adminUid = (0, admin_1.requireAdmin)(context);
    const { applicationId, status, tags, rating } = data;
    if (!applicationId || !status) {
        throw new functions.https.HttpsError("invalid-argument", "Missing applicationId or status.");
    }
    const appRef = db.collection("applications").doc(applicationId);
    await db.runTransaction(async (transaction) => {
        const appDoc = await transaction.get(appRef);
        if (!appDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Application not found.");
        }
        const currentApp = appDoc.data();
        const oldStatus = currentApp.status;
        const updatePayload = {
            status: status,
            updatedAt: FieldValue.serverTimestamp(),
            "internal.reviewerId": adminUid,
            "internal.reviewedAt": FieldValue.serverTimestamp(),
        };
        if (tags)
            updatePayload.tags = tags;
        if (rating)
            updatePayload["internal.rating"] = rating;
        transaction.update(appRef, updatePayload);
        // If status changed, decrement old status count and increment new one on the job.
        if (oldStatus !== status) {
            const jobRef = db.collection("jobs").doc(currentApp.jobId);
            transaction.update(jobRef, {
                [`stats.statusCounts.${oldStatus}`]: FieldValue.increment(-1),
                [`stats.statusCounts.${status}`]: FieldValue.increment(1),
            });
        }
    });
    // Add tracking event outside of transaction
    await db.collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { newStatus: status, adminId: adminUid },
        createdAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=adminSetApplicationStatus.js.map