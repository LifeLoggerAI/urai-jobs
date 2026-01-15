"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onJobWrite = exports.cleanup = exports.processQueue = exports.jobHeartbeat = exports.cancelJob = exports.enqueueJob = exports.healthz = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const config_1 = require("./config");
const authz_1 = require("./authz");
const events_1 = require("./events");
const admin_1 = require("./admin");
const queue_1 = require("./queue");
const workers_1 = require("./workers");
const util_1 = require("./util");
(0, v2_1.setGlobalOptions)({
    region: (0, config_1.region)(),
    memory: "256MiB",
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 20
});
function ok(res, body) {
    res.status(200).set("content-type", "application/json").send(JSON.stringify(body));
}
function bad(res, code, body) {
    res.status(code).set("content-type", "application/json").send(JSON.stringify(body));
}
exports.healthz = (0, https_1.onRequest)(async (_req, res) => ok(res, { ok: true, service: "urai-jobs", ts: Date.now() }));
exports.enqueueJob = (0, https_1.onRequest)(async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST")
        return bad(res, 405, { ok: false, error: "method_not_allowed" });
    const tok = await (0, authz_1.verifyBearer)(req);
    const uid = tok?.uid || null;
    const body = req.body && typeof req.body === "object"
        ? req.body
        : (() => { try {
            return JSON.parse(String(req.body || "{}"));
        }
        catch {
            return {};
        } })();
    const type = String(body?.type || "");
    if (!type || type.length > 64)
        return bad(res, 400, { ok: false, error: "bad_type" });
    const payload = body?.payload ?? null;
    const opts = body?.opts ?? {};
    const out = await (0, queue_1.enqueue)(type, payload, uid, opts);
    await (0, events_1.audit)(uid, "enqueueJob", { type, jobId: out.jobId, existed: out.existed, idempotencyKey: opts?.idempotencyKey ?? null });
    ok(res, { ok: true, ...out });
});
exports.cancelJob = (0, https_1.onRequest)(async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST")
        return bad(res, 405, { ok: false, error: "method_not_allowed" });
    const tok = await (0, authz_1.verifyBearer)(req);
    const uid = tok?.uid || null;
    const body = req.body && typeof req.body === "object"
        ? req.body
        : (() => { try {
            return JSON.parse(String(req.body || "{}"));
        }
        catch {
            return {};
        } })();
    const jobId = String(body?.jobId || "");
    if (!jobId)
        return bad(res, 400, { ok: false, error: "missing_jobId" });
    if (!tok)
        return bad(res, 401, { ok: false, error: "unauthenticated" });
    const snap = await (0, admin_1.db)().doc(`jobs/${jobId}`).get();
    if (!snap.exists)
        return bad(res, 404, { ok: false, error: "not_found" });
    const owner = String(snap.data()?.createdBy || "");
    const admin = (0, authz_1.isAdminToken)(tok);
    if (!admin && owner !== uid)
        return bad(res, 403, { ok: false, error: "forbidden" });
    const reason = body?.reason ? String(body.reason) : null;
    const out = await (0, queue_1.cancel)(jobId, uid, reason);
    await (0, events_1.audit)(uid, "cancelJob", { jobId, ok: out.ok ?? false, status: out.status ?? null, reason });
    ok(res, out);
});
exports.jobHeartbeat = (0, https_1.onRequest)(async (req, res) => {
    if (String(req.method || "").toUpperCase() !== "POST")
        return bad(res, 405, { ok: false, error: "method_not_allowed" });
    const body = req.body && typeof req.body === "object"
        ? req.body
        : (() => { try {
            return JSON.parse(String(req.body || "{}"));
        }
        catch {
            return {};
        } })();
    const jobId = String(body?.jobId || "");
    const leaseOwner = String(body?.leaseOwner || "");
    if (!jobId || !leaseOwner)
        return bad(res, 400, { ok: false, error: "missing_fields" });
    const out = await (0, queue_1.heartbeat)(jobId, leaseOwner);
    ok(res, out);
});
async function dispatchOne(jobId, leaseOwner) {
    await (0, queue_1.markRunning)(jobId);
    const snap = await (0, admin_1.db)().doc(`jobs/${jobId}`).get();
    if (!snap.exists)
        return;
    const d = snap.data() || {};
    if (String(d.status || "") === "cancelled")
        return;
    const type = String(d.type || "");
    const payload = d.payload ?? null;
    try {
        const wr = await (0, workers_1.runWorker)(type, payload);
        if (wr.ok)
            await (0, queue_1.markSucceeded)(jobId, wr.result ?? null);
        else
            await (0, queue_1.markFailedOrRetry)(jobId, wr.error ?? { code: "worker_failed" });
    }
    catch (e) {
        v2_1.logger.error("dispatchOne_error", { jobId, leaseOwner, err: String(e?.message || e) });
        await (0, queue_1.markFailedOrRetry)(jobId, { code: "exception", message: String(e?.message || e) });
    }
}
exports.processQueue = (0, scheduler_1.onSchedule)("every 1 minutes", async () => {
    const leaseOwner = (0, util_1.genId)("lease");
    const caps = (0, config_1.concurrencyByType)();
    const maxN = (0, config_1.maxLeaseBatch)();
    const leased = [];
    for (let i = 0; i < maxN; i++) {
        const id = await (0, queue_1.leaseOne)(leaseOwner);
        if (!id)
            break;
        leased.push(id);
    }
    if (leased.length === 0) {
        v2_1.logger.info("processQueue_empty", { leaseOwner });
        return;
    }
    const cap = caps["default"] || 3;
    let idx = 0;
    const runners = Array.from({ length: Math.min(cap, leased.length) }).map(async () => {
        while (idx < leased.length) {
            const j = leased[idx++];
            await dispatchOne(j, leaseOwner);
        }
    });
    await Promise.all(runners);
    v2_1.logger.info("processQueue_done", { leaseOwner, leased: leased.length });
});
exports.cleanup = (0, scheduler_1.onSchedule)("every day 03:12", async () => {
    const now = Date.now();
    const cutoff = now - 7 * 24 * 3600 * 1000;
    const nowTs = (0, admin_1.tsFromMs)(now);
    const cutoffTs = (0, admin_1.tsFromMs)(cutoff);
    const expired = await (0, admin_1.db)()
        .collection("jobs")
        .where("status", "in", ["leased", "running"])
        .where("leaseExpiresAt", "<=", nowTs)
        .limit(200)
        .get();
    if (!expired.empty) {
        const batch = (0, admin_1.db)().batch();
        expired.docs.forEach((d) => {
            batch.update(d.ref, {
                status: "retrying",
                leaseOwner: null,
                leaseExpiresAt: null,
                nextAttemptAt: nowTs,
                updatedAt: (0, admin_1.serverTimestamp)(),
                message: "lease_expired_requeued"
            });
        });
        await batch.commit();
    }
    const audits = await (0, admin_1.db)().collection("auditLogs").where("createdAt", "<=", cutoffTs).limit(200).get();
    if (!audits.empty) {
        const b2 = (0, admin_1.db)().batch();
        audits.docs.forEach((d) => b2.delete(d.ref));
        await b2.commit();
    }
    v2_1.logger.info("cleanup_done", { expiredLeases: expired.size, prunedAudits: audits.size });
});
exports.onJobWrite = (0, firestore_1.onDocumentWritten)("jobs/{jobId}", async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const jobId = event.params.jobId;
    if (!after)
        return;
    const bStatus = String(before?.status || "");
    const aStatus = String(after?.status || "");
    if (bStatus !== aStatus) {
        await (0, events_1.audit)(null, "jobStatusChanged", { jobId, from: bStatus || null, to: aStatus || null });
    }
});
//# sourceMappingURL=api.js.map