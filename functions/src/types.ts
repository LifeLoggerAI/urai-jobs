
import { z } from 'zod';

// C7: admins/{uid}
export const AdminDataSchema = z.object({
  role: z.enum(['owner', 'admin', 'reviewer']),
  createdAt: z.any(), // server timestamp
});
export type AdminData = z.infer<typeof AdminDataSchema>;

// C1: jobs/{jobId}
export const JobDataSchema = z.object({
  title: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  locationType: z.enum(['remote', 'hybrid', 'onsite']),
  locationText: z.string().min(1).max(100),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  descriptionMarkdown: z.string().min(1).max(5000),
  requirements: z.array(z.string().max(200)).max(20),
  niceToHave: z.array(z.string().max(200)).max(20),
  compensationRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
  status: z.enum(['draft', 'open', 'paused', 'closed']),
  createdBy: z.string(), // UID
  createdAt: z.any(), // server timestamp
  updatedAt: z.any(), // server timestamp
});
export type JobData = z.infer<typeof JobDataSchema>;

// C2: jobPublic/{jobId}
// This is a projection of JobData, so no schema needed for validation here.
// We'll define the type for convenience.
export type JobPublicData = Pick<JobData,
  | 'title'
  | 'department'
  | 'locationType'
  | 'locationText'
  | 'employmentType'
  | 'descriptionMarkdown'
  | 'requirements'
  | 'niceToHave'
  | 'compensationRange'
  | 'status'
> & {
  createdAt: any;
  updatedAt: any;
};


// C3: applicants/{applicantId}
export const ApplicantDataSchema = z.object({
  primaryEmail: z.string().email().toLowerCase(),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  links: z.object({
    portfolio: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
    other: z.array(z.string().url()).max(5).optional(),
  }).optional(),
  source: z.object({
    type: z.enum(['direct', 'referral', 'waitlist']),
    refCode: z.string().optional(),
    campaign: z.string().optional(),
  }),
  createdAt: z.any(), // server timestamp
  updatedAt: z.any(), // server timestamp
  lastActivityAt: z.any(), // server timestamp
});
export type ApplicantData = z.infer<typeof ApplicantDataSchema>;

// C4: applications/{applicationId}
export const ApplicationDataSchema = z.object({
  jobId: z.string(),
  applicantId: z.string(),
  applicantEmail: z.string().email().toLowerCase(),
  status: z.enum(['NEW', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']),
  answers: z.record(z.string(), z.string().max(5000)).optional(), // simple map for q->a
  resume: z.object({
    storagePath: z.string(),
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notesCount: z.number().default(0),
  submittedAt: z.any(), // server timestamp
  updatedAt: z.any(), // server timestamp
  internal: z.object({
    rating: z.number().min(1).max(5).optional(),
    reviewerId: z.string().optional(),
    reviewedAt: z.any().optional(),
  }).optional(),
});
export type ApplicationData = z.infer<typeof ApplicationDataSchema>;

// C5: referrals/{refCode}
export const ReferralDataSchema = z.object({
  code: z.string(),
  createdBy: z.string(), // UID
  createdAt: z.any(), // server timestamp
  clicksCount: z.number().default(0),
  submitsCount: z.number().default(0),
  active: z.boolean().default(true),
});
export type ReferralData = z.infer<typeof ReferralDataSchema>;

// C6: waitlist/{id}
export const WaitlistDataSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().optional(),
  interests: z.array(z.string().max(100)).max(10),
  consent: z.object({
    terms: z.boolean(),
    marketing: z.boolean(),
  }),
  createdAt: z.any(), // server timestamp
});
export type WaitlistData = z.infer<typeof WaitlistDataSchema>;

// C8: events/{eventId}
export const EventDataSchema = z.object({
  type: z.string(),
  entityType: z.enum(['job', 'applicant', 'application', 'referral', 'waitlist', 'page']),
  entityId: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.any(), // server timestamp
});
export type EventData = z.infer<typeof EventDataSchema>;
