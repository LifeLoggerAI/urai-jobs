const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json'); // You'll need to create this file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'http://127.0.0.1:9000?ns=urai-jobs-24d18',
});

const db = admin.firestore();

async function seed() {
  console.log('Seeding database...');

  // Create jobs
  const jobs = [
    {
      title: 'Software Engineer',
      department: 'Engineering',
      locationType: 'remote',
      locationText: 'Remote',
      employmentType: 'full_time',
      descriptionMarkdown: 'This is a great opportunity to join a growing team.',
      requirements: ['JavaScript', 'React', 'Node.js'],
      niceToHave: ['TypeScript', 'GraphQL'],
      compensationRange: { min: 100000, max: 150000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
    },
    // Add more jobs here
  ];

  for (const job of jobs) {
    await db.collection('jobs').add(job);
  }

  // Create applicants
  const applicants = [
    {
      primaryEmail: 'test@test.com',
      name: 'Test Applicant',
      phone: '123-456-7890',
      links: { portfolio: 'https://example.com' },
      source: { type: 'direct' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    },
    // Add more applicants here
  ];

  for (const applicant of applicants) {
    await db.collection('applicants').add(applicant);
  }

  // Create applications
  const applications = [
    {
      jobId: 'some-job-id', // Replace with a real job ID from above
      applicantId: 'some-applicant-id', // Replace with a real applicant ID from above
      applicantEmail: 'test@test.com',
      status: 'NEW',
      answers: { q1: 'Answer 1' },
      submittedAt: new Date(),
      updatedAt: new Date(),
    },
    // Add more applications here
  ];

  for (const application of applications) {
    await db.collection('applications').add(application);
  }

  console.log('Database seeded successfully!');
}

seed();
