import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK
const serviceAccount = require("../../serviceAccount.json"); // Adjust the path to your service account key
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const seed = async () => {
  console.log("Seeding database...");

  // Clear existing data
  await clearCollection("jobs");
  await clearCollection("jobPublic");
  await clearCollection("applicants");
  await clearCollection("applications");
  await clearCollection("referrals");
  await clearCollection("waitlist");

  // Seed jobs
  const jobs = [
    {
      title: "Senior Frontend Engineer",
      department: "Engineering",
      locationType: "remote",
      locationText: "Remote (US)",
      employmentType: "full_time",
      descriptionMarkdown: "...",
      requirements: ["React", "TypeScript", "GraphQL"],
      niceToHave: ["Next.js", "Apollo"],
      status: "open",
    },
    {
      title: "Product Manager",
      department: "Product",
      locationType: "hybrid",
      locationText: "San Francisco, CA",
      employmentType: "full_time",
      descriptionMarkdown: "...",
      requirements: ["Agile", "JIRA", "User Research"],
      niceToHave: ["SQL", "Figma"],
      status: "open",
    },
    {
      title: "Marketing Intern",
      department: "Marketing",
      locationType: "onsite",
      locationText: "New York, NY",
      employmentType: "intern",
      descriptionMarkdown: "...",
      requirements: ["Social Media", "Mailchimp"],
      niceToHave: ["Canva"],
      status: "draft",
    },
  ];

  for (const job of jobs) {
    await db.collection("jobs").add({
      ...job,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "seed",
    });
  }

  // Seed other collections as needed (applicants, applications, etc.)
  // ...

  console.log("Seeding complete!");
};

const clearCollection = async (collectionPath: string) => {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Cleared collection: ${collectionPath}`);
};

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
