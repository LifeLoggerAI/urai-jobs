import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

// Execute the actual Jobs TypeScript modules with a synthetic HTTPS transport.
// No Firebase token is minted and no endpoint, GCS object or media is accessed.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(`../functions/src/${relativePath}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    Buffer, ArrayBuffer, AbortSignal, Date, Error, Number, Reflect, Object, Response, URL, TextDecoder,
    require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return module.exports;
}
const decisionModule = load('privacy/lifeMovieConsentDecision.ts');
const boundedResponse = load('privacy/lifeMovieBoundedResponse.ts');
const { createLifeMoviePrivacyTransport } = load('privacy/lifeMovieConsentTransport.ts', {
  './lifeMovieConsentDecision.js': decisionModule,
  './lifeMovieBoundedResponse.js': boundedResponse,
});
const fixedNow = Date.parse('2026-11-01T12:00:00.000Z');
const config = { firebaseProjectId: 'urai-staging', region: 'us-central1', dedicatedJobsUid: 'urai-jobs-service-1' };
const renderScope = { projectId: 'movie-1', renderPlanDigest: 'a'.repeat(64), sourceSetDigest: 'b'.repeat(64) };
const expected = { subjectUid: 'owner-1', tenantId: 'tenant-1', correlationId: 'correlation-123456',
  decisionReceiptId: 'c'.repeat(64), renderScope };
const allowed = { allowed: true, reason: 'ALLOWED', purpose: 'life-movie.render', policyVersion: '1.1.0',
  requiredTier: 'C6', subjectUid: expected.subjectUid, tenantId: expected.tenantId,
  correlationId: expected.correlationId, receiptHash: expected.decisionReceiptId,
  renderScope, evaluatedAt: new Date(fixedNow - 500).toISOString(),
  expiresAt: new Date(fixedNow + 60_000).toISOString(), decisionEventId: 'privacy-audit-123' };
const seconds = Math.floor(fixedNow / 1000);
const validClaims = { iss: 'https://securetoken.google.com/urai-staging', aud: 'urai-staging', sub: config.dedicatedJobsUid,
  iat: seconds - 100, exp: seconds + 1800,
  system: true, role: 'system', consumerId: 'urai-jobs', firebase: { sign_in_provider: 'custom' } };
const jwt = (claims) => [Buffer.from('{"alg":"RS256"}').toString('base64url'),
  Buffer.from(JSON.stringify(claims)).toString('base64url'), 'c2ln'].join('.');
const response = (body, status = 200, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});
let count = 0;
const pass = () => { count++; };
const fetchCalls = [];
const make = ({ claims = validClaims, token, fetchImpl, project = config.firebaseProjectId,
  region = config.region, uid = config.dedicatedJobsUid } = {}) => {
  const effectiveToken = token === undefined ? jwt(claims) : token;
  return createLifeMoviePrivacyTransport({ firebaseProjectId: project, region, dedicatedJobsUid: uid }, {
    getDedicatedJobsFirebaseIdToken: async () => effectiveToken,
    nowMs: () => fixedNow,
    fetchImpl: fetchImpl ?? (async (url, options) => {
      fetchCalls.push({ url, options });
      return response({ result: allowed });
    }),
  });
};
const succeeds = async (fn = make(), input = expected) => { await fn(input); pass(); };
const rejects = async (fn, message, input = expected) => {
  await assert.rejects(() => fn(input), (error) => error && error.message === message);
  pass();
};
await succeeds();
assert.equal(fetchCalls.length, 1);
assert.equal(fetchCalls[0].url,
  'https://us-central1-urai-staging.cloudfunctions.net/verifyLifeMovieRenderConsent');
