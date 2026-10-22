// UrAi Jobs nonproduction engineering checkpoint bridge.
// Embedded in the EXISTING jobs/{jobId} record, never a shadow queue.
// Not a job admission, coding agent, or authenticated endpoint.
// Only invoke server-side after authenticating the actor and authorizing the action.
import { createHash } from 'node:crypto';

const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9_-]{8,64}$/;
const PHASES = new Set(['SOURCE_PINNED', 'TESTS_VERIFIED', 'PR_DRAFTED']);
const digest = value => createHash('sha256').update(value).digest('hex');
const deny = reason => { throw new Error('CHALK_CHECKPOINT_' + reason); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const valid = (pattern, value) => typeof value === 'string' && pattern.test(value);

export function engineeringCheckpointBridge(db, { jobRef, queueRef, now = () => Date.now() }) {
  if (typeof db?.runTransaction !== 'function' || typeof jobRef !== 'function' ||
      typeof queueRef !== 'function') deny('CONFIG');
  const refs = jobId => {
    if (!valid(ID, jobId)) deny('JOB_ID');
    return { job: jobRef(jobId), queue: queueRef(jobId) };
  };
  const validateMaster = (job, jobId, actorUid) => {
    if (!record(job) || job.jobId !== jobId || job.ownerUid !== actorUid) deny('OWNER_OR_JOB');
    // Explicitly non-admitted. Do not add this type to the active registry until
    // protected worker, permission and provider evidence exists.
    if (job.type !== 'engineering.verify' && job.jobType !== 'engineering.verify') deny('TYPE');
    if (!record(job.payload) || !valid(SHA40, job.payload.baseSha) ||
        !valid(SHA64, job.payload.requestDigest)) deny('SOURCE_BINDING');
  };
  const validatedCheckpoint = (job, checkpoint) => {
    if (checkpoint === undefined || checkpoint === null) return null;
    if (!record(checkpoint) || checkpoint.version !== 1 ||
        !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 1 ||
        !Number.isSafeInteger(checkpoint.attempt) || checkpoint.attempt < 1 ||
        !PHASES.has(checkpoint.phase) || !valid(SHA40, checkpoint.sourceSha) ||
        !valid(SHA64, checkpoint.requestDigest) || !valid(SHA64, checkpoint.outputDigest) ||
        checkpoint.sourceSha !== job.payload.baseSha ||
        checkpoint.requestDigest !== job.payload.requestDigest ||
        !valid(SHA64, checkpoint.integrity)) deny('CORRUPT');
    const { integrity, ...rest } = checkpoint;
    if (digest(JSON.stringify(rest)) !== integrity) deny('CORRUPT');
    return checkpoint;
  };
  async function read({ jobId, actorUid }) {
    if (!valid(ID, actorUid)) deny('ACTOR');
    const { job } = refs(jobId);
    const snap = await job.get();
    if (!snap.exists) deny('MISSING');
    const master = snap.data();
    validateMaster(master, jobId, actorUid);
    return validatedCheckpoint(master, master.execution?.engineeringCheckpoint);
  }
  async function persist({ jobId, actorUid, leaseToken, attempt, expectedRevision, phase, outputDigest }) {
    if (!valid(ID, actorUid) || typeof leaseToken !== 'string' || leaseToken.length < 16 ||
        !Number.isSafeInteger(attempt) || attempt < 1 ||
        !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
        !PHASES.has(phase) || !valid(SHA64, outputDigest)) deny('INPUT');
    const { job, queue } = refs(jobId);
    return db.runTransaction(async tx => {
      // Job first, queue second: preserve UrAi Jobs' existing document lock order.
      const masterSnap = await tx.get(job);
      const queueSnap = await tx.get(queue);
      if (!masterSnap.exists || !queueSnap.exists) deny('MISSING');
      const master = masterSnap.data();
      const queued = queueSnap.data();
      validateMaster(master, jobId, actorUid);
      const lease = master.lease?.leaseToken;
      if (master.status !== 'RUNNING' || queued.status !== 'RUNNING' ||
          queued.jobId !== jobId || lease !== leaseToken ||
          master.execution?.leaseToken !== leaseToken ||
          queued.lease?.leaseToken !== leaseToken ||
          master.execution?.attemptCount !== attempt) deny('LEASE_STALE');
      const previous = validatedCheckpoint(master, master.execution?.engineeringCheckpoint);
      const revision = previous?.revision ?? 0;
      if (revision !== expectedRevision) deny('REVISION_STALE');
      const progress = { version: 1, revision: revision + 1, attempt, phase,
        sourceSha: master.payload.baseSha, requestDigest: master.payload.requestDigest,
        outputDigest, savedAtMs: now() };
      const checkpoint = { ...progress, integrity: digest(JSON.stringify(progress)) };
      tx.update(job, { 'execution.engineeringCheckpoint': checkpoint });
      return checkpoint;
    });
  }
  return { read, persist };
}
