import { firestore } from 'firebase-admin';
import { JobEvent } from '../jobs/types';

const db = firestore();

export async function recordJobEvent(
  jobId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: unknown
): Promise<void> {
  const event: Omit<JobEvent, 'id' | 'ts'> = {
    jobId,
    level,
    message,
    meta,
  };

  await db.collection('jobEvents').add({
    ...event,
    ts: firestore.FieldValue.serverTimestamp(),
  });
}
