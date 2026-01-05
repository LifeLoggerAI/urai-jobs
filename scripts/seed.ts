
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Use this to connect to the emulators
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';

const serviceAccount = {
  projectId: 'urai-jobs-dev',
  privateKey: 'dummy',
  clientEmail: 'dummy@example.com'
};

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'urai-jobs-dev',
});


const db = getFirestore();
const auth = getAuth();

async function main() {
  console.log('Seeding database...');

  // Create Jobs
  const jobs = [
    {
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      locationType: 'remote',
      employmentType: 'full_time',
      descriptionMarkdown: '## About the role\n\nWe are looking for a senior frontend engineer to join our team.',
      requirements: ['React', 'TypeScript', 'Next.js'],
      niceToHave: ['GraphQL', 'Apollo'],
      compensationRange: { min: 120000, max: 150000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
    {
      title: 'Product Manager',
      department: 'Product',
      locationType: 'hybrid',
      locationText: 'San Francisco, CA',
      employmentType: 'full_time',
      descriptionMarkdown: '## About the role\n\nWe are looking for a product manager to join our team.',
      requirements: ['Agile', 'JIRA', 'Product Roadmaps'],
      niceToHave: ['Figma', 'Miro'],
      compensationRange: { min: 100000, max: 130000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
    {
      title: 'UX Designer',
      department: 'Design',
      locationType: 'onsite',
      locationText: 'New York, NY',
      employmentType: 'contract',
      descriptionMarkdown: '## About the role\n\nWe are looking for a UX designer to join our team.',
      requirements: ['Figma', 'Sketch', 'Adobe Creative Suite'],
      niceToHave: ['HTML', 'CSS'],
      compensationRange: { min: 80000, max: 100000, currency: 'USD' },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed',
    },
  ];

  for (const job of jobs) {
    await db.collection('jobs').add(job);
  }

  // Create Applicants
  const applicants = [
    {
      primaryEmail: 'alice@example.com',
      name: 'Alice',
      phone: '123-456-7890',
      links: { portfolio: 'https://alice.dev', linkedin: 'https://linkedin.com/in/alice' },
      source: { type: 'direct' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    },
    {
      primaryEmail: 'bob@example.com',
      name: 'Bob',
      phone: '123-456-7891',
      links: { github: 'https://github.com/bob' },
      source: { type: 'referral', refCode: 'bob-123' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    },
  ];

  for (const applicant of applicants) {
    await db.collection('applicants').add(applicant);
  }

  // Create Waitlist
  const waitlist = [
    {
      email: 'charlie@example.com',
      name: 'Charlie',
      interests: ['engineering', 'product'],
      consent: { terms: true, marketing: false },
      createdAt: new Date(),
    },
    {
      email: 'dave@example.com',
      name: 'Dave',
      interests: ['design'],
      consent: { terms: true, marketing: true },
      createdAt: new Date(),
    },
  ];

  for (const item of waitlist) {
    await db.collection('waitlist').add(item);
  }

  // Create Admins
  await db.collection('admins').doc('seed-admin').set({
    role: 'owner',
    createdAt: new Date(),
  });

  console.log('Database seeded!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
