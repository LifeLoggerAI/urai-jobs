import { ulid } from 'ulid';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, type CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import {
  bindingMatches,
  buildIdempotencyBindingId,
  buildRequestFingerprint,
  type IdempotencyBinding,
} from '../core/jobsReliability.js';
import { StudioLifeMovieRenderPayloadSchema, assertLifeMovieTenantPaths } from './studioLifeMovieContract.js';

const MAX_PAYLOAD_BYTES = parseInt(process.env.URAI_JOBS_MAX_PAYLOAD_BYTES || '', 10) || 32768;
const MAX_CREATE_PER_MINUTE = parseInt(process.env.URAI_JOBS_CREATE_RATE_LIMIT_PER_MINUTE || '', 10) || 10;
const IDEMPOTENCY_COLLECTION = 'jobIdempotencyBindings';
const COMMUNICATIONS_TENANT_ID_PATTERN = /^tenant_[a-zA-Z0-9_-]{6,64}$/;

const ALLOWED_JOB_TYPE_PATTERNS = [
  /^narrator\.tts$/,
  /^asset[.-]/,
  /^spatial[.-]/,
  /^studio[.-]/,
  /^career\./,
  /^content[.-]/,
  /^storytime\./,
  /^analytics\./,
  /^communications\.message\.send$/,
  /^admin\./,
  /^deployment\./,
  /^proof\./,
  /^memory\.private-source\.transcribe$/,
];

const PrivateSourcePayloadSchema = z.object({
  sourceReceiptRef: z.string().trim().regex(/^psr_[A-Za-z0-9_-]{16,128}$/),
  requestedPurpose: z.enum(['transcribe', 'memory-index']),
  locale: z.string().trim().min(2).max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional(),
  requestReceipt: z.string().trim().regex(/^req_[A-Za-z0-9_-]{12,128}$/).optional(),
}).strict();

const CommunicationsMessagePayloadSchema = z.object({
  channel: z.literal('email').default('email'),
  templateId: z.string().trim().min(6).max(128).regex(/^template_[A-Za-z0-9_-]+$/),
  recipientUid: z.string().trim().min(6).max(128),
  vars: z.record(z.unknown()).default({}),
  urgency: z.enum(['normal', 'urgent']).default('normal'),
}).strict();


function isPrivateSourceJobType(jobType: string): boolean {
  return jobType === 'memory.private-source.transcribe';
}

const JobConsentSchema = z.object({
  purpose: z.string().trim().min(1).max(160),
  policyVersion: z.string().trim().min(1).max(80),
  decisionReceiptId: z.string().trim().min(1).max(160),
}).strict();

const CreateJobSchema = z.object({
  jobType: z.string().min(3, 'Job type must be at least 3 characters').max(80),
  payload: z.record(z.any()),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
  consent: JobConsentSchema.optional(),
});

function payloadSizeBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload ?? {}), 'utf8');
}

function isAllowedJobType(jobType: string): boolean {
  return ALLOWED_JOB_TYPE_PATTERNS.some((pattern) => pattern.test(jobType));
}

function isCommunicationsJobType(jobType: string): boolean {
  return jobType.startsWith('communications.');
}

function userRecord(user: unknown): Record<string, unknown> {
  return user && typeof user === 'object' ? (user as Record<string, unknown>) : {};
}

