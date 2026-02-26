
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const scheduledDailyDigest = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const applicationsSnapshot = await db.collection('applications').where('submittedAt', '>=', yesterday).get();
  const waitlistSnapshot = await db.collection('waitlist').where('createdAt', '>=', yesterday).get();
  const jobsSnapshot = await db.collection('jobs').orderBy('stats.applicantsCount', 'desc').limit(5).get();

  const newApplicationsCount = applicationsSnapshot.size;
  const newWaitlistCount = waitlistSnapshot.size;

  const topJobs = jobsSnapshot.docs.map(doc => ({ 
    jobId: doc.id, 
    title: doc.data().title, 
    applicantsCount: doc.data().stats.applicantsCount 
  }));

  const digest = {
    date: now.toISOString().split('T')[0],
    newApplicationsCount,
    newWaitlistCount,
    topJobs,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const digestId = now.toISOString().split('T')[0];
  await db.collection('digests').doc(digestId).set(digest);
});
