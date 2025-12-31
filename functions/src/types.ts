
import { Timestamp } from "firebase-admin/firestore";

export interface Job {
    id: string;
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
    createdBy: string; // UID of the admin who created the job
}

export interface JobPublic {
    id: string;
    title: string;
    department: string;
    locationType: "remote" | "hybrid" | "onsite";
    locationText: string;
    employmentType: "full_time" | "part_time" | "contract" | "intern";
    descriptionMarkdown: string;
    requirements: string[];
    niceToHave: string[];
}

export interface Applicant {
    id: string;
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
    id: string;
    jobId: string;
    applicantId: string;
    applicantEmail: string; // lowercased and denormalized for lookups
    status: "NEW" | "SCREEN" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
    answers: Record<string, string>;
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
    id: string;
    code: string;
    createdBy: string; // UID
    createdAt: Timestamp;
    clicksCount: number;
    submitsCount: number;
    active: boolean;
}

export interface Waitlist {
    id: string;
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
    id: string;
    role: "owner" | "admin" | "reviewer";
    createdAt: Timestamp;
}

export interface Event {
    id: string;
    type: string;
    entityType: "job" | "applicant" | "application" | "referral" | "waitlist" | "page";
    entityId: string;
    metadata: Record<string, any>;
    createdAt: Timestamp;
}
