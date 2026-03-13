
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json'); // Adjust the path to your service account key
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seed = async () => {
  console.log('Seeding database...');

  // Clear existing data
  await clearCollection('jobs');
  await clearCollection('jobPublic');
  await clearCollection('applicants');
  await clearCollection('applications');
  await clearCollection('referrals');
  await clearCollection('waitlist');
  await clearCollection('admins');
  await clearCollection('events');

  // Seed Admins
  const adminUid = 'F5emx622VzY7V3gWjTOdYj2dZ3A2'; // Replace with a real UID for testing
  await db.collection('admins').doc(adminUid).set({
    role: 'owner',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Seed Jobs
  const jobs = [
    { title: 'Software Engineer', department: 'Engineering', locationType: 'remote', status: 'open' },
    { title: 'Product Manager', department: 'Product', locationType: 'hybrid', locationText: 'New York, NY', status: 'open' },
    { title: 'UX Designer', department: 'Design', locationType: 'onsite', locationText: 'San Francisco, CA', status: 'draft' },
    { title: 'Data Scientist', department: 'Data', locationType: 'remote', status: 'closed' },
    { title: 'Marketing Manager', department: 'Marketing', locationType: 'hybrid', locationText: 'London, UK', status: 'paused' },
  ];

  const jobIds: string[] = [];
  for (const job of jobs) {
    const jobId = uuidv4();
    jobIds.push(jobId);
    await db.collection('jobs').doc(jobId).set({
      ...job,
      descriptionMarkdown: 'This is a job description.',
      requirements: ['Requirement 1', 'Requirement 2'],
      niceToHave: ['Nice to have 1', 'Nice to have 2'],
      compensationRange: { min: 80000, max: 120000, currency: 'USD' },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUid,
    });
  }

  // Seed Applicants
  const applicants = Array.from({ length: 30 }, (_, i) => ({
    primaryEmail: `applicant${i}@example.com`,
    name: `Applicant ${i}`,
    source: { type: i % 3 === 0 ? 'referral' : 'direct', refCode: i % 3 === 0 ? 'REF001' : undefined },
  }));

  const applicantIds: string[] = [];
  for (const applicant of applicants) {
    const applicantId = uuidv4();
    applicantIds.push(applicantId);
    await db.collection('applicants').doc(applicantId).set({
      ...applicant,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Seed Applications
  for (let i = 0; i < 40; i++) {
    const applicationId = uuidv4();
    await db.collection('applications').doc(applicationId).set({
      jobId: jobIds[i % jobIds.length],
      applicantId: applicantIds[i % applicantIds.length],
      applicantEmail: `applicant${i % applicantIds.length}@example.com`,
      status: 'NEW',
      answers: { question1: 'Answer 1' },
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Seed Referral Codes
  await db.collection('referrals').doc('REF001').set({
    code: 'REF001',
    createdBy: adminUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    clicksCount: 10,
    submitsCount: 2,
    active: true,
  });

  // Seed Waitlist
  for (let i = 0; i < 20; i++) {
    await db.collection('waitlist').add({
      email: `waitlist${i}@example.com`,
      name: `Waitlist User ${i}`,
      interests: ['Engineering', 'Product'],
      consent: { terms: true, marketing: true },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log('Database seeded successfully!');
};

const clearCollection = async (collectionPath: string) => {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

seed().catch(err => console.error(err));
