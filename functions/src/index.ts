import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

initializeApp();
const db = getFirestore();

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "dead" | "canceled";
type QueueState = "running" | "paused";

const REGION = process.env.FUNCTION_REGION || "us-central1";
const COLLECTIONS = {
  jobs: "jobs",
  runs: "jobRuns",
  dlq: "jobDeadLetters",
  metrics: "jobMetrics",
  settings: "jobSettings",
};

const JobPayloadSchema = z.object({
  type: z.string().min(1).max(128),
  payload: z.record(z.unknown()).default({}),
  runAtMs: z.number().int().nonnegative().optional(),
  delayMs: z.number().int().nonnegative().optional(),
  maxAttempts: z.number().int().min(1).max(50).optional(),
  idempotencyKey: z.string().min(8).max(256).optional(),
});

function nowMs() { return Date.now(); }
function tsFromMs(ms: number) { return Timestamp.fromMillis(ms); }

function jitterMs(baseMs: number) {
  const span = Math.floor(baseMs * 0.25);
  const j = Math.floor(Math.random() * (span + 1));
  return baseMs + j;
}

function backoffDelayMs(attempt: number) {
  const base = 1500;
  const cap = 5 * 60 * 1000;
  const exp = Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
  return jitterMs(exp);
}

async function metricInc(name: string, incBy = 1) {
  const ref = db.collection(COLLECTIONS.metrics).doc(name);
  await ref.set({ name, count: FieldValue.increment(incBy), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function getQueueState(): Promise<QueueState> {
  const ref = db.collection(COLLECTIONS.settings).doc("queue");
  const snap = await ref.get();
  const state = snap.exists ? (snap.get("state") as QueueState | undefined) : undefined;
  return state === "paused" ? "paused" : "running";
}

async function setQueueState(state: QueueState) {
  const ref = db.collection(COLLECTIONS.settings).doc("queue");
  await ref.set({ state, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function enqueueJob(input: z.infer<typeof JobPayloadSchema>) {
  const parsed = JobPayloadSchema.parse(input);
  const createdAt = FieldValue.serverTimestamp();
  const maxAttempts = parsed.maxAttempts ?? 8;

  const runAtMs =
    parsed.runAtMs ??
    (parsed.delayMs ? (nowMs() + parsed.delayMs) : nowMs());

  const idempotencyKey = parsed.idempotencyKey;
  if (idempotencyKey) {
    const existing = await db.collection(COLLECTIONS.jobs)
      .where("idempotencyKey", "==", idempotencyKey)
      .where("status", "in", ["queued", "running", "succeeded"] as JobStatus[])
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0]!;
      return { jobId: doc.id, deduped: true };
    }
  }

  const jobId = uuidv4();
  const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
  await ref.create({
    jobId,
    type: parsed.type,
    payload: parsed.payload,
    status: "queued" as JobStatus,
    createdAt,
    updatedAt: createdAt,
    runAt: tsFromMs(runAtMs),
    attempts: 0,
    maxAttempts,
    idempotencyKey: idempotencyKey ?? null,
    leaseUntil: tsFromMs(0),
    canceledReason: null,
    lastError: null,
    correlationId: uuidv4(),
  });

  await metricInc("jobs_enqueued", 1);
  return { jobId, deduped: false };
}

async function cancelJob(jobId: string, reason: string) {
  const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
  await ref.set({ status: "canceled", canceledReason: reason, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await metricInc("jobs_canceled", 1);
}

async function moveToDLQ(jobId: string, runId: string, err: unknown) {
  const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
  const snap = await jobRef.get();
  const data = snap.data() || {};

  const dlqRef = db.collection(COLLECTIONS.dlq).doc(jobId);
  await dlqRef.set({
    jobId,
    runId,
    data,
    error: normalizeError(err),
    movedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await jobRef.set({
    status: "dead",
    updatedAt: FieldValue.serverTimestamp(),
    lastError: normalizeError(err),
  }, { merge: true });

  await metricInc("jobs_deadlettered", 1);
}

function normalizeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack ?? null };
  }
  return { name: "Error", message: String(err), stack: null };
}

async function runHandler(type: string, payload: Record<string, unknown>, jobId: string, runId: string) {
  if (type === "noop") return;

  if (type === "smoke_success") return;

  if (type === "smoke_fail_once") {
    const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
    const snap = await ref.get();
    const attempts = (snap.get("attempts") as number | undefined) ?? 0;
    if (attempts <= 0) {
      throw new Error("Intentional first-attempt failure for retry validation.");
    }
    return;
  }

  throw new Error(`Unknown job type: ${type}`);
}

async function claimJobs(batchSize: number) {
  const state = await getQueueState();
  if (state === "paused") return [];

  const now = Timestamp.fromMillis(nowMs());
  const q = db.collection(COLLECTIONS.jobs)
    .where("status", "==", "queued")
    .where("runAt", "<=", now)
    .orderBy("runAt", "asc")
    .limit(batchSize);

  const snap = await q.get();
  const claimed: { jobId: string; type: string; payload: Record<string, unknown>; correlationId: string }[] = [];

  for (const doc of snap.docs) {
    const jobId = doc.id;
    const ref = db.collection(COLLECTIONS.jobs).doc(jobId);
    const runId = uuidv4();
    const leaseMs = 60_000;

    const ok = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const status = s.get("status") as JobStatus;
      if (status !== "queued") return false;

      const leaseUntil = s.get("leaseUntil") as Timestamp | undefined;
      if (leaseUntil && leaseUntil.toMillis() > nowMs()) return false;

      tx.set(ref, {
        status: "running",
        runId,
        leaseUntil: tsFromMs(nowMs() + leaseMs),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const runRef = db.collection(COLLECTIONS.runs).doc(runId);
      tx.create(runRef, {
        runId,
        jobId,
        type: s.get("type"),
        startedAt: FieldValue.serverTimestamp(),
        status: "running",
        correlationId: s.get("correlationId") ?? uuidv4(),
      });

      return true;
    }).catch(() => false);

    if (ok) {
      const s2 = await ref.get();
      claimed.push({
        jobId,
        type: (s2.get("type") as string) || "unknown",
        payload: (s2.get("payload") as Record<string, unknown>) || {},
        correlationId: (s2.get("correlationId") as string) || uuidv4(),
      });
    }
  }

  return claimed;
}

async function finishJobSuccess(jobId: string, runId: string, startedMs: number) {
  const durMs = nowMs() - startedMs;
  const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
  const runRef = db.collection(COLLECTIONS.runs).doc(runId);

  await Promise.all([
    jobRef.set({
      status: "succeeded",
      leaseUntil: tsFromMs(0),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: null,
      finishedAt: FieldValue.serverTimestamp(),
      latencyMs: durMs,
    }, { merge: true }),
    runRef.set({
      status: "succeeded",
      finishedAt: FieldValue.serverTimestamp(),
      latencyMs: durMs,
    }, { merge: true }),
    metricInc("jobs_succeeded", 1),
    metricInc("jobs_latency_ms_sum", durMs),
  ]);
}

async function finishJobFailure(jobId: string, runId: string, err: unknown) {
  const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
  const runRef = db.collection(COLLECTIONS.runs).doc(runId);

  const snap = await jobRef.get();
  const attempts = ((snap.get("attempts") as number | undefined) ?? 0) + 1;
  const maxAttempts = (snap.get("maxAttempts") as number | undefined) ?? 8;

  await runRef.set({
    status: "failed",
    finishedAt: FieldValue.serverTimestamp(),
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
    updatedAt: FieldValue.serverTimestamp(),
    lastError: normalizeError(err),
    lastRetryDelayMs: delay,
  }, { merge: true });

  await metricInc("jobs_retried", 1);
}

export const jobsTick = onSchedule({ region: REGION, schedule: "every 1 minutes", timeZone: "UTC" }, async () => {
  const BATCH = 10;
  const claimed = await claimJobs(BATCH);
  if (claimed.length === 0) return;

  await metricInc("ticks_with_work", 1);

  for (const j of claimed) {
    const jobRef = db.collection(COLLECTIONS.jobs).doc(j.jobId);
    const snap = await jobRef.get();
    const runId = (snap.get("runId") as string | undefined) ?? uuidv4();
    const startedMs = nowMs();

    const corr = (snap.get("correlationId") as string | undefined) ?? uuidv4();
    console.log(JSON.stringify({ level: "info", msg: "job_start", jobId: j.jobId, runId, type: j.type, correlationId: corr }));

    try {
      await runHandler(j.type, j.payload, j.jobId, runId);
      await finishJobSuccess(j.jobId, runId, startedMs);
      console.log(JSON.stringify({ level: "info", msg: "job_success", jobId: j.jobId, runId, type: j.type, correlationId: corr }));
    } catch (e) {
      console.log(JSON.stringify({ level: "error", msg: "job_failure", jobId: j.jobId, runId, type: j.type, correlationId: corr, error: normalizeError(e) }));
      await finishJobFailure(j.jobId, runId, e);
    }
  }
});

const AdminActionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "requeue_dlq"]),
  jobId: z.string().uuid().optional(),
  reason: z.string().min(1).max(512).optional(),
});

async function verifyAdmin(req: any): Promise<boolean> {
  const auth = req.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) return false;
  const token = m[1]!;
  const admin = await import("firebase-admin/auth").then(m => m.getAuth());
  try {
    const decoded = await admin.verifyIdToken(token);
    return decoded.admin === true;
  } catch {
    return false;
  }
}

