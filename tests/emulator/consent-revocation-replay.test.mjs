import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const projectId = 'demo-urai-jobs-consent';
const run = `synthetic-${Date.now()}`;
const token = 'synthetic-privacy-event-token';
let app, db, blocks, ingest;
const processed = [];
let failNextCleanup = false;

function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(`../../functions/src/${relativePath}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Date, Error, Promise, console,
    process: { env: { NODE_ENV: 'production' } }, require(id) {
      if (id === 'zod' || id === 'node:crypto') return require(id);
      if (Object.hasOwn(imports, id)) return imports[id];
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return module.exports;
}

const first = {
  type: 'consent.revoked.v1', eventId: `${run}-event-a`, ownerUid: `${run}-owner-a`,
  purpose: 'life-movie.render', policyVersion: 'synthetic-policy', decisionReceiptId: 'synthetic-receipt',
  correlationId: 'synthetic-correlation', revokedAt: '2026-10-28T21:00:00.000Z',
};
const second = { ...first, eventId: `${run}-event-b`, ownerUid: `${run}-owner-b` };
const concurrentA = { ...first, eventId: `${run}-event-concurrent`, ownerUid: `${run}-concurrent-a` };
const concurrentB = { ...concurrentA, ownerUid: `${run}-concurrent-b` };
const canonicalId = createHash('sha256').update(run).digest('hex');
const canonical = {
  type: 'consent.revoked.v2', eventId: canonicalId, ownerUid: `${run}-canonical`,
  purpose: 'memory.storage', policyVersion: '1.0.0', sourceReceiptHash: 'b'.repeat(64),
  correlationId: `revocation:${canonicalId}`, revokedAt: '2026-10-28T21:00:00.000Z',
};
const sequenceOwner = `${run}-sequence`;
const sequenceV1 = { ...first, eventId: `${run}-sequence-v1`, ownerUid: sequenceOwner, purpose: 'memory.storage' };
const sequenceV2Id = createHash('sha256').update(`${run}-sequence-v2`).digest('hex');
const sequenceV2 = { ...canonical, eventId: sequenceV2Id, ownerUid: sequenceOwner, correlationId: `revocation:${sequenceV2Id}` };
const sequenceV1b = { ...sequenceV1, eventId: `${run}-sequence-v1b`, correlationId: 'synthetic-correlation-later' };

before(() => {
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
    throw new Error('A local Firestore emulator is required');
  }
  app = initializeApp({ projectId }, `revocation-replay-${Date.now()}`);
  db = getFirestore(app);
  const adapter = { collection: (...args) => db.collection(...args),
    runTransaction: callback => db.runTransaction(transaction => Promise.resolve(callback(transaction))) };
  blocks = load('privacy/consentBlocks.ts', { 'firebase-admin/firestore': { getFirestore: () => adapter } });
  ingest = load('privacy/consentRevocation.ts', {
    'firebase-admin/firestore': { FieldValue, getFirestore: () => adapter },
    'firebase-functions/params': { defineSecret: () => ({ value: () => token }) },
    'firebase-functions/v2/https': { onRequest: (_options, handler) => handler },
    './consentBlocks.js': blocks,
    './lifeMovieDerivativeRevocation.js': { invalidateLifeMovieDerivativesForConsent: async event => {
      processed.push({ ...event });
      if (failNextCleanup) { failNextCleanup = false; throw new Error('synthetic-cleanup-failure'); }
      return { purpose: event.purpose, jobsScanned: 0, jobsInvalidated: 0, plansInvalidated: 0, storageObjectsDeleted: 0 };
    } },
  }).ingestConsentRevocation;
});

after(async () => {
  if (!db) return;
  for (const event of [first, second, concurrentA, concurrentB, canonical, sequenceV1, sequenceV2, sequenceV1b]) {
    await blocks.consentBlockRef(event.ownerUid, event.purpose).delete();
    await blocks.consentEventReceiptRef(event.eventId).delete();
  }
  await blocks.consentBlockRef(second.ownerUid, 'memory.storage').delete();
  await deleteApp(app);
});

async function call(event, authorization = `Bearer ${token}`) {
  let status, body;
  await ingest({ method: 'POST', headers: { authorization }, body: event }, {
    status(value) { status = value; return this; }, json(value) { body = value; return this; },
  });
  return { status, body };
}

test('a conflicting replay cannot authorize cleanup or skip another user’s revocation', async () => {
  assert.equal((await call(first, 'Bearer invalid')).status, 401);
  assert.equal((await blocks.consentBlockRef(first.ownerUid, first.purpose).get()).exists, false);
  assert.equal((await call(first)).status, 200);
  assert.equal((await call(first)).status, 200);
  assert.equal(processed.length, 2, 'an exact replay retries cleanup');
  const variations = [
    { ownerUid: second.ownerUid }, { purpose: 'memory.storage' }, { policyVersion: 'another-policy' },
    { decisionReceiptId: 'another-receipt' }, { correlationId: 'another-correlation' },
    { revokedAt: '2026-10-28T22:00:00.000Z' },
  ];
  for (const change of variations) {
    const result = await call({ ...first, ...change });
    assert.equal(result.status, 409, `conflict must be rejected: ${Object.keys(change)[0]}`);
    assert.equal(result.body.ok, false);
  }
  assert.equal(processed.length, 2, 'conflicting events must not invoke cleanup');
  assert.equal((await blocks.consentBlockRef(second.ownerUid, first.purpose).get()).exists, false);
  const receipt = await blocks.consentEventReceiptRef(first.eventId).get();
  assert.equal(receipt.get('ownerUid'), first.ownerUid);
  assert.equal(receipt.get('revokedAt'), first.revokedAt);
});

test('legacy receipts replay only when the stored block verifies their timestamp', async () => {
  const receiptRef = blocks.consentEventReceiptRef(first.eventId);
  await receiptRef.update({ revokedAt: FieldValue.delete() });
  assert.equal((await call(first)).status, 200);
  const previousCount = processed.length;
  assert.equal((await call({ ...first, revokedAt: '2026-10-28T22:00:00.000Z' })).status, 409);
  assert.equal(processed.length, previousCount);
  const blockRef = blocks.consentBlockRef(first.ownerUid, first.purpose);
  await blockRef.update({ eventId: `${run}-newer-event` });
  assert.equal((await call(first)).status, 409);
  assert.equal(processed.length, previousCount);
});

test('a cleanup failure keeps the block active and an exact retry can complete', async () => {
  failNextCleanup = true;
  assert.equal((await call(second)).status, 500);
  assert.equal((await blocks.consentBlockRef(second.ownerUid, second.purpose).get()).get('active'), true);
  assert.equal((await call(second)).status, 200);
  assert.ok((await blocks.consentEventReceiptRef(second.eventId).get()).get('derivativeInvalidationCompletedAt'));
});

test('concurrent conflicting claims for one event ID create only one block', async () => {
  const beforeCount = processed.length;
  const outcomes = await Promise.all([call(concurrentA), call(concurrentB)]);
  assert.deepEqual(outcomes.map(outcome => outcome.status).sort(), [200, 409]);
  assert.equal(processed.length, beforeCount + 1);
  const winner = outcomes[0].status === 200 ? concurrentA : concurrentB;
  const loser = winner === concurrentA ? concurrentB : concurrentA;
  assert.equal((await blocks.consentBlockRef(winner.ownerUid, winner.purpose).get()).get('active'), true);
  assert.equal((await blocks.consentBlockRef(loser.ownerUid, loser.purpose).get()).exists, false);
  assert.equal((await blocks.consentEventReceiptRef(winner.eventId).get()).get('ownerUid'), winner.ownerUid);
});

test('an exact replay is rejected if its active block is missing', async () => {
  await blocks.consentBlockRef(second.ownerUid, second.purpose).delete();
  const beforeCount = processed.length;
  assert.equal((await call(second)).status, 409);
  assert.equal(processed.length, beforeCount);
});

test('a canonical source-receipt revocation is bound without inventing a decision receipt', async () => {
  const beforeCount = processed.length;
  assert.equal((await call({ ...canonical, ownerUid: `${run}\nother` })).status, 400);
  assert.equal((await call({ ...canonical, purpose: 'memory\nstorage' })).status, 400);
  assert.equal((await call({ ...canonical, ownerUid: ` ${canonical.ownerUid} ` })).status, 400);
  assert.equal((await call({ ...canonical, correlationId: 'unbound-correlation' })).status, 400);
  const result = await call(canonical);
  assert.equal(result.status, 200);
  assert.equal(result.body.acknowledgement.sourceReceiptHash, canonical.sourceReceiptHash);
  assert.equal(result.body.acknowledgement.decisionReceiptId, undefined);
  const reorderedHash = blocks.canonicalSourceRevocationAckHash({ status: 'blocked', revokedAt: canonical.revokedAt,
    correlationId: canonical.correlationId, sourceReceiptHash: canonical.sourceReceiptHash,
    policyVersion: canonical.policyVersion, purpose: canonical.purpose, ownerUid: canonical.ownerUid, eventId: canonical.eventId });
  assert.equal(result.body.acknowledgement.integrityHash, reorderedHash);
  const block = await blocks.consentBlockRef(canonical.ownerUid, canonical.purpose).get();
  assert.equal(block.get('active'), true);
  assert.equal(block.get('sourceReceiptHash'), canonical.sourceReceiptHash);
  assert.equal(block.get('decisionReceiptId'), undefined);
  assert.equal((await call(canonical)).status, 200);
  assert.equal(processed.length, beforeCount + 2);
  assert.equal((await call({ ...canonical, sourceReceiptHash: 'c'.repeat(64) })).status, 409);
  assert.equal((await call({ ...canonical, revokedAt: '2026-10-28T22:00:00.000Z' })).status, 409);
  assert.equal(processed.length, beforeCount + 2);
});

test('successive legacy and source-receipt events do not retain the other version’s reference', async () => {
  assert.equal((await call(sequenceV1)).status, 200);
  assert.equal((await call(sequenceV2)).status, 200);
  let block = await blocks.consentBlockRef(sequenceOwner, 'memory.storage').get();
  assert.equal(block.get('decisionReceiptId'), undefined);
  assert.equal(block.get('sourceReceiptHash'), sequenceV2.sourceReceiptHash);
  assert.equal((await call(sequenceV2)).status, 200);
  assert.equal((await call(sequenceV1)).status, 409);
  assert.equal((await call(sequenceV1b)).status, 200);
  block = await blocks.consentBlockRef(sequenceOwner, 'memory.storage').get();
  assert.equal(block.get('sourceReceiptHash'), undefined);
  assert.equal(block.get('decisionReceiptId'), sequenceV1b.decisionReceiptId);
  assert.equal((await call(sequenceV1b)).status, 200);
  assert.equal((await call(sequenceV2)).status, 409);
});
