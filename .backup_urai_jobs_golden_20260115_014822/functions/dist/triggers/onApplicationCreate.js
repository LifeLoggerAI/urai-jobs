"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onapplicationcreate = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../lib/firebase");
// --- AUTOFIX: tolerate legacy string "source" fields ---
function __asObj(v) {
    return (typeof v === "string") ? { type: v } : (v ?? {});
}
const getApplicantIdByEmail = async (email) => {
    const snapshot = await firebase_1.db.collection('applicants').where('primaryEmail', '==', email).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    return snapshot.docs[0].id;
};
exports.onapplicationcreate = v2_1.firestore.onDocumentCreated("applications/{applicationId}", async (event) => {
    const application = event.data?.data();
    const { applicantEmail, applicantId, jobId, source } = application;
    let finalApplicantId = applicantId;
    if (!finalApplicantId) {
        const existingApplicantId = await getApplicantIdByEmail(applicantEmail);
        if (existingApplicantId) {
            finalApplicantId = existingApplicantId;
            await firebase_1.db.collection('applicants').doc(finalApplicantId).update({ lastActivityAt: firestore_1.FieldValue.serverTimestamp() });
        }
        else {
            const newApplicantRef = firebase_1.db.collection('applicants').doc();
            const newApplicant = {
                primaryEmail: applicantEmail,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                lastActivityAt: firestore_1.FieldValue.serverTimestamp(),
            };
            await newApplicantRef.set(newApplicant, { merge: true });
            finalApplicantId = newApplicantRef.id;
        }
        await event.data?.ref.update({ applicantId: finalApplicantId });
    }
    // Event for application submission
    await firebase_1.db.collection('events').add({
        type: 'application_submitted',
        entityType: 'application',
        entityId: event.params.applicationId,
        metadata: { jobId, applicantId: finalApplicantId },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Job rollups
    const jobRef = firebase_1.db.collection('jobs').doc(jobId);
    await jobRef.update({
        'stats.applicantsCount': firestore_1.FieldValue.increment(1),
        'stats.statusCounts.NEW': firestore_1.FieldValue.increment(1),
    });
    if (__asObj(source).type === 'referral' && __asObj(source).refCode) {
        const referralRef = firebase_1.db.collection('referrals').doc(__asObj(source).refCode);
        await referralRef.update({ submitsCount: firestore_1.FieldValue.increment(1) });
    }
});
