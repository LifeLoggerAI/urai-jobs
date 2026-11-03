import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../functions/src/privacy/lifeMovieConsentDecision.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, Date, Error, Reflect, Number, Object });
const verify = module.exports.assertLifeMovieConsentDecision;
const now = Date.parse('2026-11-01T12:00:00.000Z');
const renderScope = { projectId: 'project-1', renderPlanDigest: 'a'.repeat(64), sourceSetDigest: 'b'.repeat(64) };
const expected = { subjectUid: 'owner-1', tenantId: 'tenant-1', correlationId: 'corr-12345678',
  decisionReceiptId: 'c'.repeat(64), renderScope };
const allowed = { allowed: true, reason: 'ALLOWED', purpose: 'life-movie.render', policyVersion: '1.1.0',
  requiredTier: 'C6', subjectUid: expected.subjectUid, tenantId: expected.tenantId,
  correlationId: expected.correlationId, receiptHash: expected.decisionReceiptId, renderScope,
  evaluatedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60_000).toISOString(),
  decisionEventId: 'event-123' };
let passes = 0;
const accept = (value = allowed) => { assert.doesNotThrow(() => verify(value, expected, now)); passes++; };
const reject = (value, binding = expected) => { assert.throws(() => verify(value, binding, now)); passes++; };
accept();
reject(null);
reject({ ...allowed, allowed: false });
reject({ ...allowed, reason: 'DENIED' });
reject({ ...allowed, purpose: 'memory.storage' });
reject({ ...allowed, policyVersion: '1.0.0' });
reject({ ...allowed, requiredTier: 'C1' });
reject({ ...allowed, subjectUid: 'other' });
reject({ ...allowed, tenantId: 'other' });
reject({ ...allowed, correlationId: 'other' });
reject({ ...allowed, receiptHash: 'd'.repeat(64) });
reject({ ...allowed, renderScope: { ...renderScope, sourceSetDigest: 'd'.repeat(64) } });
reject({ ...allowed, renderScope: { ...renderScope, extra: true } });
reject({ ...allowed, renderScope: Object.create(renderScope) });
reject({ ...allowed, evaluatedAt: new Date(now - 31_000).toISOString() });
reject({ ...allowed, evaluatedAt: new Date(now + 1000).toISOString() });
reject({ ...allowed, expiresAt: new Date(now - 1000).toISOString() });
reject({ ...allowed, decisionEventId: null });
reject(allowed, { ...expected, decisionReceiptId: 'not-a-hash' });
reject({ ...allowed, renderScope: { ...renderScope, [Symbol('critical')]: true } });
// An allow response must contain concrete own data fields, not inherited
// authority values or getters. Firebase's JSON response naturally does.
reject(Object.create(allowed));
for (const field of Object.keys(allowed)) {
  const inherited = { ...allowed };
  delete inherited[field];
  Object.setPrototypeOf(inherited, { [field]: allowed[field] });
  reject(inherited);
}
let inheritedGetterReads = 0;
const inheritedGetter = { ...allowed };
delete inheritedGetter.allowed;
Object.setPrototypeOf(inheritedGetter, Object.defineProperty({}, 'allowed', {
  get() { inheritedGetterReads++; return true; }
}));
reject(inheritedGetter);
assert.equal(inheritedGetterReads, 0, 'must not execute inherited privileged getter');
// Nested movie/source selection is also consent authority. Do not execute
// accessor-backed fields in the purported Privacy response or expectation.
for (const key of Object.keys(renderScope)) {
  let receivedGetterReads = 0;
  const accessorScope = { ...renderScope };
  Object.defineProperty(accessorScope, key, { enumerable: true,
    get() { receivedGetterReads++; return renderScope[key]; } });
  reject({ ...allowed, renderScope: accessorScope });
  assert.equal(receivedGetterReads, 0, `response scope getter for ${key} must not execute`);
  let expectedGetterReads = 0;
  const accessorExpectation = { ...renderScope };
  Object.defineProperty(accessorExpectation, key, { enumerable: true,
    get() { expectedGetterReads++; return renderScope[key]; } });
  assert.throws(() => verify(allowed, { ...expected, renderScope: accessorExpectation }, now),
    /life_movie_consent_decision_invalid_expectation/);
  assert.equal(expectedGetterReads, 0, `expected scope getter for ${key} must not execute`);
  passes++;
}
let topLevelScopeGetterReads = 0;
const scopedGetterExpectation = { ...expected };
Object.defineProperty(scopedGetterExpectation, 'renderScope', {
  get() { topLevelScopeGetterReads++; return renderScope; }
});
assert.throws(() => verify(allowed, scopedGetterExpectation, now),
  /life_movie_consent_decision_invalid_expectation/);
assert.equal(topLevelScopeGetterReads, 0, 'top-level scope getter must not execute');
passes++;
// Expected owner/tenant/correlation/receipt values must be literal own data.
// A getter could otherwise change authority between validation and comparison.
for (const field of ['subjectUid', 'tenantId', 'correlationId', 'decisionReceiptId']) {
  let reads = 0;
  const forged = { ...expected };
  Object.defineProperty(forged, field, {
    enumerable: true, get() { reads++; return expected[field]; },
  });
  assert.throws(() => verify(allowed, forged, now),
    /life_movie_consent_decision_invalid_expectation/);
  assert.equal(reads, 0, 'expected authority getter must not run: ' + field);
  passes++;
}
reject(allowed, Object.create(expected));
accept(Object.assign(Object.create(null), allowed));
assert.equal(source.includes('lifeMovieConsentAuthorityAvailable'), true, 'gate must remain referenced as unavailable');
console.log('[PASS] ' + passes + ' synthetic decision-contract cases; no transport or processing enabled.');
