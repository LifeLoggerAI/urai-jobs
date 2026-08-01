import { createHash } from 'node:crypto';

export type IdempotencyBinding = {
  ownerUid: string;
  jobType: string;
  requestFingerprint: string;
  jobId: string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function normalizeIdempotencyKey(value: string): string {
  return value.trim();
}

export function buildIdempotencyBindingId(ownerUid: string, jobType: string, idempotencyKey: string): string {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  return createHash('sha256')
    .update(stableStringify({ ownerUid, jobType, idempotencyKey: normalizedKey }))
    .digest('hex');
}

export function buildRequestFingerprint(jobType: string, payload: unknown): string {
  return createHash('sha256')
    .update(stableStringify({ jobType, payload }))
    .digest('hex');
}

export function bindingMatches(binding: Partial<IdempotencyBinding>, expected: Omit<IdempotencyBinding, 'jobId'>): boolean {
  return (
    binding.ownerUid === expected.ownerUid &&
    binding.jobType === expected.jobType &&
    binding.requestFingerprint === expected.requestFingerprint
  );
}

export function nextOutboxRetryDelayMs(attemptCount: number): number {
  const boundedAttempt = Math.max(1, Math.min(10, Math.floor(attemptCount)));
  return Math.min(15 * 60_000, 5_000 * 2 ** (boundedAttempt - 1));
}

export function terminalEventId(jobId: string, status: string): string {
  return createHash('sha256').update(`${jobId}:${status}`).digest('hex');
}
