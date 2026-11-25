import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync(new URL('../functions/src/privacy/dataRightsContinuationPolicy.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports, module: { exports }, require, Error, Number, String });

const { retryCounters, recordFailure, continuationReason, MAX_EXECUTION_FAILURE_ATTEMPTS, MAX_CONTINUATION_DELIVERIES } = exports;
assert.equal(MAX_EXECUTION_FAILURE_ATTEMPTS, 3);
assert.equal(MAX_CONTINUATION_DELIVERIES, 64);

let counters = retryCounters(null, 'initial');
assert.deepEqual({ ...counters }, { attemptNumber: 1, failureAttempts: 0, continuationDeliveries: 0 });

counters = { ...counters, ...recordFailure(counters, false) };
assert.equal(counters.failureAttempts, 1);
counters = retryCounters(counters, 'failure');
assert.equal(counters.attemptNumber, 2);
counters = { ...counters, ...recordFailure(counters, false) };
counters = retryCounters(counters, 'failure');
counters = { ...counters, ...recordFailure(counters, false) };
assert.equal(counters.failureAttempts, 3);
assert.throws(() => retryCounters(counters, 'failure'), /data_rights_failure_retry_budget_exhausted/);

let continuation = { attemptNumber: 1, failureAttempts: 0, continuationDeliveries: 0 };
for (let i = 0; i < 10; i++) {
  continuation = { ...continuation, ...recordFailure(continuation, true) };
  continuation = retryCounters(continuation, 'continuation');
}
assert.equal(continuation.failureAttempts, 0, 'bounded continuation must not consume the general failure budget');
assert.equal(continuation.continuationDeliveries, 10);

const atLimit = { attemptNumber: 64, failureAttempts: 0, continuationDeliveries: 64 };
assert.throws(() => retryCounters(atLimit, 'continuation'), /data_rights_continuation_budget_exhausted/);

const interrupted = retryCounters({ attemptNumber: 1, failureAttempts: 0, continuationDeliveries: 0 }, 'interrupted');
assert.equal(interrupted.failureAttempts, 1, 'expired leases remain bounded by the general failure budget');

assert.equal(continuationReason(new Error('private_life_model_delete_child_limit')), 'private_life_model_delete_child_limit');
assert.equal(continuationReason(new Error('private_life_model_delete_scope_limit')), 'private_life_model_delete_scope_limit');
assert.equal(continuationReason(new Error('captured_reality_runtime_cleanup_continuation_pending')), 'captured_reality_runtime_cleanup_continuation_pending');
assert.equal(continuationReason(new Error('captured_reality_runtime_cleanup_storage_failure')), null,
  'a runtime Storage failure is not a bounded continuation');
assert.equal(continuationReason(Object.assign(new Error('Bounded job log deletion requires continuation.'), { code: 'resource-exhausted' })),
  'Bounded job log deletion requires continuation.');
assert.equal(continuationReason(Object.assign(new Error('Bounded owner job deletion requires continuation.'), { code: 'resource-exhausted' })),
  'Bounded owner job deletion requires continuation.');
assert.equal(continuationReason(Object.assign(new Error('other resource limit'), { code: 'resource-exhausted' })), null,
  'unrecognized resource exhaustion must remain a real failure');

const worker = fs.readFileSync(new URL('../functions/src/privacy/dataRightsExecution.ts', import.meta.url), 'utf8');
assert.ok(worker.includes("PROTECTED_STAGING_EXECUTION_CONTINUATION_REQUIRED"));
assert.ok(worker.includes("DATA_RIGHTS_EXECUTION_CONTINUATION_REQUIRED"));
assert.ok(worker.includes("retryCounters(prior"));
assert.ok(worker.includes("recordFailure({"));
assert.ok(!worker.includes("const MAX_EXECUTION_ATTEMPTS = 3"));

console.log('[PASS] bounded privacy continuations are separate from the three-failure retry budget');
