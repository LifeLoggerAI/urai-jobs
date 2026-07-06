const TERMINAL_JOB_STATUSES = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);

type ExecutionGuardJob = {
  status?: unknown;
  lease?: { leaseToken?: unknown };
  execution?: { leaseToken?: unknown };
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

export function isTerminalJobStatus(status: unknown): boolean {
  return TERMINAL_JOB_STATUSES.has(String(status || ''));
}
