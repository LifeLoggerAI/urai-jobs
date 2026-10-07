import { createHash } from 'node:crypto';
import { FieldPath, FieldValue, getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { uploadToGcs } from '../core/gcs.js';
import { deleteCapturedRealityEngineJob, deleteCapturedRealityPublishedRuntimeForOwner } from './capturedRealityDerivativeRevocation.js';
import { assertPrivateDataRightsExportDestination, deleteOwnedPrivateLifeModel, exportOwnedPrivateLifeModel } from './privateLifeModelDataRights.js';

const DATA_RIGHTS_COLLECTION = 'dataRightsRequests';
const MAX_OWNED_JOBS = 2_000;
const EXECUTION_MODE = 'protected-staging';
const EXECUTION_SCHEMA = 'urai-jobs-data-rights-execution-v1';

const ExecuteSchema = z.object({
  requestId: z.string().trim().min(8).max(200),
  retentionDecisionReceiptId: z.string().trim().min(8).max(200),
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
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function buildExport(db: Firestore, requestId: string, ownerUid: string) {
  await assertPrivateDataRightsExportDestination();
  const [userSnap, jobs, privateLifeModel] = await Promise.all([
    db.collection('users').doc(ownerUid).get(),
    ownedJobs(db, ownerUid),
    exportOwnedPrivateLifeModel(db, ownerUid),
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
  const destination = `privacy/data-rights/${createHash('sha256').update(ownerUid).digest('hex')}/${requestId}/export.json`;
  const gcsRef = await uploadToGcs(bytes, destination, 'application/json');
  return { payload, recordCount: exportedJobs.length + privateLifeModel.records.length + (userSnap.exists ? 1 : 0), sha256, gcsRef };
}

async function executeDelete(db: Firestore, requestId: string, ownerUid: string) {
  const jobs = await ownedJobs(db, ownerUid);
  const ownerHash = createHash('sha256').update(ownerUid).digest('hex');
  const privateLifeModel = await deleteOwnedPrivateLifeModel(db, ownerUid, requestId);
  let queueDeletes = 0;
  let logDeletes = 0;
  let jobsAnonymized = 0;
  await deleteCapturedRealityPublishedRuntimeForOwner(ownerUid);

  for (const document of jobs) {
    const currentJob = document.data();
    // Fence in-flight worker/callback attempts before mutating owned records.
    await document.ref.update({ status: 'CANCELLED', lease: FieldValue.delete(), 'execution.asyncCallbackPending': false,
      'execution.leaseToken': FieldValue.delete(), 'execution.callbackLeaseToken': FieldValue.delete(),
      'execution.callbackTokenHash': FieldValue.delete(), 'execution.callbackDeadlineAt': FieldValue.delete(),
      'execution.capturedRealityAcceptedCallbackHash': FieldValue.delete() });
    if ((currentJob.jobType || currentJob.type) === 'memory.private-source.reconstruct-place') {
      // Preserve owner identity until the engine proves cleanup, so retries can
      // still locate a partially deleted reconstruction job.
      await deleteCapturedRealityEngineJob(document.id);
    }
    const logs = await document.ref.collection('logs').limit(500).get();
    if (logs.size >= 500) {
      throw httpsError('resource-exhausted', `Job ${document.id} has too many logs for bounded deletion; reconcile before retry.`);
    }
    const batch = db.batch();
    for (const log of logs.docs) {
      batch.delete(log.ref);
      logDeletes += 1;
    }
    const queueRef = db.collection('jobQueue').doc(document.id);
    const queueSnap = await queueRef.get();
    if (queueSnap.exists) {
      batch.delete(queueRef);
      queueDeletes += 1;
    }
    batch.set(document.ref, {
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
    await batch.commit();
    jobsAnonymized += 1;
  }

  // Jobs does not own Firebase Auth deletion, external provider derivatives, or
  // every cross-system artifact. Never mark the user's request globally complete.
  await db.collection('users').doc(ownerUid).set({
    dataRightsDeletionPendingCentralPrivacy: true,
    dataRightsDeletionRequestId: requestId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    jobsAnonymized,
    privateLifeModel,
    queueDeletes,
    logDeletes,
    unresolvedDomains: [
      'firebase-auth-account',
      'provider-side-derivatives',
      'external-artifacts-not-bound-to-jobs-storage',
      'cross-system-data-owned-by-other-urai-services',
      ...privateLifeModel.unresolvedDomains,
    ],
  };
}

const handler = async (data: unknown, _context: CallableContext) => {
  const parsed = ExecuteSchema.safeParse(data);
  if (!parsed.success) {
    throw httpsError('invalid-argument', 'Invalid governed data-rights execution request.', parsed.error.flatten());
  }
  const admission = executionAdmission();
  const db = getFirestore();
  const requestRef = db.collection(DATA_RIGHTS_COLLECTION).doc(parsed.data.requestId);
  const executionRef = requestRef.collection('audit').doc(`execution-${canonicalDigest(parsed.data.idempotencyKey).slice(0, 24)}`);

  const request = await db.runTransaction(async (transaction) => {
    const [requestSnap, priorExecution] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(executionRef),
    ]);
    if (!requestSnap.exists) throw httpsError('not-found', 'Data-rights request was not found.');
    const record = requestSnap.data() as RequestRecord;
    const prior = priorExecution.exists ? priorExecution.data() : null;
    if (prior?.event === 'DATA_RIGHTS_EXECUTION_FINISHED') return { replay: prior, record };
    const retry = prior?.event === 'DATA_RIGHTS_EXECUTION_FAILED'
      && record.status === 'IN_REVIEW' && record.executionState === 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE';
    if (prior && !retry) throw httpsError('failed-precondition', 'The exact data-rights execution attempt is already active or requires reconciliation.');
    if (!record.ownerUid || !['EXPORT', 'DELETE'].includes(String(record.requestType))) {
      throw httpsError('failed-precondition', 'Data-rights request schema requires reconciliation.');
    }
    if (record.status !== 'APPROVED' && !retry) {
      throw httpsError('failed-precondition', 'Only an explicitly APPROVED request can enter protected staging execution.');
    }
    const attemptNumber = Number(prior?.attemptNumber || 0) + 1;
    if (!Number.isSafeInteger(attemptNumber) || attemptNumber > 3) throw httpsError('resource-exhausted', 'The bounded data-rights retry budget is exhausted.');
    const execution = {
      event: 'DATA_RIGHTS_EXECUTION_STARTED',
      attemptNumber,
      schemaVersion: EXECUTION_SCHEMA,
      requestType: record.requestType,
      ownerHash: createHash('sha256').update(record.ownerUid).digest('hex'),
      retentionDecisionReceiptId: parsed.data.retentionDecisionReceiptId,
      admission,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (retry) transaction.set(executionRef, execution, { merge: true });
    else transaction.create(executionRef, execution);
    transaction.set(requestRef, {
      status: 'IN_REVIEW',
      executionState: 'PROTECTED_STAGING_EXECUTION_IN_PROGRESS',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { replay: null, record };
  });

  if (request.replay) return { replay: true, receipt: request.replay };
  const record = request.record;
  const ownerUid = String(record.ownerUid);
  try {
    const result = record.requestType === 'EXPORT'
      ? await buildExport(db, parsed.data.requestId, ownerUid)
      : await executeDelete(db, parsed.data.requestId, ownerUid);
    const resultDigest = canonicalDigest(result);
    const terminalState = record.requestType === 'EXPORT'
      ? 'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED'
      : 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED';
    const receipt = {
      event: 'DATA_RIGHTS_EXECUTION_FINISHED',
      schemaVersion: EXECUTION_SCHEMA,
      requestType: record.requestType,
      resultDigest,
      terminalState,
      result,
      completedAt: FieldValue.serverTimestamp(),
    };
    await executionRef.set(receipt, { merge: true });
    await requestRef.set({
      status: 'IN_REVIEW',
      executionState: terminalState,
      executionReceiptPath: executionRef.path,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { replay: false, receipt };
  } catch (error) {
    await executionRef.set({
      event: 'DATA_RIGHTS_EXECUTION_FAILED',
      failure: error instanceof Error ? error.message : 'unknown-error',
      failedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await requestRef.set({
      status: 'IN_REVIEW',
      executionState: 'PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw error;
  }
};

export const processDataRightsRequest = withAuthenticatedRole(['admin', 'operator'], handler);
