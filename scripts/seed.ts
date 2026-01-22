import * as admin from 'firebase-admin';

const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seed() {
  console.log('Seeding database...');

  // Seed jobs
  const jobs = [
    {
      title: 'Software Engineer',
      department: 'Engineering',
      locationType: 'remote',
      locationText: 'Remote',
      employmentType: 'full_time',
      descriptionMarkdown: 'This is a job description.',
      requirements: ['React', 'Firebase'],
      niceToHave: ['TypeScript'],
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: 'Product Manager',
      department: 'Product',
      locationType: 'onsite',
      locationText: 'San Francisco, CA',
      employmentType: 'full_time',
      descriptionMarkdown: 'This is a job description.',
      requirements: ['Agile', 'Jira'],
      niceToHave: ['SQL'],
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: 'UX Designer',
      department: 'Design',
      locationType: 'hybrid',
      locationText: 'New York, NY',
      employmentType: 'contract',
      descriptionMarkdown: 'This is a job description.',
      requirements: ['Figma', 'Sketch'],
      niceToHave: ['HTML/CSS'],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const job of jobs) {
    await db.collection('jobs').add(job);
  }

  // Seed applicants
  for (let i = 0; i < 30; i++) {
    await db.collection('applicants').add({
      primaryEmail: `applicant${i}@example.com`,
      name: `Applicant ${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Seed applications
  const jobDocs = await db.collection('jobs').get();
  const applicantDocs = await db.collection('applicants').get();

  for (let i = 0; i < 40; i++) {
    const job = jobDocs.docs[i % jobDocs.size];
    const applicant = applicantDocs.docs[i % applicantDocs.size];

    await db.collection('applications').add({
      jobId: job.id,
      applicantId: applicant.id,
      applicantEmail: applicant.data().primaryEmail,
      status: 'NEW',
      submittedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Seed referral codes
  for (let i = 0; i < 5; i++) {
    await db.collection('referrals').add({
      code: `REF${i}`,
      createdBy: 'admin',
      createdAt: new Date(),
      clicksCount: 0,
      submitsCount: 0,
      active: true,
    });
  }

  // Seed waitlist
  for (let i = 0; i < 20; i++) {
    await db.collection('waitlist').add({
      email: `waitlist${i}@example.com`,
      createdAt: new Date(),
    });
  }

  console.log('Seeding complete.');
}

seed();
