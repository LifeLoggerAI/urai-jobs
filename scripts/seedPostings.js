
const admin = require('firebase-admin');
const path = require('path');

// Correctly resolve the path from the project root where the script is run
const seedDataPath = path.resolve(__dirname, '../URAI-Jobs-Studio-Pack/seed/ats.roles.json');
const serviceAccountPath = path.resolve(__dirname, '../serviceAccount.json');

const seedData = require(seedDataPath);
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedJobPostings() {
  const jobPostingsCollection = db.collection('jobPostings');
  console.log('Starting to seed job postings into the \'jobPostings\' collection...');

  const batch = db.batch();

  for (const job of seedData.jobs) {
    const docRef = jobPostingsCollection.doc(job.id);
    batch.set(docRef, {
      title: job.title,
      status: job.status,
      team: job.team,
      location: job.location,
      compensation: job.compensation,
      description: job.description,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`- Staged job: ${job.id} (${job.title})`);
  }

  await batch.commit();

  console.log('\nSeeding complete! Your \'jobPostings\' collection is now populated.');
}

seedJobPostings().catch(error => {
  console.error('\nError seeding data:', error);
  console.error('Please ensure your serviceAccount.json file is correctly placed in the root directory and has the required permissions.');
  process.exit(1);
});
