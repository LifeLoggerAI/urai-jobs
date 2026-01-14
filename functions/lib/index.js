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
exports.__internalSmoke = exports.enqueue = exports.admin = exports.jobsTick = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const REGION = process.env.FUNCTION_REGION || "us-central1";
const COLLECTIONS = {
    jobs: "jobs",
    runs: "jobRuns",
    dlq: "jobDeadLetters",
    metrics: "jobMetrics",
    settings: "jobSettings",
};
const JobPayloadSchema = zod_1.z.object({
    type: zod_1.z.string().min(1).max(128),
    payload: zod_1.z.record(zod_1.z.unknown()).default({}),
    runAtMs: zod_1.z.number().int().nonnegative().optional(),
    delayMs: zod_1.z.number().int().nonnegative().optional(),
    maxAttempts: zod_1.z.number().int().min(1).max(50).optional(),
    idempotencyKey: zod_1.z.string().min(8).max(256).optional(),
});
function nowMs() { return Date.now(); }
function tsFromMs(ms) { return firestore_1.Timestamp.fromMillis(ms); }
function jitterMs(baseMs) {
    const span = Math.floor(baseMs * 0.25);
    const j = Math.floor(Math.random() * (span + 1));
    return baseMs + j;
}
function backoffDelayMs(attempt) {
    const base = 1500;
    const cap = 5 * 60 * 1000;
    const exp = Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
    return jitterMs(exp);
}
async function metricInc(name, incBy = 1) {
    const ref = db.collection(COLLECTIONS.metrics).doc(name);
    await ref.set({ name, count: firestore_1.FieldValue.increment(incBy), updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
}
async function getQueueState() {
    const ref = db.collection(COLLECTIONS.settings).doc("queue");
    const snap = await ref.get();
    const state = snap.exists ? snap.get("state") : undefined;
    return state === "paused" ? "paused" : "running";
}
async function setQueueState(state) {
    const ref = db.collection(COLLECTIONS.settings).doc("queue");
    await ref.set({ state, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
}
async function enqueueJob(input) {
    const parsed = JobPayloadSchema.parse(input);
    const createdAt = firestore_1.FieldValue.serverTimestamp();
    const maxAttempts = parsed.maxAttempts ?? 8;
    const runAtMs = parsed.runAtMs ??
        (parsed.delayMs ? (nowMs() + parsed.delayMs) : nowMs());
    const idempotencyKey = parsed.idempotencyKey;
    if (idempotencyKey) {
        const existing = await db.collection(COLLECTIONS.jobs)
            .where("idempotencyKey", "==", idempotencyKey)
            .where("status", "in", ["queued", "running", "succeeded"])
            .limit(1)
            .get();
        if (!existing.empty) {
            const doc = existing.docs[0];
            return { jobId: doc.id, deduped: true };
        }
    }
    const jobId = (0, uuid_1.v4)();
    const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
    await ref.create({
        jobId,
        type: parsed.type,
        payload: parsed.payload,
        status: "queued",
        createdAt,
        updatedAt: createdAt,
        runAt: tsFromMs(runAtMs),
        attempts: 0,
        maxAttempts,
        idempotencyKey: idempotencyKey ?? null,
        leaseUntil: tsFromMs(0),
        canceledReason: null,
        lastError: null,
        correlationId: (0, uuid_1.v4)(),
    });
    await metricInc("jobs_enqueued", 1);
    return { jobId, deduped: false };
}
async function cancelJob(jobId, reason) {
    const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
    await ref.set({ status: "canceled", canceledReason: reason, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    await metricInc("jobs_canceled", 1);
}
async function moveToDLQ(jobId, runId, err) {
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    const snap = await jobRef.get();
    const data = snap.data() || {};
    const dlqRef = db.collection(COLLECTIONS.dlq).doc(jobId);
    await dlqRef.set({
        jobId,
        runId,
        data,
        error: normalizeError(err),
        movedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    await jobRef.set({
        status: "dead",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        lastError: normalizeError(err),
    }, { merge: true });
    await metricInc("jobs_deadlettered", 1);
}
function normalizeError(err) {
    if (err instanceof Error) {
        return { name: err.name, message: err.message, stack: err.stack ?? null };
    }
    return { name: "Error", message: String(err), stack: null };
}
async function runHandler(type, payload, jobId, runId) {
    if (type === "noop")
        return;
    if (type === "smoke_success")
        return;
    if (type === "smoke_fail_once") {
        const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
        const snap = await ref.get();
        const attempts = snap.get("attempts") ?? 0;
        if (attempts <= 0) {
            throw new Error("Intentional first-attempt failure for retry validation.");
        }
        return;
    }
    throw new Error(`Unknown job type: ${type}`);
}
async function claimJobs(batchSize) {
    const state = await getQueueState();
    if (state === "paused")
        return [];
    const now = firestore_1.Timestamp.fromMillis(nowMs());
    const q = db.collection(COLLECTIONS.jobs)
        .where("status", "==", "queued")
        .where("runAt", "<=", now)
        .orderBy("runAt", "asc")
        .limit(batchSize);
    const snap = await q.get();
    const claimed = [];
    for (const doc of snap.docs) {
        const jobId = doc.id;
        const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
        const runId = (0, uuid_1.v4)();
        const leaseMs = 60_000;
        const ok = await db.runTransaction(async (tx) => {
            const s = await tx.get(ref);
            const status = s.get("status");
            if (status !== "queued")
                return false;
            const leaseUntil = s.get("leaseUntil");
            if (leaseUntil && leaseUntil.toMillis() > nowMs())
                return false;
            tx.set(ref, {
                status: "running",
                runId,
                leaseUntil: tsFromMs(nowMs() + leaseMs),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            const runRef = db.collection(COLLECTIONS.runs).doc(runId);
            tx.create(runRef, {
                runId,
                jobId,
                type: s.get("type"),
                startedAt: firestore_1.FieldValue.serverTimestamp(),
                status: "running",
                correlationId: s.get("correlationId") ?? (0, uuid_1.v4)(),
            });
            return true;
        }).catch(() => false);
        if (ok) {
            const s2 = await ref.get();
            claimed.push({
                jobId,
                type: s2.get("type") || "unknown",
                payload: s2.get("payload") || {},
                correlationId: s2.get("correlationId") || (0, uuid_1.v4)(),
            });
        }
    }
    return claimed;
}
async function finishJobSuccess(jobId, runId, startedMs) {
    const durMs = nowMs() - startedMs;
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    const runRef = db.collection(COLLECTIONS.runs).doc(runId);
    await Promise.all([
        jobRef.set({
            status: "succeeded",
            leaseUntil: tsFromMs(0),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            lastError: null,
            finishedAt: firestore_1.FieldValue.serverTimestamp(),
            latencyMs: durMs,
        }, { merge: true }),
        runRef.set({
            status: "succeeded",
            finishedAt: firestore_1.FieldValue.serverTimestamp(),
            latencyMs: durMs,
        }, { merge: true }),
        metricInc("jobs_succeeded", 1),
        metricInc("jobs_latency_ms_sum", durMs),
    ]);
}
async function finishJobFailure(jobId, runId, err) {
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    const runRef = db.collection(COLLECTIONS.runs).doc(runId);
    const snap = await jobRef.get();
    const attempts = (snap.get("attempts") ?? 0) + 1;
    const maxAttempts = snap.get("maxAttempts") ?? 8;
    await runRef.set({
        status: "failed",
        finishedAt: firestore_1.FieldValue.serverTimestamp(),
        error: normalizeError(err),
    }, { merge: true });
    if (attempts >= maxAttempts) {
        await moveToDLQ(jobId, runId, err);
        await metricInc("jobs_failed_final", 1);
        return;
    }
    const delay = backoffDelayMs(attempts);
    await jobRef.set({
        status: "queued",
        attempts,
        runAt: tsFromMs(nowMs() + delay),
        leaseUntil: tsFromMs(0),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        lastError: normalizeError(err),
        lastRetryDelayMs: delay,
    }, { merge: true });
    await metricInc("jobs_retried", 1);
}
exports.jobsTick = (0, scheduler_1.onSchedule)({ region: REGION, schedule: "every 1 minutes", timeZone: "UTC" }, async () => {
    const BATCH = 10;
    const claimed = await claimJobs(BATCH);
    if (claimed.length === 0)
        return;
    await metricInc("ticks_with_work", 1);
    for (const j of claimed) {
        const jobRef = db.collection(COLLECTIONS.jobs).doc(j.jobId);
        const snap = await jobRef.get();
        const runId = snap.get("runId") ?? (0, uuid_1.v4)();
        const startedMs = nowMs();
        const corr = snap.get("correlationId") ?? (0, uuid_1.v4)();
        console.log(JSON.stringify({ level: "info", msg: "job_start", jobId: j.jobId, runId, type: j.type, correlationId: corr }));
        try {
            await runHandler(j.type, j.payload, j.jobId, runId);
            await finishJobSuccess(j.jobId, runId, startedMs);
            console.log(JSON.stringify({ level: "info", msg: "job_success", jobId: j.jobId, runId, type: j.type, correlationId: corr }));
        }
        catch (e) {
            console.log(JSON.stringify({ level: "error", msg: "job_failure", jobId: j.jobId, runId, type: j.type, correlationId: corr, error: normalizeError(e) }));
            await finishJobFailure(j.jobId, runId, e);
        }
    }
});
const AdminActionSchema = zod_1.z.object({
    action: zod_1.z.enum(["pause", "resume", "cancel", "requeue_dlq"]),
    jobId: zod_1.z.string().uuid().optional(),
    reason: zod_1.z.string().min(1).max(512).optional(),
});
async function verifyAdmin(req) {
    const auth = req.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(auth);
    if (!m)
        return false;
    const token = m[1];
    const admin = await Promise.resolve().then(() => __importStar(require("firebase-admin/auth"))).then(m => m.getAuth());
    try {
        const decoded = await admin.verifyIdToken(token);
        return decoded.admin === true;
    }
    catch {
        return false;
    }
}
exports.admin = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const ok = await verifyAdmin(req);
    if (!ok) {
        res.status(403).send("Forbidden");
        return;
    }
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const parsed = AdminActionSchema.safeParse(body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { action, jobId, reason } = parsed.data;
    if (action === "pause") {
        await setQueueState("paused");
        res.json({ ok: true, state: "paused" });
        return;
    }
    if (action === "resume") {
        await setQueueState("running");
        res.json({ ok: true, state: "running" });
        return;
    }
    if (action === "cancel") {
        if (!jobId) {
            res.status(400).json({ error: "jobId required" });
            return;
        }
        await cancelJob(jobId, reason ?? "canceled_by_admin");
        res.json({ ok: true, jobId, status: "canceled" });
        return;
    }
    if (action === "requeue_dlq") {
        if (!jobId) {
            res.status(400).json({ error: "jobId required" });
            return;
        }
        const dlqRef = db.collection(COLLECTIONS.dlq).doc(jobId);
        const dlqSnap = await dlqRef.get();
        if (!dlqSnap.exists) {
            res.status(404).json({ error: "DLQ not found" });
            return;
        }
        const data = dlqSnap.get("data");
        const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
        await jobRef.set({
            ...data,
            status: "queued",
            attempts: 0,
            leaseUntil: tsFromMs(0),
            runAt: tsFromMs(nowMs()),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            lastError: null,
        }, { merge: true });
        await dlqRef.delete();
        await metricInc("jobs_dlq_requeued", 1);
        res.json({ ok: true, jobId, status: "queued" });
        return;
    }
    res.status(400).json({ error: "Unknown action" });
});
exports.enqueue = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const limitRef = db.collection(COLLECTIONS.metrics).doc("rate_limit_global");
    const now = nowMs();
    const windowMs = 5_000;
    const maxPerWindow = 50;
    const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(limitRef);
        const lastWindow = snap.get("windowStartMs") ?? 0;
        const count = snap.get("count") ?? 0;
        if (now - lastWindow > windowMs) {
            tx.set(limitRef, { windowStartMs: now, count: 1, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            return true;
        }
        if (count >= maxPerWindow)
            return false;
        tx.set(limitRef, { count: firestore_1.FieldValue.increment(1), updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        return true;
    });
    if (!ok) {
        res.status(429).json({ error: "rate_limited" });
        return;
    }
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const parsed = JobPayloadSchema.safeParse(body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const out = await enqueueJob(parsed.data);
    res.json({ ok: true, ...out });
});
exports.__internalSmoke = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    const enabled = process.env.URAI_JOBS_SMOKE_ENABLED === "1";
    if (!enabled) {
        res.status(403).send("disabled");
        return;
    }
    const want = process.env.URAI_JOBS_SMOKE_TOKEN || "";
    const got = req.get("x-smoke-token") || "";
    if (!want || got !== want) {
        res.status(403).send("forbidden");
        return;
    }
    const phase = String(req.query.phase || "success");
    const type = phase === "fail_once" ? "smoke_fail_once" : "smoke_success";
    const { jobId } = await enqueueJob({ type, payload: { phase }, maxAttempts: 4, delayMs: 0, idempotencyKey: `smoke_${phase}_${Date.now()}` });
    const started = nowMs();
    const timeoutMs = 120_000;
    while (nowMs() - started < timeoutMs) {
        const snap = await db.collection(COLLECTIONS.jobs).doc(jobId).get();
        const status = snap.get("status") ?? "queued";
        if (status === "succeeded") {
            res.json({ ok: true, jobId, status });
            return;
        }
        if (status === "dead") {
            res.status(500).json({ ok: false, jobId, status, lastError: snap.get("lastError") ?? null });
            return;
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    const s = await db.collection(COLLECTIONS.jobs).doc(jobId).get();
    res.status(504).json({ ok: false, jobId, status: s.get("status") ?? null });
});
//# sourceMappingURL=index.js.map