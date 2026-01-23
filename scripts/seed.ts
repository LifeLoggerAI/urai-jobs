
import * as admin from "firebase-admin";
import { faker } from "@faker-js/faker";

// Initialize Firebase Admin SDK
const serviceAccount = require("../firebase-adminsdk.json"); // Replace with your service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "http://127.0.0.1:9099", // Firestore emulator URL
});

const db = admin.firestore();

db.settings({ host: "localhost:8080", ssl: false });

const seedDatabase = async () => {
  console.log("Seeding database...");

  // Clear existing data
  await Promise.all([
    db.collection("jobs").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
    db.collection("jobPublic").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
    db.collection("applicants").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
    db.collection("applications").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
    db.collection("referrals").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
    db.collection("waitlist").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
    db.collection("admins").get().then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete())),
  ]);

  // Seed Admins
  const adminUid = "test-admin-uid";
  await db.collection("admins").doc(adminUid).set({
    role: "owner",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Seed Jobs
  const jobs = [];
  for (let i = 0; i < 5; i++) {
    const job = {
      title: faker.person.jobTitle(),
      department: faker.commerce.department(),
      locationType: faker.helpers.arrayElement(["remote", "hybrid", "onsite"]),
      employmentType: faker.helpers.arrayElement(["full_time", "part_time", "contract"]),
      descriptionMarkdown: faker.lorem.paragraphs(3),
      requirements: [faker.lorem.sentence(), faker.lorem.sentence()],
      niceToHave: [faker.lorem.sentence()],
      status: faker.helpers.arrayElement(["open", "draft", "closed"]),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUid,
      stats: { applicantsCount: 0, statusCounts: { NEW: 0, SCREEN: 0, INTERVIEW: 0, OFFER: 0, HIRED: 0, REJECTED: 0 } },
    };
    const jobRef = await db.collection("jobs").add(job);
    jobs.push({ id: jobRef.id, ...job });
  }

  // Seed Applicants
  const applicants = [];
  for (let i = 0; i < 30; i++) {
    const applicant = {
      primaryEmail: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      links: { linkedin: `https://linkedin.com/in/${faker.internet.userName()}` },
      source: { type: "direct" },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const applicantRef = await db.collection("applicants").add(applicant);
    applicants.push({ id: applicantRef.id, ...applicant });
  }

  // Seed Applications
  for (let i = 0; i < 40; i++) {
    const applicant = faker.helpers.arrayElement(applicants);
    const job = faker.helpers.arrayElement(jobs.filter(j => j.status === "open"));

    if (job) {
      const application = {
        jobId: job.id,
        applicantId: applicant.id,
        applicantEmail: applicant.primaryEmail,
        status: faker.helpers.arrayElement(["NEW", "SCREEN", "INTERVIEW"]),
        answers: { q1: faker.lorem.sentence() },
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("applications").add(application);

      // Update job stats
      const jobRef = db.collection("jobs").doc(job.id);
      await jobRef.update({
        "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
        [`stats.statusCounts.${application.status}`]: admin.firestore.FieldValue.increment(1),
      });
    }
  }

  // Seed Referrals
  for (let i = 0; i < 5; i++) {
    await db.collection("referrals").add({
      code: faker.lorem.slug(1),
      createdBy: adminUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clicksCount: faker.number.int({ min: 0, max: 100 }),
      submitsCount: faker.number.int({ min: 0, max: 20 }),
      active: true,
    });
  }

  // Seed Waitlist
  for (let i = 0; i < 20; i++) {
    await db.collection("waitlist").add({
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      interests: [faker.person.jobArea(), faker.person.jobArea()],
      consent: { terms: true, marketing: faker.datatype.boolean() },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log("Database seeded successfully.");
};

seedDatabase().catch(error => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
