"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEventSchema = exports.ActorSchema = exports.AuditEventTypeSchema = exports.JobSchema = exports.ErrorSchema = exports.LeaseSchema = exports.JobKindSchema = exports.JobStatusSchema = void 0;
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
// Job Statuses
exports.JobStatusSchema = zod_1.z.enum([
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELED',
]);
// Job Kinds
exports.JobKindSchema = zod_1.z.enum(['clip_demo', 'replay', 'render']);
// Lease Schema
exports.LeaseSchema = zod_1.z.object({
    lockedBy: zod_1.z.string().optional(),
    lockedAt: zod_1.z.instanceof(firestore_1.Timestamp).optional(),
    lockedUntil: zod_1.z.instanceof(firestore_1.Timestamp).optional(),
});
// Error Schema
exports.ErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    stack: zod_1.z.string().optional(),
});
// Job Schema
exports.JobSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    kind: exports.JobKindSchema,
    status: exports.JobStatusSchema,
    priority: zod_1.z.number().default(50),
    attempt: zod_1.z.number().default(0),
    maxAttempts: zod_1.z.number().default(3),
    lease: exports.LeaseSchema.optional(),
    input: zod_1.z.object({}).passthrough(),
    output: zod_1.z.object({}).passthrough().optional(),
    error: exports.ErrorSchema.optional(),
    createdAt: zod_1.z.instanceof(firestore_1.Timestamp),
    updatedAt: zod_1.z.instanceof(firestore_1.Timestamp),
});
// Audit Event Types
exports.AuditEventTypeSchema = zod_1.z.enum([
    'ENQUEUED',
    'LOCKED',
    'HEARTBEAT',
    'RELEASED',
    'STATUS_CHANGED',
    'CANCELED',
    'RETRIED',
]);
// Actor Schema
exports.ActorSchema = zod_1.z.object({
    kind: zod_1.z.enum(['api', 'worker', 'system']),
    id: zod_1.z.string(),
});
// Audit Event Schema
exports.AuditEventSchema = zod_1.z.object({
    eventId: zod_1.z.string(),
    jobId: zod_1.z.string(),
    at: zod_1.z.instanceof(firestore_1.Timestamp),
    type: exports.AuditEventTypeSchema,
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    actor: exports.ActorSchema,
    note: zod_1.z.string().optional(),
    meta: zod_1.z.object({}).passthrough().optional(),
});
//# sourceMappingURL=jobs.js.map