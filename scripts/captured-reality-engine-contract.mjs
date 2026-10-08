import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { packageGaussian, conservativeCollisionGlb } = require('../workers/captured-reality-worker/gaussian-package.js');
const { createResolver, firestoreReconstructionAuthority, sha } = require('../workers/captured-reality-worker/private-media-resolver.js');
const { createEngine, validateRequest, commandPlan, runtimeReadiness, computeBudget, command } = require('../workers/captured-reality-worker/reconstruction-engine.js');

function fixturePly({ value = 1, count = 2 } = {}) {
  const fields = ['x','y','z','f_dc_0','f_dc_1','f_dc_2','opacity','scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3'];
  const header = Buffer.from(`ply\nformat binary_little_endian 1.0\nelement vertex ${count}\n${fields.map((name) => `property float ${name}`).join('\n')}\nend_header\n`);
  const binary = Buffer.alloc(count * fields.length * 4);
  for (let i = 0; i < count; i++) fields.forEach((field, index) => binary.writeFloatLE(['x','y','z','rot_0'].includes(field) ? value : 0, (i * fields.length + index) * 4));
  return Buffer.concat([header, binary]);
}
const ply = fixturePly(), packaged = packageGaussian(ply);
assert.equal(packaged.runtime.length, 64); assert.equal(packaged.runtime.readFloatLE(0), 1);
assert.equal(packaged.runtime.readFloatLE(12), 1); assert.equal(packaged.runtime[24], 128); assert.equal(packaged.runtime[27], 128);
assert.equal(packaged.runtime[28], 255); assert.equal(packaged.records, 2);
assert.throws(() => packageGaussian(fixturePly({ value: NaN })), /NONFINITE/);
assert.throws(() => packageGaussian(ply.subarray(0, -1)), /LAYOUT/);
assert.throws(() => packageGaussian(ply, { maxRecords: 1 }), /RECORD_LIMIT/);
assert.throws(() => packageGaussian(Buffer.from('ply\nformat ascii 1.0\nend_header\n')), /FORMAT/);
const glb = conservativeCollisionGlb(packaged.bounds);
assert.equal(glb.readUInt32LE(0), 0x46546c67); assert.equal(glb.readUInt32LE(8), glb.length);
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
assert.equal(gltf.extras.navigationAccepted, false); assert.equal(gltf.extras.metricScaleVerified, false);
assert.equal(gltf.extras.classification, 'CONSERVATIVE_VISUAL_ENVELOPE');
await assert.rejects(command('sh', ['-c', 'true']), /COMMAND_NOT_ALLOWED/);
assert.throws(() => commandPlan('/tmp/private', 30001), /BUDGET/);
assert.deepEqual(commandPlan('/tmp/private').map(([binary]) => binary), ['ns-process-data', 'ns-train']);
const unavailable = await runtimeReadiness({}, async () => { throw new Error('unavailable'); });
assert.equal(unavailable.ok, false); assert.equal(unavailable.checks.cuda, false); assert.equal(unavailable.checks.computeAuthorized, false);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'urai-engine-contract-'));
const servers = [];
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server); return `http://127.0.0.1:${server.address().port}`; }
let revoked = false, runnerFails = false, runnerWaits = false, runnerMissingHoldout = false, callbackDrops = false, callbacks = [], commands = [], authorityBarrier, runnerEntered, authorityChecks = 0;
const callbackTokenHash = sha(Buffer.from('b'.repeat(64)));
const jobId = 'synthetic_job_01', sourceHandle = 'synthetic_handle_01', sourceRoot = path.join(temp, 'sources');
await fs.mkdir(sourceRoot, { mode: 0o700 });
const inputs = [];
for (let i = 0; i < 5; i++) {
  const bytes = Buffer.from(`synthetic-frame-${i}`), name = `${i}.png`; await fs.writeFile(path.join(sourceRoot, name), bytes, { mode: 0o600 });
  inputs.push({ accepted: true, inputRef: `synthetic_input_${i}`, frameProvenanceRef: `synthetic_frame_receipt_${i}`, path: name, sha256: sha(bytes), byteSize: bytes.length,
    mimeType: 'image/png', dynamicsPresent: false, maskRequired: false });
}
const manifestPath = path.join(temp, 'private-manifest.json');
const manifest = { entries: [{ jobId, sourceHandle, ownerUid: 'synthetic_owner_01', sourceReceiptRef: 'synthetic_receipt_01', expiresAt: new Date(Date.now() + 600000).toISOString(), acceptedInputs: inputs }] };
await fs.writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
const resolver = createResolver({ manifestPath, sourceRoot, token: 'synthetic-resolver-token', local: true,
  validateAuthority: async (body) => { authorityChecks++; if (authorityBarrier && authorityChecks >= (authorityBarrier.after || 0)) { authorityBarrier.entered(); await authorityBarrier.wait; }
    return { authorized: !revoked, ownerBound: true, jobId: body.jobId, sourceHandles: body.sourceHandles, callbackTokenHash: body.callbackTokenHash, purposes: ['memory.storage', 'location.context'] }; } });
