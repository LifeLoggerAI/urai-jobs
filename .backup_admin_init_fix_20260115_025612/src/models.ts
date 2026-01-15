import type { FieldValue, Timestamp } from "firebase-admin/firestore";

// 1. jobs/{jobId}
export interface Job {
  title: string;
  department: string;
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: { min?: number; max?: number; currency?: string };
  status: "draft" | "open" | "paused" | "closed";
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  createdBy: string; // UID
  stats?: {
    applicantsCount?: FieldValue | number;
    statusCounts?: {
      NEW?: FieldValue | number;
      SCREEN?: FieldValue | number;
      INTERVIEW?: FieldValue | number;
      OFFER?: FieldValue | number;
      HIRED?: FieldValue | number;
      REJECTED?: FieldValue | number;
    };
  };
}

// 2. jobPublic/{jobId}
export interface JobPublic {
  title: string;
  department: string;
  locationType: "remote" | "hybrid" | "onsite";
  locationText: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: { min?: number; max?: number; currency?: string };
  status: "open";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 3. applicants/{applicantId}
export interface Applicant {
  primaryEmail: string;
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
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  lastActivityAt: Timestamp | FieldValue;
}

// 4. applications/{applicationId}
export interface Application {
  source?: string;
  jobId: string;
  applicantId: string;
  applicantEmail: string;
  status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
  answers: Record<string, string>;
  resume?: {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
  };
  tags?: string[];
  notesCount?: number;
  submittedAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  internal?: {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: Timestamp;
  };
}

// 5. referrals/{refCode}
export interface Referral {
  code: string;
  createdBy: string; // UID
  createdAt: Timestamp | FieldValue;
  clicksCount: FieldValue | number;
  submitsCount: FieldValue | number;
  active: boolean;
}

// 6. waitlist/{id}
export interface Waitlist {
  email: string;
  name?: string;
  interests?: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp | FieldValue;
}

// 7. admins/{uid}
export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp | FieldValue;
}

// 8. events/{eventId}
export interface Event {
  type: string;
  entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp | FieldValue;
}

// For Job Queue System
export interface JobQueue {
  idempotencyKey: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  lease?: {
    ownerId: string;
    expiresAt: Timestamp;
  };
  attempts: number;
  lastAttemptAt?: Timestamp;
  nextAttemptAt?: Timestamp;
  payload: any;
  result?: any;
  error?: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface DeadLetterQueue extends JobQueue {
  originalJobId: string;
  failedAt: Timestamp;
}
