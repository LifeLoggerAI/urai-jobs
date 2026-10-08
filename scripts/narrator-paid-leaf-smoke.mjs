/** Execute the actual TS and tracked JS provider leaves with synthetic transports only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2), sourceArg = args.indexOf('--source-root');
const sourceRoot = sourceArg >= 0 ? path.resolve(args[sourceArg + 1]) : path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(new URL('../workers/narrator-worker/package.json', import.meta.url));
const ts = require('typescript');
const sourcePaths = ['workers/narrator-worker/src/protected-spend.ts', 'workers/narrator-worker/src/protected-spend.js', 'workers/narrator-worker/src/handlers/narrator-tts.ts', 'workers/narrator-worker/src/handlers/narrator-tts.js'];
const hash = value => createHash('sha256').update(value).digest('hex');
const stable = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(stable).join(',')}]` : `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
const protectedCanonical = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (Array.isArray(value)) return `[${value.map(protectedCanonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${protectedCanonical(k)}:${protectedCanonical(value[k])}`).join(',')}}`;
};
const requestDigest = (endpoint, body) => hash(Buffer.concat([Buffer.from(`POST\n${endpoint}\n`), Buffer.from(body)]));
const gatewayUrl = 'https://synthetic-gateway.example/api/worker/production-spend';
function assertSyntheticTransportUrl(value, expectedUrl) {
  const target = new URL(String(value)), expected = new URL(expectedUrl);
  assert.equal(target.protocol, 'https:', 'synthetic transport requires HTTPS');
  assert.equal(target.username, '', 'synthetic transport forbids URL credentials');
  assert.equal(target.password, '', 'synthetic transport forbids URL credentials');
  assert.equal(target.origin, expected.origin, 'unexpected network origin prohibited');
  assert.equal(String(value), expectedUrl, 'unexpected network call prohibited');
}
const gatewaySha = 'b'.repeat(40);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-narrator-leaf-'));
function git(...args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
for (const rel of sourcePaths) { const file = path.join(sourceRoot, rel); if (fs.existsSync(file)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.copyFileSync(file, path.join(root, rel)); } }
git('init', '--quiet'); git('add', '.'); git('-c', 'user.name=UrAi Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'Synthetic actual-leaf fixture');
const sourceSha = git('rev-parse', 'HEAD');
// Reuse compiler output for identical source bytes while each fixture receives
// fresh VM modules and adapters. Repeated compilation must not consume the
// short real timeout being tested; changed source is always recompiled.
const compiledSources = new Map();
function fixtureCode(rel, source) {
  if (!rel.endsWith('.ts')) return source;
  const previous = compiledSources.get(rel);
  if (previous?.source === source) return previous.js;
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  compiledSources.set(rel, { source, js });
  return js;
}

function fixture(provider, options = {}, extension = 'ts') {
  const clock = { now: Date.now(), monotonic: 0 }, events = [], submitted = [], stored = [], deleted = [];
  const adc = { token: 'synthetic-oauth-token', principal: 'synthetic@synthetic-project.iam.gserviceaccount.com', quota: 'synthetic-billing-project', expiresAt: clock.now + 3_600_000 };
  Object.assign(adc, options.adc);
  const job = { jobId: 'synthetic-narrator-job', jobType: 'narrator.tts', type: 'narrator.tts', ownerUid: 'synthetic-owner', tenantId: 'synthetic-tenant', leaseToken: 'synthetic-lease', consent: { purpose: 'synthetic.voice', policyVersion: 'synthetic-policy', decisionReceiptId: 'synthetic-consent' }, payload: { provider, text: 'Synthetic é voice', locale: 'en-GB', voice: 'en-GB-Standard-A', voiceId: 'synthetic-voice', format: 'OGG_OPUS' } };
  if (provider === 'elevenlabs') job.providerAuthorization = { provider, ownerUid: job.ownerUid, consentReceiptId: 'synthetic-consent', rightsReceiptId: 'synthetic-rights', provenanceRef: 'synthetic-provenance', voiceId: job.payload.voiceId };
  Object.assign(job, options.job);
  const canonical = { ...structuredClone(job), status: 'RUNNING', execution: { leaseToken: job.leaseToken } };
  delete canonical.providerAuthorization;
  const authorization = { enabled: true, provider: 'elevenlabs', ownerUid: job.ownerUid,
    consentPurpose: job.consent?.purpose || 'synthetic.voice', policyVersion: job.consent?.policyVersion || 'synthetic-policy',
    decisionReceiptId: job.consent?.decisionReceiptId || 'synthetic-consent', voiceIds: [job.payload.voiceId],
    rightsReceiptId: 'synthetic-rights', provenanceRef: 'synthetic-provenance' };
  const blocks = new Map(), fences = new Map(), dbState = { available: true }, firestoreReads = [];
  options.initialCanonical?.({ canonical, authorization, blocks, fences, dbState });
  const endpoint = provider === 'google' ? 'https://texttospeech.googleapis.com/v1/text:synthesize' : 'https://api.elevenlabs.io/v1/text-to-speech/synthetic-voice?output_format=mp3_44100_128';
  const body = provider === 'google' ? JSON.stringify({ input: { text: job.payload.text }, voice: { languageCode: job.payload.locale || 'en-US', name: job.payload.voice || job.payload.voiceId }, audioConfig: { audioEncoding: 'OGG_OPUS' } }) : JSON.stringify({ text: job.payload.text, model_id: 'eleven_multilingual_v2' });
  const accountId = provider === 'google' ? `google:${adc.quota}:${adc.principal}` : 'synthetic-elevenlabs-account';
  const mapping = { [requestDigest(endpoint, body)]: { job_id: 'synthetic-protected-job', worker_id: `synthetic-${provider}-worker`, account_id: accountId, token: 'synthetic-distinct-worker-token-1234567890', gateway_url: gatewayUrl } };
  const env = { FIREBASE_PROJECT_ID: 'synthetic-jobs-project', GCS_BUCKET_NAME: 'synthetic-bucket', URAI_SOURCE_SHA: sourceSha, ASSET_FORGE_SPEND_GATEWAY_SOURCE_SHA: gatewaySha, ASSET_FORGE_SPEND_GATEWAY_URL: gatewayUrl, ASSET_FORGE_SPEND_GATEWAY_ORIGIN: 'https://synthetic-gateway.example', URAI_NARRATOR_SPEND_BINDINGS_JSON: JSON.stringify(mapping), URAI_NARRATOR_ELEVENLABS_ENABLED: 'true', ELEVENLABS_API_KEY: 'synthetic-elevenlabs-key', ELEVENLABS_ALLOWED_VOICE_IDS: 'synthetic-voice' };
  Object.assign(env, options.env);
  let protectedJob, held = false, recorded = false, verifiedPreflightExpiry;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  function protectedEnvelope(fields) {
    const executor = { binding_version: 2, worker_id: fields.worker_id, repository: fields.executor_repository, source_sha: fields.executor_source_sha, gateway_repository: fields.gateway_repository, gateway_source_sha: fields.gateway_source_sha, tenant_sha256: fields.tenant_sha256, credential_sha256: fields.credential_sha256, source_input_sha256: fields.source_input_sha256, semantic_input_sha256: fields.semantic_input_sha256, semantic_headers_sha256: fields.semantic_headers_sha256, content_type: fields.content_type, request_sha256: fields.request_sha256, endpoint: fields.endpoint, asset: fields.asset, request_size: fields.request_size, deployment_ref: 'c'.repeat(64), controls_ref: 'd'.repeat(64) };
    const rates = { usd_micros_per_unit: 1, credits_per_unit: 0, receipt: 'synthetic-price-rate', verified_at: new Date(clock.now - 1000).toISOString(), expires_at: new Date(clock.now + 3_600_000).toISOString() };
    protectedJob = { schema_version: 1, job_id: fields.job_id, provider: fields.provider, account_id: fields.account_id, model_version: fields.model, consumer: fields.consumer, rights_reviewed: true, authority: { repository: fields.executor_repository, sha: fields.executor_source_sha }, executor, input_sha256: [fields.source_input_sha256, fields.request_sha256], budget: { max_runtime_seconds: options.runtime || 45, rates }, attempts: [] };
    options.mutateEnvelope?.(protectedJob, fields, clock);
    const price = { provider: fields.provider, account_id: fields.account_id, model_version: fields.model, request_sha256: fields.request_sha256, credential_sha256: fields.credential_sha256, semantic_headers_sha256: fields.semantic_headers_sha256, source_input_sha256: fields.source_input_sha256, semantic_input_sha256: fields.semantic_input_sha256, content_type: fields.content_type, trusted_readback: true, receipt: 'synthetic-protected-price', observed_at: new Date(clock.now - 1000).toISOString(), expires_at: new Date(clock.now + 3_600_000).toISOString(), rates: structuredClone(rates) };
    options.mutatePricing?.(price, clock);
    const controls = { provider: fields.provider, account_id: fields.account_id, trusted_readback: true, verified: true, enforcement_source_sha: gatewaySha, binding: Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'action')), credential_sha256: fields.credential_sha256, semantic_headers_sha256: fields.semantic_headers_sha256, source_input_sha256: fields.source_input_sha256, semantic_input_sha256: fields.semantic_input_sha256, content_type: fields.content_type, observed_at: new Date(clock.now - 1000).toISOString(), expires_at: new Date(clock.now + 3_600_000).toISOString() };
    options.mutateControls?.(controls, clock);
    verifiedPreflightExpiry = options.preflightExpiry === undefined ? clock.now + 3_600_000 : options.preflightExpiry;
    return { ok: true, ...(options.missingPreflightExpiry ? {} : { admission_expires_at: new Date(verifiedPreflightExpiry).toISOString() }), envelope: { job: protectedJob, ...(options.missingControls ? {} : { protected_controls: controls }), ...(options.missingPricing ? {} : { protected_pricing: price }) }, provider_call_authorized: false, execution_performed: false };
  }
  const fetch = async (url, init) => {
    if (new URL(String(url)).origin === new URL(gatewayUrl).origin) {
      assertSyntheticTransportUrl(url, gatewayUrl);
      const fields = JSON.parse(init.body); events.push({ action: fields.action, fields });
      assert.equal(String(url), gatewayUrl); assert.equal(init.redirect, 'error');
      assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${mapping[requestDigest(endpoint, body)].token}`);
      if (fields.action === 'preflight') {
        if (options.gatewayUnavailable) throw new Error('synthetic gateway unavailable');
        if (options.preflightDenied) return json({ ok: false }, 409);
        const result = protectedEnvelope(fields); options.afterPreflight?.({ env, job, adc, clock, canonical, authorization, blocks, fences, dbState, stored, deleted });
        return json(options.authorizingPreflight ? { ...result, provider_call_authorized: true } : result);
      }
      if (fields.action === 'reserve') {
        if (held || options.reserveDenied) return json({ ok: false }, 409);
        held = true;
        if (options.reserveLost) throw new Error('synthetic reserve response lost after hold');
        const digest = hash(protectedCanonical(Object.fromEntries(Object.entries(protectedJob).filter(([key]) => key !== 'approval' && key !== 'attempts'))));
        assert.equal(fields.job_digest, digest);
        const reservedAt = clock.now, admittedExpiry = Math.min(verifiedPreflightExpiry, reservedAt + (options.runtime || 45) * 1000);
        const result = { ok: true, ...(options.missingReserveTimes ? {} : { reserved_at: new Date(options.reservedAt === undefined ? reservedAt : options.reservedAt).toISOString(), admission_expires_at: new Date(options.reserveExpiry === undefined ? admittedExpiry : options.reserveExpiry).toISOString() }), attempt_id: 'synthetic-attempt', provider_call_authorized: true, execution_performed: false, job_digest: digest, executor_source_sha: sourceSha, gateway_source_sha: gatewaySha, worker_id: fields.worker_id, account_id: fields.account_id, credential_sha256: fields.credential_sha256, semantic_headers_sha256: fields.semantic_headers_sha256, source_input_sha256: fields.source_input_sha256, semantic_input_sha256: fields.semantic_input_sha256, content_type: fields.content_type, max_runtime_seconds: options.runtime || 45 };
        options.mutateReserve?.(result);
        options.afterReserve?.({ env, job, adc, clock, canonical, authorization, blocks, fences, dbState, stored, deleted });
        return json(options.badReserve ? { ...result, worker_id: 'foreign-worker' } : result);
      }
      if (fields.action === 'record') {
        assert.equal(held, true); assert.equal(fields.attempt_id, 'synthetic-attempt');
        assert.ok(['succeeded', 'failed'].includes(fields.status));
        assert.equal(fields.credential_sha256, events[0].fields.credential_sha256);
        recorded = true;
        options.afterRecord?.({ env, job, adc, clock, canonical, authorization, blocks, fences, dbState, stored, deleted });
        if (options.recordUnavailable) throw new Error('synthetic observation unavailable');
        return json({ ok: true, provider_call_authorized: false, execution_performed: false, reconciliation_required: true });
      }
      throw new Error('Unexpected synthetic gateway operation');
    }
    assertSyntheticTransportUrl(url, endpoint);
    submitted.push({ url: String(url), init });
    if (options.providerLost) throw new Error('synthetic provider response lost');
    if (options.providerTimeout) { clock.now += 2000; return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('synthetic provider timeout')), { once: true })); }
    if (options.providerDenied) return json({ error: 'synthetic failure' }, 500);
    options.afterProvider?.({ env, job, adc, clock, canonical, authorization, blocks, fences, dbState, stored, deleted });
    if (provider === 'google') return json({ audioContent: options.invalidAudio ? 'invalid!' : Buffer.from('synthetic-audio').toString('base64') });
    return new Response(options.invalidAudio ? Buffer.alloc(0) : Buffer.from('synthetic-audio'), { headers: { 'request-id': 'synthetic-provider-request' } });
  };
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } }
  class TextToSpeechClient {
    auth = { getClient: async () => ({ getAccessToken: async () => ({ token: adc.token }), get quotaProjectId() { return adc.quota; }, get credentials() { return { expiry_date: adc.expiresAt }; } }), getCredentials: async () => ({ client_email: adc.principal }), getProjectId: async () => adc.quota };
    async synthesizeSpeech(request) { submitted.push({ sdk: true, request }); return [{ audioContent: Buffer.from('synthetic-audio') }]; }
  }
  class Storage { bucket(bucket) { return { file: filename => ({
    async save(bytes, metadata) { assert.equal(metadata.preconditionOpts?.ifGenerationMatch, args.includes('--lifecycle-baseline') ? undefined : 0);
      if (options.storagePending) await new Promise(resolve => { dbState.finishStorage = resolve; });
      stored.push({ bucket, filename, bytes, metadata, generation: '1', live: true });
      options.afterStorage?.({ env, job, adc, clock, canonical, authorization, blocks, fences, dbState, stored, deleted });
      if (options.storageFails) throw new Error('synthetic Storage failure'); },
    async getMetadata() { const output = stored.find(o => o.filename === filename && o.live);
      if (!output) throw Object.assign(new Error('synthetic absent output'), { code: 404 });
      if (options.metadataFails) throw new Error('synthetic metadata unavailable');
      return [{ generation: output.generation, metadata: output.metadata.metadata.metadata }]; },
    async delete(optionsValue) { const output = stored.find(o => o.filename === filename && o.live); if (!output) return;
      options.beforeDelete?.({ output });
      if (optionsValue.ifGenerationMatch !== output.generation) throw Object.assign(new Error('synthetic generation changed'), { code: 412 });
      output.live = false; deleted.push({ filename, generation: optionsValue.ifGenerationMatch }); },
  }) }; } }
  const apps = [];
  const ref = key => ({ key });
  const db = { collection: name => ({ doc: id => ref(name + '/' + id) }), doc: ref,
    runTransaction: async fn => { if (dbState.pending) return new Promise(() => {}); if (!dbState.available) throw new Error('synthetic Firestore unavailable');
      return fn({ get: async document => { firestoreReads.push(document.key);
        if (document.key === 'jobs/' + job.jobId) return { exists: !options.jobMissing, data: () => structuredClone(canonical) };
        if (document.key === 'users/' + job.ownerUid + '/providerAuthorizations/elevenlabs') return { exists: !options.authorizationMissing, data: () => structuredClone(authorization) };
        if (document.key.startsWith('jobConsentBlocks/')) { const active = blocks.get(document.key.split('/')[1]); return { exists: active !== undefined, data: () => ({ active }) }; }
        if (document.key.startsWith('uraiPrivateLifeModelOwnerFences/') || document.key.startsWith('privacyDeletionTombstones/')) {
          const data = fences.get(document.key); return { exists: data !== undefined, data: () => data === undefined ? undefined : structuredClone(data) };
        }
        throw new Error('unexpected canonical read');
      } });
    } };
  const admin = { apps, initializeApp(optionsValue, name) { const app = { name, options: optionsValue }; apps.push(app); return app; },
    firestore(app) { assert.equal(app.options.projectId, env.FIREBASE_PROJECT_ID); return db; } };

  const context = vm.createContext({ Buffer, Headers, Response, URL, AbortController, AbortSignal, setTimeout, clearTimeout, setInterval, clearInterval, Date: FakeDate, fetch, process: { env, cwd: () => root }, console: { log() {} } });
  const modules = new Map();
  function load(rel) {
    if (modules.has(rel)) return modules.get(rel).exports;
    const source = fs.readFileSync(path.join(sourceRoot, rel), 'utf8');
    const js = fixtureCode(rel, source);
    const module = { exports: {} }; modules.set(rel, module);
    const localRequire = spec => {
      if (spec === '@google-cloud/text-to-speech') return { TextToSpeechClient };
      if (spec === '@google-cloud/storage') return { Storage };
      if (spec === 'firebase-admin') return admin;
      if (spec === './narrator-tts.js') return load(`workers/narrator-worker/src/handlers/narrator-tts.${extension}`);
      if (spec === '../protected-spend.js') return load(`workers/narrator-worker/src/protected-spend.${extension}`);
      if (spec === 'node:perf_hooks') return { performance: { now: () => clock.monotonic } };
      if (spec === '../runtime-source-proof.cjs') return require(path.join(sourceRoot, 'workers/narrator-worker/runtime-source-proof.cjs'));
      if (spec === 'node:child_process' && options.gitUnavailable) return { execFileSync() { throw new Error('synthetic Git unavailable'); } };
      if (spec.startsWith('node:')) return require(spec);
      throw new Error(`Unexpected actual-leaf dependency ${spec}`);
    };
    vm.runInContext(`(function(require,module,exports){${js}\n})`, context, { filename: rel })(localRequire, module, module.exports);
    return module.exports;
  }
  const handler = load(`workers/narrator-worker/src/handlers/narrator-tts.${extension}`);
  const registry = load(`workers/narrator-worker/src/handlers/index.${extension}`);
  return { job, env, adc, events, submitted, stored, deleted, canonical, authorization, blocks, fences, dbState, firestoreReads, endpoint, body, clock, helper: load('workers/narrator-worker/src/protected-spend.' + extension), execute: () => registry.handleJob(job), get held() { return held; }, get recorded() { return recorded; } };
}

let count = 0;
async function test(label, run) { await run(); count++; console.log(`[PASS] ${label}`); }
async function denied(provider, options, extra, extension = 'ts') { const f = fixture(provider, options, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 0); assert.equal(f.stored.length, 0); extra?.(f); }
async function malformedOwnerFenceProof(reproduce = false) {
  for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
    for (const kind of ['local', 'central']) for (const [state, value] of [
      ['missing', undefined], ['null', null], ['string', 'false'], ['number', 0], ['object', {}], ['array', []],
    ]) for (const [name, hook, posts, writes, held] of [
      ['before admission', 'initialCanonical', 0, 0, false],
      ['during reserve', 'afterReserve', 0, 0, true],
      ['during Storage write', 'afterStorage', 1, 1, true],
    ]) await test(extension + ' ' + provider + ' ' + kind + ' malformed ' + state + ' owner state ' + name, async () => {
      const mutate = ({ canonical, fences }) => {
        const owner = canonical.ownerUid, path = kind === 'local'
          ? 'uraiPrivateLifeModelOwnerFences/' + hash(owner) : 'privacyDeletionTombstones/' + owner;
        const data = kind === 'local' ? { ownerHash: hash(owner) } : { uid: owner };
        if (value !== undefined) data[kind === 'local' ? 'deleted' : 'active'] = value;
        fences.set(path, data);
      };
      const f = fixture(provider, { [hook]: mutate }, extension);
      if (reproduce) { await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.deleted.length, 0); }
      else {
        await assert.rejects(f.execute(), /narrator_canonical_owner_deleted/);
        assert.equal(f.submitted.length, posts); assert.equal(f.stored.length, writes); assert.equal(f.held, held);
        assert.equal(f.deleted.length, writes); if (writes) assert.equal(f.stored[0].live, false);
        if (held) assert.equal(f.recorded, true);
      }
    });
  }
}
async function ownerFenceProof(reproduce = false) {
  const pathFor = (kind, uid) => kind === 'local' ? 'uraiPrivateLifeModelOwnerFences/' + hash(uid) : 'privacyDeletionTombstones/' + uid;
  const deletedFence = (kind, uid) => kind === 'local' ? { ownerHash: hash(uid), deleted: true } : { uid, active: true };
  for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
    for (const kind of ['local', 'central']) {
      const removeOwner = ({ canonical, fences }) => fences.set(pathFor(kind, canonical.ownerUid), deletedFence(kind, canonical.ownerUid));
      for (const [name, hook, posts, writes, held] of [
        ['before admission', 'initialCanonical', 0, 0, false],
        ['during preflight', 'afterPreflight', 0, 0, false],
        ['during reserve', 'afterReserve', 0, 0, true],
        ['after provider response', 'afterProvider', 1, 0, true],
        ['during Storage write', 'afterStorage', 1, 1, true],
        ['during outcome observation', 'afterRecord', 1, 1, true],
      ]) await test(extension + ' ' + provider + ' ' + kind + ' owner deletion ' + name, async () => {
        const f = fixture(provider, { [hook]: removeOwner }, extension);
        if (reproduce) { await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.deleted.length, 0); }
        else { await assert.rejects(f.execute(), hook === 'afterRecord'
          ? /narrator output requires durable observation and charge reconciliation/
          : /narrator_canonical_owner_deleted/);
          assert.equal(f.submitted.length, posts); assert.equal(f.stored.length, writes); assert.equal(f.held, held);
          assert.equal(f.deleted.length, writes); if (writes) { assert.equal(f.stored[0].live, false); assert.equal(f.deleted[0].generation, '1'); }
          if (held) assert.equal(f.recorded, true);
        }
      });
      await test(extension + ' ' + provider + ' ' + kind + ' owner fence identity mismatch denies admission', async () => {
        const f = fixture(provider, { initialCanonical: ({ canonical, fences }) => fences.set(pathFor(kind, canonical.ownerUid),
          kind === 'local' ? { ownerHash: hash('foreign-owner'), deleted: false } : { uid: 'foreign-owner', active: false }) }, extension);
        if (reproduce) { await f.execute(); assert.equal(f.submitted.length, 1); }
        else { await assert.rejects(f.execute(), /narrator_canonical_owner_deleted/); assert.equal(f.submitted.length, 0); assert.equal(f.events.length, 0); }
      });
    }
    await test(extension + ' ' + provider + ' current inactive identity-bound owner fences preserve valid admission', async () => {
      const f = fixture(provider, { initialCanonical: ({ canonical, fences }) => {
        fences.set(pathFor('local', canonical.ownerUid), { ownerHash: hash(canonical.ownerUid), deleted: false });
        fences.set(pathFor('central', canonical.ownerUid), { uid: canonical.ownerUid, active: false });
      } }, extension);
      await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.deleted.length, 0);
      if (!reproduce) for (const kind of ['local', 'central']) assert.ok(f.firestoreReads.includes(pathFor(kind, f.job.ownerUid)));
    });
    await test(extension + ' ' + provider + ' another owner deletion does not widen deletion scope', async () => {
      const f = fixture(provider, { initialCanonical: ({ fences }) => { for (const kind of ['local', 'central']) fences.set(pathFor(kind, 'unrelated-owner'), deletedFence(kind, 'unrelated-owner')); } }, extension);
      await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.deleted.length, 0);
    });
  }
}
async function lifecycleProof(reproduce = false) {
  for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
    await test(extension + ' ' + provider + ' late Storage completion after session timeout is cleaned by its continuation', async () => {
      const f = fixture(provider, { runtime: 1, storagePending: true }, extension);
      const execution = f.execute(), rejected = assert.rejects(execution);
      for (let attempt = 0; !f.dbState?.finishStorage && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(typeof f.dbState?.finishStorage, 'function', 'actual handler reached pending Storage await');
      f.clock.now += 2000; await rejected; assert.equal(f.held, true); assert.equal(f.stored.length, 0);
      f.dbState.finishStorage();
      for (let attempt = 0; (!f.stored.length || (!reproduce && f.stored[0].live)) && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(f.stored.length, 1); assert.equal(f.stored[0].live, reproduce); assert.equal(f.deleted.length, reproduce ? 0 : 1);
    });
  }
  const revoke = ({ canonical, blocks }) => blocks.set(hash(canonical.ownerUid + '\n' + canonical.consent.purpose), true);
  const correct = ({ canonical }) => { canonical.payload.text = 'Corrected canonical source'; };
  for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
    const label = extension + ' ' + provider + ' canonical ';
    const races = [
      ['initial revocation', { initialCanonical: revoke }, 0, 0, false],
      ['revocation during preflight', { afterPreflight: revoke }, 0, 0, false],
      ['revocation during reserve', { afterReserve: revoke }, 0, 0, true],
      ['revocation after provider response', { afterProvider: revoke }, 1, 0, true],
      ['revocation during storage', { afterStorage: revoke }, 1, 1, true],
      ['revocation during outcome observation', { afterRecord: revoke }, 1, 1, true],
      ['source correction during reserve', { afterReserve: correct }, 0, 0, true],
      ['source correction during storage', { afterStorage: correct }, 1, 1, true],
    ];
    if (provider === 'elevenlabs') races.push(
      ['voice authorization revoked during reserve', { afterReserve: ({ authorization }) => { authorization.enabled = false; } }, 0, 0, true],
      ['voice rights corrected during storage', { afterStorage: ({ authorization }) => { authorization.rightsReceiptId = 'corrected-rights'; } }, 1, 1, true]);
    for (const [name, options, posts, writes, held] of races) await test(label + name, async () => {
      const f = fixture(provider, options, extension);
      if (reproduce) { await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.deleted.length, 0); }
      else { await assert.rejects(f.execute()); assert.equal(f.submitted.length, posts); assert.equal(f.stored.length, writes);
        assert.equal(f.held, held); assert.equal(f.deleted.length, writes);
        if (held) assert.equal(f.recorded, true);
        if (posts === 0) assert.equal(f.stored.length, 0);
        if (writes) { assert.equal(f.stored[0].live, false); assert.equal(f.deleted[0].generation, '1'); } }
    });
    if (reproduce) continue;
    for (const field of ['ownerUid', 'tenantId', 'status', 'type', 'payload', 'execution']) await test(label + 'stored ' + field + ' mismatch denies provider', async () => {
      const f = fixture(provider, { initialCanonical: ({ canonical }) => { canonical[field] = field === 'payload' ? { text: 'foreign' } : field === 'execution' ? { leaseToken: 'foreign-lease' } : 'foreign'; } }, extension);
      await assert.rejects(f.execute()); assert.equal(f.submitted.length, 0); assert.equal(f.events.length, 0);
    });
    await test(label + 'missing authoritative job denies provider', () => denied(provider, { jobMissing: true }, f => assert.equal(f.events.length, 0), extension));
    await test(label + 'missing deployed canonical project denies provider', () => denied(provider, { env: { FIREBASE_PROJECT_ID: '' } }, f => assert.equal(f.events.length, 0), extension));
    await test(label + 'project drift during reserve retains hold without dispatch', () => denied(provider, { afterReserve: ({ env }) => { env.FIREBASE_PROJECT_ID = 'foreign-jobs-project'; } }, f => assert.equal(f.held, true), extension));
    await test(label + 'additional purpose revocation denies provider', async () => {
      const additional = { purpose: 'synthetic.private-memory', policyVersion: 'p', decisionReceiptId: 'd' };
      const f = fixture(provider, { job: { consents: [additional] }, initialCanonical: ({ canonical, blocks }) => { blocks.set(hash(canonical.ownerUid + '\n' + additional.purpose), true); } }, extension);
      await assert.rejects(f.execute()); assert.equal(f.submitted.length, 0);
    });
    for (const unrelated of ['owner', 'purpose', 'inactive']) await test(label + 'unrelated/inactive block ' + unrelated + ' preserves valid run', async () => {
      const f = fixture(provider, { initialCanonical: ({ canonical, blocks }) => { blocks.set(hash((unrelated === 'owner' ? 'foreign-owner' : canonical.ownerUid) + '\n' + (unrelated === 'purpose' ? 'foreign-purpose' : canonical.consent.purpose)), unrelated !== 'inactive'); } }, extension);
      await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.deleted.length, 0); assert.ok(f.firestoreReads.includes('jobs/' + f.job.jobId));
    });
    await test(label + 'Firestore outage after reserve retains hold without dispatch', () => denied(provider, { afterReserve: ({ dbState }) => { dbState.available = false; } }, f => assert.equal(f.held, true), extension));
    await test(label + 'foreign output marker refuses destructive cleanup', async () => {
      const f = fixture(provider, { afterStorage: state => { revoke(state); state.stored[0].metadata.metadata.metadata.uraiNarratorOutputNonce = 'foreign-original'; } }, extension);
      await assert.rejects(f.execute(), /cleanup_incomplete/); assert.equal(f.deleted.length, 0); assert.equal(f.stored[0].live, true); assert.equal(f.held, true);
    });
    await test(label + 'concurrent object generation replacement survives cleanup', async () => {
      const f = fixture(provider, { afterStorage: revoke, beforeDelete: ({ output }) => { output.generation = '2'; } }, extension);
      await assert.rejects(f.execute(), /cleanup_incomplete/); assert.equal(f.deleted.length, 0); assert.equal(f.stored[0].live, true); assert.equal(f.held, true);
    });
    await test(label + 'cleanup metadata outage remains exact retry blocker', async () => {
      const f = fixture(provider, { afterStorage: revoke, metadataFails: true }, extension);
      await assert.rejects(f.execute(), /cleanup_incomplete/); assert.equal(f.deleted.length, 0); assert.equal(f.stored[0].live, true); assert.equal(f.held, true);
    });
    if (provider === 'elevenlabs') for (const field of ['enabled', 'provider', 'ownerUid', 'consentPurpose', 'policyVersion', 'decisionReceiptId', 'voiceIds', 'rightsReceiptId', 'provenanceRef']) await test(label + 'server voice grant ' + field + ' mismatch denies provider', async () => {
      const f = fixture(provider, { initialCanonical: ({ authorization }) => { authorization[field] = field === 'enabled' ? false : field === 'voiceIds' ? [] : 'foreign'; } }, extension);
      await assert.rejects(f.execute()); assert.equal(f.submitted.length, 0); assert.equal(f.events.length, 0);
    });
  }
  if (!reproduce) await test('canonical Firestore read timeout blocks all paid operations', async () => {
    const f = fixture('google', { initialCanonical: ({ dbState }) => { dbState.pending = true; } });
    await assert.rejects(f.execute(), /canonical_read_timeout/);
    assert.equal(f.events.length, 0); assert.equal(f.submitted.length, 0); assert.equal(f.held, false);
  });
}

try {
  if (args.includes('--malformed-fence-baseline') || args.includes('--malformed-fence-only')) { await malformedOwnerFenceProof(args.includes('--malformed-fence-baseline')); }
  else if (args.includes('--owner-fence-baseline') || args.includes('--owner-fence-only')) { await ownerFenceProof(args.includes('--owner-fence-baseline')); }
  else if (args.includes('--lifecycle-baseline') || args.includes('--lifecycle-only')) { await lifecycleProof(args.includes('--lifecycle-baseline')); }
  else if (args.includes('--reproduce')) {
    for (const provider of ['google', 'elevenlabs']) await test(`predecessor ${provider} invokes actual paid leaf without canonical approval`, async () => { const f = fixture(provider, { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: '{}' } }); await f.execute(); assert.equal(f.events.length, 0); assert.equal(f.submitted.length, 1); });
  } else {
    for (const expected of [gatewayUrl, 'https://texttospeech.googleapis.com/v1/text:synthesize', 'https://api.elevenlabs.io/v1/text-to-speech/synthetic-voice?output_format=mp3_44100_128']) {
      await test('synthetic transport accepts exact credential-free HTTPS URL ' + new URL(expected).host,
        () => assertSyntheticTransportUrl(expected, expected));
    }
    await test('synthetic transport accepts an exact URL object', () => assertSyntheticTransportUrl(new URL(gatewayUrl), gatewayUrl));
    for (const [label, value] of [
      ['malformed', 'not-a-url'], ['relative', '/api/worker/production-spend'],
      ['HTTP', 'http://synthetic-gateway.example/api/worker/production-spend'],
      ['credentials', 'https://synthetic:fixture@synthetic-gateway.example/api/worker/production-spend'],
      ['foreign origin', 'https://other.invalid/api/worker/production-spend'],
      ['hostname suffix', 'https://synthetic-gateway.example.other.invalid/api/worker/production-spend'],
      ['alternate port', 'https://synthetic-gateway.example:444/api/worker/production-spend'],
      ['different path', 'https://synthetic-gateway.example/other'],
    ]) await test('synthetic transport rejects ' + label, () => assert.throws(() => assertSyntheticTransportUrl(value, gatewayUrl)));
    for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
      const prefix = `${extension} ${provider}`;
      await test(`${prefix} missing protected mapping blocks actual provider`, () => denied(provider, { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: '{}' } }, undefined, extension));
      await test(`${prefix} configured credentials and forged caller approval grant no spend`, () => denied(provider, { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: '{}' }, job: { approval: { status: 'APPROVED' }, providerCallAuthorized: true } }, undefined, extension));
      await test(`${prefix} gateway denial blocks actual provider`, () => denied(provider, { preflightDenied: true }, undefined, extension));
      await test(`${prefix} uncertain reservation never dispatches or releases hold`, () => denied(provider, { reserveLost: true }, f => { assert.equal(f.held, true); assert.equal(f.recorded, false); }, extension));
      await test(`${prefix} exact synthetic reservation precedes one frozen POST`, async () => { const f = fixture(provider, {}, extension); const result = await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.submitted[0].sdk, undefined); assert.equal(f.submitted[0].init.body, f.body); assert.equal(f.submitted[0].init.redirect, 'error'); assert.deepEqual(f.events.map(e => e.action), ['preflight', 'reserve', 'record']); assert.equal(f.events[2].fields.status, 'succeeded'); assert.equal(f.held, true); assert.equal(f.stored.length, 1); assert.equal(result.provider, provider); assert.equal(result.consentRef, provider === 'elevenlabs' ? 'synthetic-consent' : null); assert.equal(result.rightsRef, provider === 'elevenlabs' ? 'synthetic-rights' : null); const field = f.events[0].fields; assert.equal(field.request_size, String(Buffer.byteLength(f.body))); assert.equal(field.request_sha256, requestDigest(f.endpoint, f.body)); assert.equal(field.source_input_sha256, hash(stable(f.job))); assert.equal(field.semantic_input_sha256, hash(stable(JSON.parse(f.body)))); if (provider === 'google') { const h = new Headers(f.submitted[0].init.headers); assert.equal(h.get('x-goog-user-project'), f.adc.quota); assert.equal(h.get('authorization'), `Bearer ${f.adc.token}`); assert.deepEqual(JSON.parse(f.body), { input: { text: f.job.payload.text }, voice: { languageCode: 'en-GB', name: 'en-GB-Standard-A' }, audioConfig: { audioEncoding: 'OGG_OPUS' } }); } });
    }
    for (const provider of ['google', 'elevenlabs']) {
      await test(`${provider} missing genuine protected pricing blocks paid POST`, () => denied(provider, { missingPricing: true }));
      for (const field of ['provider', 'account_id', 'model_version', 'request_sha256', 'credential_sha256', 'semantic_headers_sha256', 'source_input_sha256', 'semantic_input_sha256', 'content_type', 'receipt']) await test(`${provider} actual protected pricing ${field} drift blocks paid POST`, () => denied(provider, { mutatePricing: price => { price[field] = field === 'receipt' ? '' : 'foreign'; } }));
      await test(`${provider} untrusted pricing readback blocks paid POST`, () => denied(provider, { mutatePricing: price => { price.trusted_readback = false; } }));
      await test(`${provider} stale pricing blocks paid POST`, () => denied(provider, { mutatePricing: (price, clock) => { price.expires_at = new Date(clock.now).toISOString(); } }));
      await test(`${provider} future pricing readback blocks paid POST`, () => denied(provider, { mutatePricing: (price, clock) => { price.observed_at = new Date(clock.now + 1000).toISOString(); } }));
      await test(`${provider} pricing rates differ from signed budget blocks paid POST`, () => denied(provider, { mutatePricing: price => { price.rates.usd_micros_per_unit = 2; } }));
      await test(`${provider} stale pricing rates block paid POST`, () => denied(provider, { mutatePricing: (price, clock) => { price.rates.expires_at = new Date(clock.now).toISOString(); } }));
      await test(`${provider} invalid pricing calendar blocks paid POST`, () => denied(provider, { mutatePricing: price => { price.observed_at = '2026-02-30T00:00:00Z'; } }));
      await test(`${provider} wrong gateway URL blocks all transport`, () => denied(provider, { env: { ASSET_FORGE_SPEND_GATEWAY_URL: 'http://localhost/api/worker/production-spend' } }));
      await test(`${provider} unavailable gateway blocks provider`, () => denied(provider, { gatewayUnavailable: true }));
      await test(`${provider} authorizing preflight is rejected`, () => denied(provider, { authorizingPreflight: true }));
      await test(`${provider} rejected reserve blocks provider`, () => denied(provider, { reserveDenied: true }));
      await test(`${provider} malformed reserve blocks provider and keeps hold`, () => denied(provider, { badReserve: true }, f => assert.equal(f.held, true)));
      for (const field of ['source_sha', 'gateway_source_sha', 'repository', 'tenant_sha256', 'worker_id', 'credential_sha256', 'semantic_headers_sha256', 'source_input_sha256', 'semantic_input_sha256', 'request_sha256', 'content_type', 'endpoint', 'asset', 'request_size']) await test(`${provider} protected ${field} drift blocks paid POST`, () => denied(provider, { mutateEnvelope: job => { job.executor[field] = 'foreign'; } }));
      await test(`${provider} raw owner input mutation after preflight blocks reserve`, () => denied(provider, { afterPreflight: ({ job }) => { job.ownerUid = 'foreign-owner'; } }, f => assert.deepEqual(f.events.map(e => e.action), ['preflight'])));
      await test(`${provider} raw payload mutation after reserve keeps hold without POST`, () => denied(provider, { afterReserve: ({ job }) => { job.payload.text = 'foreign text'; } }, f => { assert.equal(f.held, true); assert.equal(f.recorded, true); assert.equal(f.events.at(-1).fields.status, 'failed'); }));
      await test(`${provider} provider response loss records uncertainty and prevents duplicate`, async () => { const f = fixture(provider, { providerLost: true }); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 0); assert.equal(f.events.at(-1).fields.status, 'failed'); assert.equal(f.held, true); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
      await test(`${provider} deadline aborts actual POST and retains hold`, async () => { const f = fixture(provider, { providerTimeout: true, runtime: 1 }); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.submitted[0].init.signal.aborted, true); assert.equal(f.events.at(-1).fields.status, 'failed'); assert.equal(f.held, true); });
      await test(`${provider} bad audio records failed outcome without Storage`, async () => { const f = fixture(provider, { invalidAudio: true }); await assert.rejects(f.execute()); assert.equal(f.stored.length, 0); assert.equal(f.events.at(-1).fields.status, 'failed'); assert.equal(f.held, true); });
      await test(`${provider} Storage failure cannot reconcile charges`, async () => { const f = fixture(provider, { storageFails: true }); await assert.rejects(f.execute()); assert.equal(f.events.at(-1).fields.status, 'failed'); assert.equal(f.held, true); });
      await test(`${provider} observation outage withholds successful response and retains hold`, async () => { const f = fixture(provider, { recordUnavailable: true }); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
    }
    for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
      const label = extension + ' ' + provider;
      await test(label + ' missing signed gateway controls blocks provider', () => denied(provider, { missingControls: true }, f => assert.equal(f.held, false), extension));
      for (const field of ['semantic_input_sha256', 'source_input_sha256', 'semantic_headers_sha256', 'credential_sha256', 'content_type']) {
        await test(label + ' controls ' + field + ' drift blocks provider', () => denied(provider, { mutateControls: controls => { controls[field] = 'foreign'; } }, f => assert.equal(f.held, false), extension));
      }
      await test(label + ' signed deployment semantic input drift blocks provider', () => denied(provider, { mutateControls: controls => { controls.binding.semantic_input_sha256 = 'f'.repeat(64); } }, f => assert.equal(f.held, false), extension));
      await test(label + ' control deadline during reservation cannot dispatch', () => denied(provider, { mutateControls: (controls, clock) => { controls.expires_at = new Date(clock.now + 500).toISOString(); }, afterReserve: ({ clock }) => { clock.now += 600; } }, f => assert.equal(f.held, true), extension));
      for (const field of ['account_id', 'credential_sha256', 'semantic_headers_sha256', 'source_input_sha256', 'semantic_input_sha256', 'content_type']) {
        await test(label + ' reservation ' + field + ' drift retains hold without provider', () => denied(provider, { mutateReserve: reserve => { reserve[field] = 'foreign'; } }, f => assert.equal(f.held, true), extension));
      }
      await test(label + ' missing reserved semantic identity cannot dispatch', () => denied(provider, { mutateReserve: reserve => { delete reserve.semantic_input_sha256; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' Git-less runtime without exact sealed source proof blocks paid execution', () => denied(provider, { gitUnavailable: true }, f => assert.equal(f.events.length, 0), extension));
      await test(label + ' missing protected issuer origin sends no worker secret', () => denied(provider, { env: { ASSET_FORGE_SPEND_GATEWAY_ORIGIN: '' } }, f => assert.equal(f.events.length, 0), extension));
      await test(label + ' inconsistent issuer origin sends no worker secret', () => denied(provider, { env: { ASSET_FORGE_SPEND_GATEWAY_ORIGIN: 'https://foreign.example' } }, f => assert.equal(f.events.length, 0), extension));
      await test(label + ' stale server reservation cannot authorize a new POST', () => denied(provider, { reservedAt: Date.now() - 1000 }, f => assert.equal(f.held, true), extension));
      await test(label + ' empty absolute reservation interval keeps canonical hold', () => { const at = Date.now(); return denied(provider, { reservedAt: at, reserveExpiry: at }, f => assert.equal(f.held, true), extension); });
      await test(label + ' price expiration during reservation cannot authorize', () => denied(provider, { mutatePricing: (price, clock) => { price.expires_at = new Date(clock.now + 500).toISOString(); }, afterReserve: ({ clock }) => { clock.now += 600; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' signed rate expiration after provider keeps hold without Storage', async () => { const f = fixture(provider, { mutateEnvelope: (job, _fields, clock) => { job.budget.rates.expires_at = new Date(clock.now + 500).toISOString(); }, afterProvider: ({ clock }) => { clock.now += 600; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 0); assert.equal(f.held, true); });
      await test(label + ' issuer origin drift after reservation retains hold without POST', () => denied(provider, { afterReserve: ({ env }) => { env.ASSET_FORGE_SPEND_GATEWAY_ORIGIN = 'https://foreign.example'; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' corrected output input cannot return stale success', async () => { const f = fixture(provider, { afterStorage: ({ job }) => { job.payload.text = 'corrected input'; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); assert.equal(f.events.at(-1).fields.status, 'failed'); });
      await test(label + ' issuer URL prevents environment gateway substitution before transmitting secret', () => denied(provider, { env: { ASSET_FORGE_SPEND_GATEWAY_URL: 'https://substituted.example/api/worker/production-spend' } }, f => assert.equal(f.events.length, 0), extension));
      await test(label + ' absent issuer URL cannot use configured gateway', async () => { const f = fixture(provider, {}, extension), mappings = JSON.parse(f.env.URAI_NARRATOR_SPEND_BINDINGS_JSON); for (const entry of Object.values(mappings)) delete entry.gateway_url; f.env.URAI_NARRATOR_SPEND_BINDINGS_JSON = JSON.stringify(mappings); await assert.rejects(f.execute()); assert.equal(f.events.length, 0); assert.equal(f.submitted.length, 0); });
      await test(label + ' missing verified preflight expiry blocks reservation', () => denied(provider, { missingPreflightExpiry: true }, f => assert.equal(f.held, false), extension));
      await test(label + ' expired verified preflight blocks reservation', () => denied(provider, { preflightExpiry: Date.now() - 1000 }, f => assert.equal(f.held, false), extension));
      await test(label + ' missing absolute reservation time retains hold without POST', () => denied(provider, { missingReserveTimes: true }, f => assert.equal(f.held, true), extension));
      await test(label + ' delayed reservation reply cannot restart approved runtime', () => denied(provider, { runtime: 1, afterReserve: ({ clock }) => { clock.now += 2000; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' reservation cannot extend verified preflight expiry', () => { const now = Date.now(); return denied(provider, { preflightExpiry: now + 5000, reserveExpiry: now + 6000 }, f => assert.equal(f.held, true), extension); });
      await test(label + ' reservation cannot extend reserved runtime', () => denied(provider, { runtime: 1, reserveExpiry: Date.now() + 120000 }, f => assert.equal(f.held, true), extension));
      await test(label + ' future reserved timestamp cannot authorize', () => denied(provider, { reservedAt: Date.now() + 120000 }, f => assert.equal(f.held, true), extension));
      await test(label + ' gateway URL drift after reservation keeps hold without dispatch', () => denied(provider, { afterReserve: ({ env }) => { env.ASSET_FORGE_SPEND_GATEWAY_URL = 'https://substituted.example/api/worker/production-spend'; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' expiry after provider await withholds audio and retains hold', async () => { const f = fixture(provider, { runtime: 1, afterProvider: ({ clock }) => { clock.now += 2000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 0); assert.equal(f.events.at(-1).fields.status, 'failed'); assert.equal(f.held, true); });
      await test(label + ' expiry during output persistence withholds successful response', async () => { const f = fixture(provider, { runtime: 1, afterStorage: ({ clock }) => { clock.now += 2000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 1); assert.equal(f.held, true); assert.equal(f.events.at(-1).fields.status, 'failed'); });
      await test(label + ' monotonic expiry during reserve blocks new paid POST despite stalled wall clock', () => denied(provider, { runtime: 1, afterReserve: ({ clock }) => { clock.monotonic += 2000; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' backwards wall clock during reserve keeps hold without dispatch', () => denied(provider, { afterReserve: ({ clock }) => { clock.now -= 1000; } }, f => assert.equal(f.held, true), extension));
      await test(label + ' monotonic expiry after provider withholds audio despite stalled wall clock', async () => { const f = fixture(provider, { runtime: 1, afterProvider: ({ clock }) => { clock.monotonic += 2000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.stored.length, 0); assert.equal(f.held, true); });
      await test(label + ' backwards clock during output persistence withholds stale success', async () => { const f = fixture(provider, { afterStorage: ({ clock }) => { clock.now -= 1000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); assert.equal(f.events.at(-1).fields.status, 'failed'); });
      await test(label + ' monotonic expiry during record withholds stale success', async () => { const f = fixture(provider, { runtime: 1, afterRecord: ({ clock }) => { clock.monotonic += 2000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
      await test(label + ' expiry during record await withholds successful response', async () => { const f = fixture(provider, { runtime: 1, afterRecord: ({ clock }) => { clock.now += 2000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
      await test(label + ' source input drift during record await withholds response', async () => { const f = fixture(provider, { afterRecord: ({ job }) => { job.leaseToken = 'changed-lease'; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
    }
    for (const extension of ['ts', 'js']) {
      const helper = fixture('google', {}, extension).helper;
      await test(extension + ' semantic identity ignores JSON key order and transport whitespace', async () => {
        const a = '{"z":[{"b":2,"a":"é"},true,null],"a":1.25}', b = '{ "a":1.25, "z":[{"a":"é","b":2},true,null] }';
        assert.equal(helper.narratorSemanticInputDigest(a, 'application/json'), helper.narratorSemanticInputDigest(b, 'Application/JSON; charset=utf-8'));
        assert.notEqual(requestDigest('https://synthetic.example/voice', a), requestDigest('https://synthetic.example/voice', b));
        assert.notEqual(helper.narratorSemanticInputDigest(a, 'application/json'), helper.narratorSemanticInputDigest('{"z":[null,true,{"b":2,"a":"é"}],"a":1.25}', 'application/json'));
      });
      for (const [body, contentType] of [['{', 'application/json'], ['{"value":1e999}', 'application/json'], ['{}', 'text/plain']]) {
        await test(extension + ' invalid semantic input fails closed ' + body, async () => { assert.throws(() => helper.narratorSemanticInputDigest(body, contentType)); });
      }
    }
    for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
      const label = extension + ' ' + provider;
      await test(label + ' semantic JSON excludes renamed source jobs and leases', async () => {
        const first = fixture(provider, {}, extension);
        const renamed = fixture(provider, { job: { jobId: 'renamed-synthetic-job', leaseToken: 'renamed-synthetic-lease' } }, extension);
        await first.execute(); await renamed.execute();
        const a = first.events[0].fields, b = renamed.events[0].fields;
        assert.notEqual(a.source_input_sha256, b.source_input_sha256);
        assert.equal(a.semantic_input_sha256, hash(stable(JSON.parse(first.body))));
        assert.equal(a.semantic_input_sha256, b.semantic_input_sha256);
        assert.equal(a.semantic_input_sha256, first.events.find(e => e.action === 'reserve').fields.semantic_input_sha256);
        assert.equal(a.semantic_input_sha256, first.events.find(e => e.action === 'record').fields.semantic_input_sha256);
      });
      await test(label + ' equivalent JSON key order and whitespace have one semantic identity', async () => {
        const f = fixture(provider, {}, extension);
        assert.equal(f.helper.narratorSemanticInputDigest('{"z":"é","a":[2,{"d":false,"b":1.5}]}'),
          f.helper.narratorSemanticInputDigest('{ "a" : [2, { "b": 1.5, "d": false }], "z" : "é" }'));
        assert.notEqual(f.helper.narratorSemanticInputDigest('{"a":[1,2]}'), f.helper.narratorSemanticInputDigest('{"a":[2,1]}'));
      });
      await test(label + ' missing protected semantic executor binding blocks paid POST',
        () => denied(provider, { mutateEnvelope: job => { delete job.executor.semantic_input_sha256; } }, undefined, extension));
      await test(label + ' missing protected semantic pricing blocks paid POST',
        () => denied(provider, { mutatePricing: price => { delete price.semantic_input_sha256; } }, undefined, extension));
      await test(label + ' changed provider semantic payload changes identity', async () => {
        const f = fixture(provider, {}, extension);
        assert.notEqual(f.helper.narratorSemanticInputDigest('{"text":"original"}'), f.helper.narratorSemanticInputDigest('{"text":"corrected"}'));
        assert.throws(() => f.helper.narratorSemanticInputDigest('{"broken":'), /semantic JSON/);
        assert.throws(() => f.helper.narratorSemanticInputDigest('{"numeric":1e400}'), /semantic JSON/);
      });
    }
    for (const field of ['token', 'principal', 'quota', 'expiresAt']) await test(`Google actual ADC ${field} drift after reserve blocks provider`, () => denied('google', { afterReserve: ({ adc }) => { adc[field] = field === 'expiresAt' ? adc[field] + 1 : 'foreign'; } }, f => { assert.equal(f.held, true); assert.equal(f.recorded, true); }));
    for (const [field, value] of [['token', ''], ['principal', ''], ['quota', ''], ['expiresAt', 0]]) await test(`Google missing authentic ADC ${field} blocks provider`, () => denied('google', { adc: { [field]: value } }));
    await test('Google token expires inside approved lifetime blocks reservation', () => denied('google', { adc: { expiresAt: Date.now() + 2000 } }, f => assert.equal(f.held, false)));
    await test('Google configured mapping cannot relabel actual ADC billing identity', () => denied('google', { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: JSON.stringify({ [requestDigest('https://texttospeech.googleapis.com/v1/text:synthesize', JSON.stringify({ input: { text: 'Synthetic é voice' }, voice: { languageCode: 'en-GB', name: 'en-GB-Standard-A' }, audioConfig: { audioEncoding: 'OGG_OPUS' } }))]: { job_id: 'synthetic-protected-job', worker_id: 'synthetic-google-worker', account_id: 'foreign-account', token: 'synthetic-distinct-worker-token-1234567890', gateway_url: gatewayUrl } }) } }));
    await test('ElevenLabs consent/voice authority remains mandatory before spending', () => denied('elevenlabs', { job: { providerAuthorization: undefined } }));
    await test('ElevenLabs credential rotation after reserve keeps hold without POST', () => denied('elevenlabs', { afterReserve: ({ env }) => { env.ELEVENLABS_API_KEY = 'rotated-key'; } }, f => { assert.equal(f.held, true); assert.equal(f.recorded, true); }));
    await test('ElevenLabs model change during preflight blocks reservation', () => denied('elevenlabs', { afterPreflight: ({ env }) => { env.ELEVENLABS_MODEL_ID = 'foreign-model'; } }));
    await test('ElevenLabs voice allowlist revocation after reserve blocks provider', () => denied('elevenlabs', { afterReserve: ({ env }) => { env.ELEVENLABS_ALLOWED_VOICE_IDS = ''; } }, f => assert.equal(f.held, true)));
    await test('actual unclean protected source cannot dispatch paid leaf', async () => { const target = path.join(root, sourcePaths[0]); const original = fs.readFileSync(target); try { fs.appendFileSync(target, '\n// synthetic dirty source\n'); await denied('google'); } finally { fs.writeFileSync(target, original); } });
    await test('declared SHA cannot substitute for actual clean source', () => denied('google', { env: { URAI_SOURCE_SHA: 'a'.repeat(40) } }));
    for (const rel of ['workers/narrator-worker/src/protected-spend', 'workers/narrator-worker/src/handlers/narrator-tts']) await test(`${rel} tracked JS AST matches actual TS compilation`, async () => { const compiled = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, `${rel}.ts`), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText; const tree = code => { const file = ts.createSourceFile('actual.js', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS); assert.equal(file.parseDiagnostics.length, 0); const shape = node => { const children = []; ts.forEachChild(node, child => { children.push(shape(child)); }); return [node.kind, typeof node.text === 'string' ? node.text : null, children]; }; return shape(file); }; assert.deepEqual(tree(fs.readFileSync(path.join(sourceRoot, `${rel}.js`), 'utf8')), tree(compiled)); assert.equal(fs.readFileSync(path.join(sourceRoot, `${rel}.js`), 'utf8'), compiled, 'tracked JS must match compiler bytes'); });
  }
  if (!args.includes('--lifecycle-baseline') && !args.includes('--lifecycle-only') && !args.includes('--reproduce') && !args.includes('--owner-fence-baseline') && !args.includes('--owner-fence-only') && !args.includes('--malformed-fence-baseline') && !args.includes('--malformed-fence-only')) { await lifecycleProof(); await ownerFenceProof(); await malformedOwnerFenceProof(); }
  console.log(`Actual narrator paid-leaf synthetic regressions: ${count} passed; provider network calls: 0; spending: 0.`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }

