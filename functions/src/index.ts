import * as admin from "firebase-admin";

admin.initializeApp();

// Triggers
export * from "./triggers/onJobWrite";
export * from "./triggers/onApplicationCreate";

// Callables
export * from "./callables/createResumeUpload";
export * from "./callables/adminSetApplicationStatus";

// Seed
import seed from "./seed";
import * as functions from "firebase-functions";

export const seedDatabase = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  try {
    await seed();
    res.status(200).send("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).send("Error seeding database");
  }
});