function userOrgId(user: unknown): string | null {
  const raw = userRecord(user).orgId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function userTenantId(user: unknown): string | null {
  const raw = userRecord(user).tenantId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function hasJobCreatePermission(user: unknown): boolean {
  const record = userRecord(user);
  const rawPermissions = record.permissions;
  const permissions = Array.isArray(rawPermissions) ? rawPermissions.map((value) => String(value)) : [];
  return record.role === 'admin' || record.role === 'operator' || permissions.includes('jobs:create');
}

async function assertCreateRateLimit(uid: string) {
  const db = getFirestore();
  const windowStart = Timestamp.fromMillis(Date.now() - 60_000);
  const recent = await db
    .collection('jobs')
    .where('ownerUid', '==', uid)
    .where('createdAt', '>=', windowStart)
    .limit(MAX_CREATE_PER_MINUTE + 1)
    .get();

  if (recent.size >= MAX_CREATE_PER_MINUTE) {
    throw httpsError('resource-exhausted', 'Job create rate limit exceeded. Try again later.');
  }
}

function resolveExistingBinding(
  binding: Partial<IdempotencyBinding>,
  expected: Omit<IdempotencyBinding, 'jobId'>
): { jobId: string; deduplicated: true } {
  if (!bindingMatches(binding, expected) || typeof binding.jobId !== 'string' || !binding.jobId) {
    throw httpsError(
      'already-exists',
      'The idempotency key is already bound to a different job request.'
    );
  }
  return { jobId: binding.jobId, deduplicated: true };
}

const handler = async (data: any, context: CallableContext, user: unknown) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw httpsError('unauthenticated', 'User must be authenticated.');
  }

  if (!hasJobCreatePermission(user)) {
    throw httpsError('permission-denied', 'User is not allowed to create runtime jobs.');
  }

  const validationResult = CreateJobSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid job data.', validationResult.error.flatten());
  }

  const { jobType, payload, idempotencyKey, consent } = validationResult.data;
  if (!isAllowedJobType(jobType)) {
    throw httpsError('invalid-argument', `Unsupported job type: ${jobType}`);
  }

  if (isPrivateSourceJobType(jobType)) {
    if (!consent) {
      throw httpsError(
        'failed-precondition',
        'Private-source jobs require canonical consent purpose, policy version, and decision receipt context.'
      );
    }
    const privateSource = PrivateSourcePayloadSchema.safeParse(payload);
    if (!privateSource.success) {
      throw httpsError(
        'invalid-argument',
        'Private-source jobs require an opaque sourceReceiptRef and purpose-only payload; raw media URLs, transcript text, identities, addresses, and arbitrary fields are rejected.',
        privateSource.error.flatten()
      );
    }
  }

  if (jobType === 'communications.message.send') {
    const communicationsMessage = CommunicationsMessagePayloadSchema.safeParse(payload);
    if (!communicationsMessage.success) {
      throw httpsError(
        'invalid-argument',
        'Communications jobs require the server-supported email channel, templateId, recipientUid, vars, and optional urgency only; raw recipient addresses and caller-owned destinations are rejected.',
        communicationsMessage.error.flatten()
      );
    }
  }


  if (jobType === 'studio.render.video') {
    const lifeMovieRender = StudioLifeMovieRenderPayloadSchema.safeParse(payload);
    if (!lifeMovieRender.success) {
      throw httpsError(
        'invalid-argument',
        'studio.render.video requires the provenance-bound URAI Life Movies render contract; arbitrary URLs, public release authorization, provider execution authorization, and Spatial-required jobs are rejected.',
        lifeMovieRender.error.flatten()
      );
    }
  }

  const payloadBytes = payloadSizeBytes(payload);
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw httpsError('invalid-argument', `Payload is too large. Max bytes: ${MAX_PAYLOAD_BYTES}`);
  }

  const orgId = userOrgId(user);
  const tenantId = userTenantId(user);

  if (jobType === 'studio.render.video') {
    if (!tenantId) {
      throw httpsError(
        'failed-precondition',
        'Studio Life Movies render jobs require a server-owned tenantId on the authenticated user record.'
      );
    }
    const renderPayload = StudioLifeMovieRenderPayloadSchema.parse(payload);
    try {
      assertLifeMovieTenantPaths(renderPayload, tenantId);
    } catch {
      throw httpsError('permission-denied', 'Life Movies source and output paths must remain inside the authenticated tenant/project boundary.');
    }
  }

  const communicationsJob = isCommunicationsJobType(jobType);
  if (communicationsJob && !tenantId) {
    throw httpsError(
      'failed-precondition',
      'Communications jobs require a server-owned tenantId on the authenticated user record.'
    );
  }
  if (communicationsJob && tenantId && !COMMUNICATIONS_TENANT_ID_PATTERN.test(tenantId)) {
    throw httpsError(
      'failed-precondition',
      'Communications jobs require a canonical server-owned tenantId matching the Communications tenant contract.'
    );
  }

  const db = getFirestore();
  const fingerprintPayload = communicationsJob
    ? { payload, tenantId }
    : payload;
  const requestFingerprint = buildRequestFingerprint(jobType, fingerprintPayload);
  const expectedBinding = { ownerUid: uid, jobType, requestFingerprint };
  const bindingRef = idempotencyKey
    ? db.collection(IDEMPOTENCY_COLLECTION).doc(buildIdempotencyBindingId(uid, jobType, idempotencyKey))
    : null;

  if (bindingRef) {
    const existing = await bindingRef.get();
    if (existing.exists) {
      return resolveExistingBinding(existing.data() as Partial<IdempotencyBinding>, expectedBinding);
    }
  }

  await assertCreateRateLimit(uid);

  const jobId = ulid();
  const now = FieldValue.serverTimestamp();

  const newJob: Job = {
    jobId,
    type: jobType,
    jobType,
    status: 'PENDING',
    payload,
    ownerUid: uid,
    ...(consent ? { consent } : {}),
    ...(orgId ? { orgId } : {}),
    ...(tenantId ? { tenantId } : {}),
    retryCount: 0,
    execution: {
      attemptCount: 0,
      maxAttempts: 3,
    },
  };

  const newQueueEntry: JobQueueEntry = {
    jobId,
    jobType,
    status: 'PENDING',
    attemptCount: 0,
  };

  try {
    return await db.runTransaction(async (transaction) => {
      if (bindingRef) {
        const existing = await transaction.get(bindingRef);
        if (existing.exists) {
          return resolveExistingBinding(existing.data() as Partial<IdempotencyBinding>, expectedBinding);
        }
      }

      const jobRef = jobDoc(jobId);
      const queueRef = jobQueueEntryDoc(jobId);
      const logRef = jobRef.collection('logs').doc('created');

      transaction.create(jobRef, {
        ...newJob,
        createdAt: now,
        updatedAt: now,
      });

      transaction.create(queueRef, {
        ...newQueueEntry,
        availableAt: now,
        createdAt: now,
      });

      transaction.create(logRef, {
        level: 'info',
        source: 'createJob',
        message: 'Job created and queued by authorized caller.',
        metadata: {
          jobType,
          ownerUid: uid,
          orgId,
          tenantId,
          payloadBytes,
          idempotencyBound: Boolean(bindingRef),
        },
        createdAt: now,
      });

      if (bindingRef) {
        transaction.create(bindingRef, {
          ...expectedBinding,
          jobId,
          createdAt: now,
        });
      }

      return { jobId, deduplicated: false };
    });
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    console.error('Error creating idempotent job transaction:', error);
    throw httpsError('internal', 'Failed to create job.');
  }
};

export const createJob = withAuthenticatedRole(['admin', 'operator', 'user'], handler);
