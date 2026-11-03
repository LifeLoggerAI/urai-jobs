import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
function load(path, imports = {}) {
  const src = readFileSync(new URL('../functions/src/privacy/' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Buffer, ArrayBuffer, console, URL, AbortSignal, encodeURIComponent,
    require(id) { if (id in imports) return imports[id]; throw new Error('Unexpected import ' + id); },
  });
  return module.exports;
}
const boundedResponse = load('lifeMovieBoundedResponse.ts');
const tokenModule = load('lifeMovieJobsTokenProvider.ts', {
  './lifeMovieBoundedResponse.js': boundedResponse,
});
const config = { firebaseProjectId: 'urai-staging', dedicatedJobsUid: 'dedicated-jobs-uid', firebaseWebApiKey: 'AIza1234567890abcdefghijklmnopqrstuvwx' };
const jwt = 'x.y.z';
const authorized = { app: { options: { projectId: config.firebaseProjectId } },
  async createCustomToken(uid, claims) {
    assert.equal(uid, config.dedicatedJobsUid);
    assert.deepEqual(JSON.parse(JSON.stringify(claims)), { system: true, role: 'system', consumerId: 'urai-jobs' });
    return jwt;
  },
};
function response(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', ...headers },
  });
}
const ok = { localId: config.dedicatedJobsUid, idToken: jwt, expiresIn: '3600' };
const endpoint = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + config.firebaseWebApiKey;
let tested = 0;
const accept = async (deps = {}) => {
  const f = tokenModule.createDedicatedJobsFirebaseIdTokenProvider(config, {
    adminAuth: authorized,
    fetchImpl: async (url, opts) => {
      assert.equal(url, endpoint);
      assert.equal(opts.redirect, 'error');
      assert.equal(opts.method, 'POST');
      assert.equal(opts.cache, 'no-store');
      assert.equal(opts.headers.authorization, undefined);
      assert.deepEqual(JSON.parse(opts.body), { token: jwt, returnSecureToken: true });
      return response(ok);
    }, ...deps,
  });
  assert.equal(await f(), jwt); tested++;
};
const denyConfig = (override, deps = {}) => {
  assert.throws(() => tokenModule.createDedicatedJobsFirebaseIdTokenProvider({ ...config, ...override }, {
    adminAuth: authorized, ...deps,
  }), /life_movie_consent_jobs_identity_unavailable/); tested++;
};
const denyResult = async (result, overrides = {}) => {
  const f = tokenModule.createDedicatedJobsFirebaseIdTokenProvider(config, {
    adminAuth: authorized, fetchImpl: async () => result, ...overrides,
  });
  await assert.rejects(() => f(), /life_movie_consent_jobs_identity_unavailable/); tested++;
};
await accept();
for (const override of [
  { firebaseProjectId: 'other-project' }, { dedicatedJobsUid: '../cross-tenant' },
  { firebaseWebApiKey: '' }, { firebaseWebApiKey: 'bad' },
]) denyConfig(override);
denyConfig({}, { adminAuth: { app: { options: { projectId: 'urai-jobs' } }, createCustomToken: authorized.createCustomToken } });
denyConfig({}, { adminAuth: { app: { options: { projectId: config.firebaseProjectId } } } });
for (const bad of [
  { ...ok, localId: 'another-uid' }, { ...ok, idToken: 'bad-token' },
  { ...ok, expiresIn: '0' }, { ...ok, expiresIn: '7200' },
  { ...ok, expiresIn: 3600 }, null, 'garbage',
]) await denyResult(response(bad));
for (const bad of [response({ error: 'permission_denied' }, 403), response(ok, 200, { 'content-type': 'text/html' }),
  response(ok, 200, { 'content-length': '20000' })]) await denyResult(bad);
await denyResult(undefined, { fetchImpl: async () => { throw Error('network failure'); } });
await denyResult(undefined, { adminAuth: { ...authorized, createCustomToken: async () => { throw Error('signer unavailable'); } } });
const moduleClient = load('lifeMovieJobsPrivacyClient.ts', {
  './lifeMovieJobsTokenProvider.js': tokenModule,
  './lifeMovieConsentTransport.js': { createLifeMoviePrivacyTransport(cfg, deps) {
    assert.equal(cfg.firebaseProjectId, config.firebaseProjectId);
    assert.equal(cfg.dedicatedJobsUid, config.dedicatedJobsUid);
    assert.equal(cfg.region, 'us-central1');
    assert.equal(typeof deps.getDedicatedJobsFirebaseIdToken, 'function');
    return deps.getDedicatedJobsFirebaseIdToken;
  } },
});
const getToken = moduleClient.createAuthenticatedJobsPrivacyConsentClient({ ...config, region: 'us-central1' }, {
  adminAuth: authorized, fetchImpl: async () => response(ok),
});
assert.equal(await getToken(), jwt); tested++;
console.log('[PASS] ' + tested + ' Jobs identity acquisition/transport composition synthetic cases. No real credentials or IAM changes.');
