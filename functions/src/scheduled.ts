import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const scheduledDailyDigest = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const db = admin.firestore();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const applicationsSnapshot = await db
    .collection('applications')
    .where('submittedAt', '>=', yesterday)
    .get();

  const newApplicationsCount = applicationsSnapshot.size;

  const pendingSnapshot = await db
    .collection('applications')
    .where('status', 'in', ['NEW', 'SCREEN'])
    .get();

  const pendingCount = pendingSnapshot.size;

  const jobsSnapshot = await db.collection('jobs').orderBy('stats.applicantsCount', 'desc').limit(5).get();
  const topJobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title, count: doc.data().stats.applicantsCount }));

  const digest = {
    date: now.toISOString().split('T')[0],
    newApplicationsLast24h: newApplicationsCount,
    pendingApplications: pendingCount,
    topJobs: topJobs,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('digests').doc(digest.date).set(digest);
});
