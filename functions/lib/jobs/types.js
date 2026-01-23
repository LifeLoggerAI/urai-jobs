"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyKeySchema = exports.JobAuditLogSchema = exports.JobSchema = exports.NotifyPayloadSchema = exports.AnalyzePayloadSchema = exports.ClipPayloadSchema = exports.RenderPayloadSchema = exports.JobStatusSchema = exports.JobTypeSchema = void 0;
const zod_1 = require("zod");
// Job Types
exports.JobTypeSchema = zod_1.z.enum(['render', 'clip', 'analyze', 'notify']);
// Job Status
exports.JobStatusSchema = zod_1.z.enum(['pending', 'processing', 'completed', 'failed']);
// Payloads for each job type
exports.RenderPayloadSchema = zod_1.z.object({
    sourceUrl: zod_1.z.string().url(),
    resolution: zod_1.z.enum(['1080p', '720p', '480p']),
});
exports.ClipPayloadSchema = zod_1.z.object({
    sourceUrl: zod_1.z.string().url(),
    startTime: zod_1.z.number().positive(),
    endTime: zod_1.z.number().positive(),
});
exports.AnalyzePayloadSchema = zod_1.z.object({
    sourceUrl: zod_1.z.string().url(),
    analysisType: zod_1.z.enum(['sentiment', 'transcription']),
});
exports.NotifyPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    message: zod_1.z.string(),
});
// The main Job schema
const BaseJobSchema = zod_1.z.object({
    // jobId will be the document ID, so it is not in the schema for the document data.
    jobType: exports.JobTypeSchema,
    status: exports.JobStatusSchema,
    createdAt: zod_1.z.any(), // Firestore server timestamp
    updatedAt: zod_1.z.any(), // Firestore server timestamp
    retries: zod_1.z.number().min(0).default(0),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.JobSchema = zod_1.z.discriminatedUnion('jobType', [
    BaseJobSchema.extend({
        jobType: zod_1.z.literal('render'),
        payload: exports.RenderPayloadSchema,
    }),
    BaseJobSchema.extend({
        jobType: zod_1.z.literal('clip'),
        payload: exports.ClipPayloadSchema,
    }),
    BaseJobSchema.extend({
        jobType: zod_1.z.literal('analyze'),
        payload: exports.AnalyzePayloadSchema,
    }),
    BaseJobSchema.extend({
        jobType: zod_1.z.literal('notify'),
        payload: exports.NotifyPayloadSchema,
    }),
]);
// Job Audit Log Schema
exports.JobAuditLogSchema = zod_1.z.object({
    timestamp: zod_1.z.any(), // Firestore server timestamp
    message: zod_1.z.string(),
    statusChange: zod_1.z.object({
        from: exports.JobStatusSchema,
        to: exports.JobStatusSchema,
    }).optional(),
});
// Idempotency Key Schema
exports.IdempotencyKeySchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    createdAt: zod_1.z.any(), // Firestore server timestamp
});
//# sourceMappingURL=types.js.map