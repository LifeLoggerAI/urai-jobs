"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobRef = jobRef;
exports.findByIdempotency = findByIdempotency;
exports.enqueue = enqueue;
exports.cancel = cancel;
exports.heartbeat = heartbeat;
exports.leaseOne = leaseOne;
exports.computeBackoffSeconds = computeBackoffSeconds;
exports.markRunning = markRunning;
exports.markSucceeded = markSucceeded;
exports.markFailedOrRetry = markFailedOrRetry;
const admin_1 = require("./admin");
const events_1 = require("./events");
const util_1 = require("./util");
const config_1 = require("./config");
function jobRef(jobId) {
    return (0, admin_1.db)().doc(`jobs/${jobId}`);
}
async function findByIdempotency(type, key) {
    const snap = await (0, admin_1.db)()
        .collection("jobs")
        .where("idempotencyKey", "==", key)
        .where("type", "==", type)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0];
}
async function enqueue(type, payload, createdBy, opts) {
    const idempotencyKey = opts?.idempotencyKey ? String(opts.idempotencyKey) : "";
    if (idempotencyKey) {
        const existing = await findByIdempotency(type, idempotencyKey);
        if (existing)
            return { jobId: existing.id, existed: true };
    }
    const jobId = (0, util_1.genId)("job");
    const now = (0, util_1.nowMs)();
    const scheduledForMs = opts?.scheduledForMs ? Number(opts.scheduledForMs) : NaN;
    const priority = Number.isFinite(Number(opts?.priority)) ? Number(opts.priority) : 0;
    const maxAttempts = Number.isFinite(Number(opts?.maxAttempts)) ? Number(opts.maxAttempts) : 5;
    const backoffSeconds = Number.isFinite(Number(opts?.backoffSeconds)) ? Number(opts.backoffSeconds) : 5;
    const tags = Array.isArray(opts?.tags) ? opts.tags.map(String).slice(0, 25) : [];
    const scheduled = Number.isFinite(scheduledForMs) && scheduledForMs > now + 1000;
    const status = scheduled ? "scheduled" : "queued";
    const nextAttemptAt = (0, admin_1.tsFromMs)(scheduled ? scheduledForMs : now);
    const doc = {
        type,
        status,
        payload: payload ?? null,
        createdAt: (0, admin_1.serverTimestamp)(),
        createdBy: createdBy ?? null,
        updatedAt: (0, admin_1.serverTimestamp)(),
        scheduledFor: scheduled ? (0, admin_1.tsFromMs)(scheduledForMs) : null,
        priority,
        attempts: 0,
        maxAttempts,
        backoffSeconds,
        nextAttemptAt,
        progress: 0,
        message: null,
        result: null,
        error: null,
        idempotencyKey: idempotencyKey || undefined,
        cancelledAt: null,
        cancelReason: null,
        tags,
        version: 1
    };
    await jobRef(jobId).set(doc, { merge: false });
    await (0, events_1.appendEvent)(jobId, "created", { status, type, priority, scheduledForMs: scheduled ? scheduledForMs : null });
    return { jobId, existed: false };
}
async function cancel(jobId, actor, reason) {
    const r = jobRef(jobId);
    const now = (0, util_1.nowMs)();
    return await (0, admin_1.db)().runTransaction(async (tx) => {
        const snap = await tx.get(r);
        if (!snap.exists)
            return { ok: false, code: "not_found" };
        const d = snap.data() || {};
        const s = String(d.status || "");
        if (["succeeded", "failed", "cancelled", "deadletter"].includes(s)) {
            return { ok: true, status: s, alreadyTerminal: true };
        }
        tx.update(r, {
            status: "cancelled",
            cancelledAt: (0, admin_1.tsFromMs)(now),
            cancelReason: reason ? String(reason).slice(0, 500) : null,
            leaseOwner: null,
            leaseExpiresAt: null,
            updatedAt: (0, admin_1.serverTimestamp)(),
            message: "cancelled"
        });
        return { ok: true, status: "cancelled", alreadyTerminal: false };
    }).then(async (res) => {
        if (res.ok)
            await (0, events_1.appendEvent)(jobId, "cancelled", { actor: actor ?? null, reason: reason ?? null });
        return res;
    });
}
async function heartbeat(jobId, leaseOwner) {
    const r = jobRef(jobId);
    const now = (0, util_1.nowMs)();
    const extendTo = (0, admin_1.tsFromMs)(now + (0, config_1.leaseSeconds)() * 1000);
    return await (0, admin_1.db)().runTransaction(async (tx) => {
        const snap = await tx.get(r);
        if (!snap.exists)
            return { ok: false, code: "not_found" };
        const d = snap.data() || {};
        if (String(d.leaseOwner || "") !== leaseOwner)
            return { ok: false, code: "not_owner" };
        tx.update(r, { leaseExpiresAt: extendTo, updatedAt: (0, admin_1.serverTimestamp)() });
        return { ok: true, leaseExpiresAtMs: now + (0, config_1.leaseSeconds)() * 1000 };
    });
}
async function leaseOne(leaseOwner) {
    const now = (0, util_1.nowMs)();
    const nowTs = (0, admin_1.tsFromMs)(now);
    const q = (0, admin_1.db)()
        .collection("jobs")
        .where("status", "in", ["queued", "retrying", "scheduled"])
        .where("nextAttemptAt", "<=", nowTs)
        .orderBy("nextAttemptAt", "asc")
        .orderBy("priority", "desc")
        .orderBy("createdAt", "asc")
        .limit(1);
    const snap = await q.get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    const r = doc.ref;
    const leaseExp = (0, admin_1.tsFromMs)(now + (0, config_1.leaseSeconds)() * 1000);
    const leased = await (0, admin_1.db)().runTransaction(async (tx) => {
        const cur = await tx.get(r);
        if (!cur.exists)
            return null;
        const d = cur.data() || {};
        const s = String(d.status || "");
        const nextAt = d.nextAttemptAt;
        if (!["queued", "retrying", "scheduled"].includes(s))
            return null;
        if (nextAt && nextAt.toMillis && nextAt.toMillis() > now)
            return null;
        tx.update(r, {
            status: "leased",
            leaseOwner,
            leaseExpiresAt: leaseExp,
            updatedAt: (0, admin_1.serverTimestamp)(),
            message: "leased"
        });
        return { jobId: cur.id };
    });
    if (!leased)
        return null;
    await (0, events_1.appendEvent)(leased.jobId, "leased", { leaseOwner, leaseExpiresAtMs: now + (0, config_1.leaseSeconds)() * 1000 });
    return leased.jobId;
}
function computeBackoffSeconds(attempt, base) {
    const cap = (0, config_1.backoffCapSeconds)();
    const a = Math.max(1, attempt);
    const b = Math.max(1, base);
    const exp = Math.min(cap, b * Math.pow(2, a - 1));
    const jitter = Math.floor(Math.random() * Math.min(30, exp * 0.25));
    return Math.min(cap, Math.floor(exp + jitter));
}
async function markRunning(jobId) {
    await jobRef(jobId).update({
        status: "running",
        updatedAt: (0, admin_1.serverTimestamp)(),
        message: "running"
    });
    await (0, events_1.appendEvent)(jobId, "running", {});
}
async function markSucceeded(jobId, result) {
    await jobRef(jobId).update({
        status: "succeeded",
        result: result ?? null,
        error: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        progress: 1,
        message: "succeeded",
        updatedAt: (0, admin_1.serverTimestamp)()
    });
    await (0, events_1.appendEvent)(jobId, "succeeded", {});
}
async function markFailedOrRetry(jobId, err) {
    const now = (0, util_1.nowMs)();
    const r = jobRef(jobId);
    const res = await (0, admin_1.db)().runTransaction(async (tx) => {
        const snap = await tx.get(r);
        if (!snap.exists)
            return { ok: false, code: "not_found" };
        const d = snap.data() || {};
        const s = String(d.status || "");
        if (s === "cancelled")
            return { ok: true, status: "cancelled" };
        const attempts = Number(d.attempts || 0) + 1;
        const maxAttempts = Number(d.maxAttempts || 5);
        const backoffBase = Number(d.backoffSeconds || 5);
        if (attempts >= maxAttempts) {
            tx.update(r, {
                status: "deadletter",
                attempts,
                error: err ?? { code: "unknown" },
                leaseOwner: null,
                leaseExpiresAt: null,
                message: "deadletter",
                updatedAt: (0, admin_1.serverTimestamp)()
            });
            return { ok: true, status: "deadletter", attempts };
        }
        const bo = computeBackoffSeconds(attempts, backoffBase);
        tx.update(r, {
            status: "retrying",
            attempts,
            error: err ?? { code: "unknown" },
            nextAttemptAt: (0, admin_1.tsFromMs)(now + bo * 1000),
            leaseOwner: null,
            leaseExpiresAt: null,
            message: "retrying",
            updatedAt: (0, admin_1.serverTimestamp)()
        });
        return { ok: true, status: "retrying", attempts, backoffSeconds: bo };
    });
    if (res.ok)
        await (0, events_1.appendEvent)(jobId, res.status, { attempts: res.attempts ?? null, err: err ?? null });
    return res;
}
//# sourceMappingURL=queue.js.map