import assert from 'node:assert/strict';
import {
  canFinalizeExecution,
  decideExecutionStart,
  isTerminalJobStatus,
} from '../functions/lib/functions/jobs/executionGuards.js';

const token = 'lease-token';

assert.deepEqual(
  decideExecutionStart({ status: 'LEASED', lease: { leaseToken: token } }, token),
  { action: 'start' },
);
assert.deepEqual(
  decideExecutionStart({ status: 'LEASED', lease: { leaseToken: 'old-token' } }, token),
  { action: 'ignore', reason: 'stale-lease' },
);
assert.deepEqual(
  decideExecutionStart({ status: 'RUNNING', lease: { leaseToken: token }, execution: { leaseToken: token } }, token),
  { action: 'ignore', reason: 'duplicate-running' },
);
assert.deepEqual(
  decideExecutionStart({ status: 'CANCELLED', lease: { leaseToken: token } }, token),
  { action: 'ignore', reason: 'terminal' },
);
assert.equal(
  canFinalizeExecution({ status: 'RUNNING', execution: { leaseToken: token } }, token),
  true,
);
assert.equal(
  canFinalizeExecution({ status: 'CANCELLED', execution: { leaseToken: token } }, token),
  false,
);
assert.equal(isTerminalJobStatus('DEAD'), true);
assert.equal(isTerminalJobStatus('RUNNING'), false);

console.log('[PASS] execution guard smoke');
