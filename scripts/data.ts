
import { Timestamp } from 'firebase-admin/firestore';

export const jobs = [
  {
    "id": "job-1",
    "title": "Software Engineer, Frontend",
    "department": "Engineering",
    "locationType": "remote",
    "locationText": "Remote (US)",
    "employmentType": "full_time",
    "descriptionMarkdown": "Build and maintain our user-facing applications.",
    "requirements": ["React", "TypeScript", "CSS"],
    "niceToHave": ["Next.js", "GraphQL"],
    "compensationRange": { "min": 120000, "max": 160000, "currency": "USD" },
    "status": "open",
    "createdAt": Timestamp.now(),
    "updatedAt": Timestamp.now(),
    "createdBy": "user-1"
  },
  {
    "id": "job-2",
    "title": "Software Engineer, Backend",
    "department": "Engineering",
    "locationType": "remote",
    "locationText": "Remote (US)",
    "employmentType": "full_time",
    "descriptionMarkdown": "Build and maintain our server-side applications.",
    "requirements": ["Node.js", "TypeScript", "Firestore"],
    "niceToHave": ["Go", "gRPC"],
    "compensationRange": { "min": 120000, "max": 160000, "currency": "USD" },
    "status": "open",
    "createdAt": Timestamp.now(),
    "updatedAt": Timestamp.now(),
    "createdBy": "user-1"
  },
  {
    "id": "job-3",
    "title": "Product Manager",
    "department": "Product",
    "locationType": "hybrid",
    "locationText": "San Francisco, CA",
    "employmentType": "full_time",
    "descriptionMarkdown": "Own the product roadmap and strategy.",
    "requirements": ["Agile", "JIRA", "User Research"],
    "niceToHave": ["SQL", "Figma"],
    "status": "draft",
    "createdAt": Timestamp.now(),
    "updatedAt": Timestamp.now(),
    "createdBy": "user-1"
  },
  {
    "id": "job-4",
    "title": "Data Scientist",
    "department": "Data",
    "locationType": "onsite",
    "locationText": "New York, NY",
    "employmentType": "full_time",
    "descriptionMarkdown": "Analyze data and build models to drive business decisions.",
    "requirements": ["Python", "SQL", "Machine Learning"],
    "niceToHave": ["TensorFlow", "PyTorch"],
    "status": "open",
    "createdAt": Timestamp.now(),
    "updatedAt": Timestamp.now(),
    "createdBy": "user-1"
  },
  {
    "id": "job-5",
    "title": "Marketing Manager",
    "department": "Marketing",
    "locationType": "remote",
    "locationText": "Remote",
    "employmentType": "part_time",
    "descriptionMarkdown": "Develop and execute marketing campaigns.",
    "requirements": ["SEO", "SEM", "Google Analytics"],
    "niceToHave": ["HubSpot", "Salesforce"],
    "status": "closed",
    "createdAt": Timestamp.now(),
    "updatedAt": Timestamp.now(),
    "createdBy": "user-1"
  }
];

export const applicants = Array.from({ length: 30 }, (_, i) => ({
  "id": `applicant-${i + 1}`,
  "primaryEmail": `applicant${i + 1}@example.com`,
  "name": `Applicant ${i + 1}`,
  "phone": "123-456-7890",
  "links": {
    "portfolio": "https://example.com",
    "linkedin": "https://linkedin.com/in/example",
    "github": "https://github.com/example"
  },
  "source": { "type": "direct" },
  "createdAt": Timestamp.now(),
  "updatedAt": Timestamp.now(),
  "lastActivityAt": Timestamp.now()
}));

export const applications = Array.from({ length: 40 }, (_, i) => ({
  "id": `application-${i + 1}`,
  "jobId": `job-${(i % 5) + 1}`,
  "applicantId": `applicant-${(i % 30) + 1}`,
  "applicantEmail": `applicant${(i % 30) + 1}@example.com`,
  "status": "NEW",
  "answers": {
    "question-1": "Answer 1",
    "question-2": "Answer 2"
  },
  "resume": {
    "storagePath": "resumes/applicant-1/application-1/resume.pdf",
    "filename": "resume.pdf",
    "contentType": "application/pdf",
    "size": 123456
  },
  "tags": ["tag-1", "tag-2"],
  "notesCount": 0,
  "submittedAt": Timestamp.now(),
  "updatedAt": Timestamp.now()
}));

export const referrals = Array.from({ length: 5 }, (_, i) => ({
  "id": `referral-code-${i + 1}`,
  "code": `REF${i + 1}`,
  "createdBy": `user-${i + 1}`,
  "createdAt": Timestamp.now(),
  "clicksCount": 0,
  "submitsCount": 0,
  "active": true
}));

export const waitlist = Array.from({ length: 20 }, (_, i) => ({
  "id": `waitlist-${i + 1}`,
  "email": `waitlist${i + 1}@example.com`,
  "name": `Waitlist User ${i + 1}`,
  "interests": ["engineering", "product"],
  "consent": {
    "terms": true,
    "marketing": true
  },
  "createdAt": Timestamp.now()
}));

export const admins = [
  {
    "uid": "user-1",
    "role": "owner",
    "createdAt": Timestamp.now()
  },
  {
    "uid": "user-2",
    "role": "admin",
    "createdAt": Timestamp.now()
  }
];
