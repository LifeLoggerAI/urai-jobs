import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Application, Applicant } from "../../../packages/model/src/lib/model";

const db = admin.firestore();

/**
 * Triggered on the creation of a new application document in any organization.
 *
 * This function handles several critical post-application-submission tasks:
 * 1.  **Applicant Unification:** It creates a new applicant profile if one doesn't
 *     exist for the email, or updates the last activity on an existing one.
 * 2.  **Event Logging:** It logs an `application_submitted` event for analytics.
 * 3.  **Job Stats Rollup:** It increments the `applicantsCount` on the job.
 * 4.  **Referral Tracking:** If a referral code was used, it increments the
 *     `submitsCount` on the referral document.
 */
export const onApplicationCreate = functions.firestore
  .document("orgs/{orgId}/applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const { orgId, applicationId } = context.params;
    const application = snap.data() as Application;

    const batch = db.batch();

    // 1. Unify Applicant Profile
    const applicantEmail = application.applicantEmail.toLowerCase();
    const applicantsRef = db.collection(`orgs/${orgId}/applicants`);
    const query = applicantsRef.where("primaryEmail", "==", applicantEmail).limit(1);

    const applicantSnapshot = await query.get();
    let applicantId: string;

    if (applicantSnapshot.empty) {
      // Create a new applicant
      const newApplicantRef = applicantsRef.doc(); // Auto-generate ID
      applicantId = newApplicantRef.id;
      const newApplicant: Partial<Applicant> = {
        primaryEmail: applicantEmail,
        // The name/phone might not be on the application, depends on form fields
        name: application.answers["name"] || "",
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: application.source,
      };
      batch.set(newApplicantRef, newApplicant);
      functions.logger.log(`Created new applicant ${applicantId} for ${applicantEmail}`);

      // Backfill the applicantId on the application
      batch.update(snap.ref, { applicantId: applicantId });
    } else {
      // Update existing applicant
      const existingApplicantDoc = applicantSnapshot.docs[0];
      applicantId = existingApplicantDoc.id;
      batch.update(existingApplicantDoc.ref, {
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Backfill the applicantId on the application if it's missing
      if (!application.applicantId) {
        batch.update(snap.ref, { applicantId: applicantId });
      }
      functions.logger.log(`Updated existing applicant ${applicantId} for ${applicantEmail}`);
    }

    // 2. Log Event
    const eventRef = db.collection(`orgs/${orgId}/events`).doc();
    batch.set(eventRef, {
      type: "application_submitted",
      entityType: "application",
      entityId: applicationId,
      metadata: {
        jobId: application.jobId,
        applicantId: applicantId,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Increment Job Stats
    const jobRef = db.doc(`orgs/${orgId}/jobs/${application.jobId}`);
    batch.update(jobRef, {
      "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
      "stats.statusCounts.NEW": admin.firestore.FieldValue.increment(1),
    });

    // 4. Increment Referral Counter (if applicable)
    if (application.source?.type === 'referral' && application.source?.refCode) {
        const refCode = application.source.refCode;
        const referralRef = db.doc(`orgs/${orgId}/referrals/${refCode}`);
        batch.update(referralRef, {
            submitsCount: admin.firestore.FieldValue.increment(1)
        });
        functions.logger.log(`Incremented submitsCount for referral code ${refCode}`);
    }

    try {
      await batch.commit();
      functions.logger.log(
        `Successfully processed new application ${applicationId} for org ${orgId}.`
      );
    } catch (error) {
      functions.logger.error(
        `Error processing new application ${applicationId} for org ${orgId}.`,
        error
      );
    }
  });
