/**
 * Server-owned sliding 60-second job admission ledger.
 * The caller must read and update this ledger on users/{uid} in the SAME
 * Firestore transaction as every new job/queue/log/idempotency write.
 * This pure helper does not grant admission without that transaction.
 */
export type JobCreateRateLimitLedger = Readonly<{
  admissionsMs: number[];
  latestAdmissionMs: number;
}>;

export type JobCreateRateLimitFailure = 'exhausted' | 'invalid-ledger' | 'clock-regression';
export class JobCreateRateLimitError extends Error {
  readonly reason: JobCreateRateLimitFailure;
  constructor(reason: JobCreateRateLimitFailure) {
    super(`Job creation rate limit: ${reason}`);
    this.name = 'JobCreateRateLimitError';
    this.reason = reason;
  }
}

function validMillis(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Build the next owner-owned ledger. Import recent job timestamps only on the
 * first admission after migration, while the ledger field is absent.
 */
export function reserveCreateJobRateLimit(
  stored: unknown,
  nowMs: number,
  maxPerMinute: number,
  legacyRecentAdmissionsMs: readonly number[] = [],
): JobCreateRateLimitLedger {
  if (!validMillis(nowMs) || !Number.isSafeInteger(maxPerMinute) || maxPerMinute < 1 || maxPerMinute > 10000) {
    throw new JobCreateRateLimitError('invalid-ledger');
  }

  let entries: number[];
  let latestAdmissionMs: number;
  if (stored === undefined) {
    if (!Array.isArray(legacyRecentAdmissionsMs) || !legacyRecentAdmissionsMs.every(validMillis)) {
      throw new JobCreateRateLimitError('invalid-ledger');
    }
    entries = [...legacyRecentAdmissionsMs].sort((a, b) => a - b);
    latestAdmissionMs = entries.at(-1) ?? 0;
  } else {
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      throw new JobCreateRateLimitError('invalid-ledger');
    }
    const value = stored as Record<string, unknown>;
    if (!Array.isArray(value.admissionsMs) || !validMillis(value.latestAdmissionMs) ||
        value.admissionsMs.length < 1 || value.admissionsMs.length > maxPerMinute ||
        !value.admissionsMs.every(validMillis)) {
      throw new JobCreateRateLimitError('invalid-ledger');
    }
    entries = value.admissionsMs;
    latestAdmissionMs = value.latestAdmissionMs;
    if (entries.at(-1) !== latestAdmissionMs || entries.some((n, i) => i > 0 && n < entries[i - 1])) {
      throw new JobCreateRateLimitError('invalid-ledger');
    }
  }

  // Multi-instance clock skew/regression must not silently reopen admission.
  if (latestAdmissionMs > nowMs) throw new JobCreateRateLimitError('clock-regression');
  const windowStart = nowMs - 60_000;
  const recent = entries.filter(ms => ms >= windowStart);
  if (recent.length >= maxPerMinute) throw new JobCreateRateLimitError('exhausted');
  return { admissionsMs: [...recent, nowMs], latestAdmissionMs: nowMs };
}
