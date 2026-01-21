import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobPublic } from "./models/Job";
import { Application } from "./models/Application";
import { Applicant } from "./models/Applicant";

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

const isAdmin = async (uid: string) => {
  const adminDoc = await db.collection("admins").doc(uid).get();
  return adminDoc.exists;
};

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const job = change.after.data() as Job | undefined;

    const jobPublicRef = db.collection("jobPublic").doc(jobId);

    if (job && job.status === "open") {
      const jobPublic: JobPublic = {
        title: job.title,
        department: job.department,
        locationType: job.locationType,
        locationText: job.locationText,
        employmentType: job.employmentType,
        descriptionMarkdown: job.descriptionMarkdown,
        requirements: job.requirements,
        niceToHave: job.niceToHave,
        compensationRange: job.compensationRange,
      };
      await jobPublicRef.set(jobPublic, { merge: true });
    } else {
      await jobPublicRef.delete();
    }
  });

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data() as Application;
    const { jobId, applicantEmail } = application;
    let { applicantId } = application;

    // 1. Create or merge applicant
    let applicantRef;
    if (applicantId) {
      applicantRef = db.collection("applicants").doc(applicantId);
      await applicantRef.update({
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const applicantsQuery = await db
        .collection("applicants")
        .where("primaryEmail", "==", applicantEmail.toLowerCase())
        .limit(1)
        .get();

      if (!applicantsQuery.empty) {
        applicantRef = applicantsQuery.docs[0].ref;
        await applicantRef.update({
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        applicantId = applicantRef.id;
      } else {
        // Create a new applicant
        const newApplicant: Partial<Applicant> = {
          primaryEmail: applicantEmail.toLowerCase(),
          // name is not available on application submission
          createdAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
          source: application.source || { type: "direct" },
        };
        applicantRef = await db.collection("applicants").add(newApplicant);
        applicantId = applicantRef.id;
      }
      // Update the application with the determined applicantId
      await snap.ref.update({ applicantId });
    }

    // 2. Write "application_submitted" event
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: snap.id,
      metadata: { jobId, applicantId },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Increment job rollup stats
    const jobRef = db.collection("jobs").doc(jobId);
    await db.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) return;

        const currentStats = jobDoc.data()?.stats || {};
        const newApplicantsCount = (currentStats.applicantsCount || 0) + 1;
        const newStatusCounts = { 
            ...(currentStats.statusCounts || {}),
            NEW: ((currentStats.statusCounts?.NEW || 0) + 1)
        };

        transaction.update(jobRef, {
            "stats.applicantsCount": newApplicantsCount,
            "stats.statusCounts": newStatusCounts,
        });
    });


    // 4. If referral, increment submitsCount
    if (application.source?.type === "referral" && application.source?.refCode) {
      const referralRef = db.collection("referrals").doc(application.source.refCode);
      try {
        await referralRef.update({
          submitsCount: admin.firestore.FieldValue.increment(1),
        });
      } catch (error) {
        console.error(`Could not increment referral count for code: ${application.source.refCode}`, error);
      }
    }
  });

export const createResumeUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to upload a resume."
    );
  }

  const { applicantId, applicationId, filename, contentType, size } = data;

  if (!applicantId || !applicationId || !filename || !contentType || !size) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required parameters."
    );
  }

  if (context.auth.uid !== applicantId) {
      throw new functions.https.HttpsError(
          "permission-denied",
          "You are not authorized to upload a resume for this applicant."
      );
  }

  const allowedContentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedContentTypes.includes(contentType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid content type."
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (size > maxSize) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "File size exceeds the 10MB limit."
    );
  }

  const bucket = storage.bucket();
  const filePath = `resumes/${applicantId}/${applicationId}/${filename}`;
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });

  return { url, filePath };
});

export const adminSetApplicationStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to perform this action."
      );
    }

    const admin = await isAdmin(context.auth.uid);
    if (!admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must be an admin to perform this action."
      );
    }

    const { applicationId, status, tags, rating } = data;

    if (!applicationId || !status) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required parameters."
      );
    }

    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Application not found."
      );
    }

    const application = applicationDoc.data() as Application;
    const oldStatus = application.status;
    const jobId = application.jobId;

    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      "internal.reviewerId": context.auth.uid,
      "internal.reviewedAt": admin.firestore.FieldValue.serverTimestamp(),
    };

    if (tags) {
      updateData.tags = tags;
    }
    if (rating) {
      updateData["internal.rating"] = rating;
    }

    await applicationRef.update(updateData);

    await db.collection("events").add({
      type: "status_changed",
      entityType: "application",
      entityId: applicationId,
      metadata: {
        jobId,
        applicantId: application.applicantId,
        oldStatus,
        newStatus: status,
        changedBy: context.auth.uid,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Update job stats
    const jobRef = db.collection("jobs").doc(jobId);
    await db.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) return;

        const currentStats = jobDoc.data()?.stats || {};
        const statusCounts = currentStats.statusCounts || {};
        
        const newStatusCounts = {
            ...statusCounts,
            [oldStatus]: (statusCounts[oldStatus] || 1) - 1,
            [status]: (statusCounts[status] || 0) + 1,
        };

        transaction.update(jobRef, {
            "stats.statusCounts": newStatusCounts,
        });
    });


    return { success: true };
  }
);

export const scheduledDailyDigest = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - 24 * 60 * 60 * 1000
    );

    // 1. New applications in the last 24 hours
    const newApplicationsQuery = db
      .collection("applications")
      .where("submittedAt", ">=", twentyFourHoursAgo);
    const newApplicationsSnap = await newApplicationsQuery.get();
    const newApplicationsCount = newApplicationsSnap.size;

    // 2. Pending NEW/SCREEN counts
    const pendingNewQuery = db
      .collection("applications")
      .where("status", "==", "NEW");
    const pendingNewSnap = await pendingNewQuery.get();
    const pendingNewCount = pendingNewSnap.size;

    const pendingScreenQuery = db
        .collection("applications")
        .where("status", "==", "SCREEN");
    const pendingScreenSnap = await pendingScreenQuery.get();
    const pendingScreenCount = pendingScreenSnap.size;


    // 3. Top jobs by applicant count
    const jobsQuery = db.collection("jobs").orderBy("stats.applicantsCount", "desc").limit(5);
    const jobsSnap = await jobsQuery.get();
    const topJobs = jobsSnap.docs.map((doc) => {
        const job = doc.data() as Job;
        return {
            jobId: doc.id,
            title: job.title,
            applicantsCount: job.stats?.applicantsCount || 0,
        };
    });

    // 4. Create digest document
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const digestRef = db.collection("digests").doc(today);

    await digestRef.set({
      createdAt: now,
      newApplicationsCount,
      pendingNewCount,
      pendingScreenCount,
      topJobs,
    });

    console.log(`Daily digest for ${today} created successfully.`);
    return null;
  });

export const httpHealth = functions.https.onRequest((req, res) => {
    res.status(200).send({
        status: "ok",
        buildInfo: {
            nodeVersion: process.version,
            buildTimestamp: new Date().toISOString()
        }
    });
});
