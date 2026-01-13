"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onApplicationCreate = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
exports.onApplicationCreate = functions.firestore
    .document("applications/{applicationId}")
    .onCreate(async (snap, context) => {
    var _a, _b;
    const application = snap.data();
    const { jobId, applicantEmail } = application;
    const applicantId = (0, crypto_1.createHash)("sha256").update(applicantEmail).digest("hex");
    const applicantRef = admin.firestore().collection("applicants").doc(applicantId);
    await applicantRef.set({
        primaryEmail: applicantEmail,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await snap.ref.update({ applicantId });
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    await jobRef.update({
        "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
        "stats.statusCounts.NEW": admin.firestore.FieldValue.increment(1),
    });
    if (((_a = application.source) === null || _a === void 0 ? void 0 : _a.type) === "referral" && ((_b = application.source) === null || _b === void 0 ? void 0 : _b.refCode)) {
        const referralRef = admin
            .firestore()
            .collection("referrals")
            .doc(application.source.refCode);
        await referralRef.update({
            submitsCount: admin.firestore.FieldValue.increment(1),
        });
    }
    await admin.firestore().collection("events").add({
        type: "application_submitted",
        entityType: "application",
        entityId: snap.id,
        metadata: {
            jobId,
            applicantId,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
});
//# sourceMappingURL=onApplicationCreate.js.map