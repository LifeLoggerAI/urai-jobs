const TERMINAL_JOB_STATUSES = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);

type ExecutionGuardJob = {
  status?: unknown;
  lease?: { leaseToken?: unknown };
  execution?: { leaseToken?: unknown };
};

type ExecutionAuthorityJob = ExecutionGuardJob & {
  jobId?: unknown; type?: unknown; jobType?: unknown; tenantId?: unknown;
  orgId?: unknown; ownerUid?: unknown; payload?: unknown; consent?: unknown;
  consents?: unknown; ownerSubsystem?: unknown; sourceSystem?: unknown;
  sourceProject?: unknown; createdBy?: unknown;
};

// Lifecycle timestamps and lease heartbeats may change while a worker runs.
// The account, routing, private input and consent that admitted it may not.
function authorityValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return `${typeof value}:${typeof value === 'number' ? String(value) : JSON.stringify(value)}`;
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (Array.isArray(value)) return `[${value.map(authorityValue).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${authorityValue((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function executionAuthorityUnchanged(current: ExecutionAuthorityJob, admitted: ExecutionAuthorityJob): boolean {
  const fields = ['jobId', 'type', 'jobType', 'tenantId', 'orgId', 'ownerUid',
    'payload', 'consent', 'consents', 'ownerSubsystem', 'sourceSystem',
    'sourceProject', 'createdBy'] as const;
  try { return fields.every(field => authorityValue(current[field]) === authorityValue(admitted[field])); }
  catch { return false; }
}

type QueueRecoveryRecord = {
  status?: unknown;
  lease?: { leaseToken?: unknown };
};

export type ExecutionStartDecision =
  | { action: 'start' }
  | { action: 'ignore'; reason: 'terminal' | 'stale-lease' | 'duplicate-running' | 'invalid-state' };

export function decideExecutionStart(job: ExecutionGuardJob, leaseToken: string): ExecutionStartDecision {
  const status = String(job.status || '');

  if (TERMINAL_JOB_STATUSES.has(status)) {
    return { action: 'ignore', reason: 'terminal' };
  }

  if (job.lease?.leaseToken !== leaseToken) {
    return { action: 'ignore', reason: 'stale-lease' };
  }

  if (status === 'RUNNING' && job.execution?.leaseToken === leaseToken) {
    return { action: 'ignore', reason: 'duplicate-running' };
  }

  if (status !== 'LEASED') {
    return { action: 'ignore', reason: 'invalid-state' };
  }

  return { action: 'start' };
}

export function canFinalizeExecution(job: ExecutionGuardJob, leaseToken: string): boolean {
  return job.status === 'RUNNING' && job.execution?.leaseToken === leaseToken;
}

export function canRequeueUnstartedLease(
  job: ExecutionGuardJob,
  queueEntry: QueueRecoveryRecord,
  leaseToken: string,
): boolean {
  return job.status === 'LEASED'
    && queueEntry.status === 'LEASED'
    && job.lease?.leaseToken === leaseToken
    && queueEntry.lease?.leaseToken === leaseToken
    && job.execution?.leaseToken !== leaseToken;
}

export function isTerminalJobStatus(status: unknown): boolean {
  return TERMINAL_JOB_STATUSES.has(String(status || ''));
}
