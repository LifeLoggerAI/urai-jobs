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
const canonical = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${canonical(k)}:${canonical(value[k])}`).join(',')}}`;
};
const requestDigest = (endpoint, body) => hash(Buffer.concat([Buffer.from(`POST\n${endpoint}\n`), Buffer.from(body)]));
const gatewayUrl = 'https://synthetic-gateway.example/api/worker/production-spend';
const gatewaySha = 'b'.repeat(40);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-narrator-leaf-'));
function git(...args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
for (const rel of sourcePaths) { const file = path.join(sourceRoot, rel); if (fs.existsSync(file)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.copyFileSync(file, path.join(root, rel)); } }
git('init', '--quiet'); git('add', '.'); git('-c', 'user.name=UrAi Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'Synthetic actual-leaf fixture');
const sourceSha = git('rev-parse', 'HEAD');

function fixture(provider, options = {}, extension = 'ts') {
  const clock = { now: Date.now() }, events = [], submitted = [], stored = [];
  const adc = { token: 'synthetic-oauth-token', principal: 'synthetic@synthetic-project.iam.gserviceaccount.com', quota: 'synthetic-billing-project', expiresAt: clock.now + 3_600_000 };
  Object.assign(adc, options.adc);
  const job = { jobId: 'synthetic-narrator-job', jobType: 'narrator.tts', type: 'narrator.tts', ownerUid: 'synthetic-owner', tenantId: 'synthetic-tenant', leaseToken: 'synthetic-lease', consent: { purpose: 'synthetic.voice', policyVersion: 'synthetic-policy', decisionReceiptId: 'synthetic-consent' }, payload: { provider, text: 'Synthetic é voice', locale: 'en-GB', voice: 'en-GB-Standard-A', voiceId: 'synthetic-voice', format: 'OGG_OPUS' } };
  if (provider === 'elevenlabs') job.providerAuthorization = { provider, ownerUid: job.ownerUid, consentReceiptId: 'synthetic-consent', rightsReceiptId: 'synthetic-rights', provenanceRef: 'synthetic-provenance', voiceId: job.payload.voiceId };
  Object.assign(job, options.job);
  const endpoint = provider === 'google' ? 'https://texttospeech.googleapis.com/v1/text:synthesize' : 'https://api.elevenlabs.io/v1/text-to-speech/synthetic-voice?output_format=mp3_44100_128';
  const body = provider === 'google' ? JSON.stringify({ input: { text: job.payload.text }, voice: { languageCode: job.payload.locale || 'en-US', name: job.payload.voice || job.payload.voiceId }, audioConfig: { audioEncoding: 'OGG_OPUS' } }) : JSON.stringify({ text: job.payload.text, model_id: 'eleven_multilingual_v2' });
  const accountId = provider === 'google' ? `google:${adc.quota}:${adc.principal}` : 'synthetic-elevenlabs-account';
  const mapping = { [requestDigest(endpoint, body)]: { job_id: 'synthetic-protected-job', worker_id: `synthetic-${provider}-worker`, account_id: accountId, token: 'synthetic-distinct-worker-token-1234567890', gateway_url: gatewayUrl } };
  const env = { GCS_BUCKET_NAME: 'synthetic-bucket', URAI_SOURCE_SHA: sourceSha, ASSET_FORGE_SPEND_GATEWAY_SOURCE_SHA: gatewaySha, ASSET_FORGE_SPEND_GATEWAY_URL: gatewayUrl, URAI_NARRATOR_SPEND_BINDINGS_JSON: JSON.stringify(mapping), URAI_NARRATOR_ELEVENLABS_ENABLED: 'true', ELEVENLABS_API_KEY: 'synthetic-elevenlabs-key', ELEVENLABS_ALLOWED_VOICE_IDS: 'synthetic-voice' };
  Object.assign(env, options.env);
  let protectedJob, held = false, recorded = false, verifiedPreflightExpiry;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  function protectedEnvelope(fields) {
    const executor = { binding_version: 2, worker_id: fields.worker_id, repository: fields.executor_repository, source_sha: fields.executor_source_sha, gateway_repository: fields.gateway_repository, gateway_source_sha: fields.gateway_source_sha, tenant_sha256: fields.tenant_sha256, credential_sha256: fields.credential_sha256, source_input_sha256: fields.source_input_sha256, semantic_headers_sha256: fields.semantic_headers_sha256, content_type: fields.content_type, request_sha256: fields.request_sha256, endpoint: fields.endpoint, asset: fields.asset, request_size: fields.request_size, deployment_ref: 'c'.repeat(64), controls_ref: 'd'.repeat(64) };
    const rates = { usd_micros_per_unit: 1, credits_per_unit: 0, receipt: 'synthetic-price-rate', verified_at: new Date(clock.now - 1000).toISOString(), expires_at: new Date(clock.now + 3_600_000).toISOString() };
    protectedJob = { schema_version: 1, job_id: fields.job_id, provider: fields.provider, account_id: fields.account_id, model_version: fields.model, consumer: fields.consumer, rights_reviewed: true, authority: { repository: fields.executor_repository, sha: fields.executor_source_sha }, executor, input_sha256: [fields.source_input_sha256, fields.request_sha256], budget: { max_runtime_seconds: options.runtime || 45, rates }, attempts: [] };
    options.mutateEnvelope?.(protectedJob, fields);
    const price = { provider: fields.provider, account_id: fields.account_id, model_version: fields.model, request_sha256: fields.request_sha256, credential_sha256: fields.credential_sha256, semantic_headers_sha256: fields.semantic_headers_sha256, source_input_sha256: fields.source_input_sha256, content_type: fields.content_type, trusted_readback: true, receipt: 'synthetic-protected-price', observed_at: new Date(clock.now - 1000).toISOString(), expires_at: new Date(clock.now + 3_600_000).toISOString(), rates: structuredClone(rates) };
    options.mutatePricing?.(price, clock);
    verifiedPreflightExpiry = options.preflightExpiry === undefined ? clock.now + 3_600_000 : options.preflightExpiry;
    return { ok: true, ...(options.missingPreflightExpiry ? {} : { admission_expires_at: new Date(verifiedPreflightExpiry).toISOString() }), envelope: { job: protectedJob, ...(options.missingPricing ? {} : { protected_pricing: price }) }, provider_call_authorized: false, execution_performed: false };
  }
  const fetch = async (url, init) => {
    if (String(url).startsWith('https://synthetic-gateway.example')) {
      const fields = JSON.parse(init.body); events.push({ action: fields.action, fields });
      assert.equal(String(url), gatewayUrl); assert.equal(init.redirect, 'error');
      assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${mapping[requestDigest(endpoint, body)].token}`);
      if (fields.action === 'preflight') {
        if (options.gatewayUnavailable) throw new Error('synthetic gateway unavailable');
        if (options.preflightDenied) return json({ ok: false }, 409);
        const result = protectedEnvelope(fields); options.afterPreflight?.({ env, job, adc, clock });
        return json(options.authorizingPreflight ? { ...result, provider_call_authorized: true } : result);
      }
      if (fields.action === 'reserve') {
        if (held || options.reserveDenied) return json({ ok: false }, 409);
        held = true;
        if (options.reserveLost) throw new Error('synthetic reserve response lost after hold');
        const digest = hash(canonical(Object.fromEntries(Object.entries(protectedJob).filter(([key]) => key !== 'approval' && key !== 'attempts'))));
        assert.equal(fields.job_digest, digest);
        const reservedAt = clock.now, admittedExpiry = Math.min(verifiedPreflightExpiry, reservedAt + (options.runtime || 45) * 1000);
        const result = { ok: true, ...(options.missingReserveTimes ? {} : { reserved_at: new Date(options.reservedAt === undefined ? reservedAt : options.reservedAt).toISOString(), admission_expires_at: new Date(options.reserveExpiry === undefined ? admittedExpiry : options.reserveExpiry).toISOString() }), attempt_id: 'synthetic-attempt', provider_call_authorized: true, execution_performed: false, job_digest: digest, executor_source_sha: sourceSha, gateway_source_sha: gatewaySha, worker_id: fields.worker_id, max_runtime_seconds: options.runtime || 45 };
        options.afterReserve?.({ env, job, adc, clock });
        return json(options.badReserve ? { ...result, worker_id: 'foreign-worker' } : result);
      }
      if (fields.action === 'record') {
        assert.equal(held, true); assert.equal(fields.attempt_id, 'synthetic-attempt');
        assert.ok(['succeeded', 'failed'].includes(fields.status));
        assert.equal(fields.credential_sha256, events[0].fields.credential_sha256);
        recorded = true;
        options.afterRecord?.({ env, job, adc, clock });
        if (options.recordUnavailable) throw new Error('synthetic observation unavailable');
        return json({ ok: true, provider_call_authorized: false, execution_performed: false, reconciliation_required: true });
      }
      throw new Error('Unexpected synthetic gateway operation');
    }
    assert.equal(String(url), endpoint, 'unexpected network call prohibited');
    submitted.push({ url: String(url), init });
    if (options.providerLost) throw new Error('synthetic provider response lost');
    if (options.providerTimeout) { clock.now += 2000; return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('synthetic provider timeout')), { once: true })); }
    if (options.providerDenied) return json({ error: 'synthetic failure' }, 500);
    options.afterProvider?.({ env, job, adc, clock });
    if (provider === 'google') return json({ audioContent: options.invalidAudio ? 'invalid!' : Buffer.from('synthetic-audio').toString('base64') });
    return new Response(options.invalidAudio ? Buffer.alloc(0) : Buffer.from('synthetic-audio'), { headers: { 'request-id': 'synthetic-provider-request' } });
  };
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } }
  class TextToSpeechClient {
    auth = { getClient: async () => ({ getAccessToken: async () => ({ token: adc.token }), get quotaProjectId() { return adc.quota; }, get credentials() { return { expiry_date: adc.expiresAt }; } }), getCredentials: async () => ({ client_email: adc.principal }), getProjectId: async () => adc.quota };
    async synthesizeSpeech(request) { submitted.push({ sdk: true, request }); return [{ audioContent: Buffer.from('synthetic-audio') }]; }
  }
  class Storage { bucket(bucket) { return { file: filename => ({ async save(bytes, metadata) { stored.push({ bucket, filename, bytes, metadata }); options.afterStorage?.({ env, job, adc, clock }); if (options.storageFails) throw new Error('synthetic Storage failure'); } }) }; } }
  const context = vm.createContext({ Buffer, Headers, Response, URL, AbortController, AbortSignal, setTimeout, clearTimeout, setInterval, clearInterval, Date: FakeDate, fetch, process: { env, cwd: () => root }, console: { log() {} } });
  const modules = new Map();
  function load(rel) {
    if (modules.has(rel)) return modules.get(rel).exports;
    const source = fs.readFileSync(path.join(sourceRoot, rel), 'utf8');
    const js = rel.endsWith('.ts') ? ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText : source;
    const module = { exports: {} }; modules.set(rel, module);
    const localRequire = spec => {
      if (spec === '@google-cloud/text-to-speech') return { TextToSpeechClient };
      if (spec === '@google-cloud/storage') return { Storage };
      if (spec === '../protected-spend.js') return load(`workers/narrator-worker/src/protected-spend.${extension}`);
      if (spec.startsWith('node:')) return require(spec);
      throw new Error(`Unexpected actual-leaf dependency ${spec}`);
    };
    vm.runInContext(`(function(require,module,exports){${js}\n})`, context, { filename: rel })(localRequire, module, module.exports);
    return module.exports;
  }
  const handler = load(`workers/narrator-worker/src/handlers/narrator-tts.${extension}`);
  return { job, env, adc, events, submitted, stored, endpoint, body, clock, execute: () => handler.handleNarratorTts(job), get held() { return held; }, get recorded() { return recorded; } };
}

let count = 0;
async function test(label, run) { await run(); count++; console.log(`[PASS] ${label}`); }
async function denied(provider, options, extra, extension = 'ts') { const f = fixture(provider, options, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 0); assert.equal(f.stored.length, 0); extra?.(f); }
try {
  if (args.includes('--reproduce')) {
    for (const provider of ['google', 'elevenlabs']) await test(`predecessor ${provider} invokes actual paid leaf without canonical approval`, async () => { const f = fixture(provider, { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: '{}' } }); await f.execute(); assert.equal(f.events.length, 0); assert.equal(f.submitted.length, 1); });
  } else {
    for (const extension of ['ts', 'js']) for (const provider of ['google', 'elevenlabs']) {
      const prefix = `${extension} ${provider}`;
      await test(`${prefix} missing protected mapping blocks actual provider`, () => denied(provider, { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: '{}' } }, undefined, extension));
      await test(`${prefix} configured credentials and forged caller approval grant no spend`, () => denied(provider, { env: { URAI_NARRATOR_SPEND_BINDINGS_JSON: '{}' }, job: { approval: { status: 'APPROVED' }, providerCallAuthorized: true } }, undefined, extension));
      await test(`${prefix} gateway denial blocks actual provider`, () => denied(provider, { preflightDenied: true }, undefined, extension));
      await test(`${prefix} uncertain reservation never dispatches or releases hold`, () => denied(provider, { reserveLost: true }, f => { assert.equal(f.held, true); assert.equal(f.recorded, false); }, extension));
      await test(`${prefix} exact synthetic reservation precedes one frozen POST`, async () => { const f = fixture(provider, {}, extension); const result = await f.execute(); assert.equal(f.submitted.length, 1); assert.equal(f.submitted[0].sdk, undefined); assert.equal(f.submitted[0].init.body, f.body); assert.equal(f.submitted[0].init.redirect, 'error'); assert.deepEqual(f.events.map(e => e.action), ['preflight', 'reserve', 'record']); assert.equal(f.events[2].fields.status, 'succeeded'); assert.equal(f.held, true); assert.equal(f.stored.length, 1); assert.equal(result.provider, provider); assert.equal(result.consentRef, provider === 'elevenlabs' ? 'synthetic-consent' : null); assert.equal(result.rightsRef, provider === 'elevenlabs' ? 'synthetic-rights' : null); const field = f.events[0].fields; assert.equal(field.request_size, String(Buffer.byteLength(f.body))); assert.equal(field.request_sha256, requestDigest(f.endpoint, f.body)); assert.equal(field.source_input_sha256, hash(stable(f.job))); if (provider === 'google') { const h = new Headers(f.submitted[0].init.headers); assert.equal(h.get('x-goog-user-project'), f.adc.quota); assert.equal(h.get('authorization'), `Bearer ${f.adc.token}`); assert.deepEqual(JSON.parse(f.body), { input: { text: f.job.payload.text }, voice: { languageCode: 'en-GB', name: 'en-GB-Standard-A' }, audioConfig: { audioEncoding: 'OGG_OPUS' } }); } });
    }
    for (const provider of ['google', 'elevenlabs']) {
      await test(`${provider} missing genuine protected pricing blocks paid POST`, () => denied(provider, { missingPricing: true }));
      for (const field of ['provider', 'account_id', 'model_version', 'request_sha256', 'credential_sha256', 'semantic_headers_sha256', 'source_input_sha256', 'content_type', 'receipt']) await test(`${provider} actual protected pricing ${field} drift blocks paid POST`, () => denied(provider, { mutatePricing: price => { price[field] = field === 'receipt' ? '' : 'foreign'; } }));
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
      for (const field of ['source_sha', 'gateway_source_sha', 'repository', 'tenant_sha256', 'worker_id', 'credential_sha256', 'semantic_headers_sha256', 'source_input_sha256', 'request_sha256', 'content_type', 'endpoint', 'asset', 'request_size']) await test(`${provider} protected ${field} drift blocks paid POST`, () => denied(provider, { mutateEnvelope: job => { job.executor[field] = 'foreign'; } }));
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
      await test(label + ' expiry during record await withholds successful response', async () => { const f = fixture(provider, { runtime: 1, afterRecord: ({ clock }) => { clock.now += 2000; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
      await test(label + ' source input drift during record await withholds response', async () => { const f = fixture(provider, { afterRecord: ({ job }) => { job.leaseToken = 'changed-lease'; } }, extension); await assert.rejects(f.execute()); assert.equal(f.submitted.length, 1); assert.equal(f.held, true); });
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
    for (const rel of ['workers/narrator-worker/src/protected-spend', 'workers/narrator-worker/src/handlers/narrator-tts']) await test(`${rel} tracked JS AST matches actual TS compilation`, async () => { const compiled = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, `${rel}.ts`), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText; const tree = code => { const file = ts.createSourceFile('actual.js', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS); assert.equal(file.parseDiagnostics.length, 0); const shape = node => { const children = []; ts.forEachChild(node, child => { children.push(shape(child)); }); return [node.kind, typeof node.text === 'string' ? node.text : null, children]; }; return shape(file); }; assert.deepEqual(tree(fs.readFileSync(path.join(sourceRoot, `${rel}.js`), 'utf8')), tree(compiled)); });
  }
  console.log(`Actual narrator paid-leaf synthetic regressions: ${count} passed; provider network calls: 0; spending: 0.`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