assert.equal(fetchCalls[0].options.method, 'POST');
assert.equal(fetchCalls[0].options.redirect, 'error');
assert.equal(fetchCalls[0].options.headers.Authorization, `Bearer ${jwt(validClaims)}`);
assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { data: {
  subjectUid: expected.subjectUid, tenantId: expected.tenantId,
  correlationId: expected.correlationId, decisionReceiptId: expected.decisionReceiptId,
  policyVersion: '1.1.0', renderScope,
} });
assert.deepEqual(JSON.parse(JSON.stringify(await make()(expected))), { decisionEventId: 'privacy-audit-123', evaluatedAt: allowed.evaluatedAt });
assert.equal(fetchCalls.length, 2, 'each call must obtain a fresh decision; no cached allow');
pass();
for (const claims of [
  { ...validClaims, aud: 'other-project' },
  { ...validClaims, iss: 'https://securetoken.google.com/other-project' },
  { ...validClaims, sub: 'generic-admin' },
  { ...validClaims, system: false },
  { ...validClaims, role: 'admin' },
  { ...validClaims, consumerId: 'urai-studio' },
  { ...validClaims, firebase: { sign_in_provider: 'password' } },
  { ...validClaims, exp: seconds - 1 },
  { ...validClaims, iat: seconds + 100 },
  { ...validClaims, iat: seconds - 7200, exp: seconds + 300 },
  { ...validClaims, iat: seconds - 100, exp: seconds + 7200 },
  { ...validClaims, iat: seconds - 100, exp: seconds - 100 },
]) await rejects(make({ claims }), 'life_movie_consent_jobs_identity_unavailable');
for (const token of ['', 'Bearer some-other-token', 'abc.def', 'not-a-jwt']) {
  await rejects(make({ token }), 'life_movie_consent_jobs_identity_unavailable');
}
assert.equal(fetchCalls.length, 2, 'bad caller identity must never reach network');
for (const bad of [
  { ...expected, decisionReceiptId: 'fake' },
  { ...expected, tenantId: '' },
  { ...expected, renderScope: { ...renderScope, sourceSetDigest: 'bad' } },
  { ...expected, renderScope: { ...renderScope, unexpected: 'x' } },
]) await rejects(make(), 'life_movie_consent_decision_invalid_expectation', bad);
assert.equal(fetchCalls.length, 2, 'bad request must never reach network');
for (const [key, value] of [
  ['allowed', false], ['reason', 'REVOKED'], ['subjectUid', 'another-user'],
  ['tenantId', 'another-tenant'], ['correlationId', 'another-correlation'],
  ['receiptHash', 'd'.repeat(64)], ['policyVersion', '1.0.0'],
  ['expiresAt', new Date(fixedNow - 1).toISOString()],
  ['evaluatedAt', new Date(fixedNow - 31_000).toISOString()],
  ['renderScope', { ...renderScope, sourceSetDigest: 'd'.repeat(64) }],
]) await rejects(make({ fetchImpl: async () => response({ result: { ...allowed, [key]: value } }) }),
  'life_movie_consent_decision_denied');
// Strict Jobs acceptance: a perfectly bound positive Privacy decision may
// carry ONLY the canonical 13 own fields. Marked emulator proposals and
// unexpected authority-looking claims are never allowed to pass as consent.
for (const [field, marker] of [
  ['reviewOnlyEmulator', true],
  ['productionAuthorized', false],
  ['hiddenAudit', 'untrusted'],
  ['unexpectedAuthority', true],
]) await rejects(make({ fetchImpl: async () => response({
  result: { ...allowed, [field]: marker },
}) }), 'life_movie_consent_decision_denied');

// Source-level adversarial checks include shapes JSON would drop on the wire.
// These exercise the original Jobs validator, not a copied assertion.
assert.doesNotThrow(() => decisionModule.assertLifeMovieConsentDecision(allowed, expected, fixedNow));
pass();
// The actual JSON decoder may execute in a different VM/test realm. A genuine
// canonical parsed object must still pass; only extra claims must be denied.
const crossRealmDecision = vm.runInNewContext('JSON.parse(payload)', {
  payload: JSON.stringify(allowed),
});
assert.doesNotThrow(() =>
  decisionModule.assertLifeMovieConsentDecision(crossRealmDecision, expected, fixedNow));
pass();
const crossRealmMarked = vm.runInNewContext('JSON.parse(payload)', {
  payload: JSON.stringify({ ...allowed, reviewOnlyEmulator: true }),
});
assert.throws(() =>
  decisionModule.assertLifeMovieConsentDecision(crossRealmMarked, expected, fixedNow),
  (error) => error && error.message === 'life_movie_consent_decision_denied');
pass();
for (const forged of [
  Object.assign(Object.create({ inheritedAuthority: true }), allowed),
  Object.assign({ ...allowed }, { [Symbol('synthetic-grant')]: true }),
  Object.defineProperty({ ...allowed }, 'reviewOnlyEmulator', {
    enumerable: false, value: true,
  }),
  new Proxy({ ...allowed }, { ownKeys() { throw new Error('untrusted-reflection-trap'); } }),
]) {
  assert.throws(
    () => decisionModule.assertLifeMovieConsentDecision(forged, expected, fixedNow),
    (error) => error && error.message === 'life_movie_consent_decision_denied',
  );
  pass();
}
for (const fakeResponse of [
  response({ error: { status: 'PERMISSION_DENIED' } }),
  response({ result: allowed, error: { status: 'PERMISSION_DENIED' } }),
  response({ result: null }),
  response('<html>bad</html>'),
]) await rejects(make({ fetchImpl: async () => fakeResponse }),
  fakeResponse.headers.get('content-type')?.includes('html') ? 'life_movie_consent_transport_unavailable'
    : fakeResponse === undefined ? 'life_movie_consent_transport_unavailable'
    : (await fakeResponse.clone().text()).startsWith('{') ? 'life_movie_consent_decision_denied'
      : 'life_movie_consent_transport_unavailable');
for (const status of [401, 403, 429, 500]) await rejects(make({ fetchImpl: async () => response({ error: true }, status) }),
  'life_movie_consent_transport_unavailable');
await rejects(make({ fetchImpl: async () => { throw new Error('network down'); } }),
  'life_movie_consent_transport_unavailable');
