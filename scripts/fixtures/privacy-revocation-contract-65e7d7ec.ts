import { createHash, timingSafeEqual } from 'node:crypto';

/** The independent Privacy outbox v1 and Jobs consumer v2 schemas.
 * This module performs deterministic transformation and acknowledgement
 * verification, but does NOT send a provider request or certify delivery. */
export type JobsRevocationEventV2 = Readonly<{
  type: 'consent.revoked.v2';
  eventId: string;
  ownerUid: string;
  purpose: string;
  policyVersion: string;
  correlationId: string;
  revokedAt: string;
  sourceReceiptHash: string;
}>;

const HEX64 = /^[0-9a-f]{64}$/;
const IDENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,399}$/;
// Bound to Jobs' reviewed Firebase project (urai-jobs), region us-central1.
// New gen2/Cloud Run hosts require separate immutable deployment provenance.
const PINNED_JOBS_HOST = 'us-central1-urai-jobs.cloudfunctions.net';
function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PRIVACY_JOBS_REVOCATION_INVALID_OBJECT');
  return value as Record<string, unknown>;
}
function field(value: unknown, name: string, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`PRIVACY_JOBS_REVOCATION_INVALID_${name}`);
  return value;
}
function isoDate(value: unknown): string {
  try {
    // Firestore Admin Timestamp, never a client-supplied value.
    if (!value || typeof value !== 'object' || typeof (value as { toDate?: unknown }).toDate !== 'function') {
      throw new Error('timestamp');
    }
    const raw = (value as { toDate: () => Date }).toDate();
    if (!(raw instanceof Date) || !Number.isFinite(raw.getTime())) throw new Error('timestamp');
    return raw.toISOString();
  } catch {
    throw new Error('PRIVACY_JOBS_REVOCATION_NO_SERVER_TIMESTAMP');
  }
}

/** Fail closed if the v1 source is missing, forged, truncated or modified.
 * The eventId and integrityHash are bound to the original publisher's exact
 * canonical digest structure, not supplied as unchecked transport authority. */
