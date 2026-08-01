import * as functions from 'firebase-functions/v1';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { createLog } from '../core/logging.js';
import { terminalEventId } from '../core/jobsReliability.js';

const OUTBOX_COLLECTION = 'jobTerminalEventOutbox';
const TERMINAL_STATES = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);

const definedEntries = (input: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
};

export const onJobTerminalEvent = functions.firestore
  .document('jobs/{jobId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (TERMINAL_STATES.has(before.status) || !TERMINAL_STATES.has(after.status)) return;

    const jobId = String(after.id ?? context.params.jobId);
    const eventId = terminalEventId(jobId, String(after.status));
    const eventPayload = definedEntries({
      eventId,
      eventType: 'job.terminal',
      jobId,
      rootJobId: after.rootJobId,
      correlationId: after.correlationId,
      type: after.type ?? after.jobType,
      status: after.status,
      targetSystem: after.target?.system,
      tenantId: after.tenantId,
      orgId: after.orgId,
      ownerUid: after.ownerUid,
      progress: after.progress,
      resultRef: after.result?.resultId,
      errorCode: after.error?.code,
      emittedAt: new Date().toISOString(),
    });

    const db = getFirestore();
    const outboxRef = db.collection(OUTBOX_COLLECTION).doc(eventId);

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(outboxRef);
      if (existing.exists) return;

      transaction.create(outboxRef, {
        eventId,
        jobId,
        eventType: 'job.terminal',
        payload: eventPayload,
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await createLog(
      after.tenantId,
      'INFO',
      'TRIGGER',
      'JobTerminalEvent',
      `Job ${jobId} reached terminal state: ${after.status}`,
      { ...eventPayload, delivery: 'outbox-pending' }
    );
  });
