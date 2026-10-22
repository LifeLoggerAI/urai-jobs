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

// The native Jobs-owner readback intentionally does not require Spatial consent.
// This separate two-project bridge projection does: only a record minted for
// the exact approved Spatial principal AND binding revision may cross it.
type BoundChalkDocument = { id: string; data: () => unknown };
const boundUid = (x: unknown): x is string =>
  typeof x === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(x);
export function redactChalkBoundJobDocuments<T extends BoundChalkDocument>(
  documents: ReadonlyArray<T>, jobsUid: unknown, spatialUid: unknown, bindingRevision: unknown,
): T[] {
  if (!boundUid(jobsUid) || !boundUid(spatialUid) ||
      !Number.isSafeInteger(bindingRevision) || Number(bindingRevision) < 1)
    throw Error('CHALK_READBACK_SCOPE');
  if (!Array.isArray(documents) || documents.length > 40) throw Error('CHALK_READBACK_BOUNDS');
  return documents.filter(snapshot => {
    const raw = snapshot?.data();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const record = raw as Record<string, unknown>;
    return record.ownerUid === jobsUid && record.chalkOriginSpatialUid === spatialUid &&
      record.chalkBindingRevision === bindingRevision &&
      record.type === 'engineering.verify' && record.jobType === 'engineering.verify';
  });
}

// Scope the database query BEFORE applying the limit: a client-side filter
// after a Jobs-owner-only limit can hide valid held jobs behind stale ones.
// Firestore's query builder is immutable, so no unscoped query is executed.
export function scopeChalkBoundReadbackQuery<QueryT extends {
  where(fieldPath: string, opStr: '==', value: string | number): QueryT;
  limit(limit: number): QueryT;
}>(
  collection: {where(fieldPath: string, opStr: '==', value: string | number): QueryT},
  jobsUid: unknown, spatialUid: unknown, bindingRevision: unknown, limit: unknown,
): QueryT {
  if (!boundUid(jobsUid) || !boundUid(spatialUid) ||
      !Number.isSafeInteger(bindingRevision) || Number(bindingRevision) < 1)
    throw Error('CHALK_READBACK_SCOPE');
  if (!Number.isSafeInteger(limit) || Number(limit) < 1 || Number(limit) > 40)
    throw Error('CHALK_READBACK_QUERY_LIMIT');
  return collection.where('ownerUid', '==', jobsUid)
    .where('chalkOriginSpatialUid', '==', spatialUid)
    .where('chalkBindingRevision', '==', Number(bindingRevision))
    .where('type', '==', 'engineering.verify')
    .where('jobType', '==', 'engineering.verify')
    .limit(Number(limit));
}
