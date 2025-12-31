import { firestore } from "firebase-admin";
import { Job, Applicant, Application, Referral, Waitlist, Admin } from "./types";

const seed = async () => {
  // Add your seed data here
  console.log("Seeding database...");

  // Example: Create a job
  const job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
    title: "Software Engineer",
    department: "Engineering",
    locationType: "remote",
    locationText: "Global",
    employmentType: "full_time",
    descriptionMarkdown: "## About the role\n\nWe are looking for a passionate Software Engineer to join our team.",
    requirements: ["5+ years of experience in software development", "Experience with React and Node.js"],
    niceToHave: ["Experience with Firebase", "Experience with GraphQL"],
    compensationRange: {
      min: 100000,
      max: 150000,
      currency: "USD",
    },
    status: "open",
  };

  const jobRef = await firestore().collection("jobs").add({
    ...job,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
    createdBy: "seed",
  });

  console.log(`Created job with ID: ${jobRef.id}`);
};

export default seed;
