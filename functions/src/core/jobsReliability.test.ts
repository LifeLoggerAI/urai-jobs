import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  bindingMatches,
  buildIdempotencyBindingId,
  buildRequestFingerprint,
  nextOutboxRetryDelayMs,
  normalizeIdempotencyKey,
  stableStringify,
  terminalEventId,
} from './jobsReliability.js';

test('stableStringify canonicalizes object key order', () => {
  assert.equal(stableStringify({ b: 2, a: { d: 4, c: 3 } }), stableStringify({ a: { c: 3, d: 4 }, b: 2 }));
});

test('idempotency binding is deterministic and owner scoped', () => {
  const first = buildIdempotencyBindingId('user-a', 'studio.render', ' request-1 ');
  assert.equal(first, buildIdempotencyBindingId('user-a', 'studio.render', 'request-1'));
  assert.notEqual(first, buildIdempotencyBindingId('user-b', 'studio.render', 'request-1'));
});

test('request fingerprint is stable and detects payload changes', () => {
  const first = buildRequestFingerprint('studio.render', { scene: 'home', options: { quality: 'high', frames: 60 } });
  const reordered = buildRequestFingerprint('studio.render', { options: { frames: 60, quality: 'high' }, scene: 'home' });
  const changed = buildRequestFingerprint('studio.render', { options: { frames: 30, quality: 'high' }, scene: 'home' });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('binding matching rejects cross-owner, cross-type, and request conflicts', () => {
  const expected = { ownerUid: 'user-a', jobType: 'studio.render', requestFingerprint: 'fingerprint' };
  assert.equal(bindingMatches({ ...expected, jobId: 'job-1' }, expected), true);
  assert.equal(bindingMatches({ ...expected, ownerUid: 'user-b', jobId: 'job-1' }, expected), false);
  assert.equal(bindingMatches({ ...expected, jobType: 'asset.render', jobId: 'job-1' }, expected), false);
  assert.equal(bindingMatches({ ...expected, requestFingerprint: 'different', jobId: 'job-1' }, expected), false);
});

test('outbox retry and event identity are bounded and deterministic', () => {
  assert.equal(normalizeIdempotencyKey('  request-1  '), 'request-1');
  assert.equal(nextOutboxRetryDelayMs(1), 5_000);
  assert.equal(nextOutboxRetryDelayMs(20), 15 * 60_000);
  assert.equal(
    terminalEventId('job-1', 'SUCCESS', 'transition-1'),
    terminalEventId('job-1', 'SUCCESS', 'transition-1')
  );
  assert.notEqual(
    terminalEventId('job-1', 'SUCCESS', 'transition-1'),
    terminalEventId('job-1', 'FAILED', 'transition-1')
  );
  assert.notEqual(
    terminalEventId('job-1', 'FAILED', 'transition-1'),
    terminalEventId('job-1', 'FAILED', 'transition-2')
  );
});
