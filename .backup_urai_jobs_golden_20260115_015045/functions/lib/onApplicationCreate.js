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
exports.onApplicationCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
exports.onApplicationCreate = functions.firestore
    .document("applications/{applicationId}")
    .onCreate(async (snap, context) => {
    const application = snap.data();
    const { applicantEmail, jobId, source } = application;
    const now = FieldValue.serverTimestamp();
    // Use a transaction to safely find/create the applicant and update stats.
    await db.runTransaction(async (transaction) => {
        // 1. Find or create the applicant
        const applicantsRef = db.collection("applicants");
        const applicantQuery = applicantsRef.where("primaryEmail", "==", applicantEmail).limit(1);
        const applicantSnap = await transaction.get(applicantQuery);
        let applicantId;
        if (applicantSnap.empty) {
            // Create a new applicant
            const newApplicantRef = applicantsRef.doc(); // Auto-generate ID
            applicantId = newApplicantRef.id;
            const newApplicant = {
                primaryEmail: applicantEmail,
                name: "", // Name can be updated later by admin
                source: application.source || { type: "direct" },
                createdAt: now,
                updatedAt: now,
                lastActivityAt: now,
            };
            transaction.set(newApplicantRef, newApplicant);
            functions.logger.info(`New applicant created: ${applicantId} for ${applicantEmail}`);
        }
        else {
            // Update existing applicant
            const applicantRef = applicantSnap.docs[0].ref;
            applicantId = applicantRef.id;
            transaction.update(applicantRef, { lastActivityAt: now });
            functions.logger.info(`Existing applicant found: ${applicantId}`);
        }
        // We must update the newly created application with the final applicantId
        transaction.update(snap.ref, { applicantId });
        // 2. Increment job stats
        const jobRef = db.collection("jobs").doc(jobId);
        transaction.update(jobRef, {
            "stats.applicantCount": FieldValue.increment(1),
            [`stats.statusCounts.NEW`]: FieldValue.increment(1),
        });
        // 3. Increment referral stats if applicable
        if (source?.type === 'referral' && source.refCode) {
            const referralRef = db.collection("referrals").doc(source.refCode);
            transaction.update(referralRef, { submitsCount: FieldValue.increment(1) });
        }
    });
    // 4. Write tracking event (outside of transaction)
    await db.collection("events").add({
        type: "application_submitted",
        entityType: "application",
        entityId: snap.id,
        metadata: { jobId },
        createdAt: now,
    });
});
//# sourceMappingURL=onApplicationCreate.js.map