const resolverUrl = await listen(resolver.server);
const worker = http.createServer(async (req, res) => {
  let text = ''; for await (const part of req) text += part;
  callbacks.push(JSON.parse(text));
  if (callbackDrops) return req.socket.destroy();
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
});
const callbackOrigin = await listen(worker);
const request = { jobId, sourceHandles: [sourceHandle], reconstructionMethod: '3dgs', spatialAuthorityHead: 'a'.repeat(40),
  studioProjectRef: 'synthetic_studio_01', assetFactoryGovernanceRef: 'synthetic_governance_01', callbackUrl: `${callbackOrigin}/engine-callback?callbackToken=${'b'.repeat(64)}` };
validateRequest(request, callbackOrigin, true);
assert.throws(() => validateRequest({ ...request, sourceUrl: 'https://private.invalid' }, callbackOrigin, true), /REQUEST_INVALID/);
assert.throws(() => validateRequest({ ...request, callbackUrl: `http://localhost:1/engine-callback?callbackToken=${'b'.repeat(64)}` }, callbackOrigin, true), /CALLBACK/);
assert.throws(() => validateRequest({ ...request, reconstructionMethod: 'photogrammetry' }, callbackOrigin, true), /REQUEST/);
assert.throws(() => validateRequest(request, callbackOrigin, false), /ENDPOINT/);
const safeEnvelope = await resolver.resolve({ jobId, sourceHandle, callbackTokenHash });
assert.ok(!JSON.stringify(safeEnvelope).includes(sourceRoot)); assert.ok(!JSON.stringify(safeEnvelope).includes('synthetic_owner_01')); assert.ok(!safeEnvelope.acceptedInputs[0].path);
assert.equal((await resolver.redeem({ jobId, sourceHandle, callbackTokenHash, inputRef: inputs[0].inputRef })).bytes.toString(), 'synthetic-frame-0');
revoked = true; await assert.rejects(resolver.redeem({ jobId, sourceHandle, callbackTokenHash, inputRef: inputs[0].inputRef }), /AUTHORITY/); revoked = false;
await fs.writeFile(path.join(sourceRoot, '0.png'), Buffer.from('tampered-frame-00'));
await assert.rejects(resolver.redeem({ jobId, sourceHandle, callbackTokenHash, inputRef: inputs[0].inputRef }), /HASH_MISMATCH|SIZE_MISMATCH/);
await fs.writeFile(path.join(sourceRoot, '0.png'), Buffer.from('synthetic-frame-0'));
const denial = await fetch(`${resolverUrl}/resolve`, { method: 'POST', body: JSON.stringify({ jobId, sourceHandle, callbackTokenHash }) }); assert.equal(denial.status, 401);

const sourceConsents = ['memory.storage', 'location.context'].map(purpose => ({ purpose, policyVersion: 'synthetic-v1', decisionReceiptId: 'synthetic-'+purpose }));
Object.assign(manifest.entries[0], { sourceRevision: 1, sourceSha256: 'a'.repeat(64), sourceByteLength: 1234, sourceFixityRef: 'private:synthetic/fixity' });
await fs.writeFile(manifestPath, JSON.stringify(manifest));
const dbGrant = { schemaVersion: 'urai-private-source-receipt-v2', ownerUid: 'synthetic_owner_01', sourceReceiptRef: 'synthetic_receipt_01', sourceHandle,
  status: 'ACTIVE', synthetic: false, purposes: ['reconstruct-place'], consents: sourceConsents,
  sourceRevision: 1, sourceSha256: 'a'.repeat(64), sourceByteLength: 1234, sourceFixityRef: 'private:synthetic/fixity' };
const dbJob = { type: 'memory.private-source.reconstruct-place', status: 'RUNNING', ownerUid: 'synthetic_owner_01', payload: { sourceReceiptRefs: ['synthetic_receipt_01'] }, consents: sourceConsents,
  execution: { callbackTokenHash, leaseToken: 'lease_01', callbackLeaseToken: 'lease_01', asyncCallbackPending: true, callbackDeadlineAt: { toMillis: () => Date.now() + 60000 } } };
