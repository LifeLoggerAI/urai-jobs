"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NarratorSpendRejected = void 0;
exports.narratorDigest = narratorDigest;
exports.narratorSourceJson = narratorSourceJson;
exports.narratorRequestDigest = narratorRequestDigest;
exports.narratorHeaderBindings = narratorHeaderBindings;
exports.narratorExecutorSourceSha = narratorExecutorSourceSha;
exports.paidNarratorFetch = paidNarratorFetch;
exports.withProtectedNarratorSession = withProtectedNarratorSession;
/** Narrator paid leaves use the canonical Factory gateway; configuration is never approval. */
const node_async_hooks_1 = require("node:async_hooks");
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const node_net_1 = require("node:net");
const sessions = new node_async_hooks_1.AsyncLocalStorage();
const SOURCE_PATHS = ['workers/narrator-worker/src/protected-spend.ts', 'workers/narrator-worker/src/protected-spend.js', 'workers/narrator-worker/src/handlers/narrator-tts.ts', 'workers/narrator-worker/src/handlers/narrator-tts.js'];
const REPOSITORY = 'LifeLoggerAI/urai-jobs';
const GATEWAY_REPOSITORY = 'LifeLoggerAI/asset-factory';
class NarratorSpendRejected extends Error {
    code = 'narrator_spend_rejected';
}
exports.NarratorSpendRejected = NarratorSpendRejected;
function need(value, reason) { if (!value)
    throw new NarratorSpendRejected(reason); }
