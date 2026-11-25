export const MAX_EXECUTION_FAILURE_ATTEMPTS = 3;
export const MAX_CONTINUATION_DELIVERIES = 64;
export const MAX_EXECUTION_DELIVERIES = 72;

export type RetryKind = 'initial' | 'failure' | 'continuation' | 'interrupted';

export type RetryCounters = {
  attemptNumber: number;
  failureAttempts: number;
  continuationDeliveries: number;
};

function safeCounter(value: unknown, fallback: number, label: string): number {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new Error(`data_rights_retry_counter_invalid:${label}`);
  }
  return candidate;
}

export function retryCounters(prior: any, kind: RetryKind): RetryCounters {
  const priorAttempt = safeCounter(prior?.attemptNumber, 0, 'attemptNumber');
  // Legacy receipts predate separate counters. Preserve their stricter behavior by
  // treating every historical delivery as a consumed failure attempt.
  let failureAttempts = safeCounter(prior?.failureAttempts, priorAttempt, 'failureAttempts');
  const continuationDeliveries = safeCounter(prior?.continuationDeliveries, 0, 'continuationDeliveries');

  if (kind === 'interrupted') failureAttempts += 1;
  if (kind === 'failure' && failureAttempts >= MAX_EXECUTION_FAILURE_ATTEMPTS) {
    throw new Error('data_rights_failure_retry_budget_exhausted');
  }
  if (kind === 'interrupted' && failureAttempts > MAX_EXECUTION_FAILURE_ATTEMPTS) {
    throw new Error('data_rights_failure_retry_budget_exhausted');
  }
  if (kind === 'continuation' && continuationDeliveries >= MAX_CONTINUATION_DELIVERIES) {
    throw new Error('data_rights_continuation_budget_exhausted');
  }
  if (priorAttempt >= MAX_EXECUTION_DELIVERIES) {
    throw new Error('data_rights_total_delivery_budget_exhausted');
  }

  return {
    attemptNumber: priorAttempt + 1,
    failureAttempts,
    continuationDeliveries,
  };
}

export function recordFailure(
  counters: Pick<RetryCounters, 'failureAttempts' | 'continuationDeliveries'>,
  continuation: boolean
): Pick<RetryCounters, 'failureAttempts' | 'continuationDeliveries'> {
  if (continuation) {
    return {
      failureAttempts: counters.failureAttempts,
      continuationDeliveries: counters.continuationDeliveries + 1,
    };
  }
  return {
    failureAttempts: counters.failureAttempts + 1,
    continuationDeliveries: counters.continuationDeliveries,
  };
}

export function continuationReason(error: unknown): string | null {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : '';
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (message === 'private_life_model_delete_child_limit') return message;
  if (message === 'private_life_model_delete_scope_limit') return message;
  if (message === 'captured_reality_runtime_cleanup_continuation_pending') return message;
  if (code === 'resource-exhausted' && (
    message === 'Bounded job log deletion requires continuation.'
    || message === 'Bounded owner job deletion requires continuation.'
  )) return message;
  return null;
}
