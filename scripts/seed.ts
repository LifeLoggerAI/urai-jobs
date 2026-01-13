import * as admin from 'firebase-admin';
import { faker } from '@faker-js/faker';

admin.initializeApp({ projectId: 'urai-jobs' });
const db = admin.firestore();

async function seed() {
  console.log('Seeding database...');

  // Clear existing data
  const collections = await db.listCollections();
  for (const collection of collections) {
    const snapshot = await collection.get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // Seed Admins
  const adminUIDs = ['admin-user'];
  await db.collection('admins').doc(adminUIDs[0]).set({ role: 'owner', createdAt: new Date() });

  // Seed Jobs
  const jobIds = [];
  for (let i = 0; i < 5; i++) {
    const jobId = faker.string.uuid();
    jobIds.push(jobId);
    await db.collection('jobs').doc(jobId).set({
      title: faker.person.jobTitle(),
      department: faker.company.name(),
      locationType: 'remote',
      locationText: 'Remote',
      employmentType: 'full_time',
      descriptionMarkdown: faker.lorem.paragraphs(3),
      requirements: [faker.lorem.sentence()],
      niceToHave: [faker.lorem.sentence()],
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminUIDs[0],
    });
  }

  console.log('Database seeded successfully!');
}

seed().catch(console.error);