function record(value) { need(value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.toString.call(value) === '[object Object]', 'invalid protected record'); return value; }
function nonempty(value) { need(typeof value === 'string' && value.trim(), 'missing protected identity'); return value; }
function sha(value, length = 64) { need(typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(value), 'invalid protected digest'); return value; }
function timestamp(value) {
    need(typeof value === 'string', 'protected timestamp required');
    const parts = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
    need(parts, 'complete protected ISO timestamp required');
    const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number), calendar = new Date(Date.UTC(year, month - 1, day));
    need(calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day && hour < 24 && minute < 60 && second < 60, 'invalid protected calendar timestamp');
    const parsed = Date.parse(value);
    need(Number.isFinite(parsed), 'invalid protected timestamp');
    return parsed;
}
function fresh(value, observed) { need(timestamp(value[observed]) <= Date.now() && Date.now() < timestamp(value.expires_at), 'protected narrator pricing is stale or future'); }
function narratorDigest(value) { return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex'); }
function narratorSourceJson(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string')
        return JSON.stringify(value);
    if (typeof value === 'number') {
        need(Number.isFinite(value), 'nonfinite source input');
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map(narratorSourceJson).join(',')}]`;
    const object = record(value);
    return `{${Object.keys(object).filter(k => object[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${narratorSourceJson(object[k])}`).join(',')}}`;
}
function canonical(value) {
    if (value === null)
        return 'null';
    if (typeof value === 'string')
        return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
    if (typeof value === 'boolean')
        return String(value);
    if (typeof value === 'number') {
        need(Number.isSafeInteger(value), 'unsafe protected number');
        return String(value);
    }
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    const object = record(value), keys = Object.keys(object).sort();
    need(keys.every(k => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)), 'ambiguous protected key');
    return `{${keys.map(k => `${canonical(k)}:${canonical(object[k])}`).join(',')}}`;
}
function narratorRequestDigest(endpoint, body) { return narratorDigest(Buffer.concat([Buffer.from(`POST\n${endpoint}\n`), Buffer.from(body, 'utf8')])); }
function narratorHeaderBindings(headers) {
    const entries = [...new Headers(headers).entries()].sort(([a], [b]) => a.localeCompare(b));
    const credentialNames = new Set(['authorization', 'xi-api-key', 'x-api-key']);
    const credentials = Object.fromEntries(entries.filter(([key]) => credentialNames.has(key)));
    need(Object.keys(credentials).length > 0, 'provider credential unavailable');
    return { credential_sha256: narratorDigest(narratorSourceJson(credentials)), semantic_headers_sha256: narratorDigest(narratorSourceJson(Object.fromEntries(entries.filter(([key]) => !credentialNames.has(key))))) };
}
function httpsEndpoint(value, gateway = false) {
    let url;
    try {
        url = new URL(nonempty(value));
    }
    catch {
        throw new NarratorSpendRejected('invalid protected endpoint');
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    need(url.protocol === 'https:' && !url.username && !url.password && !url.hash && !(0, node_net_1.isIP)(host) && host.includes('.') && !/(^|\.)(localhost|local|internal)$/.test(host), 'public protected HTTPS endpoint required');
    if (gateway)
        need(url.pathname === '/api/worker/production-spend' && !url.search, 'canonical gateway route required');
    need(url.toString() === value, 'canonical endpoint required');
    return url.toString();
}
function narratorExecutorSourceSha() {
    const expected = sha(process.env.URAI_SOURCE_SHA, 40);
    try {
        const options = { encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'pipe'] };
        const root = (0, node_child_process_1.execFileSync)('git', ['-C', process.cwd(), 'rev-parse', '--show-toplevel'], options).trim();
        const git = (...args) => (0, node_child_process_1.execFileSync)('git', ['-C', root, ...args], options).trim();
        need(git('rev-parse', 'HEAD') === expected, 'narrator build differs from declared source');
        const tracked = git('ls-files', '--error-unmatch', '--', ...SOURCE_PATHS).split('\n');
        need(tracked.length === SOURCE_PATHS.length && SOURCE_PATHS.every(p => tracked.includes(p)), 'narrator protected source untracked');
        need(!git('status', '--porcelain', '--untracked-files=all', '--', ...SOURCE_PATHS), 'narrator protected source dirty');
    }
    catch (error) {
        if (error instanceof NarratorSpendRejected)
            throw error;
        throw new NarratorSpendRejected('actual clean narrator source unavailable');
    }
    return expected;
}
function current(session) {
    need(!session.controller.signal.aborted && (!session.deadline || Date.now() < session.deadline), 'narrator deadline expired; reconcile before retry');
    need(narratorDigest(narratorSourceJson(session.job)) === session.inputDigest, 'narrator source input changed');
}
async function boundedJson(response) {
    need(response.ok && response.body, 'protected gateway rejected request');
    const reader = response.body.getReader(), chunks = [];
    let count = 0;
    try {
        while (true) {
            const next = await reader.read();
            if (next.done)
                break;
            count += next.value.byteLength;
            if (count > 65_536) {
                await reader.cancel();
                throw new NarratorSpendRejected('oversized gateway response');
            }
            chunks.push(next.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    try {
        const value = record(JSON.parse(Buffer.concat(chunks, count).toString('utf8')));
        need(value.ok === true, 'gateway did not admit request');
        return value;
    }
    catch (error) {
        if (error instanceof NarratorSpendRejected)
            throw error;
        throw new NarratorSpendRejected('invalid gateway response');
    }
}
async function gateway(action, fields, token) {
    const endpoint = httpsEndpoint(process.env.ASSET_FORGE_SPEND_GATEWAY_URL, true);
    need(token.length >= 32, 'protected worker credential unavailable');
    try {
        return await boundedJson(await fetch(endpoint, { method: 'POST', redirect: 'error', cache: 'no-store', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }), signal: AbortSignal.timeout(15_000) }));
    }
    catch (error) {
        if (error instanceof NarratorSpendRejected)
            throw error;
        throw new NarratorSpendRejected('gateway outcome unavailable; reconcile before retry');
    }
}
function protectedBinding(requestDigest) {
    let mapping;
    try {
        mapping = record(JSON.parse(process.env.URAI_NARRATOR_SPEND_BINDINGS_JSON || '{}'));
    }
    catch {
        throw new NarratorSpendRejected('invalid protected narrator mapping');
    }
    const entry = record(mapping[requestDigest]);
    return { jobId: nonempty(entry.job_id), workerId: nonempty(entry.worker_id), accountId: nonempty(entry.account_id), token: nonempty(entry.token) };
}
/** The actual paid POST is reached once, only after authenticated atomic reservation. */
async function paidNarratorFetch(provider, model, request) {
    const session = sessions.getStore();
    need(session, 'narrator paid request lacks source session');
    current(session);
    need(!session.submitted, 'duplicate narrator paid submission rejected');
    const endpoint = httpsEndpoint(request.endpoint), parsed = new URL(endpoint);
    need(provider === 'google' ? endpoint === 'https://texttospeech.googleapis.com/v1/text:synthesize' : parsed.origin === 'https://api.elevenlabs.io' && /^\/v1\/text-to-speech\/[^/]+$/.test(parsed.pathname), 'provider endpoint changed');
    need(typeof request.body === 'string' && Buffer.byteLength(request.body) > 0 && Buffer.byteLength(request.body) <= 1_048_576, 'exact bounded narrator bytes required');
    const body = request.body, headers = new Headers(request.headers), sourceSha = narratorExecutorSourceSha();
    const requestDigest = narratorRequestDigest(endpoint, body), config = protectedBinding(requestDigest), accountHeaders = narratorHeaderBindings(headers);
    if (provider === 'google')
        need(request.actualAccountId === config.accountId, 'protected Google account differs from actual ADC principal and quota project');
    const gatewaySource = sha(process.env.ASSET_FORGE_SPEND_GATEWAY_SOURCE_SHA, 40);
    const fields = { job_id: config.jobId, worker_id: config.workerId, executor_repository: REPOSITORY, executor_source_sha: sourceSha, gateway_repository: GATEWAY_REPOSITORY, gateway_source_sha: gatewaySource, consumer: 'jobs-narrator', tenant_sha256: narratorDigest(nonempty(session.job.tenantId)), provider, account_id: config.accountId, ...accountHeaders, source_input_sha256: session.inputDigest, content_type: nonempty(headers.get('content-type')), request_sha256: requestDigest, endpoint, model: nonempty(model), asset: `${nonempty(session.job.tenantId)}/${nonempty(session.job.jobId)}/narrator.tts`, request_size: String(Buffer.byteLength(body)) };
    const verifyCurrent = async () => { current(session); need(narratorExecutorSourceSha() === sourceSha && process.env.ASSET_FORGE_SPEND_GATEWAY_SOURCE_SHA === gatewaySource, 'narrator execution source changed'); need(narratorSourceJson(protectedBinding(requestDigest)) === narratorSourceJson(config), 'protected narrator mapping changed'); await request.assertCurrent(); current(session); };
    session.submitted = true;
    await verifyCurrent();
    const prepared = await gateway('preflight', fields, config.token);
    need(prepared.provider_call_authorized === false && prepared.execution_performed === false, 'preflight cannot authorize a provider call');
    const envelope = record(prepared.envelope), job = record(envelope.job), executor = record(job.executor), authority = record(job.authority), budget = record(job.budget);
    need(job.job_id === config.jobId && job.provider === provider && job.account_id === config.accountId && job.model_version === model && job.consumer === fields.consumer && job.rights_reviewed === true, 'protected narrator job changed');
    need(executor.binding_version === 2 && authority.repository === REPOSITORY && authority.sha === sourceSha, 'protected narrator source authority changed');
    const bound = { job_id: job.job_id, worker_id: executor.worker_id, executor_repository: executor.repository, executor_source_sha: executor.source_sha, gateway_repository: executor.gateway_repository, gateway_source_sha: executor.gateway_source_sha, consumer: job.consumer, tenant_sha256: executor.tenant_sha256, provider: job.provider, account_id: job.account_id, credential_sha256: executor.credential_sha256, source_input_sha256: executor.source_input_sha256, semantic_headers_sha256: executor.semantic_headers_sha256, content_type: executor.content_type, request_sha256: executor.request_sha256, endpoint: executor.endpoint, model: job.model_version, asset: executor.asset, request_size: executor.request_size };
    need(narratorSourceJson(bound) === narratorSourceJson(fields), 'protected narrator exact request binding changed');
    const price = record(envelope.protected_pricing), rates = record(price.rates);
    need(price.provider === provider && price.account_id === config.accountId && price.model_version === model && price.request_sha256 === requestDigest && price.trusted_readback === true, 'protected narrator pricing request changed');
    for (const key of ['credential_sha256', 'semantic_headers_sha256', 'source_input_sha256', 'content_type'])
        need(price[key] === fields[key], 'protected narrator pricing transport changed');
    nonempty(price.receipt);
    fresh(price, 'observed_at');
    fresh(rates, 'verified_at');
    need(canonical(rates) === canonical(budget.rates), 'protected narrator pricing rates changed');
    sha(executor.deployment_ref);
    sha(executor.controls_ref);
    need(Array.isArray(job.input_sha256) && job.input_sha256.includes(session.inputDigest) && job.input_sha256.includes(requestDigest), 'protected narrator input fixity missing');
    const runtime = budget.max_runtime_seconds;
    need(typeof runtime === 'number' && Number.isSafeInteger(runtime) && runtime > 0 && runtime <= 45, 'narrator runtime exceeds bounded HTTP lifetime');
    if (request.credentialExpiresAt !== undefined)
        need(Number.isFinite(request.credentialExpiresAt) && request.credentialExpiresAt > Date.now() + runtime * 1000, 'provider credential expires inside approved lifetime');
    const jobDigest = narratorDigest(canonical(Object.fromEntries(Object.entries(job).filter(([key]) => key !== 'approval' && key !== 'attempts'))));
    await verifyCurrent();
    const admitted = await gateway('reserve', { ...fields, job_digest: jobDigest }, config.token);
    need(admitted.provider_call_authorized === true && admitted.execution_performed === false && admitted.executor_source_sha === sourceSha && admitted.gateway_source_sha === gatewaySource && admitted.worker_id === config.workerId && admitted.job_digest === jobDigest && admitted.max_runtime_seconds === runtime, 'invalid authenticated narrator reservation');
    session.fields = fields;
    session.token = config.token;
    session.attemptId = nonempty(admitted.attempt_id);
    session.deadline = Date.now() + runtime * 1000;
    await verifyCurrent();
    if (request.credentialExpiresAt !== undefined)
        need(request.credentialExpiresAt > session.deadline, 'provider credential expired after reservation');
    // Freeze exact bytes/headers. Redirects and transport errors cannot trigger a second POST.
    const response = await fetch(endpoint, { method: 'POST', headers, body, redirect: 'error', cache: 'no-store', signal: session.controller.signal });
    current(session);
    const requestId = response.headers.get('request-id') || response.headers.get('x-request-id');
    if (requestId)
        session.requestId = requestId.slice(0, 256);
    return response;
}
/** One deadline spans provider response decoding and output persistence; outcomes never settle funds. */
async function withProtectedNarratorSession(jobValue, run) {
    const job = record(jobValue);
    for (const key of ['jobId', 'tenantId', 'ownerUid', 'leaseToken'])
        nonempty(job[key]);
    need((job.type || job.jobType) === 'narrator.tts', 'narrator job type required');
    need(!sessions.getStore(), 'nested narrator paid execution rejected');
    const session = { job, inputDigest: narratorDigest(narratorSourceJson(job)), submitted: false, controller: new AbortController() };
    return sessions.run(session, async () => {
        let outcome = 'failed';
        const timer = setInterval(() => { if (session.deadline && Date.now() >= session.deadline)
            session.controller.abort(); }, 25);
        const wait = (work) => new Promise((resolve, reject) => {
            const abort = () => reject(new NarratorSpendRejected('narrator execution timed out; charge reconciliation required'));
            session.controller.signal.addEventListener('abort', abort, { once: true });
            work.then(resolve, reject).finally(() => session.controller.signal.removeEventListener('abort', abort));
        });
        try {
            const result = await wait(run());
            current(session);
            outcome = 'succeeded';
            return result;
        }
        finally {
            clearInterval(timer);
            if (session.fields && session.attemptId) {
                try {
                    const observed = await gateway('record', { ...session.fields, attempt_id: session.attemptId, status: outcome, ...(session.requestId ? { request_id: session.requestId } : {}) }, session.token);
                    need(observed.provider_call_authorized === false && observed.execution_performed === false && observed.reconciliation_required === true, 'invalid narrator observation');
                }
                catch {
                    if (outcome === 'succeeded')
                        throw new NarratorSpendRejected('narrator output requires durable observation and charge reconciliation');
                }
            }
        }
    });
}
