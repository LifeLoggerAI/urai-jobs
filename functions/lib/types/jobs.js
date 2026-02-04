"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobSchema = void 0;
const zod_1 = require("zod");
exports.JobSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    kind: zod_1.z.string(),
    status: zod_1.z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"]),
    priority: zod_1.z.number(),
    attempt: zod_1.z.number(),
    maxAttempts: zod_1.z.number(),
    input: zod_1.z.any(),
    output: zod_1.z.any().optional(),
    lockedUntil: zod_1.z.date().optional(),
    lockedBy: zod_1.z.string().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
//# sourceMappingURL=jobs.js.map