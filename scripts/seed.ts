import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp({ projectId: "urai-jobs" });

const db = admin.firestore();

async function seed() {
    console.log("Seeding database...");

    // 1. Admins
    await db.collection("admins").doc("test-admin").set({
        role: "owner",
        createdAt: new Date(),
    });

    // 2. Jobs
    const jobs = [
        { title: "Software Engineer", department: "Engineering", locationType: "remote", status: "open" },
        { title: "Product Manager", department: "Product", locationType: "hybrid", locationText: "New York, NY", status: "open" },
        { title: "Designer", department: "Design", locationType: "onsite", locationText: "San Francisco, CA", status: "draft" },
    ];
    for (const job of jobs) {
        await db.collection("jobs").add({
            ...job,
            employmentType: "full_time",
            descriptionMarkdown: "Lorem ipsum dolor sit amet...",
            requirements: ["Requirement 1", "Requirement 2"],
            niceToHave: ["Nice to have 1", "Nice to have 2"],
            compensationRange: { min: 100000, max: 150000, currency: "USD" },
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: "test-admin",
            stats: { applicantsCount: 0, statusCounts: { NEW: 0, SCREEN: 0, INTERVIEW: 0, OFFER: 0, HIRED: 0, REJECTED: 0 } },
        });
    }

    // 3. Applicants, Applications, Waitlist, Referrals
    // ... (omitted for brevity, but would be implemented similarly)

    console.log("Seeding complete.");
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
