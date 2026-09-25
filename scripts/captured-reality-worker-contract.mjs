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
]) assert.ok(worker.includes(marker), marker);
assert.ok(!worker.includes('rawMediaUrl'));
assert.ok(!worker.includes('drive.google.com'));
assert.ok(!worker.includes('providerSpendAuthorized:true'));
assert.ok(!worker.includes('publicReleaseAuthorized:true'));
assert.ok(worker.indexOf('const sourceHandles=await authorizeSources(job)') < worker.indexOf("'execution.asyncCallbackPending':true"));
assert.match(worker,/reconstruction engine rejected dispatch status/);
assert.match(worker,/status\('SUCCESS'\)|status:'SUCCESS'/);
assert.match(worker,/status:'FAILED'/);
console.log('[PASS] captured reality worker adapter contract');
