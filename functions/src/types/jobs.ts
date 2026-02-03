
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

// Job Statuses
export const JobStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// Job Kinds
export const JobKindSchema = z.enum(['clip_demo', 'replay', 'render']);
export type JobKind = z.infer<typeof JobKindSchema>;

// Lease Schema
export const LeaseSchema = z.object({
  lockedBy: z.string().optional(),
  lockedAt: z.instanceof(Timestamp).optional(),
  lockedUntil: z.instanceof(Timestamp).optional(),
});
export type Lease = z.infer<typeof LeaseSchema>;

// Error Schema
export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().optional(),
});
export type Error = z.infer<typeof ErrorSchema>;

// Job Schema
export const JobSchema = z.object({
  jobId: z.string(),
  kind: JobKindSchema,
  status: JobStatusSchema,
  priority: z.number().default(50),
  attempt: z.number().default(0),
  maxAttempts: z.number().default(3),
  lease: LeaseSchema.optional(),
  input: z.object({}).passthrough(),
  output: z.object({}).passthrough().optional(),
  error: ErrorSchema.optional(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});
export type Job = z.infer<typeof JobSchema>;

// Audit Event Types
export const AuditEventTypeSchema = z.enum([
  'ENQUEUED',
  'LOCKED',
  'HEARTBEAT',
  'RELEASED',
  'STATUS_CHANGED',
  'CANCELED',
  'RETRIED',
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// Actor Schema
export const ActorSchema = z.object({
  kind: z.enum(['api', 'worker', 'system']),
  id: z.string(),
});
export type Actor = z.infer<typeof ActorSchema>;

// Audit Event Schema
export const AuditEventSchema = z.object({
  eventId: z.string(),
  jobId: z.string(),
  at: z.instanceof(Timestamp),
  type: AuditEventTypeSchema,
  from: z.string().optional(),
  to: z.string().optional(),
  actor: ActorSchema,
  note: z.string().optional(),
  meta: z.object({}).passthrough().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