export const admin = onRequest({ region: REGION }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
  const ok = await verifyAdmin(req);
  if (!ok) { res.status(403).send("Forbidden"); return; }

  const body = (req.body && typeof req.body === "object") ? req.body : {};
  const parsed = AdminActionSchema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { action, jobId, reason } = parsed.data;

  if (action === "pause") { await setQueueState("paused"); res.json({ ok: true, state: "paused" }); return; }
  if (action === "resume") { await setQueueState("running"); res.json({ ok: true, state: "running" }); return; }

  if (action === "cancel") {
    if (!jobId) { res.status(400).json({ error: "jobId required" }); return; }
    await cancelJob(jobId, reason ?? "canceled_by_admin");
    res.json({ ok: true, jobId, status: "canceled" });
    return;
  }

  if (action === "requeue_dlq") {
    if (!jobId) { res.status(400).json({ error: "jobId required" }); return; }
    const dlqRef = db.collection(COLLECTIONS.dlq).doc(jobId);
    const dlqSnap = await dlqRef.get();
    if (!dlqSnap.exists) { res.status(404).json({ error: "DLQ not found" }); return; }
    const data = dlqSnap.get("data") as Record<string, any>;
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    await jobRef.set({
      ...data,
      status: "queued",
      attempts: 0,
      leaseUntil: tsFromMs(0),
      runAt: tsFromMs(nowMs()),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: null,
    }, { merge: true });
    await dlqRef.delete();
    await metricInc("jobs_dlq_requeued", 1);
    res.json({ ok: true, jobId, status: "queued" });
    return;
  }

  res.status(400).json({ error: "Unknown action" });
});

