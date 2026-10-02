import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync('workers/captured-reality-worker/index.js','utf8');
for(const marker of [
  "memory.private-source.reconstruct-place",
  "PRIVATE_SOURCE_AUTHORITY_URL",
  "requestedPurpose:'reconstruct-place'",
  "CAPTURED_REALITY_ENGINE_URL",
  "CAPTURED_REALITY_ENGINE_TOKEN",
  "sourceHandles",
  "execution.asyncCallbackPending",
  "callbackTokenHash",
  "callbackLeaseToken",
  "callbackDeadlineAt",
  "sourceVsReconstructionReceiptRef",
  "private source authorization denied or invalid",
  "captured-reality.dispatch.ambiguous",
  "callback authority remains active",
  "execution.asyncCallbackPending':false",
  "location.context",
  "memory.storage",
  "jobConsentBlocks",
  "function consentBlockId(ownerUid,purpose)",
  "CAPTURED_REALITY_WORKER_PUBLIC_URL must use HTTPS outside local/test",
  "captured reality callback origin must use HTTPS outside local/test",
]) assert.ok(worker.includes(marker), marker);
assert.ok(!worker.includes('rawMediaUrl'));
assert.ok(!worker.includes('sourceMediaUrl'));
assert.ok(worker.includes('PRIVATE_HANDLE'));
assert.ok(worker.includes('CAPTURED_PAYLOAD_KEYS'));
assert.ok(worker.includes('unsupported captured reality payload field'));
assert.ok(worker.includes("require('express-rate-limit')"));
assert.ok(worker.includes('const callbackRateLimit = rateLimit'));
assert.ok(worker.includes('const executeRateLimit = rateLimit'));
assert.ok(worker.includes("app.post('/engine-callback',callbackRateLimit"));
assert.ok(worker.includes("app.post('/execute-job',requireWorkerAuth,executeRateLimit"));
assert.ok(worker.includes('CAPTURED_REALITY_EXECUTE_RATE_LIMIT_PER_MINUTE'));
assert.ok(worker.includes("execute rate limit exceeded"));
assert.ok(worker.includes("app.post('/execute-job',requireWorkerAuth,executeRateLimit"));
assert.ok(worker.includes('CAPTURED_REALITY_EXECUTE_RATE_LIMIT_PER_MINUTE'));
assert.ok(worker.includes("execute rate limit exceeded"));
assert.ok(worker.includes("status:'CANCELLED'"));
assert.ok(worker.includes('boundedResult'));
assert.ok(!worker.includes('providerSpendAuthorized:true'));
assert.ok(!worker.includes('publicReleaseAuthorized:true'));
assert.ok(worker.indexOf('const sourceHandles=await authorizeSources(job)') < worker.indexOf("'execution.asyncCallbackPending':true"));
assert.match(worker,/reconstruction engine rejected dispatch status/);
assert.match(worker,/status\('SUCCESS'\)|status:'SUCCESS'/);
assert.match(worker,/status:'FAILED'/);
console.log('[PASS] captured reality worker adapter contract');


const deploy=fs.readFileSync('scripts/deploy-workers.sh','utf8');
const rootPackage=JSON.parse(fs.readFileSync('package.json','utf8'));
const capturedWorkerPackage=JSON.parse(fs.readFileSync('workers/captured-reality-worker/package.json','utf8'));
const prodEnv=fs.readFileSync('ops/production.env.example','utf8');

for(const marker of [
  'narrator-worker|asset-worker|studio-worker|captured-reality-worker',
  'PRIVATE_SOURCE_AUTHORITY_TOKEN_SECRET',
  'CAPTURED_REALITY_ENGINE_TOKEN_SECRET',
  'PRIVATE_SOURCE_AUTHORITY_URL',
  'CAPTURED_REALITY_ENGINE_URL',
  'PRIVATE_SOURCE_AUTHORITY_TOKEN=',
  'CAPTURED_REALITY_ENGINE_TOKEN=',
]) assert.ok(deploy.includes(marker), `deploy marker: ${marker}`);

assert.ok(!/URAI_JOBS_DEPLOY_WORKERS:-[^\n]*captured-reality-worker/.test(deploy), 'Captured Reality must not enter the default production worker set');
assert.equal(capturedWorkerPackage.dependencies['express-rate-limit'], '^8.7.0');
assert.ok(rootPackage.scripts['urai-jobs:verify'].includes('captured-reality-worker-contract.mjs'));
assert.ok(rootPackage.scripts.build.includes('captured-reality-worker:build'));
assert.ok(rootPackage.scripts.typecheck.includes('captured-reality-worker:typecheck'));
for(const marker of ['PRIVATE_SOURCE_AUTHORITY_URL=','PRIVATE_SOURCE_AUTHORITY_TOKEN=','CAPTURED_REALITY_ENGINE_URL=','CAPTURED_REALITY_ENGINE_TOKEN=']) {
  assert.ok(prodEnv.includes(marker), `production env marker: ${marker}`);
}
assert.ok(!worker.includes('revokedConsentPurpose('), 'undefined duplicate consent helper must not exist');
console.log('[PASS] captured reality opt-in deployment contract');
