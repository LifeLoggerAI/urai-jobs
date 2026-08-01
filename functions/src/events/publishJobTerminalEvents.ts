import { PubSub } from '@google-cloud/pubsub';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { ulid } from 'ulid';
import { nextOutboxRetryDelayMs } from '../core/jobsReliability.js';

const OUTBOX_COLLECTION = 'jobTerminalEventOutbox';
const TERMINAL_EVENT_TOPIC = process.env.URAI_JOBS_TERMINAL_EVENT_TOPIC || 'job-terminal-events';
const MAX_ATTEMPTS = Math.max(1, parseInt(process.env.URAI_JOBS_TERMINAL_EVENT_MAX_ATTEMPTS || '', 10) || 8);
const BATCH_SIZE = Math.max(1, Math.min(100, parseInt(process.env.URAI_JOBS_TERMINAL_EVENT_BATCH_SIZE || '', 10) || 25));
const LEASE_DURATION_MS = 60_000;
const pubsub = new PubSub();

type OutboxRecord = {
  eventId?: string;
  jobId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  status?: 'PENDING' | 'PUBLISHING' | 'DELIVERED' | 'DEAD';
  attemptCount?: number;
  nextAttemptAt?: unknown;
  leaseToken?: string;
  leaseExpiresAt?: unknown;
};

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

function isDue(record: OutboxRecord, nowMs: number): boolean {
  if (record.status === 'PENDING') {
    const nextAttemptMs = timestampMillis(record.nextAttemptAt);
    return nextAttemptMs === null || nextAttemptMs <= nowMs;
  }
  if (record.status === 'PUBLISHING') {
    const leaseExpiresMs = timestampMillis(record.leaseExpiresAt);
    return leaseExpiresMs === null || leaseExpiresMs <= nowMs;
  }
  return false;
}

export const publishJobTerminalEvents = onSchedule('every 1 minutes', async () => {
  const db = getFirestore();
  const nowMs = Date.now();
  const candidates = await db
    .collection(OUTBOX_COLLECTION)
    .where('status', 'in', ['PENDING', 'PUBLISHING'])
    .limit(BATCH_SIZE * 2)
    .get();

  const due = candidates.docs.filter((doc) => isDue(doc.data() as OutboxRecord, nowMs)).slice(0, BATCH_SIZE);

  await Promise.all(due.map(async (doc) => {
    const leaseToken = ulid();
    const claimed = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(doc.ref);
      if (!current.exists) return null;

      const record = current.data() as OutboxRecord;
      if (!isDue(record, Date.now())) return null;

      const attemptCount = Math.max(0, record.attemptCount ?? 0) + 1;
      if (attemptCount > MAX_ATTEMPTS) {
        transaction.update(doc.ref, {
          status: 'DEAD',
          attemptCount: attemptCount - 1,
          leaseToken: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return null;
      }

      transaction.update(doc.ref, {
        status: 'PUBLISHING',
        attemptCount,
        leaseToken,
        leaseExpiresAt: Timestamp.fromMillis(Date.now() + LEASE_DURATION_MS),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { ...record, attemptCount, leaseToken };
    });

    if (!claimed?.eventId || !claimed.payload) return;

    try {
      const messageId = await pubsub.topic(TERMINAL_EVENT_TOPIC).publishMessage({
        json: claimed.payload,
        attributes: {
          eventId: claimed.eventId,
          eventType: claimed.eventType || 'job.terminal',
          jobId: claimed.jobId || '',
        },
      });

      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(doc.ref);
        if (!current.exists || current.data()?.leaseToken !== leaseToken) return;
        transaction.update(doc.ref, {
          status: 'DELIVERED',
          messageId,
          deliveredAt: FieldValue.serverTimestamp(),
          leaseToken: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
          lastError: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(doc.ref);
        if (!current.exists || current.data()?.leaseToken !== leaseToken) return;

        const attemptCount = Math.max(1, Number(current.data()?.attemptCount) || 1);
        const dead = attemptCount >= MAX_ATTEMPTS;
        transaction.update(doc.ref, {
          status: dead ? 'DEAD' : 'PENDING',
          nextAttemptAt: dead
            ? FieldValue.delete()
            : Timestamp.fromMillis(Date.now() + nextOutboxRetryDelayMs(attemptCount)),
          leaseToken: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
          lastError: message.slice(0, 1000),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      console.error(`Failed to publish terminal event ${claimed.eventId}:`, error);
    }
  }));
});
