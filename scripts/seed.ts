
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
const serviceAccount = require("../../firebase-adminsdk.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seed() {
  // Create jobs
  const jobs = [
    {
      title: "Software Engineer",
      department: "Engineering",
      locationType: "remote",
      locationText: "Remote",
      employmentType: "full_time",
      descriptionMarkdown: "## About the role\n\nWe are looking for a passionate Software Engineer to join our team.",
      requirements: ["5+ years of experience", "Experience with React and Node.js"],
      niceToHave: ["Experience with Firebase"],
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "seed",
    },
    {
      title: "Product Manager",
      department: "Product",
      locationType: "hybrid",
      locationText: "San Francisco, CA",
      employmentType: "full_time",
      descriptionMarkdown: "## About the role\n\nWe are looking for a talented Product Manager to join our team.",
      requirements: ["3+ years of experience", "Experience with agile methodologies"],
      niceToHave: ["Experience with Figma"],
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "seed",
    },
  ];

  for (const job of jobs) {
    await db.collection("jobs").add(job);
  }

  console.log("Seeding complete!");
}

seed();
