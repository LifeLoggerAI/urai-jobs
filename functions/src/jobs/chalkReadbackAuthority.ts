// Redacted readback for Chalk only. Source content, payloads, media and logs
// are never returned by this projection. Authentication happens separately.
export type ChalkJobSummary = Readonly<{
  jobId: string;
  ownerUid: string;
  type: 'engineering.verify';
  status: 'PENDING' | 'LEASED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'DEAD' | 'CANCELLED';
}>;
const validId = /^[^/\s]{1,128}$/;
const validJobId = /^[A-Za-z0-9_-]{1,128}$/;
const allowed = new Set(['PENDING', 'LEASED', 'RUNNING', 'SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);
export function redactChalkJobDocuments(
  documents: ReadonlyArray<{ id: string; data: () => unknown }>,
  ownerUid: string,
): ChalkJobSummary[] {
  if (typeof ownerUid !== 'string' || !validId.test(ownerUid)) throw Error('CHALK_READBACK_OWNER');
  if (!Array.isArray(documents) || documents.length > 40) throw Error('CHALK_READBACK_BOUNDS');
  const visible: ChalkJobSummary[] = [];
  for (const snap of documents) {
    const doc = snap?.data();
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) continue;
    const fields = doc as Record<string, unknown>;
    if (!validJobId.test(snap.id) || fields.ownerUid !== ownerUid ||
        fields.type !== 'engineering.verify' || (fields.jobType !== undefined && fields.jobType !== 'engineering.verify') ||
        !allowed.has(String(fields.status))) continue;
    visible.push(Object.freeze({ jobId: snap.id, ownerUid,
      type: 'engineering.verify', status: fields.status as ChalkJobSummary['status'] }));
  }
  return visible;
}

// A master admission flag does not prove absence from the actual job queue.
// Only represent a job as HELD_UNQUEUED after a server-side queue-document read.
export function projectChalkHeldReadback(
  status: unknown, admission: unknown, queueExists: unknown,
): Readonly<{admission: 'HELD_UNQUEUED' | 'UNVERIFIED'; queued: false | null}> {
  if (queueExists !== true && queueExists !== false) throw Error('CHALK_READBACK_QUEUE_NOT_OBSERVED');
  const a = admission !== null && typeof admission === 'object' && !Array.isArray(admission)
    ? admission as Record<string, unknown> : {};
  const held = status === 'PENDING' && a.state === 'HELD_UNQUEUED' &&
    a.environment === 'firestore-emulator-only' && a.workerAdmitted === false &&
    a.providerSpendUsd === 0 && a.humanApprovalRequired === true && queueExists === false;
  return Object.freeze({admission: held ? 'HELD_UNQUEUED' : 'UNVERIFIED', queued: held ? false : null});
}
