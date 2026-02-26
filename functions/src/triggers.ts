import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Triggered on write to a job document.
 * Maintains the public projection of the job in `jobPublic`.
 */
export const onJobWrite = functions.firestore
    .document("orgs/{orgId}/jobs/{jobId}")
    .onWrite(async (change, context) => {
        const { orgId, jobId } = context.params;
        const jobPublicRef = db.doc(`orgs/${orgId}/jobPublic/${jobId}`);

        const jobData = change.after.data();

        // If the job is deleted or not open, delete the public doc.
        if (!jobData || jobData.status !== "open") {
            try {
                await jobPublicRef.delete();
                console.log(`Deleted public job ${jobId} for org ${orgId}`);
            } catch (error) {
                // It's okay if it doesn't exist.
            }
            return;
        }

        // If the job is open, create or update the public doc.
        const {
            title,
            department,
            locationType,
            locationText,
            employmentType,
            descriptionMarkdown,
            requirements,
            niceToHave,
            compensationRange,
            createdAt,
        } = jobData;

        const publicJob = {
            orgId, // Keep orgId for client-side queries
            title,
            department,
            locationType,
            locationText,
            employmentType,
            descriptionMarkdown,
            requirements: requirements || [],
            niceToHave: niceToHave || [],
            compensationRange: compensationRange || {},
            createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await jobPublicRef.set(publicJob, { merge: true });
        console.log(`Updated public job ${jobId} for org ${orgId}`);
    });

/**
 * Triggered on creation of a new application.
 */
export const onApplicationCreate = functions.firestore
    .document("orgs/{orgId}/applications/{applicationId}")
    .onCreate(async (snap, context) => {
        const { orgId, applicationId } = context.params;
        const applicationData = snap.data();

        if (!applicationData) {
            console.error("No data in application creation trigger.");
            return;
        }

        const { jobId, applicantEmail, source, applicantName } = applicationData;
        const batch = db.batch();

        // 1. Create/merge applicant
        const applicantsRef = db.collection(`orgs/${orgId}/applicants`);
        const existingApplicantQuery = await applicantsRef.where("primaryEmail", "==", applicantEmail).limit(1).get();

        let applicantId = applicationData.applicantId;
        if (existingApplicantQuery.empty) {
            const newApplicantRef = applicantsRef.doc();
            applicantId = newApplicantRef.id;
            batch.set(newApplicantRef, {
                orgId,
                primaryEmail: applicantEmail,
                name: applicantName || "",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
                source: source || { type: "direct" },
            });
            batch.update(snap.ref, { applicantId });
        } else {
            const applicantDoc = existingApplicantQuery.docs[0];
            applicantId = applicantDoc.id;
            batch.update(applicantDoc.ref, {
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (!applicationData.applicantId) {
                batch.update(snap.ref, { applicantId });
            }
        }

        // 2. Write "application_submitted" event
        const eventRef = db.collection(`orgs/${orgId}/events`).doc();
        batch.set(eventRef, {
            orgId,
            type: "application_submitted",
            entityType: "application",
            entityId: applicationId,
            metadata: { jobId, applicantId },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Increment job stats
        const jobRef = db.doc(`orgs/${orgId}/jobs/${jobId}`);
        batch.update(jobRef, {
            "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
            "stats.statusCounts.NEW": admin.firestore.FieldValue.increment(1),
        });
        
        // 4. Handle referral
        if (source && source.type === "referral" && source.refCode) {
            const referralRef = db.doc(`orgs/${orgId}/referrals/${source.refCode}`);
            batch.update(referralRef, {
                submitsCount: admin.firestore.FieldValue.increment(1),
            });
        }
        
        await batch.commit();
        console.log(`Processed new application ${applicationId} for org ${orgId}`);
    });

/**
 * Scheduled function to create a daily digest of activity.
 */
export const scheduledDailyDigest = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
        console.log("Running scheduled daily digest.");
        const orgsSnapshot = await db.collection("orgs").get();

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const timestampYesterday = admin.firestore.Timestamp.fromDate(yesterday);
        
        const digestPromises = orgsSnapshot.docs.map(async (orgDoc) => {
            const orgId = orgDoc.id;
            const applicationsRef = db.collection(`orgs/${orgId}/applications`);

            const newAppsQuery = applicationsRef
                .where("submittedAt", ">=", timestampYesterday);
            const newAppsSnapshot = await newAppsQuery.get();

            const pendingScreenQuery = applicationsRef.where("status", "==", "SCREEN").count().get();
            const pendingNewQuery = applicationsRef.where("status", "==", "NEW").count().get();
            
            const [pendingScreenCount, pendingNewCount] = await Promise.all([
                pendingScreenQuery,
                pendingNewQuery
            ]);

            const today = new Date().toISOString().split("T")[0];
            const digestRef = db.doc(`orgs/${orgId}/digests/${today}`);

            await digestRef.set({
                orgId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                newApplicationsLast24h: newAppsSnapshot.size,
                pendingScreenCount: pendingScreenCount.data().count,
                pendingNewCount: pendingNewCount.data().count,
            });
            console.log(`Created digest for org ${orgId}`);
        });

        await Promise.all(digestPromises);
        console.log("Daily digests completed.");
    });
