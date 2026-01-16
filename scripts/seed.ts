import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://<YOUR_PROJECT_ID>.firebaseio.com",
});

const db = admin.firestore();

async function seed() {
  // Create jobs
  const jobs = [
    {
      title: "Frontend Engineer",
      department: "Engineering",
      locationType: "remote",
      employmentType: "full_time",
      descriptionMarkdown: "...",
      requirements: ["React", "TypeScript"],
      niceToHave: ["Firebase"],
      status: "open",
    },
    {
      title: "Backend Engineer",
      department: "Engineering",
      locationType: "remote",
      employmentType: "full_time",
      descriptionMarkdown: "...",
      requirements: ["Node.js", "TypeScript"],
      niceToHave: ["Firebase"],
      status: "open",
    },
    {
      title: "Product Manager",
      department: "Product",
      locationType: "hybrid",
      locationText: "New York, NY",
      employmentType: "full_time",
      descriptionMarkdown: "...",
      requirements: ["Agile", "Jira"],
      niceToHave: ["Firebase"],
      status: "draft",
    },
  ];

  for (const job of jobs) {
    await db.collection("jobs").add(job);
  }

  // Create applicants
  const applicants = [
    {
      primaryEmail: "applicant1@example.com",
      name: "Applicant One",
    },
    {
      primaryEmail: "applicant2@example.com",
      name: "Applicant Two",
    },
  ];

  for (const applicant of applicants) {
    await db.collection("applicants").add(applicant);
  }

  // Create applications
  const applications = [
    {
      jobId: "<JOB_ID_1>",
      applicantId: "<APPLICANT_ID_1>",
      status: "NEW",
    },
    {
      jobId: "<JOB_ID_2>",
      applicantId: "<APPLICANT_ID_2>",
      status: "NEW",
    },
  ];

  for (const application of applications) {
    await db.collection("applications").add(application);
  }

  console.log("Seeding complete!");
}

seed();
