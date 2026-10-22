import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EngineeringContinuityStore } from './chalk-engineering-continuity.mjs';

const identity = {
  jobId: 'source-lock-test01',
  ownerUid: 'founder-test-id',
  repository: 'LifeLoggerAI/urai-spatial',
  baseSha: 'a'.repeat(40),
  requestDigest: 'b'.repeat(64),
};
const leaseToken = 'test-active-worker-token';
const resultDigest = 'd'.repeat(64);

test('pinned job cannot complete with a different source SHA even with a valid lease', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'urai-pin-contract-'));
  try {
    const store = new EngineeringContinuityStore({ directory });
    await store.create(identity);
    const lease = await store.claim({
      jobId: identity.jobId, ownerUid: identity.ownerUid, token: leaseToken,
    });
    const args = {
      jobId: identity.jobId, ownerUid: identity.ownerUid, token: leaseToken,
      generation: lease.generation, expectedRevision: lease.revision, resultDigest,
    };
    await assert.rejects(store.complete({ ...args, sourceSha: 'c'.repeat(40) }), /SOURCE_SHA_MISMATCH/);
    assert.equal((await store.read({ jobId: identity.jobId, ownerUid: identity.ownerUid })).status, 'RUNNING');
    const final = await store.complete({ ...args, sourceSha: identity.baseSha });
    assert.equal(final.result.sourceSha, identity.baseSha);
    assert.equal(final.status, 'COMPLETED');
    await assert.rejects(store.complete({ ...args, sourceSha: 'c'.repeat(40) }), /SOURCE_SHA_MISMATCH/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
