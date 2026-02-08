import * as admin from 'firebase-admin';
import { faker } from '@faker-js/faker';

// Initialize Firebase Admin SDK against the emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'urai-jobs-dev' });

const db = admin.firestore();

const seedDatabase = async () => {
  console.log('Starting to seed the database...');

  // Clear existing data
  await clearAllData();

  // Seed Admins
  await db.collection('admins').doc('test-admin-uid').set({
    role: 'owner',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Seed Jobs
  const jobIds = await seedJobs();

  // Seed Applicants and Applications
  await seedApplicantsAndApplications(jobIds);

  // Seed Waitlist
  await seedWaitlist();

  // Seed Referrals
  await seedReferrals();

  console.log('Database seeding completed successfully!');
};

const clearAllData = async () => {
    console.log('Clearing all existing data...');
    const collections = await db.listCollections();
    for (const collection of collections) {
        const docs = await collection.listDocuments();
        await Promise.all(docs.map(doc => doc.delete()));
    }
}

const seedJobs = async (): Promise<string[]> => {
  const jobPromises: Promise<any>[] = [];
  for (let i = 0; i < 5; i++) {
    const status = i < 3 ? 'open' : 'draft'; // 3 open, 2 draft
    const jobData = {
      title: faker.person.jobTitle(),
      department: faker.commerce.department(),
      locationType: faker.helpers.arrayElement(['remote', 'hybrid', 'onsite']),
      locationText: faker.location.city() + ', ' + faker.location.state(),
      employmentType: faker.helpers.arrayElement(['full_time', 'part_time', 'contract']),
      descriptionMarkdown: faker.lorem.paragraphs(3),
      requirements: Array.from({ length: 5 }, () => faker.lorem.sentence()),
      niceToHave: Array.from({ length: 3 }, () => faker.lorem.sentence()),
      status: status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'test-admin-uid',
    };
    jobPromises.push(db.collection('jobs').add(jobData));
  }
  const results = await Promise.all(jobPromises);
  return results.map(r => r.id);
};

const seedApplicantsAndApplications = async (jobIds: string[]) => {
  const applicantPromises: Promise<any>[] = [];
  for (let i = 0; i < 30; i++) {
    const applicantData = {
        primaryEmail: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        phone: faker.phone.number(),
        links: {
            portfolio: faker.internet.url(),
            linkedin: `https://linkedin.com/in/${faker.internet.userName()}`
        },
        source: { type: 'direct' },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    applicantPromises.push(db.collection('applicants').add(applicantData));
  }
  const applicantResults = await Promise.all(applicantPromises);
  const applicantIds = applicantResults.map(r => r.id);

  const applicationPromises: Promise<any>[] = [];
  for (let i = 0; i < 40; i++) {
    const applicantId = faker.helpers.arrayElement(applicantIds);
    const jobId = faker.helpers.arrayElement(jobIds);
    const applicationData = {
        jobId: jobId,
        applicantId: applicantId,
        applicantEmail: faker.internet.email().toLowerCase(), // Denormalized
        status: faker.helpers.arrayElement(['NEW', 'SCREEN', 'INTERVIEW', 'REJECTED']),
        answers: {
            'question1': faker.lorem.paragraph(),
            'question2': faker.lorem.sentence(),
        },
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    applicationPromises.push(db.collection('applications').add(applicationData));
  }
  await Promise.all(applicationPromises);
};

const seedWaitlist = async () => {
    const waitlistPromises: Promise<any>[] = [];
    for (let i = 0; i < 20; i++) {
        const waitlistData = {
            email: faker.internet.email().toLowerCase(),
            name: faker.person.fullName(),
            interests: [faker.person.jobArea()],
            consent: { terms: true, marketing: faker.datatype.boolean() },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        waitlistPromises.push(db.collection('waitlist').add(waitlistData));
    }
    await Promise.all(waitlistPromises);
};

const seedReferrals = async () => {
    const referralPromises: Promise<any>[] = [];
    for (let i = 0; i < 5; i++) {
        const referralData = {
            code: faker.lorem.slug(),
            createdBy: 'test-admin-uid',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            clicksCount: faker.number.int({ min: 10, max: 100 }),
            submitsCount: faker.number.int({ min: 1, max: 10 }),
            active: true,
        };
        referralPromises.push(db.collection('referrals').add(referralData));
    }
    await Promise.all(referralPromises);
};

seedDatabase().catch(error => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
