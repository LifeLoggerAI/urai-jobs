import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore";

export const onApplicationCreate = functions.firestore
    .document("applications/{applicationId}")
    .onCreate(async (snap: QueryDocumentSnapshot, context: functions.EventContext) => {
        const db = getFirestore();
        const application = snap.data();

        // 1. Create or merge applicant
        let applicantId = application.applicantId;
        if (!applicantId) {
            // If no applicantId is provided, create one based on the email hash.
            const email = application.applicantEmail.toLowerCase();
            applicantId = createHash('sha256').update(email).digest('hex');
            
            const applicantRef = db.collection("applicants").doc(applicantId);
            const applicantSnap = await applicantRef.get();

            if (applicantSnap.exists) {
                // If applicant exists, update their last activity.
                await applicantRef.update({ lastActivityAt: FieldValue.serverTimestamp() });
            } else {
                // If applicant does not exist, create a new one.
                await applicantRef.set({
                    primaryEmail: email,
                    name: application.answers?.name || "", // Assuming name is in answers
                    lastActivityAt: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp(),
                });
            }
        } else {
          const applicantRef = db.collection("applicants").doc(applicantId);
          await applicantRef.update({ lastActivityAt: FieldValue.serverTimestamp() });
        }

        // 2. Write event entry
        await db.collection("events").add({
            type: "application_submitted",
            entityType: "application",
            entityId: context.params.applicationId,
            metadata: { jobId: application.jobId },
            createdAt: FieldValue.serverTimestamp(),
        });

        // 3. Increment job stats
        const jobRef = db.collection("jobs").doc(application.jobId);
        await jobRef.update({
            'stats.applicantsCount': FieldValue.increment(1),
            [`stats.statusCounts.NEW`]: FieldValue.increment(1),
        });

        // 4. Handle referral
        if (application.source?.type === "referral" && application.source?.refCode) {
            const referralRef = db.collection("referrals").doc(application.source.refCode);
            await referralRef.update({ submitsCount: FieldValue.increment(1) });
        }
    });
