import * as admin from "firebase-admin";

export type Timestamp = admin.firestore.Timestamp;

export type JobStatus = "draft" | "open" | "paused" | "closed";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type LocationType = "remote" | "hybrid" | "onsite";
export type ApplicationStatus =
  | "NEW"
  | "SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED";

export interface Job {
  title: string;
  department: string;
  locationType: LocationType;
  locationText: string;
  employmentType: EmploymentType;
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: JobStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // UID
  stats?: {
      applicantsCount?: number;
      statusCounts?: Record<ApplicationStatus, number>;
  }
}

export interface JobPublic {
    title: string;
    department: string;
    locationType: LocationType;
    locationText: string;
    employmentType: EmploymentType;
    descriptionMarkdown: string;
    requirements: string[];
    niceToHave: string[];
    compensationRange?: Job["compensationRange"];
    status: "open";
    updatedAt: Timestamp;
}


export interface Applicant {
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

export interface Application {
  jobId: string;
  applicantId: string;
  applicantEmail: string; // lowercased, denormalized
  status: ApplicationStatus;
  answers: Record<string, string>; // q -> a
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
    reviewerId?: string;
    reviewedAt?: Timestamp;
  };
}

export interface Referral {
  code: string;
  createdBy: string; // UID
  createdAt: Timestamp;
  clicksCount: number;
  submitsCount: number;
  active: boolean;
}

export interface Waitlist {
  email: string; // lowercased
  name?: string;
  interests: string[];
  consent: {
    terms: boolean;
    marketing: boolean;
  };
  createdAt: Timestamp;
}

export interface Admin {
  role: "owner" | "admin" | "reviewer";
  createdAt: Timestamp;
}

export type EventEntityType =
  | "job"
  | "applicant"
  | "application"
  | "referral"
  | "waitlist"
  | "page";

export interface Event {
  type: string;
  entityType: EventEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
