/**
 * Strict Studio-to-Jobs private-delivery request shape. Validation is NOT
 * authorization: authorityHash is opaque caller-controlled data, and must
 * never be accepted as an allow decision, bearer credential, or signed URL.
 * Jobs' delivery handlers remain hard-closed until a reviewed server-owned
 * identity, current consent, owner/source-rights and output-generation
 * verifier is installed and protected streaming is independently accepted.
 */
export type LifeMoviePrivateDeliveryRequest = Readonly<{
  action: 'deliver';
  tenantId: string;
  userId: string;
  kind: 'mp4' | 'srt';
  authorityHash: string;
  expiresAt: number;
  generation: string;
  disposition: 'inline' | 'attachment';
  jobId?: string;
  planId?: string;
  artifact?: string;
}>;

export type LifeMovieDeliveryMode = 'short' | 'longform';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const JOB_ID = /^[A-Za-z0-9_-]{10,64}$/;
const PLAN_ID = /^lmp_[A-Za-z0-9_-]{20,64}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const GENERATION = /^[1-9][0-9]{0,19}$/;
const SEGMENT = /^segment:(?:0|[1-9][0-9]{0,2})$/;
const COMMON_FIELDS = [
  'action', 'tenantId', 'userId', 'kind', 'authorityHash',
  'expiresAt', 'generation', 'disposition',
];
const DENIED = 'life_movie_private_delivery_request_invalid';

function fail(): never { throw new Error(DENIED); }

export function parseLifeMoviePrivateDeliveryRequest(
  value: unknown,
  mode: LifeMovieDeliveryMode,
  nowMs = Date.now(),
): LifeMoviePrivateDeliveryRequest {
  if (mode !== 'short' && mode !== 'longform') fail();
  if (!Number.isSafeInteger(nowMs) || nowMs < 1 ||
    !value || typeof value !== 'object' || Array.isArray(value)) fail();
  // A JSON body has an ordinary, own-key-only object shape. Reject hidden and
  // symbol properties rather than silently dropping unreviewed instructions.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail();
  const input = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(input);
  const required = mode === 'short'
    ? [...COMMON_FIELDS, 'jobId']
    : [...COMMON_FIELDS, 'planId', 'artifact'];
  if (keys.length !== required.length || keys.some((key) => typeof key !== 'string' || !required.includes(key))) fail();
  // Inspect data descriptors without invoking getter claims. Validate only a
  // detached own-value snapshot, so subsequent validation/return cannot run a
  // caller-defined accessor between key validation and media selection.
  const body: Record<string, unknown> = Object.create(null);
  for (const key of required) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) fail();
    body[key] = descriptor.value;
  }
  if (body.action !== 'deliver' || typeof body.tenantId !== 'string' || !ID.test(body.tenantId)
    || typeof body.userId !== 'string' || !ID.test(body.userId)
    || (body.kind !== 'mp4' && body.kind !== 'srt')
    || typeof body.authorityHash !== 'string' || !HEX_SHA256.test(body.authorityHash)
    || typeof body.generation !== 'string' || !GENERATION.test(body.generation)
    || !Number.isSafeInteger(Number(body.generation))
    || typeof body.expiresAt !== 'number' || !Number.isSafeInteger(body.expiresAt)
    || body.expiresAt <= nowMs || body.expiresAt > nowMs + 300_000
    || (body.disposition !== 'inline' && body.disposition !== 'attachment')) fail();
  if (mode === 'short') {
    if (typeof body.jobId !== 'string' || !JOB_ID.test(body.jobId)) fail();
  } else {
    if (typeof body.planId !== 'string' || !PLAN_ID.test(body.planId)
      || typeof body.artifact !== 'string' ||
      (body.artifact !== 'final' && (!SEGMENT.test(body.artifact) || Number(body.artifact.slice(8)) >= 180))) fail();
  }
  return Object.freeze({
    action: 'deliver', tenantId: body.tenantId, userId: body.userId,
    kind: body.kind, authorityHash: body.authorityHash,
    expiresAt: body.expiresAt, generation: body.generation,
    disposition: body.disposition,
    ...(mode === 'short' ? { jobId: body.jobId } : { planId: body.planId, artifact: body.artifact }),
  }) as LifeMoviePrivateDeliveryRequest;
}