const db = { collection: (name) => ({ doc: (id) => ({ name, id }) }), runTransaction: (fn) => fn({ get: async (ref) => ref.name === 'jobs'
  ? { exists: true, data: () => dbJob } : ref.name === 'uraiPrivateSourceReceipts' ? { exists: true, data: () => dbGrant }
  : { exists: ref.name === 'jobConsentBlocks' && revoked, data: () => ({ active: true }) } }) };
const policy = firestoreReconstructionAuthority(db, manifestPath, { getOwner: async uid => ({ uid, disabled: false, metadata: { creationTime: 'synthetic-created' } }) });
assert.equal((await policy({ jobId, sourceHandles: [sourceHandle], callbackTokenHash })).authorized, true);
await assert.rejects(policy({ jobId, sourceHandles: [sourceHandle], callbackTokenHash: 'f'.repeat(64) }), /ATTEMPT/);
dbJob.execution.leaseToken = 'successor_lease'; await assert.rejects(policy({ jobId, sourceHandles: [sourceHandle], callbackTokenHash }), /LEASE/); dbJob.execution.leaseToken = 'lease_01';
revoked = true; await assert.rejects(policy({ jobId, sourceHandles: [sourceHandle], callbackTokenHash }), /REVOKED/); revoked = false;

const run = async (binary, args, { cwd, signal }) => {
  commands.push(binary); if (runnerFails) throw new Error('synthetic runner failure'); if (signal.aborted) throw new Error('cancelled');
  if (runnerWaits) { runnerEntered?.resolve(); await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })); }
  if (binary === 'ns-process-data') {
    await fs.mkdir(path.join(cwd, '05_colmap_processed'), { recursive: true });
    const pose = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    await fs.writeFile(path.join(cwd, '05_colmap_processed', 'transforms.json'), JSON.stringify({ w: 4, h: 4, frames: (runnerMissingHoldout ? inputs.slice(0, 2) : inputs).map((_input, i) => ({
      file_path: `images/frame_${String(i + 1).padStart(5, '0')}.png`, transform_matrix: pose })) }));
  }
  if (binary === 'ns-eval') await fs.writeFile(path.join(cwd, 'heldout-metrics.json'), JSON.stringify({ method_name: 'splatfacto', results: { psnr: 23, ssim: 0.8, lpips: 0.3 } }));
  if (binary === 'ns-train') {
    await fs.mkdir(path.join(cwd, '06_training', 'fixed', 'nerfstudio_models'), { recursive: true });
    await fs.writeFile(path.join(cwd, '06_training', 'fixed', 'config.yml'), 'synthetic: true');
    await fs.writeFile(path.join(cwd, '06_training', 'fixed', 'nerfstudio_models', 'step-000000009.ckpt'), 'synthetic checkpoint, no model training');
    await fs.writeFile(path.join(cwd, 'private-command.log'), 'synthetic command adapter log');
  }
  if (binary === 'ns-export') { await fs.mkdir(path.join(cwd, '07_archival'), { recursive: true }); await fs.writeFile(path.join(cwd, '07_archival', 'splat.ply'), ply); }
};
const config = { token: 'synthetic-engine-token', sourceSha: 'c'.repeat(40), runtimeRevision: 'synthetic-revision', spatialAuthorityHead: 'a'.repeat(40), componentEnvelopeSha256: 'd'.repeat(64),
  resolverUrl, resolverToken: 'synthetic-resolver-token', callbackOrigin, storageRoot: path.join(temp, 'engine'), local: true, computeAuthorityRef: 'synthetic-compute-authority', enabled: true,
  computeBudgetReceipt: { schemaVersion: 'urai-prepaid-reconstruction-admission-v1', provider: 'prepaid-private-runner', operation: 'captured-reality.gaussian-reconstruction',
    authorityRef: 'synthetic-compute-authority', budgetSourceRef: 'synthetic-budget-reference', prepaidVerified: true, newCardChargeAuthorized: false,
    maxAutomaticRetries: 0, estimatedCostUsd: 1, prepaidAvailableUsd: 2, maxRunMs: 2700000, verifiedAt: new Date().toISOString() } };
