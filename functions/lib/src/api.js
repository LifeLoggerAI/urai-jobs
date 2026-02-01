"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express = __importStar(require("express"));
const zod_1 = require("zod");
const app = express();
const db = admin.firestore();
// Zod schemas for validation
const JobSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    status: zod_1.z.enum(["active", "paused", "archived"]),
    priority: zod_1.z.number().int(),
    schedule: zod_1.z.string().nullable(),
    handler: zod_1.z.string(),
    inputSchemaVersion: zod_1.z.number().int(),
    defaultParams: zod_1.z.record(zod_1.z.any()),
    idempotencyPolicy: zod_1.z.enum(["byParamsHash", "manual"]),
    leaseSeconds: zod_1.z.number().int(),
    maxRetries: zod_1.z.number().int(),
    timeoutSeconds: zod_1.z.number().int(),
    tags: zod_1.z.array(zod_1.z.string()),
});
const EnqueueRunSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    params: zod_1.z.record(zod_1.z.any()).optional(),
});
// Middleware for admin access
const isAdmin = async (req, res, next) => {
    var _a;
    const idToken = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split('Bearer ')[1];
    if (!idToken) {
        res.status(401).send('Unauthorized');
        return;
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.role !== 'admin') {
            res.status(403).send('Forbidden');
            return;
        }
        next();
    }
    catch (error) {
        res.status(401).send('Unauthorized');
    }
};
app.post("/jobs", isAdmin, async (req, res) => {
    try {
        const jobData = JobSchema.parse(req.body);
        const job = await db.collection("jobs").add(Object.assign(Object.assign({}, jobData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: "admin" }));
        res.status(201).send({ id: job.id });
    }
    catch (error) {
        res.status(400).send(error);
    }
});
app.put("/jobs/:jobId", isAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobData = JobSchema.partial().parse(req.body);
        await db.collection("jobs").doc(jobId).update(Object.assign(Object.assign({}, jobData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        res.status(200).send({ id: jobId });
    }
    catch (error) {
        res.status(400).send(error);
    }
});
app.post("/jobs/:jobId/enqueue", isAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { params } = EnqueueRunSchema.parse(req.body);
        const jobDoc = await db.collection("jobs").doc(jobId).get();
        if (!jobDoc.exists) {
            res.status(404).send("Job not found");
            return;
        }
        const job = jobDoc.data();
        const runParams = Object.assign(Object.assign({}, job === null || job === void 0 ? void 0 : job.defaultParams), params);
        // This is a simplified version of the idempotency logic
        const paramsHash = ""; // crypto.createHash('sha256').update(JSON.stringify(runParams)).digest('hex');
        const run = await db.collection("jobRuns").add({
            jobId,
            status: "queued",
            queuedAt: admin.firestore.FieldValue.serverTimestamp(),
            attempt: 0,
            params: runParams,
            paramsHash,
            idempotencyKey: "", // Simplified
        });
        res.status(201).send({ id: run.id });
    }
    catch (error) {
        res.status(400).send(error);
    }
});
// Add other endpoints (listJobs, getJob, etc.) here
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=api.js.map