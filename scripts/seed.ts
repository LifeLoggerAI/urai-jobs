
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch } from 'firebase/firestore';

// TODO: Replace with your project's actual configuration
const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'your-auth-domain',
  projectId: 'your-project-id',
  storageBucket: 'your-storage-bucket',
  messagingSenderId: 'your-messaging-sender-id',
  appId: 'your-app-id',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  const batch = writeBatch(db);

  // Seed Jobs
  const jobsCol = collection(db, 'jobs');
  for (let i = 0; i < 5; i++) {
    const jobRef = doc(jobsCol);
    batch.set(jobRef, {
      title: `Job Title ${i}`,
      department: 'Engineering',
      locationType: 'remote',
      employmentType: 'full_time',
      descriptionMarkdown: `This is job ${i}`,
      requirements: ['Requirement 1', 'Requirement 2'],
      niceToHave: ['Nice to have 1', 'Nice to have 2'],
      status: i < 3 ? 'open' : 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Seed Applicants
  const applicantsCol = collection(db, 'applicants');
  for (let i = 0; i < 30; i++) {
    const applicantRef = doc(applicantsCol);
    batch.set(applicantRef, {
      primaryEmail: `applicant${i}@example.com`,
      name: `Applicant ${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    });
  }

  // Seed Applications
  const applicationsCol = collection(db, 'applications');
  for (let i = 0; i < 40; i++) {
    const applicationRef = doc(applicationsCol);
    batch.set(applicationRef, {
      jobId: `job${i % 5}`,
      applicantId: `applicant${i % 30}`,
      applicantEmail: `applicant${i % 30}@example.com`,
      status: 'NEW',
      submittedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Seed Referral Codes
  const referralsCol = collection(db, 'referrals');
  for (let i = 0; i < 5; i++) {
    const referralRef = doc(referralsCol);
    batch.set(referralRef, {
      code: `REF${i}`,
      createdBy: 'admin',
      createdAt: new Date(),
      clicksCount: 0,
      submitsCount: 0,
      active: true,
    });
  }

  // Seed Waitlist Entries
  const waitlistCol = collection(db, 'waitlist');
  for (let i = 0; i < 20; i++) {
    const waitlistRef = doc(waitlistCol);
    batch.set(waitlistRef, {
      email: `waitlist${i}@example.com`,
      name: `Waitlist User ${i}`,
      interests: ['Engineering', 'Product'],
      consent: { terms: true, marketing: false },
      createdAt: new Date(),
    });
  }

  await batch.commit();
  console.log('Seeding complete!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
});
