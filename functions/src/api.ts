import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { region, concurrencyByType, maxLeaseBatch } from "./config";
import { verifyBearer, isAdminToken } from "./authz";
import { audit } from "./events";
import { db, tsFromMs, serverTimestamp } from "./admin";
import { enqueue, cancel, heartbeat, leaseOne, markRunning, markSucceeded, markFailedOrRetry } from "./queue";
import { runWorker } from "./workers";
import { genId } from "./util";

setGlobalOptions({
  region: region(),
  memory: "256MiB",
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 20
});

function ok(res: any, body: any) {
  res.status(200).set("content-type","application/json").send(JSON.stringify(body));
}

function bad(res: any, code: number, body: any) {
  res.status(code).set("content-type","application/json").send(JSON.stringify(body));
}

export const healthz = onRequest(async (_req, res) => ok(res, { ok: true, service: "urai-jobs", ts: Date.now() }));

export const enqueueJob = onRequest(async (req, res) => {
  if (String(req.method || "").toUpperCase() !== "POST") return bad(res, 405, { ok: false, error: "method_not_allowed" });
  const tok = await verifyBearer(req);
  const uid = tok?.uid || null;

  const body: any = (req as any).body && typeof (req as any).body === "object"
    ? (req as any).body
    : (() => { try { return JSON.parse(String((req as any).body || "{}")); } catch { return {}; } })();

  const type = String(body?.type || "");
  if (!type || type.length > 64) return bad(res, 400, { ok: false, error: "bad_type" });

  const payload = body?.payload ?? null;
  const opts = body?.opts ?? {};
  const out = await enqueue(type, payload, uid, opts);
  await audit(uid, "enqueueJob", { type, jobId: out.jobId, existed: out.existed, idempotencyKey: opts?.idempotencyKey ?? null });
  ok(res, { ok: true, ...out });
});

export const cancelJob = onRequest(async (req, res) => {
  if (String(req.method || "").toUpperCase() !== "POST") return bad(res, 405, { ok: false, error: "method_not_allowed" });

  const tok = await verifyBearer(req);
  const uid = tok?.uid || null;

  const body: any = (req as any).body && typeof (req as any).body === "object"
    ? (req as any).body
    : (() => { try { return JSON.parse(String((req as any).body || "{}")); } catch { return {}; } })();

  const jobId = String(body?.jobId || "");
  if (!jobId) return bad(res, 400, { ok: false, error: "missing_jobId" });
  if (!tok) return bad(res, 401, { ok: false, error: "unauthenticated" });

  const snap = await db().doc(`jobs/${jobId}`).get();
  if (!snap.exists) return bad(res, 404, { ok: false, error: "not_found" });

  const owner = String((snap.data() as any)?.createdBy || "");
  const admin = isAdminToken(tok);
  if (!admin && owner !== uid) return bad(res, 403, { ok: false, error: "forbidden" });

  const reason = body?.reason ? String(body.reason) : null;
  const out = await cancel(jobId, uid, reason);
  await audit(uid, "cancelJob", { jobId, ok: (out as any).ok ?? false, status: (out as any).status ?? null, reason });
  ok(res, out);
});

export const jobHeartbeat = onRequest(async (req, res) => {
  if (String(req.method || "").toUpperCase() !== "POST") return bad(res, 405, { ok: false, error: "method_not_allowed" });

  const body: any = (req as any).body && typeof (req as any).body === "object"
    ? (req as any).body
    : (() => { try { return JSON.parse(String((req as any).body || "{}")); } catch { return {}; } })();

  const jobId = String(body?.jobId || "");
  const leaseOwner = String(body?.leaseOwner || "");
  if (!jobId || !leaseOwner) return bad(res, 400, { ok: false, error: "missing_fields" });
  const out = await heartbeat(jobId, leaseOwner);
  ok(res, out);
});

async function dispatchOne(jobId: string, leaseOwner: string) {
  await markRunning(jobId);
  const snap = await db().doc(`jobs/${jobId}`).get();
  if (!snap.exists) return;

  const d: any = snap.data() || {};
  if (String(d.status || "") === "cancelled") return;

  const type = String(d.type || "");
  const payload = d.payload ?? null;

  try {
    const wr = await runWorker(type, payload);
    if (wr.ok) await markSucceeded(jobId, wr.result ?? null);
    else await markFailedOrRetry(jobId, wr.error ?? { code: "worker_failed" });
  } catch (e: any) {
    logger.error("dispatchOne_error", { jobId, leaseOwner, err: String(e?.message || e) });
    await markFailedOrRetry(jobId, { code: "exception", message: String(e?.message || e) });
  }
}

export const processQueue = onSchedule("every 1 minutes", async () => {
  const leaseOwner = genId("lease");
  const caps = concurrencyByType();
  const maxN = maxLeaseBatch();

  const leased: string[] = [];
  for (let i = 0; i < maxN; i++) {
    const id = await leaseOne(leaseOwner);
    if (!id) break;
    leased.push(id);
  }

  if (leased.length === 0) {
    logger.info("processQueue_empty", { leaseOwner });
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
  logger.info("processQueue_done", { leaseOwner, leased: leased.length });
});

export const cleanup = onSchedule("every day 03:12", async () => {
  const now = Date.now();
  const cutoff = now - 7 * 24 * 3600 * 1000;
  const nowTs = tsFromMs(now);
  const cutoffTs = tsFromMs(cutoff);

  const expired = await db()
    .collection("jobs")
    .where("status", "in", ["leased", "running"])
    .where("leaseExpiresAt", "<=", nowTs)
    .limit(200)
    .get();

  if (!expired.empty) {
    const batch = db().batch();
    expired.docs.forEach((d) => {
      batch.update(d.ref, {
        status: "retrying",
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: nowTs,
        updatedAt: serverTimestamp(),
        message: "lease_expired_requeued"
      });
    });
    await batch.commit();
  }

  const audits = await db().collection("auditLogs").where("createdAt", "<=", cutoffTs).limit(200).get();
  if (!audits.empty) {
    const b2 = db().batch();
    audits.docs.forEach((d) => b2.delete(d.ref));
    await b2.commit();
  }

  logger.info("cleanup_done", { expiredLeases: expired.size, prunedAudits: audits.size });
});

export const onJobWrite = onDocumentWritten("jobs/{jobId}", async (event) => {
  const before = event.data?.before?.data() as any;
  const after = event.data?.after?.data() as any;
  const jobId = event.params.jobId as string;

  if (!after) return;

  const bStatus = String(before?.status || "");
  const aStatus = String(after?.status || "");
  if (bStatus !== aStatus) {
    await audit(null, "jobStatusChanged", { jobId, from: bStatus || null, to: aStatus || null });
  }
});
