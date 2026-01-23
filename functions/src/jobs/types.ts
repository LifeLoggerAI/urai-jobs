
import { z } from 'zod';

// Job Types
export const JobTypeSchema = z.enum(['render', 'clip', 'analyze', 'notify']);
export type JobType = z.infer<typeof JobTypeSchema>;

// Job Status
export const JobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// Payloads for each job type
export const RenderPayloadSchema = z.object({
  sourceUrl: z.string().url(),
  resolution: z.enum(['1080p', '720p', '480p']),
});
export type RenderPayload = z.infer<typeof RenderPayloadSchema>;

export const ClipPayloadSchema = z.object({
  sourceUrl: z.string().url(),
  startTime: z.number().positive(),
  endTime: z.number().positive(),
});
export type ClipPayload = z.infer<typeof ClipPayloadSchema>;

export const AnalyzePayloadSchema = z.object({
  sourceUrl: z.string().url(),
  analysisType: z.enum(['sentiment', 'transcription']),
});
export type AnalyzePayload = z.infer<typeof AnalyzePayloadSchema>;

export const NotifyPayloadSchema = z.object({
  userId: z.string(),
  message: z.string(),
});
export type NotifyPayload = z.infer<typeof NotifyPayloadSchema>;

// The main Job schema
const BaseJobSchema = z.object({
  // jobId will be the document ID, so it is not in the schema for the document data.
  jobType: JobTypeSchema,
  status: JobStatusSchema,
  createdAt: z.any(), // Firestore server timestamp
  updatedAt: z.any(), // Firestore server timestamp
  retries: z.number().min(0).default(0),
  idempotencyKey: z.string().optional(),
});

export const JobSchema = z.discriminatedUnion('jobType', [
  BaseJobSchema.extend({
    jobType: z.literal('render'),
    payload: RenderPayloadSchema,
  }),
  BaseJobSchema.extend({
    jobType: z.literal('clip'),
    payload: ClipPayloadSchema,
  }),
  BaseJobSchema.extend({
    jobType: z.literal('analyze'),
    payload: AnalyzePayloadSchema,
  }),
  BaseJobSchema.extend({
    jobType: z.literal('notify'),
    payload: NotifyPayloadSchema,
  }),
]);
export type Job = z.infer<typeof JobSchema>;


// Job Audit Log Schema
export const JobAuditLogSchema = z.object({
    timestamp: z.any(), // Firestore server timestamp
    message: z.string(),
    statusChange: z.object({
        from: JobStatusSchema,
        to: JobStatusSchema,
    }).optional(),
});
export type JobAuditLog = z.infer<typeof JobAuditLogSchema>;

// Idempotency Key Schema
export const IdempotencyKeySchema = z.object({
    jobId: z.string(),
    createdAt: z.any(), // Firestore server timestamp
});
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

