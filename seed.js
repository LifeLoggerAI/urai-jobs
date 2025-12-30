const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const data = require('./seed/ats.sample.json');

admin.initializeApp();

const db = getFirestore();

async function seedDatabase() {
  const jobsCollection = db.collection('jobs');
  for (const job of data.jobs) {
    await jobsCollection.doc(job.id).set(job);
  }
}

seedDatabase().then(() => console.log('Database seeded successfully'));
