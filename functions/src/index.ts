import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobSchema } from "./types/jobs";
import { lockJob, heartbeatJob, releaseJob } from "./firestore";
import { writeAuditEvent } from "./audit";

admin.initializeApp();

const db = admin.firestore();

const getApiKey = () => functions.config().urai.internal_key;

const isAuthorized = (req: functions.https.Request) => req.header("x-urai-internal-key") === getApiKey();

export const enqueueJob = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const { kind, input } = req.body;

  const newJob: Job = {
    jobId: db.collection("jobs").doc().id,
    kind: kind,
    status: "QUEUED",
    priority: 50,
    attempt: 0,
    maxAttempts: 3,
    input: input,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validation = JobSchema.safeParse(newJob);

  if (!validation.success) {
    res.status(400).send(validation.error.issues);
    return;
  }

  await db.collection("jobs").doc(newJob.jobId).set(newJob);

  await writeAuditEvent(newJob, "ENQUEUED", { kind: "api", id: "enqueueJob" });

  res.send({ ok: true, jobId: newJob.jobId });
});

export const getJob = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send("jobId is required");
    return;
  }

  const jobDoc = await db.collection("jobs").doc(jobId).get();

  if (!jobDoc.exists) {
    res.status(404).send("Job not found");
    return;
  }

  res.send({ ok: true, job: jobDoc.data() });
});

export const pollJobs = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const limit = parseInt(req.query.limit as string) || 10;
  const kinds = (req.query.kinds as string)?.split(",");

  let query: admin.firestore.Query = db.collection("jobs").where("status", "==", "QUEUED").orderBy("priority", "desc");

  if (kinds && kinds.length > 0) {
    query = query.where("kind", "in", kinds);
  }

  const jobsSnapshot = await query.limit(limit).get();

  const jobs = jobsSnapshot.docs.map((doc) => doc.data());

  res.send({ ok: true, jobs: jobs });
});

export const lockNextJob = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const workerId = req.body.workerId;

  if (!workerId) {
    res.status(400).send("workerId is required");
    return;
  }

  const jobsSnapshot = await db.collection("jobs").where("status", "==", "QUEUED").orderBy("priority", "desc").limit(1).get();

  if (jobsSnapshot.empty) {
    res.send({ ok: true, job: null });
    return;
  }

  const job = jobsSnapshot.docs[0].data() as Job;

  const lockedJob = await lockJob(job, workerId);

  if (!lockedJob) {
    res.status(409).send("Job already locked");
    return;
  }

  res.send({ ok: true, job: lockedJob });
});

export const heartbeat = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const jobId = req.params.jobId;
  const workerId = req.body.workerId;

  if (!jobId || !workerId) {
    res.status(400).send("jobId and workerId are required");
    return;
  }

  const jobDoc = await db.collection("jobs").doc(jobId).get();

  if (!jobDoc.exists) {
    res.status(404).send("Job not found");
    return;
  }

  const lockedUntil = await heartbeatJob(jobDoc.data() as Job, workerId);

  if (!lockedUntil) {
    res.status(409).send("Job not locked by this worker");
    return;
  }

  res.send({ ok: true, lockedUntil });
});

export const release = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const jobId = req.params.jobId;
  const workerId = req.body.workerId;

  if (!jobId || !workerId) {
    res.status(400).send("jobId and workerId are required");
    return;
  }

  const jobDoc = await db.collection("jobs").doc(jobId).get();

  if (!jobDoc.exists) {
    res.status(404).send("Job not found");
    return;
  }

  await releaseJob(jobDoc.data() as Job, workerId);

  res.send({ ok: true });
});

export const cancelJob = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send("jobId is required");
    return;
  }

  const jobRef = db.collection("jobs").doc(jobId);

  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    res.status(404).send("Job not found");
    return;
  }

  const job = jobDoc.data() as Job;

  if (job.status === "CANCELED") {
    res.send({ ok: true });
    return;
  }

  await jobRef.update({ status: "CANCELED" });

  await writeAuditEvent(job, "CANCELED", { kind: "api", id: "cancelJob" });

  res.send({ ok: true });
});

export const retryJob = functions.https.onRequest(async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(400).send("jobId is required");
    return;
  }

  const jobRef = db.collection("jobs").doc(jobId);

  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    res.status(404).send("Job not found");
    return;
  }

  const job = jobDoc.data() as Job;

  if (job.status !== "FAILED" || job.attempt >= job.maxAttempts) {
    res.status(400).send("Job cannot be retried");
    return;
  }

  const retriedJob = {
    ...job,
    status: "QUEUED",
    attempt: job.attempt + 1,
  } as Job;

  await jobRef.update(retriedJob);

  await writeAuditEvent(retriedJob, "RETRIED", { kind: "api", id: "retryJob" });

  res.send({ ok: true, job: retriedJob });
});