export const enqueue = onRequest({ region: REGION }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const limitRef = db.collection(COLLECTIONS.metrics).doc("rate_limit_global");
  const now = nowMs();
  const windowMs = 5_000;
  const maxPerWindow = 50;

  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(limitRef);
    const lastWindow = (snap.get("windowStartMs") as number | undefined) ?? 0;
    const count = (snap.get("count") as number | undefined) ?? 0;
    if (now - lastWindow > windowMs) {
      tx.set(limitRef, { windowStartMs: now, count: 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    }
    if (count >= maxPerWindow) return false;
    tx.set(limitRef, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });

  if (!ok) { res.status(429).json({ error: "rate_limited" }); return; }

  const body = (req.body && typeof req.body === "object") ? req.body : {};
  const parsed = JobPayloadSchema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const out = await enqueueJob(parsed.data);
  res.json({ ok: true, ...out });
});

export const __internalSmoke = onRequest({ region: REGION }, async (req, res) => {
  const enabled = process.env.URAI_JOBS_SMOKE_ENABLED === "1";
  if (!enabled) { res.status(403).send("disabled"); return; }

  const want = process.env.URAI_JOBS_SMOKE_TOKEN || "";
  const got = req.get("x-smoke-token") || "";
  if (!want || got !== want) { res.status(403).send("forbidden"); return; }

  const phase = String(req.query.phase || "success");
  const type = phase === "fail_once" ? "smoke_fail_once" : "smoke_success";

  const { jobId } = await enqueueJob({ type, payload: { phase }, maxAttempts: 4, delayMs: 0, idempotencyKey: `smoke_${phase}_${Date.now()}` });

  const started = nowMs();
  const timeoutMs = 120_000;

  while (nowMs() - started < timeoutMs) {
    const snap = await db.collection(COLLECTIONS.jobs).doc(jobId).get();
    const status = (snap.get("status") as JobStatus | undefined) ?? "queued";
    if (status === "succeeded") { res.json({ ok: true, jobId, status }); return; }
    if (status === "dead") { res.status(500).json({ ok: false, jobId, status, lastError: snap.get("lastError") ?? null }); return; }
    await new Promise(r => setTimeout(r, 1500));
  }

  const s = await db.collection(COLLECTIONS.jobs).doc(jobId).get();
  res.status(504).json({ ok: false, jobId, status: s.get("status") ?? null });
});
