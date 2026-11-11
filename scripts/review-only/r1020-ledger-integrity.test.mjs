/**
 * R1020 review-only ledger snapshot-integrity adversarial regression tests.
 * This is NOT source authentication, real Firestore CAS, GCS IAM proof,
 * cloud upload permission, deletion acknowledgement, or launch approval.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReviewLedgerIntegrity, DENIED } from './r1020-ledger-integrity.mjs';
import {
  createReviewLedger, reserveForReview, startUploadForReview,
  withdrawForReview, observeDrainCandidate, inspectDrainForReview,
} from './r1016-revocation-ledger-model.mjs';

const scope = () => ({
  ownerUid: 'owner1', tenantId: 'tenant1', projectId: 'project1',
  bucket: 'privatebucket1', epoch: 4,
});
const path = 'tenants/tenant1/life-movies/project1/attempt-attempt1/life-movie.mp4';
const request = () => ({ ...scope(), attemptId: 'attempt1', objectPath: path });
const withdrawal = () => ({
  ownerUid: 'owner1', tenantId: 'tenant1', projectId: 'project1', withdrawalId: 'withdrawal1',
});
const proof = () => ({
  attemptId: 'attempt1', epoch: 4, bucket: 'privatebucket1', objectPath: path,
  generation: null, bytesCommitted: false, writerDrained: true, writerIncapable: true,
  objectAbsent: true, inventoryAfterFence: true, generationDeleted: false,
});
function initial() { return createReviewLedger(scope()); }
function reserved() { const s = initial(); return reserveForReview(s, request(), s.version); }
function inFlight() { const s = reserved(); return startUploadForReview(s, 'attempt1', s.version); }
function fenced() { const s = inFlight(); return withdrawForReview(s, withdrawal(), s.version); }
function candidate() { const s = fenced(); return observeDrainCandidate(s, proof(), s.version); }
function seal(s) {
  for (const r of s.reservations) Object.freeze(r);
  Object.freeze(s.reservations);
  Object.freeze(s.scope);
  return Object.freeze(s);
}
function forged(origin, edit) {
  const s = JSON.parse(JSON.stringify(origin));
  edit(s);
  return seal(s);
}
const rejects = s => assert.throws(() => assertReviewLedgerIntegrity(s), { message: DENIED });
const guards = s => {
  assert.throws(() => reserveForReview(s, request(), s.version), { message: DENIED });
  assert.throws(() => inspectDrainForReview(s), { message: DENIED });
};

test('created OPEN ledger accepted and stays non-authoritative', () => {
  const s = assertReviewLedgerIntegrity(initial());
  assert.equal(s.storageWriteAuthorized, false);
  assert.equal(s.deletionAcknowledged, false);
  assert.equal(s.releaseAuthorized, false);
});
test('reserved ledger accepted', () => assert.equal(assertReviewLedgerIntegrity(reserved()).version, 2));
test('in-flight ledger accepted', () => assert.equal(assertReviewLedgerIntegrity(inFlight()).version, 3));
test('FENCING ledger accepted', () => assert.equal(assertReviewLedgerIntegrity(fenced()).scope.epoch, 5));
test('drain candidate accepted but cannot acknowledge deletion', () => {
  const s = assertReviewLedgerIntegrity(candidate());
  assert.equal(inspectDrainForReview(s).deletionAcknowledged, false);
});
test('generation-bound drain candidate accepted but remains review-only', () => {
  const s = fenced();
  const p = proof();
  Object.assign(p, { bytesCommitted: true, generation: '42', generationDeleted: true });
  const out = observeDrainCandidate(s, p, s.version);
  assert.equal(assertReviewLedgerIntegrity(out).reservations[0].observedGeneration, '42');
  assert.equal(inspectDrainForReview(out).allWritersStorageFenced, false);
});
test('unfrozen root denied', () => rejects({ ...reserved() }));
test('unfrozen scope denied', () => {
  const s = { ...reserved(), scope: { ...scope() } };
  Object.freeze(s);
  rejects(s);
});
test('unfrozen reservations denied', () => {
  const s = { ...reserved(), reservations: [...reserved().reservations] };
  Object.freeze(s);
  rejects(s);
});
test('unfrozen attempt denied', () => {
  const s = { ...reserved(), reservations: [{ ...reserved().reservations[0] }] };
  Object.freeze(s.reservations); Object.freeze(s);
  rejects(s);
});
test('missing root field denied', () => rejects(forged(reserved(), s => { delete s.phase; })));
test('unexpected root field denied', () => rejects(forged(reserved(), s => { s.cloudVerified = true; })));
test('root symbol denied', () => {
  const s = JSON.parse(JSON.stringify(reserved()));
  s[Symbol('spoof')] = true;
  rejects(seal(s));
});
test('root accessor rejected', () => {
  const s = JSON.parse(JSON.stringify(reserved()));
  Object.defineProperty(s, 'phase', { enumerable: true, configurable: true, get: () => 'OPEN' });
  rejects(seal(s));
});
test('nonstandard root prototype denied', () => {
  const s = JSON.parse(JSON.stringify(reserved()));
  Object.setPrototypeOf(s, { attacker: true });
  rejects(seal(s));
});
test('storage authorization flag cannot be asserted', () => rejects(forged(reserved(), s => { s.storageWriteAuthorized = true; })));
test('deletion ACK cannot be asserted', () => rejects(forged(fenced(), s => { s.deletionAcknowledged = true; })));
test('release approval cannot be asserted', () => rejects(forged(fenced(), s => { s.releaseAuthorized = true; })));
test('reviewOnly cannot be turned off', () => rejects(forged(reserved(), s => { s.reviewOnly = false; })));
test('unknown ledger schema denied', () => rejects(forged(reserved(), s => { s.schema = 'V2'; })));
test('fractional version denied', () => rejects(forged(reserved(), s => { s.version = 1.5; })));
test('version below transition floor denied', () => rejects(forged(fenced(), s => { s.version = 2; })));
test('missing scope field denied', () => rejects(forged(reserved(), s => { delete s.scope.ownerUid; })));
test('extra scope field denied', () => rejects(forged(reserved(), s => { s.scope.authorized = true; })));
test('scope accessor denied', () => {
  const s = JSON.parse(JSON.stringify(reserved()));
  Object.defineProperty(s.scope, 'ownerUid', { enumerable: true, get: () => 'owner1' });
  rejects(seal(s));
});
test('malformed owner identifier denied', () => rejects(forged(reserved(), s => { s.scope.ownerUid = '../owner'; })));
test('zero epoch denied', () => rejects(forged(reserved(), s => { s.scope.epoch = 0; })));
test('OPEN with withdrawal ID denied', () => rejects(forged(reserved(), s => { s.withdrawalId = 'withdrawal1'; })));
test('FENCING without withdrawal ID denied', () => rejects(forged(fenced(), s => { s.withdrawalId = null; })));
test('FENCING epoch of one denied', () => rejects(forged(fenced(), s => { s.scope.epoch = 1; })));
test('unexpected phase denied', () => rejects(forged(reserved(), s => { s.phase = 'REVOKED'; })));
test('missing attempt field denied', () => rejects(forged(reserved(), s => { delete s.reservations[0].state; })));
test('extra attempt field denied', () => rejects(forged(reserved(), s => { s.reservations[0].cloudVerified = true; })));
test('duplicate attempt ID denied', () => rejects(forged(reserved(), s => {
  s.reservations.push({ ...s.reservations[0] }); s.version++;
})));
test('different bucket in attempt denied', () => rejects(forged(reserved(), s => { s.reservations[0].bucket = 'otherbucket'; })));
test('attempt from another epoch denied', () => rejects(forged(reserved(), s => { s.reservations[0].epoch = 3; })));
test('attempt epoch cannot follow new FENCING epoch', () => rejects(forged(fenced(), s => { s.reservations[0].epoch = 5; })));
test('unsupported attempt state denied', () => rejects(forged(reserved(), s => { s.reservations[0].state = 'COMPLETE'; })));
test('OPEN cannot already contain drain candidates', () => rejects(forged(reserved(), s => { s.reservations[0].state = 'DRAIN_CANDIDATE'; })));
test('non-drained reservation cannot claim a generation', () => rejects(forged(inFlight(), s => { s.reservations[0].observedGeneration = '42'; })));
test('invalid observed generation denied', () => rejects(forged(candidate(), s => { s.reservations[0].observedGeneration = '0'; })));
test('wrong attempt path denied', () => rejects(forged(reserved(), s => { s.reservations[0].objectPath = path.replace('attempt1', 'attempt2'); })));
test('path traversal denied', () => rejects(forged(reserved(), s => { s.reservations[0].objectPath = '../' + path; })));
test('unsupported output kind denied', () => rejects(forged(reserved(), s => { s.reservations[0].objectPath = path.replace('life-movie.mp4', 'secret.txt'); })));
test('forged snapshot rejected by mutation and inspection entrypoints', () => guards(forged(reserved(), s => { s.scope.bucket = 'otherbucket'; })));
test('forged deletion ACK rejected by every entrypoint', () => guards(forged(fenced(), s => { s.deletionAcknowledged = true; })));
test('valid snapshot still uses expectedVersion CAS check', () => {
  const s = reserved();
  assert.throws(() => startUploadForReview(s, 'attempt1', s.version - 1), {
    message: 'R1016_REVIEW_ONLY_DENIED',
  });
});
