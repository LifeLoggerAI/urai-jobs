import { db, serverTimestamp, tsFromMs } from "./admin";
import { appendEvent } from "./events";
import { genId, nowMs } from "./util";
import { backoffCapSeconds, leaseSeconds } from "./config";
import type { JobDoc, JobStatus } from "./types";

export function jobRef(jobId: string) {
  return db().doc(`jobs/${jobId}`);
}

export async function findByIdempotency(type: string, key: string) {
  const snap = await db()
    .collection("jobs")
    .where("idempotencyKey", "==", key)
    .where("type", "==", type)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

export async function enqueue(type: string, payload: any, createdBy: string | null, opts: any) {
  const idempotencyKey = opts?.idempotencyKey ? String(opts.idempotencyKey) : "";
  if (idempotencyKey) {
    const existing = await findByIdempotency(type, idempotencyKey);
    if (existing) return { jobId: existing.id, existed: true };
  }

  const jobId = genId("job");
  const now = nowMs();
  const scheduledForMs = opts?.scheduledForMs ? Number(opts.scheduledForMs) : NaN;
  const priority = Number.isFinite(Number(opts?.priority)) ? Number(opts.priority) : 0;
  const maxAttempts = Number.isFinite(Number(opts?.maxAttempts)) ? Number(opts.maxAttempts) : 5;
  const backoffSeconds = Number.isFinite(Number(opts?.backoffSeconds)) ? Number(opts.backoffSeconds) : 5;
  const tags = Array.isArray(opts?.tags) ? opts.tags.map(String).slice(0, 25) : [];

  const scheduled = Number.isFinite(scheduledForMs) && scheduledForMs > now + 1000;
  const status: JobStatus = scheduled ? "scheduled" : "queued";
  const nextAttemptAt = tsFromMs(scheduled ? scheduledForMs : now);

  const doc: JobDoc = {
    type,
    status,
    payload: payload ?? null,
    createdAt: serverTimestamp(),
    createdBy: createdBy ?? null,
    updatedAt: serverTimestamp(),
    scheduledFor: scheduled ? tsFromMs(scheduledForMs) : null,
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
  await appendEvent(jobId, "created", { status, type, priority, scheduledForMs: scheduled ? scheduledForMs : null });
  return { jobId, existed: false };
}

export async function cancel(jobId: string, actor: string | null, reason: string | null) {
  const r = jobRef(jobId);
  const now = nowMs();
  return await db().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists) return { ok: false, code: "not_found" };
    const d: any = snap.data() || {};
    const s = String(d.status || "");
    if (["succeeded","failed","cancelled","deadletter"].includes(s)) {
      return { ok: true, status: s, alreadyTerminal: true };
    }
    tx.update(r, {
      status: "cancelled",
      cancelledAt: tsFromMs(now),
      cancelReason: reason ? String(reason).slice(0, 500) : null,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: serverTimestamp(),
      message: "cancelled"
    });
    return { ok: true, status: "cancelled", alreadyTerminal: false };
  }).then(async (res) => {
    if ((res as any).ok) await appendEvent(jobId, "cancelled", { actor: actor ?? null, reason: reason ?? null });
    return res;
  });
}

export async function heartbeat(jobId: string, leaseOwner: string) {
  const r = jobRef(jobId);
  const now = nowMs();
  const extendTo = tsFromMs(now + leaseSeconds() * 1000);
  return await db().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists) return { ok: false, code: "not_found" };
    const d: any = snap.data() || {};
    if (String(d.leaseOwner || "") !== leaseOwner) return { ok: false, code: "not_owner" };
    tx.update(r, { leaseExpiresAt: extendTo, updatedAt: serverTimestamp() });
    return { ok: true, leaseExpiresAtMs: now + leaseSeconds() * 1000 };
  });
}

export async function leaseOne(leaseOwner: string) {
  const now = nowMs();
  const nowTs = tsFromMs(now);

  const q = db()
    .collection("jobs")
    .where("status", "in", ["queued", "retrying", "scheduled"])
    .where("nextAttemptAt", "<=", nowTs)
    .orderBy("nextAttemptAt", "asc")
    .orderBy("priority", "desc")
    .orderBy("createdAt", "asc")
    .limit(1);

  const snap = await q.get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const r = doc.ref;
  const leaseExp = tsFromMs(now + leaseSeconds() * 1000);

  const leased = await db().runTransaction(async (tx) => {
    const cur = await tx.get(r);
    if (!cur.exists) return null;
    const d: any = cur.data() || {};
    const s = String(d.status || "");
    const nextAt = d.nextAttemptAt;
    if (!["queued", "retrying", "scheduled"].includes(s)) return null;
    if (nextAt && nextAt.toMillis && nextAt.toMillis() > now) return null;

    tx.update(r, {
      status: "leased",
      leaseOwner,
      leaseExpiresAt: leaseExp,
      updatedAt: serverTimestamp(),
      message: "leased"
    });
    return { jobId: cur.id };
  });

  if (!leased) return null;
  await appendEvent(leased.jobId, "leased", { leaseOwner, leaseExpiresAtMs: now + leaseSeconds() * 1000 });
  return leased.jobId;
}

export function computeBackoffSeconds(attempt: number, base: number) {
  const cap = backoffCapSeconds();
  const a = Math.max(1, attempt);
  const b = Math.max(1, base);
  const exp = Math.min(cap, b * Math.pow(2, a - 1));
  const jitter = Math.floor(Math.random() * Math.min(30, exp * 0.25));
  return Math.min(cap, Math.floor(exp + jitter));
}

export async function markRunning(jobId: string) {
  await jobRef(jobId).update({
    status: "running",
    updatedAt: serverTimestamp(),
    message: "running"
  });
  await appendEvent(jobId, "running", {});
}

export async function markSucceeded(jobId: string, result: any) {
  await jobRef(jobId).update({
    status: "succeeded",
    result: result ?? null,
    error: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    progress: 1,
    message: "succeeded",
    updatedAt: serverTimestamp()
  });
  await appendEvent(jobId, "succeeded", {});
}

export async function markFailedOrRetry(jobId: string, err: any) {
  const now = nowMs();
  const r = jobRef(jobId);

  const res = await db().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists) return { ok: false, code: "not_found" };
    const d: any = snap.data() || {};
    const s = String(d.status || "");
    if (s === "cancelled") return { ok: true, status: "cancelled" };

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
        updatedAt: serverTimestamp()
      });
      return { ok: true, status: "deadletter", attempts };
    }

    const bo = computeBackoffSeconds(attempts, backoffBase);
    tx.update(r, {
      status: "retrying",
      attempts,
      error: err ?? { code: "unknown" },
      nextAttemptAt: tsFromMs(now + bo * 1000),
      leaseOwner: null,
      leaseExpiresAt: null,
      message: "retrying",
      updatedAt: serverTimestamp()
    });
    return { ok: true, status: "retrying", attempts, backoffSeconds: bo };
  });

  if ((res as any).ok) await appendEvent(jobId, (res as any).status, { attempts: (res as any).attempts ?? null, err: err ?? null });
  return res;
}
