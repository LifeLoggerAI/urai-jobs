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
const express = __importStar(require("express"));
const nanoid_1 = require("nanoid");
const firestore_1 = require("firebase-admin/firestore");
const jobs_1 = require("./types/jobs");
const firestore_2 = require("./firestore");
const audit_1 = require("./audit");
const app = express();
const authMiddleware = (req, res, next) => {
    const apiKey = req.get('x-urai-internal-key');
    if (apiKey && apiKey === process.env.URAI_INTERNAL_KEY) {
        next();
    }
    else {
        res.status(401).send('Unauthorized');
    }
};
app.use(authMiddleware);
app.post('/jobs/enqueue', async (req, res) => {
    try {
        const jobId = (0, nanoid_1.nanoid)();
        const job = {
            jobId,
            ...req.body,
            status: 'QUEUED',
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const validatedJob = jobs_1.JobSchema.parse(job);
        await (0, firestore_2.createJob)(validatedJob);
        await (0, audit_1.writeAuditEvent)({
            eventId: (0, nanoid_1.nanoid)(),
            jobId,
            at: firestore_1.Timestamp.now(),
            type: 'ENQUEUED',
            actor: { kind: 'api', id: 'enqueue' },
        });
        res.status(200).json({ ok: true, jobId });
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.get('/jobs/poll', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const kinds = req.query.kinds ? req.query.kinds.split(',') : [];
        const jobs = await (0, firestore_2.pollJobs)(limit, kinds);
        res.status(200).json({ ok: true, jobs });
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await (0, firestore_2.getJob)(jobId);
        if (job) {
            res.status(200).json({ ok: true, job });
        }
        else {
            res.status(404).json({ ok: false, error: 'Job not found' });
        }
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await (0, firestore_2.getJob)(jobId);
        if (!job) {
            return res.status(404).json({ ok: false, error: 'Job not found' });
        }
        await (0, firestore_2.updateJob)(jobId, { status: 'CANCELED' });
        await (0, audit_1.writeAuditEvent)({
            eventId: (0, nanoid_1.nanoid)(),
            jobId,
            at: firestore_1.Timestamp.now(),
            type: 'CANCELED',
            from: job.status,
            to: 'CANCELED',
            actor: { kind: 'api', id: 'cancel' },
        });
        res.status(200).json({ ok: true });
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.post('/jobs/:jobId/retry', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await (0, firestore_2.getJob)(jobId);
        if (!job) {
            return res.status(404).json({ ok: false, error: 'Job not found' });
        }
        if (job.status === 'FAILED' && job.attempt < job.maxAttempts) {
            await (0, firestore_2.updateJob)(jobId, { status: 'QUEUED', attempt: job.attempt + 1 });
            await (0, audit_1.writeAuditEvent)({
                eventId: (0, nanoid_1.nanoid)(),
                jobId,
                at: firestore_1.Timestamp.now(),
                type: 'RETRIED',
                from: job.status,
                to: 'QUEUED',
                actor: { kind: 'api', id: 'retry' },
            });
            const newJob = await (0, firestore_2.getJob)(jobId);
            res.status(200).json({ ok: true, job: newJob });
        }
        else {
            res.status(400).json({ ok: false, error: 'Job not eligible for retry' });
        }
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.post('/jobs/:jobId/lock', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { workerId, leaseMs } = req.body;
        const job = await (0, firestore_2.lockJob)(jobId, workerId, leaseMs);
        if (job) {
            await (0, audit_1.writeAuditEvent)({
                eventId: (0, nanoid_1.nanoid)(),
                jobId,
                at: firestore_1.Timestamp.now(),
                type: 'LOCKED',
                actor: { kind: 'worker', id: workerId },
            });
            res.status(200).json({ ok: true, job });
        }
        else {
            res.status(409).json({ ok: false, error: 'Could not lock job' });
        }
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.post('/jobs/:jobId/heartbeat', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { workerId, leaseMs } = req.body;
        const lockedUntil = await (0, firestore_2.heartbeatJob)(jobId, workerId, leaseMs);
        if (lockedUntil) {
            await (0, audit_1.writeAuditEvent)({
                eventId: (0, nanoid_1.nanoid)(),
                jobId,
                at: firestore_1.Timestamp.now(),
                type: 'HEARTBEAT',
                actor: { kind: 'worker', id: workerId },
            });
            res.status(200).json({ ok: true, lockedUntil });
        }
        else {
            res.status(409).json({ ok: false, error: 'Could not heartbeat job' });
        }
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
app.post('/jobs/:jobId/release', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { workerId } = req.body;
        await (0, firestore_2.releaseJob)(jobId, workerId);
        await (0, audit_1.writeAuditEvent)({
            eventId: (0, nanoid_1.nanoid)(),
            jobId,
            at: firestore_1.Timestamp.now(),
            type: 'RELEASED',
            actor: { kind: 'worker', id: workerId },
        });
        res.status(200).json({ ok: true });
    }
    catch (error) {
        res.status(400).json({ ok: false, error });
    }
});
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map