await rejects(make({ fetchImpl: async () => response({ result: allowed }, 200, { 'content-type': 'text/plain' }) }),
  'life_movie_consent_transport_unavailable');
await rejects(make({ fetchImpl: async () => response({ result: allowed }, 200, { 'content-length': '9999999' }) }),
  'life_movie_consent_transport_unavailable');
await rejects(make({ fetchImpl: async () => response(' '.repeat(20_000)) }),
  'life_movie_consent_transport_unavailable');
await rejects(make({ fetchImpl: async () => {
  const ok = response({ result: allowed });
  return { ...ok, status: 200, redirected: true, headers: ok.headers, text: () => ok.text() };
} }), 'life_movie_consent_transport_unavailable');
assert.throws(() => createLifeMoviePrivacyTransport({ ...config, firebaseProjectId: '' }, {
  getDedicatedJobsFirebaseIdToken: async () => jwt(validClaims),
}), /life_movie_consent_jobs_identity_unavailable/);
pass();
// The authority input must be pinned before service-token retrieval. Neither
// an in-process getter nor an async mutation can change the requested movie.
for (const key of ['subjectUid', 'tenantId', 'correlationId', 'decisionReceiptId', 'renderScope']) {
  let reads = 0;
  const accessor = { ...expected };
  Object.defineProperty(accessor, key, { enumerable: true,
    get() { reads++; return expected[key]; } });
  let tokens = 0;
  let requests = 0;
  await rejects(createLifeMoviePrivacyTransport(config, {
    getDedicatedJobsFirebaseIdToken: async () => { tokens++; return jwt(validClaims); },
    nowMs: () => fixedNow,
    fetchImpl: async () => { requests++; return response({ result: allowed }); },
  }), 'life_movie_consent_decision_invalid_expectation', accessor);
  assert.equal(reads, 0, `expected ${key} getter must not execute`);
  assert.equal(tokens, 0, 'invalid selection must not request a service token');
  assert.equal(requests, 0, 'invalid selection must not reach Privacy');
}
for (const key of Object.keys(renderScope)) {
  let reads = 0;
  const accessorScope = { ...renderScope };
  Object.defineProperty(accessorScope, key, { enumerable: true,
    get() { reads++; return renderScope[key]; } });
  let tokens = 0;
  let requests = 0;
  await rejects(createLifeMoviePrivacyTransport(config, {
    getDedicatedJobsFirebaseIdToken: async () => { tokens++; return jwt(validClaims); },
    nowMs: () => fixedNow,
    fetchImpl: async () => { requests++; return response({ result: allowed }); },
  }), 'life_movie_consent_decision_invalid_expectation', { ...expected, renderScope: accessorScope });
  assert.equal(reads, 0, `nested ${key} getter must not execute`);
  assert.equal(tokens, 0);
  assert.equal(requests, 0);
}
// After the token await, the caller can mutate its original object. The
// actual request AND the response validator must use the pinned first scope.
const mutatedOnToken = { ...expected, renderScope: { ...renderScope } };
let postedSourceDigest = '';
await succeeds(createLifeMoviePrivacyTransport(config, {
  getDedicatedJobsFirebaseIdToken: async () => {
    mutatedOnToken.renderScope.sourceSetDigest = 'f'.repeat(64);
    return jwt(validClaims);
  },
  nowMs: () => fixedNow,
  fetchImpl: async (_url, options) => {
    const data = JSON.parse(options.body).data;
    postedSourceDigest = data.renderScope.sourceSetDigest;
    return response({ result: allowed });
  },
}), mutatedOnToken);
assert.equal(postedSourceDigest, renderScope.sourceSetDigest, 'request must be pinned before token await');
assert.equal(mutatedOnToken.renderScope.sourceSetDigest, 'f'.repeat(64));
// Likewise, mutation during the HTTPS call cannot rewrite the expectation used
// to verify the result. A reply for the original source set must still bind.
const mutatedOnNetwork = { ...expected, renderScope: { ...renderScope } };
await succeeds(createLifeMoviePrivacyTransport(config, {
  getDedicatedJobsFirebaseIdToken: async () => jwt(validClaims),
  nowMs: () => fixedNow,
  fetchImpl: async () => {
    mutatedOnNetwork.renderScope.sourceSetDigest = 'e'.repeat(64);
    return response({ result: allowed });
  },
}), mutatedOnNetwork);
assert.equal(mutatedOnNetwork.renderScope.sourceSetDigest, 'e'.repeat(64));
const gate = readFileSync(new URL('../functions/src/privacy/lifeMovieConsentGate.ts', import.meta.url), 'utf8');
assert.match(gate, /function lifeMovieConsentAuthorityAvailable\(\): boolean \{\s*return false;/);
assert.doesNotMatch(gate, /process\.env\.[A-Z_]+_ENABLED/);
pass();
console.log(`[PASS] ${count} synthetic Jobs-to-Privacy transport and fail-closed checks.`);
console.log('No live identity, scoped issuer, rendering, provider endpoint, or hosted test was activated.');