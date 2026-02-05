
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';

// Initialize Firebase Admin SDK
initializeApp({
  projectId: 'urai-4dc1d',
});

const db = getFirestore();
const auth = getAuth();

const sha256 = (input: string) => crypto.createHash('sha256').update(input).digest('hex');

const clearCollection = async (collectionPath: string) => {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Cleared collection: ${collectionPath}`);
};

const seed = async () => {
  console.log('Clearing existing data...');
  await Promise.all([
    clearCollection('admins'),
    clearCollection('jobs'),
    clearCollection('jobPublic'),
    clearCollection('applicants'),
    clearCollection('applications'),
    clearCollection('referrals'),
    clearCollection('waitlist'),
    clearCollection('events'),
  ]);

  console.log('Seeding database...');

  // Create Admins
  const adminUIDs = ['Wg2d0d5R1XgXr4a3X1A4E7qJ2f3'];
  for (const uid of adminUIDs) {
    await db.collection('admins').doc(uid).set({
      role: 'admin',
      createdAt: new Date(),
    });
    console.log(`Created admin with UID: ${uid}`);
  }

  // Create Jobs
  const jobs = [
    {
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      locationType: 'remote',
      locationText: 'Remote',
      employmentType: 'full_time',
      descriptionMarkdown: '## About the Role\n\nWe are looking for a talented Senior Frontend Engineer to join our team and help us build the future of URAI-Jobs.',
      requirements: ['5+ years of experience with React', 'TypeScript', 'CSS-in-JS'],
      niceToHave: ['Experience with GraphQL', 'Next.js'],
      compensationRange: { min: 120000, max: 160000, currency: 'USD' },
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminUIDs[0],
    },
    {
      title: 'Backend Engineer',
      department: 'Engineering',
      locationType: 'hybrid',
      locationText: 'San Francisco, CA',
      employmentType: 'full_time',
      descriptionMarkdown: '## About the Role\n\nWe are looking for a skilled Backend Engineer to help us build and maintain our server-side applications.',
      requirements: ['3+ years of experience with Node.js', 'Experience with Firestore'],
      niceToHave: ['Experience with GraphQL'],
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminUIDs[0],
    },
    {
      title: 'Product Manager',
      department: 'Product',
      locationType: 'onsite',
      locationText: 'New York, NY',
      employmentType: 'full_time',
      descriptionMarkdown: '## About the Role\n\nWe are looking for a talented Product Manager to lead the development of our core products.',
      requirements: ['5+ years of experience in product management', 'Excellent communication skills'],
      niceToHave: ['Experience in the HR tech space'],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminUIDs[0],
    },
  ];

  const jobIds: string[] = [];
  for (const job of jobs) {
    const jobRef = await db.collection('jobs').add(job);
    jobIds.push(jobRef.id);
    console.log(`Created job with ID: ${jobRef.id}`);
  }

  // Create Applicants
  const applicants = [
    {
      primaryEmail: 'applicant1@example.com',
      name: 'Applicant One',
      phone: '123-456-7890',
      links: {
        portfolio: 'https://example.com',
        linkedin: 'https://linkedin.com/in/applicantone',
      },
      source: { type: 'direct' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    },
    {
      primaryEmail: 'applicant2@example.com',
      name: 'Applicant Two',
      source: { type: 'referral', refCode: 'referral-code' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    },
  ];

  const applicantIds: string[] = [];
  for (const applicant of applicants) {
    const applicantId = sha256(applicant.primaryEmail);
    await db.collection('applicants').doc(applicantId).set(applicant);
    applicantIds.push(applicantId);
    console.log(`Created applicant with ID: ${applicantId}`);
  }

  // Create Applications
  const applications = [
    {
      jobId: jobIds[0], 
      applicantId: applicantIds[0],
      applicantEmail: 'applicant1@example.com',
      status: 'NEW',
      answers: {
        'Why do you want to work here?': 'I am passionate about your mission.',
      },
      submittedAt: new Date(),
      updatedAt: new Date(),
    },
    {
      jobId: jobIds[1], 
      applicantId: applicantIds[1],
      applicantEmail: 'applicant2@example.com',
      status: 'NEW',
      answers: {
        'Why do you want to work here?': 'I am excited about the opportunity to contribute to your team.',
      },
      submittedAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const application of applications) {
    await db.collection('applications').add(application);
    console.log(`Created application for: ${application.applicantEmail}`);
  }

  // Create Referral Codes
  const referralCodes = [
    {
      code: 'referral-code',
      createdBy: adminUIDs[0],
      createdAt: new Date(),
      clicksCount: 0,
      submitsCount: 0,
      active: true,
    },
  ];

  for (const referralCode of referralCodes) {
    await db.collection('referrals').doc(referralCode.code).set(referralCode);
    console.log(`Created referral code: ${referralCode.code}`);
  }

  // Create Waitlist Entries
  const waitlistEntries = [
    {
      email: 'waitlist1@example.com',
      name: 'Waitlist User One',
      interests: ['engineering', 'product'],
      consent: { terms: true, marketing: true },
      createdAt: new Date(),
    },
    {
      email: 'waitlist2@example.com',
      name: 'Waitlist User Two',
      interests: ['design'],
      consent: { terms: true, marketing: false },
      createdAt: new Date(),
    },
  ];

  for (const entry of waitlistEntries) {
    await db.collection('waitlist').add(entry);
    console.log(`Created waitlist entry for: ${entry.email}`);
  }

  console.log('Database seeding complete!');
};

seed().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
