import { createHash, randomUUID } from 'node:crypto';
import { FieldPath, FieldValue, getFirestore, type Firestore, type QueryDocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { uploadToGcs } from '../core/gcs.js';
import { deleteCapturedRealityEngineJob, deleteCapturedRealityPublishedRuntimeForOwner } from './capturedRealityDerivativeRevocation.js';
import { assertPrivateDataRightsExportDestination, assertPrivateLifeModelOwnerEpoch, deleteOwnedPrivateLifeModel, exportOwnedPrivateLifeModel, removePrivateDataRightsExportAttempt } from './privateLifeModelDataRights.js';
import { continuationReason, recordFailure, retryCounters } from './dataRightsContinuationPolicy.js';

const DATA_RIGHTS_COLLECTION = 'dataRightsRequests';
const MAX_OWNED_JOBS = 2_000;
const EXECUTION_MODE = 'protected-staging';
const EXECUTION_SCHEMA = 'urai-jobs-data-rights-execution-v1';
const EXECUTION_LEASE_MS = 180000;
const MAX_LOG_DELETE_PAGES = 20;

const ExecuteSchema = z.object({
  requestId: z.string().trim().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  retentionDecisionReceiptId: z.string().trim().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

type RequestRecord = {
  ownerUid?: string;
  requestType?: 'EXPORT' | 'DELETE';
  status?: string;
  executionState?: string;
  requestedFormat?: 'json' | 'csv' | null;
};

function executionAdmission() {
  const mode = String(process.env.URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE || '').trim();
  const project = String(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
  const allowedProject = String(process.env.URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT || '').trim();
  if (mode !== EXECUTION_MODE || !allowedProject || project !== allowedProject) {
    throw httpsError(
      'failed-precondition',
      'Data-rights execution is hard-off unless the exact protected staging project is explicitly admitted.'
    );
  }
  if (process.env.URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED === 'true') {
    throw httpsError(
      'failed-precondition',
      'This pre-review executor must not run with production authorization enabled.'
    );
  }
  return { mode, project };
}

function timestamp(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof (value as { toDate?: unknown }).toDate !== 'function') return null;
  const date = (value as { toDate: () => Date }).toDate();
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (/secret|password|token|authorization|cookie|signedurl|serviceurl/i.test(key)) continue;
    output[key] = redact(entry);
  }
  return output;
}

async function ownedJobs(db: Firestore, ownerUid: string): Promise<QueryDocumentSnapshot[]> {
  const snap = await db.collection('jobs')
    .where('ownerUid', '==', ownerUid)
    .orderBy(FieldPath.documentId())
    .limit(MAX_OWNED_JOBS + 1)
    .get();
  if (snap.size > MAX_OWNED_JOBS) {
    throw httpsError('resource-exhausted', 'Owned job set exceeds the bounded privacy execution limit.');
  }
  for (const document of snap.docs) {
    if (document.data().ownerUid !== ownerUid) {
      throw httpsError('permission-denied', 'Owned-job query returned an authority mismatch.');
    }
  }
  return snap.docs;
}

function canonicalDigest(value: unknown) {
  const canonical = (item: any): string => Array.isArray(item) ? '[' + item.map(canonical).join(',') + ']'
    : item && typeof item === 'object' ? '{' + Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry)).join(',') + '}' : JSON.stringify(item);
  return createHash('sha256').update(canonical(value)).digest('hex');
}

