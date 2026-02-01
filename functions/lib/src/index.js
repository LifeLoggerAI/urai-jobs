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
exports.getRun = exports.listRuns = exports.getJob = exports.listJobs = exports.enqueueRun = exports.createJob = exports.taskExecuteRun = exports.health = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const zod_1 = require("zod");
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
// const tasksClient = new admin.tasks.CloudTasksClient(); // Cloud Tasks are not available in the emulator
// ---- UTILS & HELPERS ----
const getRole = async (uid) => {
    var _a, _b, _c;
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            const bootstrapAdminUid = (_a = functions.config().urai_jobs) === null || _a === void 0 ? void 0 : _a.bootstrap_admin_uid;
            if (bootstrapAdminUid && uid === bootstrapAdminUid) {
                await db.collection('users').doc(uid).set({ role: 'admin' });
                return 'admin';
            }
            return null;
        }
        return (_c = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.role) !== null && _c !== void 0 ? _c : null;
    }
    catch (error) {
        functions.logger.error("Error getting user role", { uid, error });
        return null;
    }
};
const assertRole = async (context, requiredRoles) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }
    const role = await getRole(context.auth.uid);
    if (!role || !requiredRoles.includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to perform this action.');
    }
    return { uid: context.auth.uid, role };
};
const createAuditLog = async (actorId, action, target, changes = {}) => {
    const auditEntry = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actorId,
        action,
        target,
        changes,
    };
    await db.collection('jobAudit').add(auditEntry);
};
// ---- HTTP FUNCTIONS ----
exports.health = functions.https.onRequest(async (req, res) => {
    try {
        await db.collection('health_check').doc('ping').set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
        await db.collection('health_check').doc('ping').get();
        res.status(200).json({
            status: 'ok',
            firestore: 'read/write successful',
            version: process.env.npm_package_version || 'unknown',
            env: process.env.NODE_ENV,
        });
    }
    catch (error) {
        functions.logger.error("Health check failed", { error });
        res.status(500).json({ status: 'error', message: 'Health check failed.' });
    }
});
// Worker function (to be triggered by Cloud Tasks in production)
exports.taskExecuteRun = functions.https.onRequest(async (req, res) => {
    const { runId } = req.body;
    if (!runId) {
        res.status(400).send('Missing runId');
        return;
    }
    const runRef = db.collection('jobRuns').doc(runId);
    try {
        await db.runTransaction(async (transaction) => {
            const runDoc = await transaction.get(runRef);
            if (!runDoc.exists) {
                throw new Error('Run not found');
            }
            const run = runDoc.data();
            if (run.status !== 'queued') {
                throw new Error('Run is not in queued state');
            }
            transaction.update(runRef, {
                status: 'running',
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 2000));
        await runRef.update({
            status: 'succeeded',
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            'metrics.durationMs': 2000,
        });
        res.status(200).send(`Run ${runId} executed successfully`);
    }
    catch (error) {
        functions.logger.error(`Failed to execute run ${runId}`, { error });
        await runRef.update({
            status: 'failed',
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            error: { message: error.message },
        });
        res.status(500).send(`Failed to execute run ${runId}`);
    }
});
// ---- CALLABLE FUNCTIONS ----
const CreateJobSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(100),
    description: zod_1.z.string().max(5000),
    handler: zod_1.z.enum(["assetFactoryRender", "analyticsBackfill", "noop"]),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    idempotencyPolicy: zod_1.z.enum(["byParamsHash", "manual"]).optional(),
    leaseSeconds: zod_1.z.number().int().positive().optional(),
    maxRetries: zod_1.z.number().int().min(0).optional(),
    timeoutSeconds: zod_1.z.number().int().positive().optional(),
});
exports.createJob = functions.https.onCall(async (data, context) => {
    const { uid } = await assertRole(context, ['admin']);
    const validation = CreateJobSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid job data.', validation.error.format());
    }
    const jobRef = db.collection('jobs').doc();
    const newJob = {
        name: validation.data.name,
        description: validation.data.description,
        handler: validation.data.handler,
        status: "active",
        priority: 100,
        schedule: null,
        inputSchemaVersion: 1,
        defaultParams: {},
        createdBy: uid,
        tags: validation.data.tags || [],
        idempotencyPolicy: validation.data.idempotencyPolicy || "byParamsHash",
        leaseSeconds: validation.data.leaseSeconds || 300,
        maxRetries: validation.data.maxRetries || 3,
        timeoutSeconds: validation.data.timeoutSeconds || 600,
    };
    await jobRef.set(Object.assign(Object.assign({}, newJob), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
    await createAuditLog(uid, 'job.create', { type: 'job', id: jobRef.id }, { newJob });
    return { id: jobRef.id };
});
const EnqueueRunSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    params: zod_1.z.record(zod_1.z.any()).optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.enqueueRun = functions.https.onCall(async (data, context) => {
    const { uid } = await assertRole(context, ['admin', 'operator']);
    const validation = EnqueueRunSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid run data.', validation.error.format());
    }
    const { jobId, params, idempotencyKey: manualIdempotencyKey } = validation.data;
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Job not found.');
    }
    const job = jobDoc.data();
    const runParams = Object.assign(Object.assign({}, job.defaultParams), params);
    const paramsHash = crypto.createHash('sha256').update(JSON.stringify(runParams)).digest('hex');
    const idempotencyKey = job.idempotencyPolicy === 'manual' ? manualIdempotencyKey : paramsHash;
    if (!idempotencyKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Idempotency key is required for this job.');
    }
    const existingRuns = await db.collection('jobRuns')
        .where('jobId', '==', jobId)
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();
    if (!existingRuns.empty) {
        const existingRunId = existingRuns.docs[0].id;
        return { runId: existingRunId, status: 'alreadyExists' };
    }
    const runRef = db.collection('jobRuns').doc();
    const newRun = {
        id: runRef.id,
        jobId,
        status: 'queued',
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: null,
        finishedAt: null,
        attempt: 0,
        params: runParams,
        paramsHash,
        idempotencyKey,
        leaseExpiresAt: null,
        workerId: null,
        error: null,
        metrics: null,
        logRef: `/jobRunLogs/${runRef.id}`,
        artifactRefs: [],
    };
    await runRef.set(newRun);
    // In a real scenario, we'd use Cloud Tasks here.
    // For the emulator, we'll just log that we would have enqueued it.
    functions.logger.info("Task for run would be enqueued here.", { runId: runRef.id });
    await createAuditLog(uid, 'run.enqueue', { type: 'jobRun', id: runRef.id }, { jobId });
    return { runId: runRef.id, status: 'queued' };
});
exports.listJobs = functions.https.onCall(async (data, context) => {
    await assertRole(context, ['admin', 'operator', 'viewer']);
    const snapshot = await db.collection('jobs').get();
    return snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
});
exports.getJob = functions.https.onCall(async (data, context) => {
    await assertRole(context, ['admin', 'operator', 'viewer']);
    const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(data);
    const doc = await db.collection('jobs').doc(id).get();
    return Object.assign({ id: doc.id }, doc.data());
});
exports.listRuns = functions.https.onCall(async (data, context) => {
    await assertRole(context, ['admin', 'operator', 'viewer']);
    const { jobId } = zod_1.z.object({ jobId: zod_1.z.string() }).parse(data);
    const snapshot = await db.collection('jobRuns').where('jobId', '==', jobId).get();
    return snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
});
exports.getRun = functions.https.onCall(async (data, context) => {
    await assertRole(context, ['admin', 'operator', 'viewer']);
    const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(data);
    const doc = await db.collection('jobRuns').doc(id).get();
    return Object.assign({ id: doc.id }, doc.data());
});
//# sourceMappingURL=index.js.map