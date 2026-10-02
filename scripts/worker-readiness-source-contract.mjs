import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [genericWorker, narratorWorker, assetWorker, studioWorker, runtimeVerifier] = await Promise.all([
  readFile(new URL('./run-worker.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../workers/narrator-worker/src/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../workers/asset-worker/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8'),
  readFile(new URL('./verify-worker-health.mjs', import.meta.url), 'utf8'),
]);

assert.match(genericWorker, /req\.url === '\/healthz'/, 'generic worker must retain a liveness route');
assert.match(genericWorker, /req\.url === '\/readyz'/, 'generic worker must expose a distinct readiness route');
assert.match(genericWorker, /firestoreReady\(\)/, 'generic readiness must probe Firestore reachability');
assert.match(genericWorker, /notShuttingDown:\s*!shuttingDown/, 'generic readiness must reject shutdown state');
assert.match(genericWorker, /loopFresh/, 'generic readiness must reject a stalled worker loop');
assert.match(genericWorker, /sourceShaExact/, 'generic readiness must bind an exact source SHA');
assert.match(genericWorker, /providerProjectPresent/, 'generic readiness must require provider project identity');
assert.doesNotMatch(genericWorker, /req\.url === '\/healthz' \|\| req\.url === '\/readyz'/, 'health and readiness must not share an unconditional success branch');

assert.match(narratorWorker, /app\.get\('\/readyz'/, 'narrator worker must expose readiness');
assert.match(narratorWorker, /K_REVISION/, 'narrator readiness must require deployed revision identity');
assert.match(narratorWorker, /sourceShaExact/, 'narrator readiness must bind exact source identity');
assert.match(narratorWorker, /capacityAvailable:\s*governor\.canAcceptJob\(\)/, 'narrator readiness must reject saturated capacity');
assert.match(narratorWorker, /result|checks|ok/, 'narrator readiness must return structured status');

assert.match(assetWorker, /app\.get\('\/readyz'/, 'asset worker must expose readiness');
assert.match(assetWorker, /configuredPublicBaseUrlIsHttps\(\)/, 'asset readiness must require an explicit HTTPS callback base');
assert.match(assetWorker, /K_REVISION/, 'asset readiness must require deployed revision identity');
assert.match(assetWorker, /\^\[0-9a-f\]\{40\}\$/, 'asset readiness must bind exact source identity');
assert.match(assetWorker, /canonicalAssetFactoryRepo:\s*assetFactoryRepo === 'LifeLoggerAI\/asset-factory'/, 'asset readiness must remain bound to canonical Asset Factory authority');
assert.match(assetWorker, /callbackUrlMode:\s*configuredPublicBaseUrl \? 'configured' : 'request-derived'/, 'asset runtime must retain callback provenance reporting');

assert.match(studioWorker, /app\.get\('\/readyz'/, 'studio worker must expose readiness');
assert.match(studioWorker, /K_REVISION/, 'studio readiness must require deployed revision identity');
assert.match(studioWorker, /sourceShaExact/, 'studio readiness must bind exact source identity');
assert.match(studioWorker, /GCS_BUCKET_NAME/, 'studio readiness must require artifact storage');
assert.match(studioWorker, /ffmpeg/, 'studio readiness must require FFmpeg');

assert.match(runtimeVerifier, /\$\{rootUrl\}\/healthz/, 'production verifier must check liveness');
assert.match(runtimeVerifier, /\$\{rootUrl\}\/readyz/, 'production verifier must check readiness');
assert.match(runtimeVerifier, /exactShaOrFail\(name, 'health'/, 'production verifier must SHA-bind health');
assert.match(runtimeVerifier, /exactShaOrFail\(name, 'readiness'/, 'production verifier must SHA-bind readiness');
assert.match(runtimeVerifier, /credential-free HTTPS/, 'production verifier must reject credential-bearing or non-HTTPS worker URLs');

console.log('worker readiness source contract verified');