async function buildExport(db: Firestore, requestId: string, ownerUid: string, checkpoint: () => Promise<void>, attemptKey: string) {
  await checkpoint();
  await assertPrivateDataRightsExportDestination();
  const [userSnap, jobs, privateLifeModel] = await Promise.all([
    db.collection('users').doc(ownerUid).get(),
    ownedJobs(db, ownerUid),
    exportOwnedPrivateLifeModel(db, ownerUid, checkpoint),
  ]);
  const exportedJobs = jobs.map((document) => {
    const source = redact(document.data()) as Record<string, unknown>;
    return {
      jobId: document.id,
      type: source.type || source.jobType || null,
      status: source.status || null,
      ownerUid,
      tenantId: source.tenantId || null,
      orgId: source.orgId || null,
      payload: source.payload ?? null,
      consent: source.consent ?? null,
      consents: source.consents ?? null,
      output: source.output ?? null,
      createdAt: timestamp(source.createdAt),
      updatedAt: timestamp(source.updatedAt),
      completedAt: timestamp(source.completedAt),
    };
  });
  const payload = {
    schemaVersion: EXECUTION_SCHEMA,
    scope: 'urai-jobs-proven-owner-data',
    completeEcosystemExport: false,
    ownerUid,
    requestId,
    user: userSnap.exists ? redact(userSnap.data()) : null,
    jobs: exportedJobs,
    privateLifeModel: redact(privateLifeModel),
    unresolvedDomains: [
      'firebase-auth-account',
      'provider-side-derivatives',
      'external-artifacts-not-bound-to-jobs-storage',
      'cross-system-data-owned-by-other-urai-services',
      ...privateLifeModel.unresolvedDomains,
    ],
  };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  // Distinct attempt paths prevent a delayed upload from replacing a successor.
  const destination = `privacy/data-rights/${createHash('sha256').update(ownerUid).digest('hex')}/${requestId}/${attemptKey}/export.json`;
  await checkpoint();
  await assertPrivateLifeModelOwnerEpoch(db, ownerUid, privateLifeModel.ownerDeletionEpoch);
  const gcsRef = await uploadToGcs(bytes, destination, 'application/json');
  await checkpoint();
  await assertPrivateLifeModelOwnerEpoch(db, ownerUid, privateLifeModel.ownerDeletionEpoch);
  return { recordCount: exportedJobs.length + privateLifeModel.records.length + (userSnap.exists ? 1 : 0), sha256, gcsRef,
    completeEcosystemExport: false, unresolvedDomains: payload.unresolvedDomains };
}