assert.equal(computeBudget(config).maxAutomaticRetries, 0);
assert.throws(() => computeBudget({ ...config, computeBudgetReceipt: undefined }), /BUDGET_NOT_CURRENT/);
assert.throws(() => computeBudget({ ...config, computeBudgetReceipt: { ...config.computeBudgetReceipt, prepaidAvailableUsd: 0 } }), /BUDGET_NOT_CURRENT/);
assert.throws(() => computeBudget({ ...config, computeBudgetReceipt: { ...config.computeBudgetReceipt, newCardChargeAuthorized: true } }), /BUDGET_NOT_CURRENT/);
assert.throws(() => computeBudget({ ...config, computeBudgetReceipt: { ...config.computeBudgetReceipt, verifiedAt: new Date(Date.now() - 16 * 60000).toISOString() } }), /BUDGET_NOT_CURRENT/);
const engine = createEngine(config, { run, checkRuntime: async () => ({ ok: true, checks: { syntheticBoundaryOnly: true } }) });
await engine.initialize(); const engineUrl = await listen(engine.server);
try {
  const unauthorized = await fetch(`${engineUrl}/reconstruct`, { method: 'POST', body: JSON.stringify(request) }); assert.equal(unauthorized.status, 401); assert.equal(commands.length, 0);
  const first = await engine.submit(request); assert.equal(first.status, 202); const result = await first.completion; assert.equal(result.success, true);
  assert.deepEqual(commands, ['ns-process-data', 'ns-train', 'ns-eval', 'ns-export']);
  assert.equal(callbacks[0].status, 'success'); assert.equal(callbacks[0].result.runtime.sha256, sha(packaged.runtime));
  for (const kind of ['archival', 'runtime', 'collision']) { assert.match(callbacks[0].result[kind].ref, /^cr-artifact:/); assert.ok(callbacks[0].result[kind].byteSize > 0); }
  const firstState = JSON.parse(await fs.readFile(path.join(config.storageRoot, 'state', `${sha(Buffer.from(jobId))}.json`), 'utf8'));
  assert.equal(firstState.callbackAttempts, 1);
  assert.deepEqual(firstState.pipeline.events.map((event) => event.stage), ['RECEIVED', 'AUTHORIZED', 'FIXITY_VERIFIED', 'POSE_SOLVED', 'TRAINING', 'RECONSTRUCTED', 'RUNTIME_PACKAGED', 'QA']);
  assert.equal(firstState.pipeline.privateAcceptance, false);
  assert.equal(firstState.pipeline.events.at(-1).literalReviewCompleted, false);
  const artifactRoot = path.join(config.storageRoot, 'artifacts', sha(Buffer.from(jobId)));
  const trainingReceipt = JSON.parse(await fs.readFile(path.join(artifactRoot, result.output.trainingReceiptRef.split(':').at(-1)), 'utf8'));
  const evidence = JSON.parse(await fs.readFile(path.join(artifactRoot, trainingReceipt.archivalEvidence.sha256), 'utf8'));
  assert.equal(trainingReceipt.checkpointAvailable, true); assert.equal(trainingReceipt.resumeAutomaticallyAuthorized, false);
  assert.equal(trainingReceipt.computeAdmission.provider, 'prepaid-private-runner'); assert.equal(trainingReceipt.actualCostUsd, null);
  assert.equal(trainingReceipt.actualCostReceiptAvailable, false);
  assert.deepEqual(evidence.artifacts.map((artifact) => artifact.role), ['configuration', 'cameras', 'checkpoint', 'processing-log']);
  assert.ok(!JSON.stringify(evidence).includes(sourceRoot));
  for (const artifact of evidence.artifacts) {
    const bytes = await fs.readFile(path.join(artifactRoot, artifact.sha256));
    assert.equal(bytes.length, artifact.byteSize); assert.equal(sha(bytes), artifact.sha256);
  }
  assert.equal((await fs.readdir(path.join(config.storageRoot, 'work'))).length, 0, 'ephemeral source/log/config workspaces must be deleted');
  const replay = await engine.submit(request); assert.equal(replay.body.idempotent, true); assert.equal(commands.length, 4, 'idempotent replay cannot train twice');
  assert.equal((await engine.submit({ ...request, studioProjectRef: 'other_studio_01' })).status, 409);
  await assert.rejects(engine.submit({ ...request, spatialAuthorityHead: 'f'.repeat(40) }), /SPATIAL_AUTHORITY/);
  revoked = true;
  const artifactDenied = await fetch(`${engineUrl}/artifact`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId, ref: result.output.runtime.ref }) });
  assert.equal(artifactDenied.status, 403); revoked = false;
  // Pause the second64KiB private delivery authority check. Deletion must write
  // its tombstone without waiting for the streaming request's lifecycle lock.
  const deliveryBytes = Buffer.alloc(1024 * 1024, 9), deliveryHash = sha(deliveryBytes);
  await fs.writeFile(path.join(artifactRoot, deliveryHash), deliveryBytes, { mode: 0o600 });
  let releaseDelivery, observedDelivery;
  const deliveryWait = new Promise((resolve) => { releaseDelivery = resolve; });
  const deliveryEntered = new Promise((resolve) => { observedDelivery = resolve; });
  authorityBarrier = { after: authorityChecks + 3, entered: observedDelivery, wait: deliveryWait };
  const streamed = await fetch(`${engineUrl}/artifact`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ jobId, ref: `cr-artifact:${sha(Buffer.from(jobId))}:${deliveryHash}` }) });
  const reader = streamed.body.getReader(); const firstChunk = await reader.read(); assert.ok(firstChunk.value.length <= 64 * 1024);
  await deliveryEntered;
  const deletionDuringStream = await fetch(`${engineUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId }) });
  assert.ok([200, 409].includes(deletionDuringStream.status));
  assert.equal(JSON.parse(await fs.readFile(path.join(config.storageRoot, 'state', `${sha(Buffer.from(jobId))}.json`), 'utf8')).status, 'DELETED');
  releaseDelivery(); authorityBarrier = undefined;
  let deliveredBytes = firstChunk.value.length;
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; deliveredBytes += chunk.value.length; } } catch {}
  assert.ok(deliveredBytes < deliveryBytes.length, 'deletion prevents all remaining private artifact delivery');
  const deleted = await fetch(`${engineUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId }) }); assert.equal(deleted.status, 200);
  assert.equal((await engine.submit(request)).body.accepted, false, 'deleted attempts cannot restart compute');
  assert.equal((await fs.readFile(path.join(config.storageRoot, 'state', `${sha(Buffer.from(jobId))}.json`), 'utf8')).includes('callbackToken'), false, 'deletion scrubs callback/source authority');
  const secondId = 'synthetic_job_02'; manifest.entries[0].jobId = secondId; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  runnerFails = true;
  const second = await engine.submit({ ...request, jobId: secondId }); assert.equal((await second.completion).success, false);
  assert.equal((await fs.readdir(path.join(config.storageRoot, 'work'))).length, 0);
  assert.equal(callbacks.at(-1).status, 'failed'); runnerFails = false;
  const missingHoldoutId = 'synthetic_missing_holdout_01'; manifest.entries[0].jobId = missingHoldoutId; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  runnerMissingHoldout = true; const beforeMissingHoldout = commands.length;
  const missingHoldout = await engine.submit({ ...request, jobId: missingHoldoutId }); assert.equal((await missingHoldout.completion).success, false);
  assert.deepEqual(commands.slice(beforeMissingHoldout), ['ns-process-data'], 'invalid camera/holdout coverage must stop before expensive training'); runnerMissingHoldout = false;
  const maskBytes = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(maskBytes);
  maskBytes.writeUInt32BE(13, 8); maskBytes.write('IHDR', 12); maskBytes.writeUInt32BE(4, 16); maskBytes.writeUInt32BE(4, 20);
  const maskedInputs = inputs.map((input, i) => ({ ...input, dynamicsPresent: true, maskRequired: true,
    mask: { inputRef: `synthetic_mask_${i}`, frameSha256: input.sha256, frameProvenanceRef: input.frameProvenanceRef,
      maskProvenanceRef: `synthetic_mask_receipt_${i}`, sha256: sha(maskBytes), byteSize: maskBytes.length, mimeType: 'image/png', accepted: true, path: `mask-${i}.png` } }));
  for (const input of maskedInputs) await fs.writeFile(path.join(sourceRoot, input.mask.path), maskBytes, { mode: 0o600 });
  const maskedId = 'synthetic_masked_engine_01'; manifest.entries[0].jobId = maskedId; manifest.entries[0].acceptedInputs = maskedInputs;
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const maskedJob = await engine.submit({ ...request, jobId: maskedId }), maskedResult = await maskedJob.completion;
  assert.equal(maskedResult.success, true);
  const maskedArtifactRoot = path.join(config.storageRoot, 'artifacts', sha(Buffer.from(maskedId)));
  const maskedTraining = JSON.parse(await fs.readFile(path.join(maskedArtifactRoot, maskedResult.output.trainingReceiptRef.split(':').at(-1)), 'utf8'));
  assert.equal(maskedTraining.maskReceipt.maskedRegisteredViews, 5); assert.equal(maskedTraining.maskReceipt.candidateAcceptance, false);
  const maskedArchive = JSON.parse(await fs.readFile(path.join(maskedArtifactRoot, maskedTraining.archivalEvidence.sha256), 'utf8'));
  const maskedCameras = JSON.parse(await fs.readFile(path.join(maskedArtifactRoot, maskedArchive.artifacts.find((artifact) => artifact.role === 'cameras').sha256), 'utf8'));
  assert.ok(maskedCameras.frames.every((frame) => /^masks\/frame_\d{5}\.png$/.test(frame.mask_path)));
  assert.ok(commandPlan('/synthetic-private')[1][1].includes('--downscale-factor'));
  const mismatchId = 'synthetic_mask_dimension_mismatch_01'; manifest.entries[0].jobId = mismatchId;
  const mismatchBytes = Buffer.from(maskBytes); mismatchBytes.writeUInt32BE(5, 16);
  await fs.writeFile(path.join(sourceRoot, maskedInputs[0].mask.path), mismatchBytes); maskedInputs[0].mask.sha256 = sha(mismatchBytes);
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const beforeMaskMismatch = commands.length, mismatched = await engine.submit({ ...request, jobId: mismatchId });
  assert.equal((await mismatched.completion).success, false);
  assert.deepEqual(commands.slice(beforeMaskMismatch), ['ns-process-data'], 'mask/camera dimensions must match before paid training');
  manifest.entries[0].acceptedInputs = inputs;
  const thirdId = 'synthetic_job_03'; manifest.entries[0].jobId = thirdId; await fs.writeFile(manifestPath, JSON.stringify(manifest)); callbackDrops = true;
  const third = await engine.submit({ ...request, jobId: thirdId }); await third.completion;
  const pending = JSON.parse(await fs.readFile(path.join(config.storageRoot, 'state', `${sha(Buffer.from(thirdId))}.json`), 'utf8'));
  assert.equal(pending.status, 'CALLBACK_PENDING'); assert.ok(pending.output.runtime.ref, 'ambiguous callbacks preserve private bytes instead of retraining'); callbackDrops = false;
  const recovery = await fetch(`${engineUrl}/retry-callback`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: thirdId }) }); assert.equal(recovery.status, 200);
  assert.equal(JSON.parse(await fs.readFile(path.join(config.storageRoot, 'state', `${sha(Buffer.from(thirdId))}.json`), 'utf8')).callbackAttempts, 2);

  const retryId = 'synthetic_retry_limit_01'; manifest.entries[0].jobId = retryId; await fs.writeFile(manifestPath, JSON.stringify(manifest)); callbackDrops = true;
  const retryJob = await engine.submit({ ...request, jobId: retryId }); await retryJob.completion;
  const commandsAfterRetry = commands.length;
  for (let attempt = 0; attempt < 2; attempt++) {
    const dropped = await fetch(`${engineUrl}/retry-callback`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: retryId }) });
    assert.equal(dropped.status, 403);
  }
  callbackDrops = false;
  const exhausted = await fetch(`${engineUrl}/retry-callback`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: retryId }) });
  assert.equal(exhausted.status, 403);
  const exhaustedState = JSON.parse(await fs.readFile(path.join(config.storageRoot, 'state', `${sha(Buffer.from(retryId))}.json`), 'utf8'));
  assert.equal(exhaustedState.status, 'CALLBACK_PENDING'); assert.equal(exhaustedState.callbackAttempts, 3);
  assert.equal(commands.length, commandsAfterRetry, 'callback retry exhaustion cannot launch another paid reconstruction');
  const fourthId = 'synthetic_job_04'; manifest.entries[0].jobId = fourthId; await fs.writeFile(manifestPath, JSON.stringify(manifest)); runnerWaits = true;
  const fourth = await engine.submit({ ...request, jobId: fourthId }); await engine.cancel(fourthId);
  assert.equal((await fourth.completion).success, false); assert.equal((await fs.readdir(path.join(config.storageRoot, 'work'))).length, 0); runnerWaits = false;
  const fifthId = 'synthetic_job_05', interruptedKey = sha(Buffer.from(fifthId));
  await fs.mkdir(path.join(config.storageRoot, 'work', interruptedKey), { recursive: true });
  await fs.writeFile(path.join(config.storageRoot, 'work', interruptedKey, 'private-frame'), 'synthetic-private-source');
  const interruptedWorkspace = path.join(config.storageRoot, 'work', interruptedKey);
  await fs.mkdir(path.join(interruptedWorkspace, '06_training', 'checkpointed'), { recursive: true });
  await fs.mkdir(path.join(interruptedWorkspace, '05_colmap_processed'), { recursive: true });
  await fs.writeFile(path.join(interruptedWorkspace, '06_training', 'checkpointed', 'config.yml'), 'synthetic: interrupted');
  await fs.writeFile(path.join(interruptedWorkspace, '06_training', 'checkpointed', 'step-000000010.ckpt'), 'synthetic intermediate checkpoint');
  await fs.writeFile(path.join(interruptedWorkspace, '05_colmap_processed', 'transforms.json'), '{"frames":[]}');
  await fs.writeFile(path.join(config.storageRoot, 'state', `${interruptedKey}.json`), JSON.stringify({ status: 'RUNNING', digest: 'f'.repeat(64), request: { ...request, jobId: fifthId } }), { mode: 0o600 });
  const commandCount = commands.length; await engine.initialize();
  assert.equal(commands.length, commandCount, 'restart recovery must not silently retrain');
  assert.equal((await fs.readdir(path.join(config.storageRoot, 'work'))).length, 0);
  const interrupted = JSON.parse(await fs.readFile(path.join(config.storageRoot, 'state', `${interruptedKey}.json`), 'utf8'));
  assert.equal(interrupted.status, 'FAILED'); assert.equal(interrupted.recoveryEvidence.newGovernedAttemptRequired, true);
  assert.equal(interrupted.recoveryEvidence.automaticallyResumed, false);
  assert.ok((await fs.stat(path.join(config.storageRoot, 'artifacts', interruptedKey, interrupted.recoveryEvidence.sha256))).size > 0);
  const recoveryDelete = await fetch(`${engineUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: fifthId }) });
  assert.equal(recoveryDelete.status, 200); assert.equal((await fs.readdir(path.join(config.storageRoot, 'artifacts'))).includes(interruptedKey), false);

  // Admission authority deliberately waits while the same job is submitted
  // again. Both callers must share the original reservation, not race training
  // or return a transient global-busy response for the identical attempt.
  function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
  function observed(promise) { promise.catch(() => {}); return promise; }
  const sixthId = 'synthetic_job_06'; manifest.entries[0].jobId = sixthId; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const authorityEntered = deferred(), releaseAuthority = deferred();
  authorityBarrier = { entered: authorityEntered.resolve, wait: releaseAuthority.promise };
  let readinessCalls = 0;
  const concurrentConfig = { ...config, storageRoot: path.join(temp, 'concurrent-engine') };
  const concurrent = createEngine(concurrentConfig, { run, checkRuntime: async () => { readinessCalls++; return { ok: true, checks: { syntheticBoundaryOnly: true } }; } });
  await concurrent.initialize(); const concurrentUrl = await listen(concurrent.server);
  const beforeConcurrent = commands.length, sixthRequest = { ...request, jobId: sixthId };
  const sixthFirst = observed(concurrent.submit(sixthRequest)); await authorityEntered.promise;
  const sixthSecond = observed(concurrent.submit(sixthRequest)); await new Promise(setImmediate);
  assert.equal(readinessCalls, 1, 'simultaneous identical admission must share readiness and authorization');
  releaseAuthority.resolve(); authorityBarrier = undefined;
  const [sixthA, sixthB] = await Promise.all([sixthFirst, sixthSecond]);
  assert.equal(sixthA.status, 202); assert.equal(sixthB.status, 202); assert.equal(sixthB.body.idempotent, true);
  assert.equal((await sixthA.completion).success, true); assert.equal(commands.length - beforeConcurrent, 4, 'only one pipeline may run');

  // Deletion of an unknown attempt is permanent, including across process
  // restart, rather than an acknowledgement that leaves it trainable later.
  const seventhId = 'synthetic_job_07';
  const seventhDelete = await fetch(`${concurrentUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: seventhId }) });
  assert.equal(seventhDelete.status, 200); assert.equal((await seventhDelete.json()).artifactsDeleted, true);
  const seventhPath = path.join(concurrentConfig.storageRoot, 'state', `${sha(Buffer.from(seventhId))}.json`);
  assert.deepEqual(JSON.parse(await fs.readFile(seventhPath, 'utf8')), { status: 'DELETED' });
  const restarted = createEngine(concurrentConfig, { run, checkRuntime: async () => ({ ok: true }) }); await restarted.initialize();
  assert.equal((await restarted.submit({ ...request, jobId: seventhId })).body.status, 'DELETED');

  // A pending readiness probe cannot resurrect a job deleted before admission.
  const eighthId = 'synthetic_job_08'; manifest.entries[0].jobId = eighthId; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const readinessEntered = deferred(), releaseReadiness = deferred();
  const preadmissionConfig = { ...config, storageRoot: path.join(temp, 'preadmission-engine') };
  const preadmission = createEngine(preadmissionConfig, { run, checkRuntime: async () => { readinessEntered.resolve(); await releaseReadiness.promise; return { ok: true }; } });
  await preadmission.initialize(); const preadmissionUrl = await listen(preadmission.server);
  const beforeDeleteCommands = commands.length, beforeDeleteCallbacks = callbacks.length;
  const eighthSubmit = observed(preadmission.submit({ ...request, jobId: eighthId })); await readinessEntered.promise;
  const eighthDelete = await fetch(`${preadmissionUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: eighthId }) });
  assert.ok([200, 409].includes(eighthDelete.status));
  assert.equal(JSON.parse(await fs.readFile(path.join(preadmissionConfig.storageRoot, 'state', `${sha(Buffer.from(eighthId))}.json`), 'utf8')).status, 'DELETED');
  releaseReadiness.resolve(); const eighthAdmission = await eighthSubmit;
  assert.equal(eighthAdmission.status, 409); assert.equal(eighthAdmission.body.status, 'DELETED');
  const eighthAck = await fetch(`${preadmissionUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: eighthId }) });
  assert.equal(eighthAck.status, 200);
  assert.equal(commands.length, beforeDeleteCommands); assert.equal(callbacks.length, beforeDeleteCallbacks, 'deleted preadmission jobs cannot emit callbacks');

  // The same fence must hold with source authority blocked after readiness.
  const ninthId = 'synthetic_job_09'; manifest.entries[0].jobId = ninthId; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const ninthEntered = deferred(), ninthRelease = deferred(); authorityBarrier = { entered: ninthEntered.resolve, wait: ninthRelease.promise };
  const ninthSubmit = observed(concurrent.submit({ ...request, jobId: ninthId })); await ninthEntered.promise;
  const ninthDelete = await fetch(`${concurrentUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: ninthId }) });
  assert.ok([200, 409].includes(ninthDelete.status)); ninthRelease.resolve(); authorityBarrier = undefined;
  assert.equal((await ninthSubmit).body.status, 'DELETED');
  const ninthAck = await fetch(`${concurrentUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: ninthId }) });
  assert.equal(ninthAck.status, 200); assert.equal(commands.length, beforeDeleteCommands); assert.equal(callbacks.length, beforeDeleteCallbacks);

  // An already running command is aborted before cleanup acknowledgement,
  // and its failure/callback/finalization paths must preserve the tombstone.
  const tenthId = 'synthetic_job_10'; manifest.entries[0].jobId = tenthId; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  runnerEntered = deferred(); runnerWaits = true;
  const tenth = await concurrent.submit({ ...request, jobId: tenthId }); await runnerEntered.promise;
  const tenthDelete = await fetch(`${concurrentUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: tenthId }) });
  assert.equal(tenthDelete.status, 409, 'cleanup cannot be acknowledged with an active subprocess');
  assert.equal((await tenth.completion).success, false); runnerWaits = false; runnerEntered = undefined;
  const tenthAck = await fetch(`${concurrentUrl}/delete`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: tenthId }) });
  assert.equal(tenthAck.status, 200); assert.equal(callbacks.length, beforeDeleteCallbacks, 'deleted computations cannot emit a late failure/success callback');
  const tenthState = JSON.parse(await fs.readFile(path.join(concurrentConfig.storageRoot, 'state', `${sha(Buffer.from(tenthId))}.json`), 'utf8'));
  assert.equal(tenthState.status, 'DELETED'); assert.deepEqual(Object.keys(tenthState).sort(), ['digest', 'status']);
  assert.equal((await concurrent.submit({ ...request, jobId: tenthId })).body.status, 'DELETED');
  assert.equal((await fs.readdir(path.join(concurrentConfig.storageRoot, 'artifacts'))).includes(sha(Buffer.from(tenthId))), false);
  for (const [route, extra] of [['/retry-callback', {}], ['/artifact', { ref: result.output.runtime.ref }]]) {
    const denied = await fetch(`${concurrentUrl}${route}`, { method: 'POST', headers: { authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jobId: tenthId, ...extra }) });
    assert.equal(denied.status, 403, 'deleted state cannot be delivered or resurrected');
  }
} finally { for (const server of servers) server.closeAllConnections(); await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve)))); await fs.rm(temp, { recursive: true, force: true }); }
console.log('[PASS] captured reality engine/resolver contracts: synthetic transport/command doubles only; no CUDA, training, private-source or runtime acceptance');
