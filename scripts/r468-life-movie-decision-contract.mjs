#!/usr/bin/env node
/** Synthetic original-source Jobs Privacy response contract.
 * A passing response-shape check is NOT an authorization to issue consent,
 * render media, enable Jobs, or bypass live identity/deletion/rights gates.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const requireFn = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = requireFn('typescript');
const decisionSource = new URL('../functions/src/privacy/lifeMovieConsentDecision.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(decisionSource, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, { module, exports: module.exports }, { filename: decisionSource.pathname, timeout: 5000 });
const { assertLifeMovieConsentDecision } = module.exports;
assert.equal(typeof assertLifeMovieConsentDecision, 'function', 'original response validator must load');

const now = Date.UTC(2026, 10, 3, 12);
const scope = { projectId: 'movie-1', renderPlanDigest: 'a'.repeat(64), sourceSetDigest: 'b'.repeat(64) };
const expected = { subjectUid: 'owner-1', tenantId: 'tenant-1', correlationId: 'trace-123456',
  decisionReceiptId: 'c'.repeat(64), renderScope: scope };
// This is hypothetical JSON response data, NOT a genuine Privacy decision.
const canonical = {
  allowed: true, reason: 'ALLOWED', purpose: 'life-movie.render', policyVersion: '1.1.0',
  requiredTier: 'C6', subjectUid: expected.subjectUid, tenantId: expected.tenantId,
  correlationId: expected.correlationId, receiptHash: expected.decisionReceiptId,
  renderScope: scope, evaluatedAt: new Date(now - 1000).toISOString(),
  expiresAt: new Date(now + 60000).toISOString(), decisionEventId: 'decision-1234',
};
const clone = (value) => JSON.parse(JSON.stringify(value));
let total = 0;
function test(name, body) {
  body(); total += 1;
  console.log('PASS ' + name);
}
function deny(reply, request = expected, clock = now) {
  assert.throws(
    () => assertLifeMovieConsentDecision(reply, request, clock),
    /life_movie_consent_decision_(?:denied|invalid_expectation)/,
  );
}

test('canonical hypothetical response shape accepted without granting consent', () =>
  assert.doesNotThrow(() => assertLifeMovieConsentDecision(clone(canonical), expected, now)));
test('serialized JSON from a separate VM realm retains canonical shape', () =>
  assert.doesNotThrow(() => assertLifeMovieConsentDecision(
    runInNewContext('JSON.parse(text)', { text: JSON.stringify(canonical) }), expected, now)));
test('null-prototype canonical response can be validated', () =>
  assert.doesNotThrow(() => assertLifeMovieConsentDecision(
    Object.assign(Object.create(null), clone(canonical)), expected, now)));
for (const key of ['reviewOnlyEmulator', 'productionAuthorized', 'hiddenAudit', 'unexpectedAuthority']) {
  test('surplus marker denied: ' + key, () => deny({ ...clone(canonical), [key]: false }));
}
for (const [name, change] of [
  ['wrong owner', { subjectUid: 'owner-2' }],
  ['wrong tenant', { tenantId: 'tenant-2' }],
  ['wrong correlation', { correlationId: 'trace-different' }],
  ['wrong receipt', { receiptHash: '0'.repeat(64) }],
  ['wrong purpose', { purpose: 'ai.personalization' }],
  ['wrong tier', { requiredTier: 'C1' }],
  ['revoked decision', { allowed: false, reason: 'REVOKED' }],
  ['wrong policy', { policyVersion: '1.0.0' }],
  ['empty decision event', { decisionEventId: '' }],
  ['stale decision', { evaluatedAt: new Date(now - 30001).toISOString() }],
  ['future decision', { evaluatedAt: new Date(now + 1).toISOString() }],
  ['expired decision', { expiresAt: new Date(now - 1).toISOString() }],
]) {
  test('reject ' + name, () => deny({ ...clone(canonical), ...change }));
}
for (const key of ['sourceSetDigest', 'renderPlanDigest']) {
  test('reject altered render scope ' + key, () => deny({ ...clone(canonical),
    renderScope: { ...scope, [key]: 'd'.repeat(64) } }));
}
test('missing required field denied', () => {
  const reply = clone(canonical); delete reply.reason; deny(reply);
});
test('symbol authority denied', () => {
  const reply = clone(canonical); reply[Symbol('audit')] = true; deny(reply);
});
test('nonenumerable authority denied', () => {
  const reply = clone(canonical); Object.defineProperty(reply, 'hiddenAudit', { value: true }); deny(reply);
});
test('accessor authority denied without invoking getter', () => {
  const reply = clone(canonical); let invoked = 0;
  Object.defineProperty(reply, 'allowed', { get() { invoked++; return true; } });
  deny(reply); assert.equal(invoked, 0);
});
test('inherited custom authority denied', () =>
  deny(Object.assign(Object.create({ privileged: true }), clone(canonical))));
test('throwing Proxy reflection denied', () =>
  deny(new Proxy(clone(canonical), { ownKeys() { throw new Error('hostile trap'); } })));
test('expected owner request getter denied without invocation', () => {
  const request = clone(expected); let invoked = 0;
  Object.defineProperty(request, 'tenantId', { get() { invoked++; return 'tenant-1'; } });
  deny(clone(canonical), request); assert.equal(invoked, 0);
});
test('accessor-backed nested source scope denied', () => {
  const reply = clone(canonical); const source = { ...scope };
  Object.defineProperty(source, 'sourceSetDigest', { get() { throw new Error('unsafe getter'); } });
  reply.renderScope = source; deny(reply);
});
test('surplus authority in nested source scope denied', () =>
  deny({ ...clone(canonical), renderScope: { ...scope, productionAuthorized: true } }));
test('mismatched expected source-set denied', () =>
  deny(clone(canonical), { ...expected, renderScope: { ...scope, sourceSetDigest: 'e'.repeat(64) } }));
test('invalid freshness bound denied', () =>
  assert.throws(() => assertLifeMovieConsentDecision(clone(canonical), expected, now, 60000),
    /life_movie_consent_decision_invalid_expectation/));

console.log('R468_JOBS_CONSENT_DECISION_SHAPE_PASS ' + total + '/' + total);
console.log('SOURCE_ONLY - NO SIGNED SERVICE IDENTITY, GRANT ISSUANCE, PRIVATE RENDER OR RELEASE');