export function buildJobsRevocationEventV2(outboxId: string, input: unknown): JobsRevocationEventV2 {
  const data = object(input);
  if (data.schemaVersion !== 'consent.revoked.v1' || data.status !== 'pending') {
    throw new Error('PRIVACY_JOBS_REVOCATION_NOT_PENDING_V1');
  }
  const eventId = field(data.eventId, 'EVENT_ID', HEX64);
  if (outboxId !== eventId) throw new Error('PRIVACY_JOBS_REVOCATION_ID_MISMATCH');
  const ownerUid = field(data.uid, 'OWNER', IDENT);
  const purpose = field(data.purpose, 'PURPOSE', IDENT);
  const consentTier = field(data.consentTier, 'TIER', /^C[1-9][0-9]*$/);
  const policyVersion = field(data.policyVersion, 'POLICY_VERSION', /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
  const sourceReceiptHash = field(data.sourceReceiptHash, 'SOURCE_HASH', HEX64);
  const recordId = field(data.consentRecordId, 'RECORD_ID', RECORD_ID);
  if (recordId !== `${ownerUid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, '_')}`) {
    throw new Error('PRIVACY_JOBS_REVOCATION_RECORD_SCOPE_MISMATCH');
  }
  const expectedId = hash({
    schemaVersion: 'consent.revoked.v1', recordId, uid: ownerUid,
    purpose, consentTier, policyVersion, receiptHash: sourceReceiptHash,
  });
  if (expectedId !== eventId || data.integrityHash !== hash({ eventId, recordId, uid: ownerUid, purpose })) {
    throw new Error('PRIVACY_JOBS_REVOCATION_PUBLISHER_INTEGRITY_MISMATCH');
  }
  const revokedAt = isoDate(data.createdAt);
  return {
    type: 'consent.revoked.v2', eventId, ownerUid, purpose, policyVersion,
    correlationId: `revocation:${eventId}`, revokedAt, sourceReceiptHash,
  };
}

/** Same key order and digest as urai-jobs canonicalSourceRevocationAckHash
 * pinned to Jobs PR #234. Not a signature; caller MUST also verify the HTTPS
 * endpoint and secret-bound consumer identity before trusting its response. */
export function jobsRevocationAckHash(event: JobsRevocationEventV2): string {
  return hash({
    type: 'consent.revoked.v2', eventId: event.eventId,
    ownerUid: event.ownerUid, purpose: event.purpose,
    policyVersion: event.policyVersion, sourceReceiptHash: event.sourceReceiptHash,
    correlationId: event.correlationId, revokedAt: event.revokedAt, status: 'blocked',
  });
}
export function verifyJobsRevocationResponse(event: JobsRevocationEventV2, value: unknown): boolean {
  try {
    const response = object(value);
    if (response.ok !== true) return false;
    const ack = object(response.acknowledgement);
    if (ack.consumerId !== 'urai-jobs' || ack.eventType !== event.type ||
        ack.eventId !== event.eventId || ack.ownerUid !== event.ownerUid ||
        ack.purpose !== event.purpose || ack.policyVersion !== event.policyVersion ||
        ack.sourceReceiptHash !== event.sourceReceiptHash ||
        ack.correlationId !== event.correlationId || ack.revokedAt !== event.revokedAt ||
        ack.status !== 'blocked' || typeof ack.integrityHash !== 'string' ||
        !HEX64.test(ack.integrityHash)) return false;
    const expected = Buffer.from(jobsRevocationAckHash(event), 'hex');
    const actual = Buffer.from(ack.integrityHash, 'hex');
    if (!timingSafeEqual(expected, actual)) return false;
    const summary = object(ack.derivativeInvalidation);
    if (summary.purpose !== event.purpose) return false;
    for (const key of ['jobsScanned', 'jobsInvalidated', 'plansInvalidated', 'storageObjectsDeleted']) {
      if (!Number.isSafeInteger(summary[key]) || (summary[key] as number) < 0) return false;
    }
    if ((summary.jobsInvalidated as number) > (summary.jobsScanned as number)) return false;
    // Jobs only scans and deletes Life Movie derivatives for this purpose.
    // Do not accept fabricated cleanup counts for unrelated consent purposes.
    if (event.purpose !== 'life-movie.render' &&
        ['jobsScanned', 'jobsInvalidated', 'plansInvalidated', 'storageObjectsDeleted']
          .some((key) => summary[key] !== 0)) return false;
    return true;
  } catch { return false; }
}

export type JobsRevocationTransport = Readonly<{
  endpoint: string;
  expectedHost: string;
  bearerToken: string;
  request?: typeof fetch;
}>;

/** Secure transport primitive, deliberately NOT a scheduled/event-triggered
 * dispatcher. The caller must separately enforce trusted configuration,
 * durable retries, per-consumer state, and least-privilege deployment. */
export async function sendJobsRevocationEvent(
  event: JobsRevocationEventV2,
  transport: JobsRevocationTransport,
): Promise<Readonly<{ eventId: string; consumerId: 'urai-jobs'; acknowledgementHash: string }>> {
  const { endpoint, expectedHost, bearerToken } = transport;
  if (typeof endpoint !== 'string' || typeof expectedHost !== 'string') {
    throw new Error('PRIVACY_JOBS_ENDPOINT_NOT_CONFIGURED');
  }
  let url: URL;
  try { url = new URL(endpoint); }
  catch { throw new Error('PRIVACY_JOBS_ENDPOINT_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.search || url.hash || url.pathname !== '/ingestConsentRevocation' ||
      url.hostname !== expectedHost || url.hostname !== PINNED_JOBS_HOST) {
    throw new Error('PRIVACY_JOBS_ENDPOINT_NOT_PINNED');
  }
  if (typeof bearerToken !== 'string' || bearerToken.length < 32 || bearerToken.length > 4096 ||
      /[\r\n]/.test(bearerToken)) {
    throw new Error('PRIVACY_JOBS_TOKEN_UNAVAILABLE');
  }
  if (!HEX64.test(event.eventId) || !HEX64.test(event.sourceReceiptHash) ||
      event.correlationId !== `revocation:${event.eventId}` ||
      !IDENT.test(event.ownerUid) || !IDENT.test(event.purpose)) {
    throw new Error('PRIVACY_JOBS_EVENT_NOT_VALIDATED');
  }
  const sender = transport.request ?? fetch;
  const response = await sender(url.href, {
    method: 'POST', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(event),
  });
  if (!response.ok || response.status !== 200) throw new Error('PRIVACY_JOBS_DELIVERY_UNCONFIRMED');
  const type = response.headers.get('content-type') || '';
  if (!/^application\/json(?:;|$)/i.test(type)) throw new Error('PRIVACY_JOBS_ACK_CONTENT_TYPE');
  // Do not buffer unbounded provider responses before enforcing size limits.
  // The earlier post-response.text() check could exhaust process memory.
  const MAX_ACK_BYTES = 16384;
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^[0-9]+$/.test(declaredLength) ||
        !Number.isSafeInteger(Number(declaredLength)) || Number(declaredLength) > MAX_ACK_BYTES) {
      throw new Error('PRIVACY_JOBS_ACK_OVERSIZE');
    }
  }
  let body: string;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ACK_BYTES) {
          await reader.cancel();
          throw new Error('PRIVACY_JOBS_ACK_OVERSIZE');
        }
        chunks.push(Buffer.from(value));
      }
      // Buffer.toString() replaces malformed UTF-8 with U+FFFD. Treat an
      // acknowledgement as untrusted bytes: any lossy decoding invalidates
      // its authority. Preserve existing JSON BOM rejection semantics.
      try {
        body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
          .decode(Buffer.concat(chunks, total));
      } catch {
        throw new Error('PRIVACY_JOBS_ACK_INVALID_UTF8');
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    // Used by test fakes without a ReadableStream; live fetch always streams.
    body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_ACK_BYTES) throw new Error('PRIVACY_JOBS_ACK_OVERSIZE');
  }
  let decoded: unknown;
  try { decoded = JSON.parse(body); }
  catch { throw new Error('PRIVACY_JOBS_ACK_INVALID_JSON'); }
  if (!verifyJobsRevocationResponse(event, decoded)) throw new Error('PRIVACY_JOBS_ACK_NOT_VERIFIED');
  return {
    eventId: event.eventId,
    consumerId: 'urai-jobs',
    // The Jobs integrityHash binds the immutable revocation identity.
    // Cleanup counts can legitimately change on idempotent retries.
    acknowledgementHash: jobsRevocationAckHash(event),
  };
}
