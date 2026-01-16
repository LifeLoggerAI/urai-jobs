export const jobs = [
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    department: 'Engineering',
    locationType: 'remote',
    locationText: 'Remote (US)',
    employmentType: 'full_time',
    descriptionMarkdown: 'This is a test job.',
    requirements: ['5+ years of experience', 'Experience with React'],
    niceToHave: ['Experience with Firebase'],
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'seed',
  },
];

export const applicants = [
  {
    id: 'test-applicant',
    primaryEmail: 'test@example.com',
    name: 'Test Applicant',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const applications = [
  {
    id: 'test-application',
    jobId: 'software-engineer',
    applicantId: 'test-applicant',
    applicantEmail: 'test@example.com',
    status: 'NEW',
    submittedAt: new Date(),
    updatedAt: new Date(),
  },
];

export const referrals = [];

export const waitlist = [];

export const admins = [
  {
    uid: 'test-admin',
    role: 'admin',
    createdAt: new Date(),
  },
];
