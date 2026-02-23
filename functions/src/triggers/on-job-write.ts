import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

export const onJobWrite = functions.firestore
    .document("jobs/{jobId}")
    .onWrite(async (change, context) => {
        const db = getFirestore();
        const jobId = context.params.jobId;
        const job = change.after.data();

        const jobPublicRef = db.collection("jobPublic").doc(jobId);

        if (job && job.status === "open") {
            // If the job is open, create or update the public projection.
            const publicJob = {
                title: job.title,
                department: job.department,
                locationType: job.locationType,
                locationText: job.locationText,
                employmentType: job.employmentType,
                descriptionMarkdown: job.descriptionMarkdown,
                requirements: job.requirements,
                niceToHave: job.niceToHave,
                compensationRange: job.compensationRange,
                updatedAt: job.updatedAt,
            };
            await jobPublicRef.set(publicJob, { merge: true });
        } else {
            // If the job is not open, delete the public projection.
            await jobPublicRef.delete();
        }
    });
