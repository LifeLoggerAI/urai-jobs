import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Run `firebase emulators:start` first
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Use a service account
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function seed() {
  // Create jobs
  const jobs = [
    {
      title: 'Software Engineer, Frontend',
      department: 'Engineering',
      locationType: 'remote',
      locationText: 'Remote',
      employmentType: 'full_time',
      descriptionMarkdown: 'Build the future of URAI.',
      requirements: ['React', 'TypeScript', 'Vite'],
      niceToHave: ['Firebase', 'Node.js'],
      compensationRange: { min: 100000, max: 150000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
    {
      title: 'Software Engineer, Backend',
      department: 'Engineering',
      locationType: 'remote',
      locationText: 'Remote',
      employmentType: 'full_time',
      descriptionMarkdown: 'Build the future of URAI.',
      requirements: ['Node.js', 'TypeScript', 'Firebase'],
      niceToHave: ['Google Cloud', 'Terraform'],
      compensationRange: { min: 100000, max: 150000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
    {
      title: 'Product Manager',
      department: 'Product',
      locationType: 'hybrid',
      locationText: 'New York, NY',
      employmentType: 'full_time',
      descriptionMarkdown: 'Shape the future of URAI.',
      requirements: ['Product Management', 'Agile'],
      niceToHave: ['AI/ML', 'SaaS'],
      compensationRange: { min: 120000, max: 180000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
    {
      title: 'UX Designer',
      department: 'Design',
      locationType: 'onsite',
      locationText: 'San Francisco, CA',
      employmentType: 'full_time',
      descriptionMarkdown: 'Design the future of URAI.',
      requirements: ['Figma', 'User Research'],
      niceToHave: ['HTML', 'CSS'],
      compensationRange: { min: 90000, max: 130000, currency: 'USD' },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
    {
        title: 'Data Scientist',
        department: 'Data',
        locationType: 'remote',
        locationText: 'Remote',
        employmentType: 'full_time',
        descriptionMarkdown: 'Analyze the data of URAI.',
        requirements: ['Python', 'SQL', 'Machine Learning'],
        niceToHave: ['BigQuery', 'Looker'],
        compensationRange: { min: 110000, max: 160000, currency: 'USD' },
        status: 'closed',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'seed',
      },
  ];

  for (const job of jobs) {
    await db.collection('jobs').add(job);
  }

  // Create applicants
  for (let i = 0; i < 30; i++) {
    await db.collection('applicants').add({
      primaryEmail: `applicant${i}@example.com`,
      name: `Applicant ${i}`,
      phone: '123-456-7890',
      links: { portfolio: 'https://example.com', linkedin: 'https://linkedin.com/in/example' },
      source: { type: 'direct' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    });
  }

  // Create applications
  const openJobs = await db.collection('jobs').where('status', '==', 'open').get();
  const applicants = await db.collection('applicants').get();

  for (let i = 0; i < 40; i++) {
    const job = openJobs.docs[i % openJobs.size];
    const applicant = applicants.docs[i % applicants.size];

    await db.collection('applications').add({
      jobId: job.id,
      applicantId: applicant.id,
      applicantEmail: applicant.data().primaryEmail,
      status: 'NEW',
      answers: { question1: 'Answer 1', question2: 'Answer 2' },
      submittedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Create referral codes
    for (let i = 0; i < 5; i++) {
        await db.collection('referrals').add({
        code: `REF${i}`,
        createdBy: 'seed',
        createdAt: new Date(),
        clicksCount: 0,
        submitsCount: 0,
        active: true,
        });
    }

    // Create waitlist entries
    for (let i = 0; i < 20; i++) {
        await db.collection('waitlist').add({
        email: `waitlist${i}@example.com`,
        name: `Waitlist User ${i}`,
        interests: ['engineering', 'product'],
        consent: { terms: true, marketing: true },
        createdAt: new Date(),
        });
    }


  console.log('Seeding finished.');
}

seed();
