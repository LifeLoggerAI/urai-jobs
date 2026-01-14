import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
initializeApp();

const db = getFirestore();

async function seed() {
  console.log('Seeding database...');

  // Seed Jobs
  const jobs = [
    { id: 'job1', title: 'Software Engineer', department: 'Engineering', status: 'open' },
    { id: 'job2', title: 'Product Manager', department: 'Product', status: 'open' },
    { id: 'job3', title: 'UX Designer', department: 'Design', status: 'draft' },
  ];

  for (const job of jobs) {
    await db.collection('jobs').doc(job.id).set(job);
    if (job.status === 'open') {
      await db.collection('jobPublic').doc(job.id).set(job);
    }
  }

  // Seed Applicants
  const applicants = [
    { id: 'app1', name: 'Alice', email: 'alice@example.com' },
    { id: 'app2', name: 'Bob', email: 'bob@example.com' },
  ];

  for (const applicant of applicants) {
    await db.collection('applicants').doc(applicant.id).set(applicant);
  }

  // Seed Applications
  const applications = [
    { jobId: 'job1', applicantId: 'app1', status: 'NEW' },
    { jobId: 'job1', applicantId: 'app2', status: 'SCREEN' },
  ];

  for (const application of applications) {
    await db.collection('applications').add(application);
  }

  // Seed Waitlist
  await db.collection('waitlist').add({ email: 'charlie@example.com' });

  // Seed Admins
  // Replace 'admin-uid' with a real UID from your Firebase project
  await db.collection('admins').doc('admin-uid').set({ role: 'admin' });

  console.log('Database seeded successfully!');
}

seed().catch(console.error);
