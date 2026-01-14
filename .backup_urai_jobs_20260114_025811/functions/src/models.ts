import * as admin from 'firebase-admin';

// Re-export for convenience in other files
export type Timestamp = admin.firestore.Timestamp;
export const FieldValue = admin.firestore.FieldValue;

// 1. jobs/{jobId}
export interface Job {
  id?: string;
  title: string;
  department: string;
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: "draft" | "open" | "paused" | "closed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // uid
  stats?: {
    applicantCount: number;
    statusCounts: Record<Application['status'], number>;
  };
}

// 2. jobPublic/{jobId} - Public projection of a Job
export interface JobPublic extends Pick<
  Job,
  |'title'
  | 'department'
  | 'locationType'
  | 'locationText'
  | 'employmentType'
  | 'descriptionMarkdown'
  | 'requirements'
  | 'niceToHave'
  | 'compensationRange'
> {
  id?: string;
  status: 'open'; // Only open jobs are public
  updatedAt: Timestamp;
}

// 3. applicants/{applicantId}
export interface Applicant {
  id?: string;
  primaryEmail: string; // lowercased
  name: string;
  phone?: string;
  links?: {
    portfolio?: string;
    linkedin?: string;
    github?: string;
    other?: string[];
  };
  source: {
    type: "direct" | "referral" | "waitlist";
    refCode?: string;
    campaign?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}

// 4. applications/{applicationId}
export interface Application {
  id?: string;
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased, denormalized
  status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
  answers: Record<string, string>; // question -> answer
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags: string[];
  notesCount: number;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  internal?: {
    rating?: number;
    reviewerId?: string; // uid
    reviewedAt?: Timestamp;
  };
}

// 5. referrals/{refCode}
export interface Referral {
  id?: string;
  code: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

// 6. waitlist/{id}
export interface WaitlistEntry {
  id?: string;
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp;
}

// 7. admins/{uid}
export interface Admin {
  uid: string;
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp;
}

// 8. events/{eventId}
export interface TrackingEvent {
  id?: string;
  type: string; // e.g., 'page_view', 'apply_start'
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}
