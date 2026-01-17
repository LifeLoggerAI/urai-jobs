import { Timestamp } from "firebase-admin/firestore";

// --- JOB QUEUE ENGINE TYPES (from original implementation) ---

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD" | "CANCELED";

export interface Job {
    type: string;
    status: JobStatus;
    priority: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    runAfter: Timestamp;
    attempts: number;
    maxAttempts: number;
    leaseOwner: string | null;
    leaseExpiresAt: Timestamp | null;
    lastError: {
        message: string;
        code?: string;
        stack?: string;
        at?: Timestamp;
    } | null;
    payload: object;
    idempotencyKey?: string;
}

export interface JobRun {
    startedAt: Timestamp;
    finishedAt: Timestamp | null;
    workerId: string;
    outcome: JobStatus | null;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    durationMs: number | null;
}

export interface DailyJobMetrics {
    counters: {
        enqueued: number;
        succeeded: number;
        failed: number;
        dead: number;
        canceled: number;
    };
    successDuration: {
        [jobType: string]: {
            totalDurationMs: number;
            count: number;
        };
    };
}


// --- URAI-JOBS ATS DATA MODEL ---

// A) Job Postings

export type JobPostingStatus = "draft" | "open" | "paused" | "closed";
export type LocationType = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export interface CompensationRange {
    min?: number;
    max?: number;
    currency?: string;
}

export interface JobPosting {
    // Core Details
    title: string;
    department: string;
    locationType: LocationType;
    locationText: string;
    employmentType: EmploymentType;
    descriptionMarkdown: string;

    // Requirements
    requirements: string[];
    niceToHave: string[];

    // Compensation
    compensationRange?: CompensationRange;

    // Metadata
    status: JobPostingStatus;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string; // UID of admin
}

// Publicly readable, simplified version of a JobPosting
export interface JobPublic {
    title: string;
    department: string;
    locationType: LocationType;
    locationText: string;
    employmentType: EmploymentType;
    descriptionMarkdown: string;
    requirements: string[];
    niceToHave: string[];
    compensationRange?: CompensationRange;
    status: "open"; // Only open jobs are public
    updatedAt: Timestamp;
}

// B) Applicants & Applications

export type ApplicationStatus = "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
export type ApplicantSourceType = "direct" | "referral" | "waitlist";

export interface ApplicantSource {
    type: ApplicantSourceType;
    refCode?: string;
    campaign?: string;
}

export interface ApplicantLinks {
    portfolio?: string;
    linkedin?: string;
    github?: string;
    other?: string[];
}

export interface Applicant {
    primaryEmail: string; // lowercased, serves as a potential ID
    name: string;
    phone?: string;
    links?: ApplicantLinks;
    source: ApplicantSource;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastActivityAt: Timestamp;
}

export interface Resume {
    storagePath: string;
    filename: string;
    contentType: string;
    size: number;
}

export interface ApplicationInternal {
    rating?: number;
    reviewerId?: string;
    reviewedAt?: Timestamp;
}

export interface Application {
    // Linking
    jobId: string;
    applicantId: string;
    applicantEmail: string; // denormalized for lookups

    // Core Data
    status: ApplicationStatus;
    answers: Record<string, string>; // Map of question keys to answers
    resume?: Resume;

    // Admin/Internal
    tags?: string[];
    notesCount?: number;
    internal?: ApplicationInternal;

    // Timestamps
    submittedAt: Timestamp;
    updatedAt: Timestamp;
}

// C) Referrals, Waitlist, Admins

export interface Referral {
    code: string;
    createdBy: string; // UID of admin/employee
    createdAt: Timestamp;
    clicksCount: number;
    submitsCount: number;
    active: boolean;
}

export interface WaitlistEntry {
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

// D) System Events for Tracking

export type EventType = "page_view" | "apply_start" | "apply_submit" | "waitlist_submit" | "referral_click" | "status_changed";
export type EntityType = "job" | "applicant" | "application" | "referral" | "waitlist" | "page";

export interface Event {
    type: EventType;
    entityType: EntityType;
    entityId: string;
    metadata?: Record<string, any>;
    createdAt: Timestamp;
}
