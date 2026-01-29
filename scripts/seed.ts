import { faker } from '@faker-js/faker';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json'); // you should replace this with your own service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seedDatabase = async () => {
  console.log('Seeding database...');

  // Seed Jobs
  const jobs = [];
  for (let i = 0; i < 5; i++) {
    const job = {
      title: faker.person.jobTitle(),
      department: faker.commerce.department(),
      locationType: faker.helpers.arrayElement(['remote', 'hybrid', 'onsite']),
      locationText: faker.location.city(),
      employmentType: faker.helpers.arrayElement(['full_time', 'part_time', 'contract', 'intern']),
      descriptionMarkdown: faker.lorem.paragraphs(3),
      requirements: Array.from({ length: faker.number.int({ min: 3, max: 5 }) }, () => faker.lorem.sentence()),
      niceToHave: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.lorem.sentence()),
      compensationRange: {
        min: faker.number.int({ min: 50000, max: 100000 }),
        max: faker.number.int({ min: 100000, max: 200000 }),
        currency: 'USD'
      },
      status: faker.helpers.arrayElement(['open', 'draft']),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'seed'
    };
    jobs.push(job);
    await db.collection('jobs').add(job);
  }

  // Seed Applicants
  const applicants = [];
  for (let i = 0; i < 30; i++) {
    const applicant = {
      primaryEmail: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      links: {
        portfolio: faker.internet.url(),
        linkedin: faker.internet.url(),
        github: faker.internet.url(),
      },
      source: {
        type: faker.helpers.arrayElement(['direct', 'referral', 'waitlist']),
        refCode: faker.lorem.word(),
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    applicants.push(applicant);
    const applicantRef = await db.collection('applicants').add(applicant);
    
    // Seed Applications
    if (i < 40) { // create 40 applications for 30 applicants
        const application = {
            jobId: faker.helpers.arrayElement(jobs).id,
            applicantId: applicantRef.id,
            applicantEmail: applicant.primaryEmail,
            status: faker.helpers.arrayElement(['NEW', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']),
            answers: {
                'question1': faker.lorem.sentence(),
                'question2': faker.lorem.sentence(),
            },
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('applications').add(application);
    }
  }

  // Seed Referral Codes
  for (let i = 0; i < 5; i++) {
    const referral = {
      code: faker.lorem.word(),
      createdBy: 'seed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clicksCount: faker.number.int({ min: 0, max: 100 }),
      submitsCount: faker.number.int({ min: 0, max: 50 }),
      active: faker.datatype.boolean(),
    };
    await db.collection('referrals').add(referral);
  }

  // Seed Waitlist
  for (let i = 0; i < 20; i++) {
    const waitlistEntry = {
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      interests: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.commerce.department()),
      consent: {
        terms: true,
        marketing: faker.datatype.boolean(),
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('waitlist').add(waitlistEntry);
  }

  console.log('Finished seeding database.');
};

seedDatabase().catch(error => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