async function executeDelete(db: Firestore, requestId: string, ownerUid: string, checkpoint: (transaction?: Transaction) => Promise<void>) {
  await checkpoint();
  const ownerHash = createHash('sha256').update(ownerUid).digest('hex');
  const privateLifeModel = await deleteOwnedPrivateLifeModel(db, ownerUid, requestId, checkpoint);
  let queueDeletes = 0;
  let logDeletes = 0;
  let jobsAnonymized = 0;
  const capturedRealityRuntime = await deleteCapturedRealityPublishedRuntimeForOwner(ownerUid);

  // Committed anonymization removes ownerUid from this query, so a retry can
  // continue beyond the execution budget without retaining a mutable cursor.
  for (let jobPage = 0; jobPage < 20; jobPage++) {
    await checkpoint();
    const jobs = await db.collection('jobs').where('ownerUid', '==', ownerUid).limit(100).get();
    if (!jobs.size) break;
    for (const document of jobs.docs) {
      await checkpoint();
      // Fence in-flight worker/callback attempts before mutating owned records.
      const currentJob = await db.runTransaction(async transaction => {
        await checkpoint(transaction);
        const current = (await transaction.get(document.ref)).data();
        if (!current || current.ownerUid !== ownerUid) throw httpsError('permission-denied', 'Owned job authority changed during deletion.');
        await checkpoint(transaction);
        transaction.update(document.ref, { status: 'CANCELLED', lease: FieldValue.delete(), 'execution.asyncCallbackPending': false,
          'execution.leaseToken': FieldValue.delete(), 'execution.callbackLeaseToken': FieldValue.delete(),
          'execution.callbackTokenHash': FieldValue.delete(), 'execution.callbackDeadlineAt': FieldValue.delete(),
          'execution.capturedRealityAcceptedCallbackHash': FieldValue.delete() });
        return current;
      });
      if ((currentJob.jobType || currentJob.type) === 'memory.private-source.reconstruct-place') {
        // Preserve owner identity until the engine proves cleanup, so retries can
        // still locate a partially deleted reconstruction job.
        await deleteCapturedRealityEngineJob(document.id);
      }
      const logsRef = document.ref.collection('logs');
      for (let page = 0; page < MAX_LOG_DELETE_PAGES; page++) {
        await checkpoint();
        const logs = await logsRef.limit(400).get();
        if (!logs.size) break;
        const committed = await db.runTransaction(async transaction => {
          await checkpoint(transaction);
          const current = (await transaction.get(document.ref)).data();
          if (!current || current.ownerUid !== ownerUid) throw httpsError('permission-denied', 'Owned job authority changed during log deletion.');
          const targets = [];
          for (const log of logs.docs) {
            const observed = await transaction.get(log.ref);
            if (!observed.exists) continue;
            if (!observed.updateTime?.isEqual(log.updateTime)) throw httpsError('failed-precondition', 'Owned job log version changed during deletion.');
            targets.push(observed);
          }
          await checkpoint(transaction);
          for (const target of targets) transaction.delete(target.ref, { lastUpdateTime: target.updateTime! });
          return targets.length;
        });
        logDeletes += committed;
      }
      if ((await logsRef.limit(1).get()).size) throw httpsError('resource-exhausted', 'Bounded job log deletion requires continuation.');
      await checkpoint();
      const queueRef = db.collection('jobQueue').doc(document.id);
      const queueDeleted = await db.runTransaction(async transaction => {
        await checkpoint(transaction);
        const current = await transaction.get(document.ref);
        const queueSnap = await transaction.get(queueRef), queue = queueSnap.data();
        if (current.data()?.ownerUid !== ownerUid) throw httpsError('permission-denied', 'Owned job authority changed during deletion.');
        if (queue && ((queue.ownerUid !== undefined && queue.ownerUid !== ownerUid)
          || (queue.jobId !== undefined && queue.jobId !== document.id))) {
          throw httpsError('permission-denied', 'Owned job queue authority changed during deletion.');
        }
        await checkpoint(transaction);
        if (queueSnap.exists) transaction.delete(queueRef, { lastUpdateTime: queueSnap.updateTime! });
        transaction.set(document.ref, {
        ownerUid: `deleted:${ownerHash}`,
        payload: FieldValue.delete(),
        output: FieldValue.delete(),
        result: FieldValue.delete(),
        consent: FieldValue.delete(),
        consents: FieldValue.delete(),
        error: FieldValue.delete(),
        deletionReceipt: {
          schemaVersion: EXECUTION_SCHEMA,
          requestId,
          ownerHash,
          deletedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return queueSnap.exists;
      });
      if (queueDeleted) queueDeletes++;
      jobsAnonymized += 1;
    }
  }
  if ((await db.collection('jobs').where('ownerUid', '==', ownerUid).limit(1).get()).size) throw httpsError('resource-exhausted', 'Bounded owner job deletion requires continuation.');

  // Jobs does not own Firebase Auth deletion, external provider derivatives, or
  // every cross-system artifact. Never mark the user's request globally complete.
  await checkpoint();
  const profilePendingMarkerApplied = await db.runTransaction(async transaction => {
    await checkpoint(transaction);
    const ref = db.collection('users').doc(ownerUid), snapshot = await transaction.get(ref), current = snapshot.data();
    // Central Privacy may already have physically removed the profile. Never
    // resurrect it by merging a Jobs-only pending marker into a missing record.
    if (!snapshot.exists) return false;
    if ((current?.uid !== undefined && current.uid !== ownerUid) || (current?.userId !== undefined && current.userId !== ownerUid)) {
      throw httpsError('permission-denied', 'Owned profile authority changed during deletion.');
    }
    await checkpoint(transaction);
    transaction.update(ref, { dataRightsDeletionPendingCentralPrivacy: true,
      dataRightsDeletionRequestId: requestId, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });

  return {
    jobsAnonymized,
    privateLifeModel,
    capturedRealityRuntime,
    queueDeletes,
    logDeletes,
    profilePendingMarkerApplied,
    unresolvedDomains: [
      'firebase-auth-account',
      'provider-side-derivatives',
      'external-artifacts-not-bound-to-jobs-storage',
      'cross-system-data-owned-by-other-urai-services',
      ...privateLifeModel.unresolvedDomains,
    ],
  };
}

const handler = async (data: unknown, context: CallableContext) => {
  const parsed = ExecuteSchema.safeParse(data);
  if (!parsed.success) {
    throw httpsError('invalid-argument', 'Invalid governed data-rights execution request.', parsed.error.flatten());
  }
  const admission = executionAdmission();
  const db = getFirestore();
  const actorUid = context.auth?.uid;
  const currentActor = async (transaction?: Transaction) => {
    const token = context.rawRequest?.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    try {
      if (!actorUid || !token || (await getAuth().verifyIdToken(token, true)).uid !== actorUid
        || (await getAuth().getUser(actorUid)).disabled) throw new Error();
    } catch { throw httpsError('unauthenticated', 'Current data-rights operator authentication is required.'); }
    const actorRef = db.collection('users').doc(actorUid);
    const actor = (await (transaction ? transaction.get(actorRef) : actorRef.get())).data();
    if (!actor || !['admin', 'operator'].includes(String(actor.role))) {
      throw httpsError('permission-denied', 'Current data-rights operator role is required.');
    }
  };
  await currentActor();
  const requestRef = db.collection(DATA_RIGHTS_COLLECTION).doc(parsed.data.requestId);
  const executionRef = requestRef.collection('audit').doc(`execution-${canonicalDigest(parsed.data.idempotencyKey).slice(0, 24)}`);
  const leaseToken = randomUUID();

  const request = await db.runTransaction(async (transaction) => {
    const [requestSnap, priorExecution] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(executionRef),
    ]);
    if (!requestSnap.exists) throw httpsError('not-found', 'Data-rights request was not found.');
    const record = requestSnap.data() as RequestRecord;
    const prior = priorExecution.exists ? priorExecution.data() : null;
    if (typeof record.ownerUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(record.ownerUid) || !['EXPORT', 'DELETE'].includes(String(record.requestType))) {
      throw httpsError('failed-precondition', 'Data-rights request schema requires reconciliation.');
    }
    const requestHash = canonicalDigest({ schemaVersion: EXECUTION_SCHEMA, requestId: parsed.data.requestId,
      idempotencyKeyHash: canonicalDigest(parsed.data.idempotencyKey),
      ownerHash: createHash('sha256').update(record.ownerUid).digest('hex'), requestType: record.requestType,
      retentionDecisionReceiptId: parsed.data.retentionDecisionReceiptId, admission });
    if (prior && prior.requestHash !== requestHash) throw httpsError('already-exists', 'Data-rights idempotency authority differs or an unbound legacy attempt requires reconciliation.');
    if (!['APPROVED', 'IN_REVIEW'].includes(String(record.status))) throw httpsError('failed-precondition', 'Stored data-rights approval is no longer current.');
    if (prior?.event === 'DATA_RIGHTS_EXECUTION_FINISHED') {
      if (prior.schemaVersion !== EXECUTION_SCHEMA || !prior.result || typeof prior.result !== 'object'
        || prior.resultDigest !== canonicalDigest(prior.result)) throw httpsError('failed-precondition', 'Retained data-rights receipt requires reconciliation.');
      return { replay: prior, record, requestHash, attemptNumber: prior.attemptNumber };
    }
    const failedRetry = prior?.event === 'DATA_RIGHTS_EXECUTION_FAILED'
      && record.status === 'IN_REVIEW' && record.executionState === 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE';
    const continuationRetry = prior?.event === 'DATA_RIGHTS_EXECUTION_CONTINUATION_REQUIRED'
      && record.status === 'IN_REVIEW' && record.executionState === 'PROTECTED_STAGING_EXECUTION_CONTINUATION_REQUIRED';
    const interrupted = prior?.event === 'DATA_RIGHTS_EXECUTION_STARTED'
      && record.status === 'IN_REVIEW' && record.executionState === 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS';
    if (interrupted && (!Number.isSafeInteger(prior.leaseExpiresAtMs) || prior.leaseExpiresAtMs > Date.now())) {
      throw httpsError('unavailable', 'The exact data-rights execution is still in progress.');
    }
    const retry = failedRetry || continuationRetry || interrupted;
    if (prior && !retry) throw httpsError('failed-precondition', 'The exact data-rights execution attempt requires reconciliation.');
    if (record.status !== 'APPROVED' && !retry) {
      throw httpsError('failed-precondition', 'Only an explicitly APPROVED request can enter protected staging execution.');
    }
    let budget;
    try {
      budget = retryCounters(prior, continuationRetry ? 'continuation' : failedRetry ? 'failure' : interrupted ? 'interrupted' : 'initial');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'data_rights_retry_budget_invalid';
      throw httpsError('resource-exhausted', reason);
    }
    const { attemptNumber, failureAttempts, continuationDeliveries } = budget;
    await currentActor(transaction);
    const execution = {
      event: 'DATA_RIGHTS_EXECUTION_STARTED',
      attemptNumber, failureAttempts, continuationDeliveries,
      requestHash, leaseToken, leaseExpiresAtMs: Date.now() + EXECUTION_LEASE_MS,
      exportAttemptObjectKey: canonicalDigest(leaseToken).slice(0, 32),
      schemaVersion: EXECUTION_SCHEMA,
      requestType: record.requestType,
      ownerHash: createHash('sha256').update(record.ownerUid).digest('hex'),
      retentionDecisionReceiptId: parsed.data.retentionDecisionReceiptId,
      admission,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (retry) transaction.set(executionRef, { ...execution, failureCode: FieldValue.delete(), failedAt: FieldValue.delete() }, { merge: true });
    else transaction.create(executionRef, execution);
    transaction.create(executionRef.collection('attempts').doc(String(attemptNumber).padStart(2, '0')), {
      event: 'DATA_RIGHTS_ATTEMPT_STARTED', schemaVersion: EXECUTION_SCHEMA, requestHash, attemptNumber,
      failureAttempts, continuationDeliveries,
      ownerHash: execution.ownerHash, requestType: record.requestType,
      exportAttemptObjectKey: execution.exportAttemptObjectKey, createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(requestRef, {
      status: 'IN_REVIEW',
      executionState: 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { replay: null, record, requestHash, attemptNumber, failureAttempts, continuationDeliveries };
  });

  if (request.replay) { await currentActor(); return { replay: true, receipt: request.replay }; }
  const record = request.record;
  const ownerUid = String(record.ownerUid);
  const attemptRef = executionRef.collection('attempts').doc(String(request.attemptNumber).padStart(2, '0'));
  const currentExecution = async (transaction: Transaction) => {
    const [execution, currentRequest] = await Promise.all([transaction.get(executionRef), transaction.get(requestRef)]);
    const active = execution.data(), current = currentRequest.data();
    if (active?.event !== 'DATA_RIGHTS_EXECUTION_STARTED' || active.requestHash !== request.requestHash
      || active.leaseToken !== leaseToken || !Number.isSafeInteger(active.leaseExpiresAtMs) || active.leaseExpiresAtMs <= Date.now()
      || current?.ownerUid !== ownerUid || current.requestType !== record.requestType || current.status !== 'IN_REVIEW'
      || current.executionState !== 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS') throw httpsError('unavailable', 'Data-rights execution authority changed or its lease expired.');
    await currentActor(transaction);
    return active;
  };
  const checkpoint = async (transaction?: Transaction) => {
    if (transaction) await currentExecution(transaction); else await db.runTransaction(currentExecution);
  };
  try {
    const result = record.requestType === 'EXPORT'
      ? await buildExport(db, parsed.data.requestId, ownerUid, checkpoint, canonicalDigest(leaseToken).slice(0, 32))
      : await executeDelete(db, parsed.data.requestId, ownerUid, checkpoint);
    const resultDigest = canonicalDigest(result);
    const terminalState = record.requestType === 'EXPORT'
      ? 'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED'
      : 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED';
    const receipt = {
      event: 'DATA_RIGHTS_EXECUTION_FINISHED',
      schemaVersion: EXECUTION_SCHEMA,
      requestHash: request.requestHash, attemptNumber: request.attemptNumber,
      requestType: record.requestType,
      resultDigest,
      terminalState,
      result,
      completedAt: FieldValue.serverTimestamp(),
    };
    await db.runTransaction(async transaction => {
      await currentExecution(transaction);
      transaction.set(executionRef, { ...receipt, leaseToken: FieldValue.delete(), leaseExpiresAtMs: 0,
        failureCode: FieldValue.delete(), failedAt: FieldValue.delete() }, { merge: true });
      transaction.set(attemptRef, { event: 'DATA_RIGHTS_ATTEMPT_FINISHED', resultDigest,
        completedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(requestRef, { status: 'IN_REVIEW', executionState: terminalState,
        executionReceiptPath: executionRef.path, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return { replay: false, receipt };
  } catch (error) {
    let cleanupPending = false;
    if (record.requestType === 'EXPORT') {
      // An ambiguous/stale upload can only be removed from its own attempt path.
      try { await removePrivateDataRightsExportAttempt(ownerUid, parsed.data.requestId, canonicalDigest(leaseToken).slice(0, 32)); }
      catch { cleanupPending = true; }
    }
    const continuation = !cleanupPending && record.requestType === 'DELETE' ? continuationReason(error) : null;
    const counters = recordFailure({
      failureAttempts: request.failureAttempts,
      continuationDeliveries: request.continuationDeliveries,
    }, Boolean(continuation));
    await db.runTransaction(async transaction => {
      const [execution, currentRequest, ownAttempt] = await Promise.all([transaction.get(executionRef), transaction.get(requestRef), transaction.get(attemptRef)]);
      const active = execution.data(), current = currentRequest.data();
      if (ownAttempt.data()?.requestHash === request.requestHash && ownAttempt.data()?.event === 'DATA_RIGHTS_ATTEMPT_STARTED') {
        transaction.set(attemptRef, {
          event: continuation ? 'DATA_RIGHTS_ATTEMPT_CONTINUATION_REQUIRED' : 'DATA_RIGHTS_ATTEMPT_FAILED',
          privateExportCleanupPending: cleanupPending,
          failureCode: cleanupPending ? 'PRIVATE_EXPORT_CLEANUP_RECONCILIATION_REQUIRED'
            : continuation ? 'DATA_RIGHTS_EXECUTION_CONTINUATION_REQUIRED' : 'DATA_RIGHTS_EXECUTION_FAILED',
          ...counters,
          failedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      // An expired predecessor cannot mark its successor failed or revive approval.
      if (active?.event !== 'DATA_RIGHTS_EXECUTION_STARTED' || active.leaseToken !== leaseToken
        || active.requestHash !== request.requestHash || current?.ownerUid !== ownerUid
        || current.requestType !== record.requestType || current.status !== 'IN_REVIEW') return;
      transaction.set(executionRef, {
        event: continuation ? 'DATA_RIGHTS_EXECUTION_CONTINUATION_REQUIRED' : 'DATA_RIGHTS_EXECUTION_FAILED',
        failureCode: cleanupPending ? 'PRIVATE_EXPORT_CLEANUP_RECONCILIATION_REQUIRED'
          : continuation ? 'DATA_RIGHTS_EXECUTION_CONTINUATION_REQUIRED' : 'DATA_RIGHTS_EXECUTION_FAILED',
        ...counters,
        leaseToken: FieldValue.delete(), leaseExpiresAtMs: 0, failedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(requestRef, {
        status: 'IN_REVIEW',
        executionState: cleanupPending ? 'PROTECTED_STAGING_EXECUTION_FAILED_RECONCILIATION_REQUIRED'
          : continuation ? 'PROTECTED_STAGING_EXECUTION_CONTINUATION_REQUIRED' : 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    if (cleanupPending) throw httpsError('internal', 'Private export cleanup requires reconciliation.');
    if (continuation) throw httpsError('resource-exhausted', 'Bounded data-rights deletion continuation required.');
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (['unavailable', 'resource-exhausted', 'permission-denied', 'failed-precondition', 'unauthenticated'].includes(code)) throw error;
    // Storage/database errors can include owner IDs, private paths and payloads.
    throw httpsError('internal', 'Protected data-rights execution failed.');
  }
};

export const processDataRightsRequest = withAuthenticatedRole(['admin', 'operator'], handler);


