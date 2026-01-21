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
exports.JobEngine = void 0;
const admin = __importStar(require("firebase-admin"));
const tasks_1 = require("@google-cloud/tasks");
const zod_1 = require("zod");
const backoff_1 = require("./lib/backoff");
const claim_1 = require("./lib/claim");
const handlers_1 = require("../../functions/src/handlers");
const logger_1 = require("./lib/logger");
const envSchema = zod_1.z.object({
    GCLOUD_PROJECT: zod_1.z.string(),
    QUEUE_LOCATION: zod_1.z.string().default('us-central1'),
    QUEUE_ID: zod_1.z.string().default('urai-jobs'),
});
const env = envSchema.parse(process.env);
const RUN_JOB_URL = `https://us-central1-${env.GCLOUD_PROJECT}.cloudfunctions.net/runJob`;
class JobEngine {
    firestore = admin.firestore();
    tasksClient = new tasks_1.CloudTasksClient();
    async enqueue(type, payload, options) {
        const idempotencyKey = options.idempotencyKey;
        const jobRef = this.firestore.collection('jobs').doc(`${type}-${idempotencyKey}`);
        try {
            const job = await this.firestore.runTransaction(async (transaction) => {
                const doc = await transaction.get(jobRef);
                if (doc.exists) {
                    return doc.data();
                }
                const newJob = {
                    type,
                    status: 'queued',
                    priority: 0,
                    attempt: 0,
                    maxAttempts: 8,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    scheduledFor: options.scheduledFor,
                    idempotencyKey,
                    payload,
                    traceId: crypto.randomUUID(),
                    lockedBy: null,
                    leaseUntil: null,
                };
                transaction.create(jobRef, newJob);
                return newJob;
            });
            const task = {
                httpRequest: {
                    httpMethod: 'POST',
                    url: RUN_JOB_URL,
                    body: Buffer.from(JSON.stringify({ jobId: jobRef.id })).toString('base64'),
                    headers: { 'Content-Type': 'application/json' },
                    oidcToken: {
                        serviceAccountEmail: `${env.GCLOUD_PROJECT}@appspot.gserviceaccount.com`,
                    },
                },
                scheduleTime: options.scheduledFor ? { seconds: Math.floor(options.scheduledFor.getTime() / 1000) } : undefined,
            };
            const parent = this.tasksClient.queuePath(env.GCLOUD_PROJECT, env.QUEUE_LOCATION, env.QUEUE_ID);
            await this.tasksClient.createTask({ parent, task });
            return job;
        }
        catch (error) {
            console.error('Error enqueuing job:', error);
            throw error;
        }
    }
    async getJob(jobId) {
        const jobRef = this.firestore.collection('jobs').doc(jobId);
        const doc = await jobRef.get();
        return doc.data();
    }
    async cancelJob(jobId) {
        const jobRef = this.firestore.collection('jobs').doc(jobId);
        await jobRef.update({ status: 'canceled', updatedAt: new Date() });
    }
    async runJob(jobId) {
        const jobRef = this.firestore.collection('jobs').doc(jobId);
        const job = await (0, claim_1.claimJob)(this.firestore, jobRef);
        if (!job) {
            return;
        }
        (0, logger_1.log)('info', 'starting job', job);
        const handler = handlers_1.handlers[job.type];
        if (!handler) {
            (0, logger_1.log)('error', 'no handler for job type', job);
            throw new Error(`No handler for job type ${job.type}`);
        }
        try {
            handler.payload.parse(job.payload);
        }
        catch (error) {
            (0, logger_1.log)('error', 'invalid payload', job, { error: error.format() });
            await (0, claim_1.releaseJob)(this.firestore, jobRef, 'deadletter', { error: error.format() });
            return;
        }
        const runRef = this.firestore.collection('jobRuns').doc();
        await runRef.set({
            jobId,
            type: job.type,
            attempt: job.attempt,
            startedAt: new Date(),
            status: 'running',
            worker: `worker-${process.pid}`,
            traceId: job.traceId,
        });
        try {
            const result = await handler.handler(job.payload);
            (0, logger_1.log)('info', 'job succeeded', job);
            await (0, claim_1.releaseJob)(this.firestore, jobRef, 'succeeded', { result });
            await runRef.update({ status: 'succeeded', endedAt: new Date(), metrics: { durationMs: 0, coldStart: false } });
        }
        catch (error) {
            (0, logger_1.log)('error', 'job failed', job, { error: error.message });
            const nextAttempt = job.attempt + 1;
            if (nextAttempt >= job.maxAttempts) {
                await (0, claim_1.releaseJob)(this.firestore, jobRef, 'deadletter', { error: error.message });
                await runRef.update({ status: 'deadletter', endedAt: new Date(), error: error.message });
            }
            else {
                const scheduledFor = new Date(Date.now() + (0, backoff_1.backoff)(nextAttempt));
                await (0, claim_1.releaseJob)(this.firestore, jobRef, 'queued', { error: error.message, attempt: nextAttempt, scheduledFor });
                await runRef.update({ status: 'failed', endedAt: new Date(), error: error.message });
            }
        }
    }
    async listJobs(status, type) {
        let query = this.firestore.collection('jobs').where('status', '==', status);
        if (type) {
            query = query.where('type', '==', type);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
    }
    async requeueJob(jobId) {
        const jobRef = this.firestore.collection('jobs').doc(jobId);
        const doc = await jobRef.get();
        const job = doc.data();
        if (job.status !== 'deadletter') {
            throw new Error('Only deadlettered jobs can be requeued');
        }
        await jobRef.update({ status: 'queued', attempt: 0, updatedAt: new Date() });
    }
    async getJobRuns(jobId) {
        const snapshot = await this.firestore.collection('jobRuns').where('jobId', '==', jobId).get();
        return snapshot.docs.map(doc => doc.data());
    }
}
exports.JobEngine = JobEngine;
