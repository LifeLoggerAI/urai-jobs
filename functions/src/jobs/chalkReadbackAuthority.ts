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
