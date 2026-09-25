import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';

const DATA_RIGHTS_COLLECTION = 'dataRightsRequests';

const SubmitSchema = z.object({
  requestType: z.enum(['EXPORT', 'DELETE']),
  format: z.enum(['json', 'csv']).optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();

const ListSchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

const GetSchema = z.object({
  requestId: z.string().trim().min(8).max(200),
}).strict();

function ownerUid(context: CallableContext): string {
  const uid = context.auth?.uid;
  if (!uid) throw httpsError('unauthenticated', 'Authentication is required.');
  return uid;
}

const submitHandler = async (data: unknown, context: CallableContext) => {
  const parsed = SubmitSchema.safeParse(data);
  if (!parsed.success) {
    throw httpsError('invalid-argument', 'Invalid data-rights request.', parsed.error.flatten());
  }

  const uid = ownerUid(context);
  const db = getFirestore();
  const requestRef = db.collection(DATA_RIGHTS_COLLECTION).doc();
  const now = FieldValue.serverTimestamp();

  const record = {
    requestId: requestRef.id,
    ownerUid: uid,
    requestType: parsed.data.requestType,
    requestedFormat: parsed.data.requestType === 'EXPORT' ? (parsed.data.format || 'json') : null,
    note: parsed.data.note || null,
    status: 'PENDING',
    executionState: 'HARD_OFF_PENDING_GOVERNED_WORKER',
    createdAt: now,
    updatedAt: now,
  };

  await requestRef.create(record);
  await requestRef.collection('audit').doc('submitted').create({
    event: 'DATA_RIGHTS_REQUEST_SUBMITTED',
    actorUid: uid,
    status: 'PENDING',
    createdAt: now,
  });

  return {
    requestId: requestRef.id,
    status: 'PENDING',
    executionState: 'HARD_OFF_PENDING_GOVERNED_WORKER',
  };
};

const getHandler = async (data: unknown, context: CallableContext) => {
  const parsed = GetSchema.safeParse(data);
  if (!parsed.success) throw httpsError('invalid-argument', 'requestId is required.');

  const uid = ownerUid(context);
  const snap = await getFirestore().collection(DATA_RIGHTS_COLLECTION).doc(parsed.data.requestId).get();
  if (!snap.exists) throw httpsError('not-found', 'Data-rights request was not found.');

  const record = snap.data() || {};
  if (record.ownerUid !== uid) throw httpsError('permission-denied', 'You do not have access to this request.');

  return {
    request: {
      requestId: snap.id,
      requestType: record.requestType,
      requestedFormat: record.requestedFormat || null,
      status: record.status,
      executionState: record.executionState,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    },
  };
};

const listHandler = async (data: unknown) => {
  const parsed = ListSchema.safeParse(data ?? {});
  if (!parsed.success) throw httpsError('invalid-argument', 'Invalid data-rights list request.');

  let query: FirebaseFirestore.Query = getFirestore().collection(DATA_RIGHTS_COLLECTION);
  if (parsed.data.status) query = query.where('status', '==', parsed.data.status);
  const snap = await query.orderBy('createdAt', 'desc').limit(parsed.data.limit).get();

  return {
    requests: snap.docs.map((doc) => {
      const record = doc.data();
      return {
        requestId: doc.id,
        ownerUid: record.ownerUid,
        requestType: record.requestType,
        requestedFormat: record.requestedFormat || null,
        status: record.status,
        executionState: record.executionState,
        createdAt: record.createdAt || null,
        updatedAt: record.updatedAt || null,
      };
    }),
  };
};

export const submitDataRightsRequest = withAuthenticatedRole(['user', 'admin', 'operator'], submitHandler);
export const getDataRightsRequest = withAuthenticatedRole(['user', 'admin', 'operator'], getHandler);
export const listDataRightsRequests = withAuthenticatedRole(['admin', 'operator'], listHandler);
