import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Job, JobPublic } from '../../lib/types';

const db = admin.firestore();

export const onJobWrite = functions.firestore
  .document('jobs/{jobId}')
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const job = change.after.data() as Job | undefined;

    const publicJobRef = db.collection('jobPublic').doc(jobId);

    if (job && job.status === 'open') {
      console.log(`Job ${jobId} is open, updating public listing.`);
      // Create the public projection of the job
      const publicJob: JobPublic = {
        id: job.id,
        title: job.title,
        department: job.department,
        locationType: job.locationType,
        locationText: job.locationText,
        employmentType: job.employmentType,
        descriptionMarkdown: job.descriptionMarkdown,
        requirements: job.requirements,
        niceToHave: job.niceToHave,
        compensationRange: job.compensationRange,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
      await publicJobRef.set(publicJob, { merge: true });
    } else {
      console.log(`Job ${jobId} is not open, deleting public listing.`);
      // If the job is not open, or is deleted, remove it from the public collection
      await publicJobRef.delete();
    }
  });
