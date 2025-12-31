export interface Job {
    title: string;
    department: string;
    locationType: 'remote' | 'hybrid' | 'onsite';
    locationText: string;
    employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
    descriptionMarkdown: string;
    requirements: string[];
    niceToHave: string[];
    compensationRange?: { min?: number; max?: number; currency?: string };
    status: 'draft' | 'open' | 'paused' | 'closed';
    createdAt: any; // server timestamp
    updatedAt: any; // server timestamp
    createdBy: string; // uid
    stats?: {
        applicantsCount?: any; // FieldValue.increment
        statusCounts?: {
            NEW?: any; // FieldValue.increment
            SCREEN?: any; // FieldValue.increment
            INTERVIEW?: any; // FieldValue.increment
            OFFER?: any; // FieldValue.increment
            HIRED?: any; // FieldValue.increment
            REJECTED?: any; // FieldValue.increment
        }
    }
}

export interface Applicant {
    primaryEmail: string;
    name: string;
    phone?: string;
    links?: { portfolio?: string; linkedin?: string; github?: string; other?: string[] };
    source: { type: 'direct' | 'referral' | 'waitlist'; refCode?: string; campaign?: string };
    createdAt: any; // server timestamp
    updatedAt: any; // server timestamp
    lastActivityAt: any; // server timestamp
}

export interface Application {
    jobId: string;
    applicantId: string;
    applicantEmail: string;
    status: 'NEW' | 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
    answers: { [key: string]: string };
    resume?: { storagePath: string; filename: string; contentType: string; size: number };
    tags?: string[];
    notesCount?: number;
    submittedAt: any; // server timestamp
    updatedAt: any; // server timestamp
    internal?: { rating?: number; reviewerId?: string; reviewedAt?: any };
}
