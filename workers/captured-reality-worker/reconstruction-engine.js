const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { createWriteStream } = require('node:fs');
const { constants } = require('node:fs');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const { packageGaussian, conservativeCollisionGlb } = require('./gaussian-package');
const { archiveReconstructionEvidence, hashOpenFile } = require('./reconstruction-evidence');
const { partitionFrames, bindRegisteredSplits, radianceIsolationArguments, readHoldoutMetrics } = require('./reconstruction-holdout');
const { validateMaskMetadata, pngDimensions, bindMasksToTransforms, prepareSfmMasks, verifySfmMaskReceipt } = require('./reconstruction-masks');
const { jsonRequest, privateUrl, readBody, authorized, send, HANDLE, SHA256, sha } = require('./private-media-resolver');
const REQUEST_KEYS = new Set(['jobId', 'sourceHandles', 'reconstructionMethod', 'spatialAuthorityHead', 'studioProjectRef', 'assetFactoryGovernanceRef', 'callbackUrl']);

function validateRequest(body, callbackOrigin, local = false) {
  if (!body || typeof body !== 'object' || Object.keys(body).some((key) => !REQUEST_KEYS.has(key)) || !HANDLE.test(String(body.jobId || ''))
    || !Array.isArray(body.sourceHandles) || body.sourceHandles.length < 1 || body.sourceHandles.length > 32
    || body.sourceHandles.some((handle) => !HANDLE.test(String(handle))) || new Set(body.sourceHandles).size !== body.sourceHandles.length
    || body.reconstructionMethod !== '3dgs' || !/^[0-9a-f]{40}$/.test(String(body.spatialAuthorityHead || ''))
    || !HANDLE.test(String(body.studioProjectRef || '')) || !HANDLE.test(String(body.assetFactoryGovernanceRef || ''))) throw new Error('RECONSTRUCTION_REQUEST_INVALID');
  const callback = privateUrl(body.callbackUrl, local), expected = privateUrl(callbackOrigin, local);
  if (callback.origin !== expected.origin || callback.pathname !== '/engine-callback' || [...callback.searchParams.keys()].length !== 1
    || !/^[0-9a-f]{64}$/.test(callback.searchParams.get('callbackToken') || '')) throw new Error('CALLBACK_AUTHORITY_INVALID');
  return JSON.parse(JSON.stringify(body));
}
function commandPlan(workspace, iterations = 30000, masked = false, maskManifestSha256) {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 30000) throw new Error('TRAINING_BUDGET_INVALID');
  const wrapper = path.join(__dirname, 'masked-colmap.py');
  if (masked && !/^\/[A-Za-z0-9_./-]+$/.test(wrapper)) throw new Error('MASK_SFM_WRAPPER_PATH_INVALID');
  if (masked && !SHA256.test(String(maskManifestSha256 || ''))) throw new Error('MASK_SFM_AUTHORITY_REQUIRED');
  return [
    ...(masked ? [['python3', [wrapper, '--authority-sha256', maskManifestSha256, '--validate-source']]] : []),
    ['ns-process-data', ['images', '--data', path.join(workspace, '04_frames_accepted'), '--output-dir', path.join(workspace, '05_colmap_processed'),
      ...(masked ? ['--sfm-tool', 'colmap', '--colmap-cmd', `${wrapper} --authority-sha256 ${maskManifestSha256}`, '--num-downscales', '0'] : [])]],
    ['ns-train', ['splatfacto', '--data', path.join(workspace, '05_colmap_processed'), '--output-dir', path.join(workspace, '06_training'), '--max-num-iterations', String(iterations), '--vis', 'tensorboard', ...radianceIsolationArguments(), '--downscale-factor', '1']],
  ];
}
function computeBudget(config, binding, now = Date.now()) {
  const receipt = config.computeBudgetReceipt;
  if (!receipt || receipt.schemaVersion !== 'urai-prepaid-reconstruction-admission-v1'
    || !['runpod', 'gcp', 'prepaid-private-runner'].includes(receipt.provider)
    || receipt.operation !== 'captured-reality.gaussian-reconstruction'
    || !HANDLE.test(String(receipt.jobId || '')) || !SHA256.test(String(receipt.requestDigest || ''))
    || !SHA256.test(String(receipt.sourceManifestSha256 || ''))
    || !HANDLE.test(String(receipt.authorityRef || '')) || receipt.authorityRef !== config.computeAuthorityRef
    || !HANDLE.test(String(receipt.budgetSourceRef || '')) || receipt.prepaidVerified !== true
    || receipt.newCardChargeAuthorized !== false || receipt.maxAutomaticRetries !== 0
    || !Number.isFinite(receipt.estimatedCostUsd) || receipt.estimatedCostUsd < 0
    || !Number.isFinite(receipt.prepaidAvailableUsd) || receipt.prepaidAvailableUsd < receipt.estimatedCostUsd
    || !Number.isSafeInteger(receipt.maxRunMs) || receipt.maxRunMs < 1000 || receipt.maxRunMs > 2700000
    || (config.maxRunMs || 2700000) > receipt.maxRunMs
    || !Number.isFinite(Date.parse(receipt.verifiedAt)) || Date.parse(receipt.verifiedAt) > now
    || now - Date.parse(receipt.verifiedAt) > 15 * 60 * 1000) throw new Error('PREPAID_COMPUTE_BUDGET_NOT_CURRENT');
  // The existing protected compute authority is a fixed-attempt reservation,
  // not a reusable assertion about an account balance. It grants no second job.
  if (binding && (binding.jobId !== receipt.jobId || binding.requestDigest !== receipt.requestDigest
    || (binding.sourceManifestSha256 !== undefined && binding.sourceManifestSha256 !== receipt.sourceManifestSha256))) throw new Error('PREPAID_COMPUTE_RESERVATION_BINDING_MISMATCH');
  return JSON.parse(JSON.stringify(receipt));
}
function acceptedSourceManifestSha256(lineage) {
  return sha(Buffer.from(JSON.stringify(lineage.map(({ filename, inputRef, sourceReceiptRef, frameProvenanceRef, sha256, byteSize, dynamicsPresent, maskRequired, mask }) => ({
    filename, inputRef, sourceReceiptRef, frameProvenanceRef, sha256, byteSize, dynamicsPresent, maskRequired, ...(mask ? { mask } : {}) })) )));
}
async function command(executable, args, { cwd, signal, logfile, timeoutMs = 2700000 } = {}) {
  const allowed = new Set(['ns-process-data', 'ns-train', 'ns-export', 'ns-eval', 'nvidia-smi', 'python3']);
  if (!allowed.has(executable) || !Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) throw new Error('COMMAND_NOT_ALLOWED');
  const log = logfile ? createWriteStream(logfile, { flags: 'a', mode: 0o600 }) : null; let loggedBytes = 0;
  log?.on('error', () => {});
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, signal, shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const stop = () => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    const retain = (chunk) => { loggedBytes += chunk.length; if (log && loggedBytes <= 16 * 1024 * 1024) log.write(chunk); };
    child.stdout.on('data', retain); child.stderr.on('data', retain);
    child.once('error', () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(new Error('COMMAND_START_FAILED')); });
    child.once('close', (code) => { clearTimeout(timer); signal?.removeEventListener('abort', stop); code === 0 ? resolve() : reject(new Error('COMMAND_FAILED')); });
  }).finally(async () => { if (log) { log.end(); await finished(log); } });
}
async function runtimeReadiness(config, run = command) {
  const checks = { engineAuth: Boolean(config.token), exactSourceSha: /^[0-9a-f]{40}$/.test(config.sourceSha || ''),
    exactSpatialAuthority: /^[0-9a-f]{40}$/.test(config.spatialAuthorityHead || ''), componentEnvelope: SHA256.test(String(config.componentEnvelopeSha256 || '')),
    runtimeRevision: Boolean(config.runtimeRevision), resolverBinding: Boolean(config.resolverUrl && config.resolverToken),
    callbackOrigin: Boolean(config.callbackOrigin), privateStorage: Boolean(config.storageRoot),
    computeAuthorized: config.enabled === true && HANDLE.test(String(config.computeAuthorityRef || '')), cuda: false, nerfstudio: false };
  try { computeBudget(config); checks.prepaidBudget = true; } catch { checks.prepaidBudget = false; }
  try { privateUrl(config.resolverUrl, config.local); privateUrl(config.callbackOrigin, config.local); } catch { checks.resolverBinding = false; checks.callbackOrigin = false; }
  try { await run('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], { timeoutMs: 10000 });
    await run('python3', ['-c', 'import torch; assert torch.cuda.is_available()'], { timeoutMs: 10000 }); checks.cuda = true; } catch {}
  try { for (const binary of ['ns-process-data', 'ns-train', 'ns-export', 'ns-eval']) await run(binary, ['--help'], { timeoutMs: 10000 }); checks.nerfstudio = true; } catch {}
  return { ok: Object.values(checks).every(Boolean), checks };
}
async function filesNamed(root, name) {
  const results = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) results.push(...await filesNamed(candidate, name));
    else if (entry.isFile() && entry.name === name) results.push(candidate);
  }
  return results;
}
function createEngine(config, { run = command, checkRuntime = runtimeReadiness } = {}) {
  const maxCallbackAttempts = config.maxCallbackAttempts ?? 3;
  if (!Number.isSafeInteger(maxCallbackAttempts) || maxCallbackAttempts < 1 || maxCallbackAttempts > 5) throw new Error('CALLBACK_RETRY_BUDGET_INVALID');
  const active = new Map(), admissions = new Map(), lifecycle = new Map(), deliveries = new Map(); let ready;
  const root = config.storageRoot || path.join(process.cwd(), '.private-captured-reality');
  const key = (jobId) => sha(Buffer.from(jobId));
  const statePath = (jobId) => path.join(root, 'state', `${key(jobId)}.json`);
  function exclusive(jobId, operation) {
    const previous = lifecycle.get(jobId) || Promise.resolve();
    const result = previous.then(operation), tail = result.then(() => {}, () => {});
    lifecycle.set(jobId, tail);
    return result.finally(() => { if (lifecycle.get(jobId) === tail) lifecycle.delete(jobId); });
  }
  async function readState(jobId) {
    return fs.readFile(statePath(jobId), 'utf8').then(JSON.parse).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
  }
  async function writeState(jobId, state) {
    await fs.mkdir(path.join(root, 'state'), { recursive: true, mode: 0o700 });
    const target = statePath(jobId), temp = `${target}.tmp`;
    await fs.writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await fs.rename(temp, target);
  }
  async function persist(jobId, state) {
    return exclusive(jobId, async () => {
      const existing = await readState(jobId);
      if (existing?.status === 'DELETED' && state.status !== 'DELETED') throw new Error('RECONSTRUCTION_DELETED');
      if (existing?.pipeline && state.status !== 'DELETED') state.pipeline = existing.pipeline;
      if (existing?.computeAdmission && state.status !== 'DELETED') state.computeAdmission = existing.computeAdmission;
      if (existing?.callbackAttempts !== undefined && state.status !== 'DELETED') state.callbackAttempts = existing.callbackAttempts;
      await writeState(jobId, state);
    });
  }
  async function stage(jobId, name, evidence = {}) {
    return exclusive(jobId, async () => {
      const state = await readState(jobId);
      if (state?.status !== 'RUNNING' || !state.pipeline || state.pipeline.events.length >= 32) throw new Error('RECONSTRUCTION_STAGE_DENIED');
      state.pipeline.events.push({ stage: name, recordedAt: new Date().toISOString(), ...evidence });
      await writeState(jobId, state);
    });
  }
  async function sourceCheck(request, signal) {
    const callbackTokenHash = sha(Buffer.from(new URL(request.callbackUrl).searchParams.get('callbackToken')));
    const result = await jsonRequest(`${config.resolverUrl}/check`, config.resolverToken, { jobId: request.jobId, sourceHandles: request.sourceHandles, callbackTokenHash }, config.local, signal);
    if (result.authorized !== true || result.jobId !== request.jobId || result.callbackTokenHash !== callbackTokenHash || JSON.stringify([...result.sourceHandles].sort()) !== JSON.stringify([...request.sourceHandles].sort())) throw new Error('SOURCE_AUTHORIZATION_DENIED');
  }
  async function deliverCallback(request, body) {
    // Callback authority is already the worker's one-use token; never log URLs.
    const result = await fetch(privateUrl(request.callbackUrl, config.local), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw new Error('CALLBACK_REJECTED');
  }
  async function callback(request, body) {
    return exclusive(request.jobId, async () => {
      const state = await readState(request.jobId);
      if (state?.status === 'DELETED') throw new Error('RECONSTRUCTION_DELETED');
      if (body.status === 'success') {
        if (state?.status !== 'CALLBACK_PENDING' || (state.callbackAttempts || 0) >= maxCallbackAttempts) throw new Error('CALLBACK_RETRY_BUDGET_EXHAUSTED');
        state.callbackAttempts = (state.callbackAttempts || 0) + 1;
        await writeState(request.jobId, state);
      }
      await deliverCallback(request, body);
    });
  }
  async function perform(request, digest, controller) {
    const jobKey = key(request.jobId), workspace = path.join(root, 'work', jobKey), artifactRoot = path.join(root, 'artifacts', jobKey);
    let output, failure = false, callbackPrepared = false;
    await fs.mkdir(workspace, { recursive: true, mode: 0o700 });
    const signal = controller.signal;
    const watchdog = setTimeout(() => controller.abort(), Math.min(config.maxRunMs || 2700000, 2700000));
    const monitor = setInterval(() => { sourceCheck(request).catch(() => controller.abort()); }, 5000);
    try {
      await sourceCheck(request, signal);
      const frames = path.join(workspace, '04_frames_accepted'); await fs.mkdir(frames, { mode: 0o700 });
      const sourceMasks = path.join(workspace, 'source-masks'); await fs.mkdir(sourceMasks, { mode: 0o700 });
      let total = 0, count = 0; const lineage = [];
      for (const sourceHandle of request.sourceHandles) {
        const callbackTokenHash = sha(Buffer.from(new URL(request.callbackUrl).searchParams.get('callbackToken')));
        const envelope = await jsonRequest(`${config.resolverUrl}/resolve`, config.resolverToken, { jobId: request.jobId, sourceHandle, callbackTokenHash }, config.local, signal);
        if (envelope.authorized !== true || envelope.jobId !== request.jobId || envelope.sourceHandle !== sourceHandle
          || !HANDLE.test(String(envelope.sourceReceiptRef || '')) || Date.parse(envelope.expiresAt) <= Date.now()
          || !Number.isFinite(Date.parse(envelope.expiresAt)) || !Array.isArray(envelope.acceptedInputs)) throw new Error('SOURCE_ENVELOPE_INVALID');
        for (const input of envelope.acceptedInputs) {
          if (!HANDLE.test(String(input.inputRef || '')) || !HANDLE.test(String(input.frameProvenanceRef || '')) || !SHA256.test(String(input.sha256 || ''))
            || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > 256 * 1024 * 1024
            || !['image/png', 'image/jpeg'].includes(input.mimeType) || ++count > 3000 || (total += input.byteSize) > 2 * 1024 * 1024 * 1024) throw new Error('INPUT_BUDGET_OR_IDENTITY_INVALID');
          if (typeof input.dynamicsPresent !== 'boolean' || typeof input.maskRequired !== 'boolean') throw new Error('DYNAMIC_SOURCE_CLASSIFICATION_REQUIRED');
          const mask = validateMaskMetadata(input);
          const response = await fetch(privateUrl(`${config.resolverUrl}/redeem`, config.local), { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.resolverToken}` },
            body: JSON.stringify({ jobId: request.jobId, sourceHandle, inputRef: input.inputRef, callbackTokenHash }), signal, redirect: 'error' });
          if (!response.ok) throw new Error('SOURCE_REDEMPTION_DENIED');
          const filename = `${String(count).padStart(6, '0')}.${input.mimeType === 'image/png' ? 'png' : 'jpg'}`;
          const file = await fs.open(path.join(frames, filename), 'wx', 0o600); let received = 0; const hash = crypto.createHash('sha256');
          try {
            for await (const chunk of response.body) { received += chunk.length; if (received > input.byteSize) throw new Error('SOURCE_SIZE_MISMATCH'); hash.update(chunk); await file.writeFile(chunk); }
          } finally { await file.close(); }
          if (received !== input.byteSize || hash.digest('hex') !== input.sha256) throw new Error('SOURCE_FIXITY_MISMATCH');
          const record = { filename, inputRef: input.inputRef, sourceReceiptRef: envelope.sourceReceiptRef, frameProvenanceRef: input.frameProvenanceRef,
            sha256: input.sha256, byteSize: received, dynamicsPresent: input.dynamicsPresent, maskRequired: input.maskRequired };
          if (mask) {
            if ((total += mask.byteSize) > 2 * 1024 * 1024 * 1024) throw new Error('INPUT_BUDGET_OR_IDENTITY_INVALID');
            const maskResponse = await fetch(privateUrl(`${config.resolverUrl}/redeem-mask`, config.local), {
              method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.resolverToken}` },
              body: JSON.stringify({ jobId: request.jobId, sourceHandle, inputRef: input.inputRef, maskInputRef: mask.inputRef, callbackTokenHash }), signal, redirect: 'error' });
            if (!maskResponse.ok) throw new Error('MASK_REDEMPTION_DENIED');
            const maskPath = path.join(sourceMasks, `${String(count).padStart(6, '0')}.png`), maskFile = await fs.open(maskPath, 'wx', 0o600);
            let maskReceived = 0; const maskHash = crypto.createHash('sha256');
            try {
              for await (const chunk of maskResponse.body) {
                maskReceived += chunk.length; if (maskReceived > mask.byteSize) throw new Error('MASK_SIZE_MISMATCH');
                maskHash.update(chunk); await maskFile.writeFile(chunk);
              }
            } finally { await maskFile.close(); }
            if (maskReceived !== mask.byteSize || maskHash.digest('hex') !== mask.sha256) throw new Error('MASK_FIXITY_MISMATCH');
            record.mask = mask; record.maskDimensions = pngDimensions(await fs.readFile(maskPath));
          }
          lineage.push(record);
        }
      }
      if (count < 3) throw new Error('INSUFFICIENT_ACCEPTED_FRAMES');
      const sourceManifestSha256 = acceptedSourceManifestSha256(lineage);
      const computeAdmission = (await readState(request.jobId))?.computeAdmission;
      computeBudget({ ...config, computeBudgetReceipt: computeAdmission }, { jobId: request.jobId, requestDigest: digest, sourceManifestSha256 });
      await stage(request.jobId, 'FIXITY_VERIFIED', { sourceManifestSha256, frameCount: count, byteSize: total });
      const reservation = partitionFrames(lineage);
      if (!reservation.reserved) throw new Error('INSUFFICIENT_DISJOINT_HOLDOUT_INPUTS');
      await fs.writeFile(path.join(workspace, 'holdout-reservation.json'), JSON.stringify(reservation), { mode: 0o600 });
      const sfmMaskPreparation = await prepareSfmMasks(workspace, lineage);
      const startedAt = new Date().toISOString(), plan = commandPlan(workspace, config.iterations || 30000, Boolean(sfmMaskPreparation), sfmMaskPreparation?.manifestSha256), logfile = path.join(workspace, 'private-command.log');
      const deadline = Date.now() + Math.min(config.maxRunMs || 2700000, 2700000);
      let splitReceipt, maskReceipt, sfmMaskReceipt;
      for (const [binary, args] of plan) {
        await sourceCheck(request, signal);
        if (binary === 'ns-train') await stage(request.jobId, 'TRAINING', { computeAuthorityRef: config.computeAuthorityRef, automaticTrainingRetries: 0 });
        await run(binary, args, { cwd: workspace, signal, logfile, timeoutMs: Math.max(1, deadline - Date.now()) });
        if (binary === 'ns-process-data') {
          if (sfmMaskPreparation) {
            const bytes = await fs.readFile(path.join(workspace, 'sfm-mask-application.json'));
            if (bytes.length > 1024 * 1024) throw new Error('MASK_SFM_RECEIPT_LIMIT');
            sfmMaskReceipt = verifySfmMaskReceipt(JSON.parse(bytes.toString('utf8')), sfmMaskPreparation);
          }
          const transformPath = path.join(workspace, '05_colmap_processed', 'transforms.json'), cameraBytes = await fs.readFile(transformPath);
          if (cameraBytes.length > 16 * 1024 * 1024) throw new Error('CAMERA_MANIFEST_LIMIT');
          const bound = bindRegisteredSplits(JSON.parse(cameraBytes.toString('utf8')), reservation);
          if (!bound.receipt.evaluable) throw new Error('HOLDOUT_CAMERAS_NOT_REGISTERED');
          splitReceipt = bound.receipt;
          const masked = bindMasksToTransforms(bound.transforms, lineage); maskReceipt = masked.receipt;
          if (maskReceipt.maskedRegisteredViews > 0) {
            const destination = path.join(workspace, '05_colmap_processed', 'masks'); await fs.mkdir(destination, { mode: 0o700 });
            for (const [index, record] of [...lineage].sort((a, b) => a.filename.localeCompare(b.filename, 'en')).entries()) {
              if (record.mask) await fs.copyFile(path.join(sourceMasks, record.filename.replace(/\.(png|jpg)$/, '.png')),
                path.join(destination, `frame_${String(index + 1).padStart(5, '0')}.png`), constants.COPYFILE_EXCL);
            }
          }
          await fs.writeFile(transformPath, JSON.stringify(masked.transforms), { mode: 0o600 });
          await stage(request.jobId, 'POSE_SOLVED', { registeredTrainingViews: splitReceipt.registeredTrainingViews,
            registeredValidationViews: splitReceipt.registeredValidationViews, registeredHoldoutViews: splitReceipt.registeredHoldoutViews,
            reservationSha256: reservation.reservationSha256 });
        }
        if (binary === 'ns-train') splitReceipt.sparseSeedUsesHeldoutImages = false;
      }
      const configurations = await filesNamed(path.join(workspace, '06_training'), 'config.yml');
      if (configurations.length !== 1) throw new Error('TRAINED_CONFIGURATION_AMBIGUOUS');
      const metricsPath = path.join(workspace, 'heldout-metrics.json');
      await sourceCheck(request, signal);
      await run('ns-eval', ['--load-config', configurations[0], '--output-path', metricsPath],
        { cwd: workspace, signal, logfile, timeoutMs: Math.max(1, deadline - Date.now()) });
      const metricBytes = await fs.readFile(metricsPath);
      if (metricBytes.length > 1024 * 1024) throw new Error('HOLDOUT_METRIC_LIMIT');
      const holdout = readHoldoutMetrics(JSON.parse(metricBytes.toString('utf8')), splitReceipt);
      const archiveDir = path.join(workspace, '07_archival');
      await sourceCheck(request, signal);
      await run('ns-export', ['gaussian-splat', '--load-config', configurations[0], '--output-dir', archiveDir], { cwd: workspace, signal, logfile, timeoutMs: Math.max(1, deadline - Date.now()) });
      const archiveFiles = (await fs.readdir(archiveDir)).filter((name) => name.endsWith('.ply'));
      if (archiveFiles.length !== 1) throw new Error('GAUSSIAN_EXPORT_AMBIGUOUS');
      const archivePath = path.join(archiveDir, archiveFiles[0]), archiveStat = await fs.stat(archivePath);
      if (archiveStat.size > 512 * 1024 * 1024) throw new Error('GAUSSIAN_SIZE_LIMIT');
      const archival = await fs.readFile(archivePath), packaged = packageGaussian(archival), collision = conservativeCollisionGlb(packaged.bounds);
      const transformsBytes = await fs.readFile(path.join(workspace, '05_colmap_processed', 'transforms.json'));
      if (transformsBytes.length > 16 * 1024 * 1024) throw new Error('CAMERA_MANIFEST_LIMIT');
      const transforms = JSON.parse(transformsBytes.toString('utf8'));
      if (!Array.isArray(transforms.frames) || transforms.frames.length < 3 || transforms.frames.length > count) throw new Error('CAMERA_SOLVE_INVALID');
      await stage(request.jobId, 'RECONSTRUCTED', { archivalSha256: sha(archival), cameraManifestSha256: sha(transformsBytes) });
      await sourceCheck(request, signal);
      const retainedEvidence = await archiveReconstructionEvidence({ workspace, configurationPath: configurations[0],
        transformsPath: path.join(workspace, '05_colmap_processed', 'transforms.json'), logfile, artifactRoot, jobKey,
        binding: { sourceManifestSha256, engineSourceSha: config.sourceSha, spatialAuthorityHead: request.spatialAuthorityHead,
          requestDigest: digest, componentEnvelopeSha256: config.componentEnvelopeSha256 } });
      const completedAt = new Date().toISOString(), binding = { engineSourceSha: config.sourceSha, runtimeRevision: config.runtimeRevision,
        spatialAuthorityHead: request.spatialAuthorityHead, componentEnvelopeSha256: config.componentEnvelopeSha256, requestDigest: digest,
        sourceManifestSha256, publicReleaseAuthorized: false, candidateAcceptance: false };
      const receipts = {
        camera: { schemaVersion: 'urai-camera-solve-v1', ...binding, registeredImages: transforms.frames.length, totalInputImages: count, transformsSha256: sha(transformsBytes), metricScaleVerified: false, frameLineage: lineage },
        training: { schemaVersion: 'urai-reconstruction-training-v1', ...binding, computeAuthorityRef: config.computeAuthorityRef, method: 'splatfacto', iterations: config.iterations || 30000,
          computeAdmission: (await readState(request.jobId)).computeAdmission, actualCostUsd: null, actualCostReceiptAvailable: false,
          configurationSha256: sha(await fs.readFile(configurations[0])), archivalEvidence: { ref: retainedEvidence.ref, sha256: retainedEvidence.sha256, byteSize: retainedEvidence.byteSize },
          checkpointAvailable: retainedEvidence.manifest.checkpointAvailable, resumeAutomaticallyAuthorized: false,
          holdoutReservation: reservation, splitReceipt, holdoutMetrics: holdout, maskReceipt, sfmMaskReceipt,
          startedAt, completedAt, sourceBytes: total, gaussianRecords: packaged.records },
        comparison: { schemaVersion: 'urai-source-reconstruction-review-v1', ...binding, machineCameraCoverage: transforms.frames.length / count,
          sourceVsReconstructionReviewed: false, literalReviewState: 'unreviewed', heldOutViewCount: holdout.heldOutViewCount, holdoutMetrics: holdout,
          metricScaleVerified: false, collisionPolicy: 'BLOCKS_VISUAL_ENVELOPE', navigationAccepted: false,
          mobileCertified: false, xrCertified: false, identityAccepted: false, archivalSha256: sha(archival), runtimeSha256: sha(packaged.runtime), collisionSha256: sha(collision) },
      };
      await sourceCheck(request, signal); if (signal.aborted) throw new Error('RECONSTRUCTION_CANCELLED');
      await fs.mkdir(artifactRoot, { recursive: true, mode: 0o700 });
      async function storeArtifact(bytes) {
        const hash = sha(bytes); await fs.writeFile(path.join(artifactRoot, hash), bytes, { mode: 0o600, flag: 'wx' });
        return { ref: `cr-artifact:${jobKey}:${hash}`, sha256: hash, byteSize: bytes.length };
      }
      output = { archival: await storeArtifact(archival), runtime: await storeArtifact(packaged.runtime), collision: await storeArtifact(collision),
        cameraSolveReceiptRef: (await storeArtifact(Buffer.from(JSON.stringify(receipts.camera)))).ref,
        trainingReceiptRef: (await storeArtifact(Buffer.from(JSON.stringify(receipts.training)))).ref,
        sourceVsReconstructionReceiptRef: (await storeArtifact(Buffer.from(JSON.stringify(receipts.comparison)))).ref };
      await stage(request.jobId, 'RUNTIME_PACKAGED', { runtimeSha256: output.runtime.sha256, collisionSha256: output.collision.sha256 });
      await stage(request.jobId, 'QA', { literalReviewCompleted: false, navigationAccepted: false, privateAccepted: false });
      await sourceCheck(request, signal);
      await persist(request.jobId, { digest, status: 'CALLBACK_PENDING', request, output }); callbackPrepared = true;
      await callback(request, { jobId: request.jobId, status: 'success', result: output });
      await persist(request.jobId, { digest, status: 'SUCCESS', request, output });
    } catch {
      failure = true;
      // Once success callback transport begins, delivery may be ambiguous. Keep
      // private output for idempotent callback recovery; never retrain the job.
      const deleted = (await readState(request.jobId))?.status === 'DELETED';
      if (!callbackPrepared || deleted) {
        await fs.rm(artifactRoot, { recursive: true, force: true });
        if (!deleted) {
          await callback(request, { jobId: request.jobId, status: 'failed' }).catch(() => {});
          await persist(request.jobId, { digest, status: 'FAILED', request, failureCode: signal.aborted ? 'CANCELLED_OR_REVOKED' : 'RECONSTRUCTION_FAILED' });
        }
      }
    } finally {
      clearInterval(monitor); clearTimeout(watchdog);
      await exclusive(request.jobId, async () => {
        if ((await readState(request.jobId))?.status === 'DELETED') await fs.rm(artifactRoot, { recursive: true, force: true });
        await fs.rm(workspace, { recursive: true, force: true }); active.delete(request.jobId);
      });
    }
    return { success: !failure, output };
  }
  async function submit(body) {
    const request = validateRequest(body, config.callbackOrigin, config.local);
    if (request.spatialAuthorityHead !== config.spatialAuthorityHead) throw new Error('SPATIAL_AUTHORITY_MISMATCH');
    const digest = sha(Buffer.from(JSON.stringify(request)));
    const pending = admissions.get(request.jobId);
    if (pending) {
      if (pending.digest !== digest) return { status: 409, body: { accepted: false, idempotent: true, status: 'ADMISSION_PENDING' } };
      const result = await pending.promise;
      return { ...result, body: { ...result.body, idempotent: true } };
    }
    const admission = { digest };
    admission.promise = admit(request, digest).finally(() => { if (admissions.get(request.jobId) === admission) admissions.delete(request.jobId); });
    admissions.set(request.jobId, admission);
    return admission.promise;
  }
  async function admit(request, digest) {
    const controller = new AbortController(); let launched = false;
    const deletedResult = () => ({ status: 409, body: { accepted: false, idempotent: true, status: 'DELETED' } });
    const existingResult = await exclusive(request.jobId, async () => {
      const existing = await readState(request.jobId);
      if (existing) {
        const replayable = existing.digest === digest && ['RUNNING', 'CALLBACK_PENDING', 'SUCCESS'].includes(existing.status);
        return { status: replayable ? 202 : 409, body: { accepted: replayable, idempotent: true, status: existing.status } };
      }
      // Reservation is synchronous after the state read. Other jobs cannot
      // pass the compute ceiling while readiness/source authority is pending.
      if (active.size) return { status: 429, body: { accepted: false, code: 'BOUNDED_COMPUTE_BUSY' } };
      active.set(request.jobId, controller); return null;
    });
    if (existingResult) return existingResult;
    try {
      const computeAdmission = computeBudget(config, { jobId: request.jobId, requestDigest: digest });
      ready = await checkRuntime(config);
      if ((await readState(request.jobId))?.status === 'DELETED') return deletedResult();
      if (controller.signal.aborted) return { status: 409, body: { accepted: false, code: 'ADMISSION_CANCELLED' } };
      if (!ready.ok) return { status: 503, body: { accepted: false, code: 'ENGINE_NOT_READY', checks: ready.checks } };
      await sourceCheck(request, controller.signal);
      return await exclusive(request.jobId, async () => {
        if ((await readState(request.jobId))?.status === 'DELETED') return deletedResult();
        if (controller.signal.aborted) return { status: 409, body: { accepted: false, code: 'ADMISSION_CANCELLED' } };
        await writeState(request.jobId, { digest, status: 'RUNNING', request, callbackAttempts: 0, computeAdmission,
          pipeline: { schemaVersion: 'urai-private-place-execution-v1', requestDigest: digest, engineSourceSha: config.sourceSha,
            privateAcceptance: false, publicReleaseAuthorized: false, events: [{ stage: 'RECEIVED', recordedAt: new Date().toISOString() },
              { stage: 'AUTHORIZED', recordedAt: new Date().toISOString() }] } });
        launched = true; const completion = perform(request, digest, controller);
        // Infrastructure failures retain no callback/source details publicly.
        completion.catch(() => { controller.abort(); active.delete(request.jobId); });
        return { status: 202, body: { accepted: true, jobId: request.jobId }, completion };
      });
    } catch (error) {
      if ((await readState(request.jobId))?.status === 'DELETED') return deletedResult();
      throw error;
    } finally { if (!launched && active.get(request.jobId) === controller) active.delete(request.jobId); }
  }
  async function cancel(jobId) { if (!HANDLE.test(String(jobId))) throw new Error('JOB_ID_INVALID'); active.get(jobId)?.abort(); }
  async function deleteJob(jobId) {
    if (!HANDLE.test(String(jobId))) throw new Error('JOB_ID_INVALID');
    return exclusive(jobId, async () => {
      const state = await readState(jobId);
      // Tombstone even an unknown/preadmission identity before acknowledging or
      // aborting. All admission, state, callback and delivery paths share this
      // fence, so a delayed authority check cannot resurrect deleted output.
      await writeState(jobId, { ...(state?.digest ? { digest: state.digest } : {}), status: 'DELETED' });
      active.get(jobId)?.abort();
      for (const delivery of deliveries.get(jobId) || []) delivery.abort();
      if (active.has(jobId)) return { status: 409, body: { ok: false, code: 'CANCEL_PENDING' } };
      await fs.rm(path.join(root, 'artifacts', key(jobId)), { recursive: true, force: true });
      await fs.rm(path.join(root, 'work', key(jobId)), { recursive: true, force: true });
      if (deliveries.get(jobId)?.size) return { status: 409, body: { ok: false, code: 'DELIVERY_CANCEL_PENDING' } };
      return { status: 200, body: { ok: true, artifactsDeleted: true } };
    });
  }
  async function initialize() {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    await fs.mkdir(path.join(root, 'state'), { recursive: true, mode: 0o700 });
    // A restart cannot silently replay paid training or retain abandoned sources.
    for (const name of await fs.readdir(path.join(root, 'state'))) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const entry = JSON.parse(await fs.readFile(path.join(root, 'state', name), 'utf8'));
      if (entry.status === 'RUNNING') {
        const jobKey = key(entry.request.jobId), workspace = path.join(root, 'work', jobKey), artifactRoot = path.join(root, 'artifacts', jobKey);
        // Recover only existing checkpoints under fresh source authority. A
        // restart never starts paid commands or substitutes a new consent grant.
        try {
          await sourceCheck(entry.request);
          const configurations = await filesNamed(path.join(workspace, '06_training'), 'config.yml');
          if (configurations.length !== 1) throw new Error('RECOVERY_CONFIGURATION_AMBIGUOUS');
          const evidence = await archiveReconstructionEvidence({ workspace, configurationPath: configurations[0],
            transformsPath: path.join(workspace, '05_colmap_processed', 'transforms.json'), logfile: path.join(workspace, 'private-command.log'), artifactRoot, jobKey,
            binding: { requestDigest: entry.digest, engineSourceSha: config.sourceSha, spatialAuthorityHead: entry.request.spatialAuthorityHead,
              componentEnvelopeSha256: config.componentEnvelopeSha256 } });
          await sourceCheck(entry.request);
          entry.recoveryEvidence = { ref: evidence.ref, sha256: evidence.sha256, byteSize: evidence.byteSize, requestDigest: entry.digest,
            engineSourceSha: config.sourceSha, newGovernedAttemptRequired: true, automaticallyResumed: false };
        } catch { delete entry.recoveryEvidence; await fs.rm(artifactRoot, { recursive: true, force: true }); }
        await fs.rm(workspace, { recursive: true, force: true });
        entry.status = 'FAILED'; entry.failureCode = 'INTERRUPTED_REQUIRES_NEW_GOVERNED_ATTEMPT'; await persist(entry.request.jobId, entry);
        await callback(entry.request, { jobId: entry.request.jobId, status: 'failed' }).catch(() => {}); }
    }
  }
  const server = http.createServer(async (req, res) => {
    if (!authorized(req, config.token)) return send(res, 401, { ok: false, code: 'UNAUTHORIZED' });
    try {
      if (req.method === 'GET' && req.url === '/readyz') { ready = await checkRuntime(config); return send(res, ready.ok ? 200 : 503, ready); }
      if (req.method !== 'POST') return send(res, 404, { ok: false, code: 'NOT_FOUND' });
      const body = await readBody(req);
      if (req.url === '/reconstruct') { const result = await submit(body); return send(res, result.status, result.body); }
      if (req.url === '/cancel') { await cancel(body.jobId); return send(res, 202, { accepted: true }); }
      if (req.url === '/retry-callback') {
        if (!HANDLE.test(String(body.jobId || ''))) throw new Error('JOB_ID_INVALID');
        return await exclusive(body.jobId, async () => {
          const state = await readState(body.jobId);
          if (state?.status !== 'CALLBACK_PENDING') throw new Error('CALLBACK_NOT_PENDING');
          if ((state.callbackAttempts || 0) >= maxCallbackAttempts) throw new Error('CALLBACK_RETRY_BUDGET_EXHAUSTED');
          await sourceCheck(state.request);
          state.callbackAttempts = (state.callbackAttempts || 0) + 1;
          await writeState(body.jobId, state);
          await deliverCallback(state.request, { jobId: body.jobId, status: 'success', result: state.output });
          state.status = 'SUCCESS'; await writeState(body.jobId, state); return send(res, 200, { ok: true });
        });
      }
      if (req.url === '/delete') {
        const result = await deleteJob(body.jobId); return send(res, result.status, result.body);
      }
      if (req.url === '/artifact') {
        if (!HANDLE.test(String(body.jobId || ''))) throw new Error('JOB_ID_INVALID');
        const admitted = await exclusive(body.jobId, async () => {
          const state = await readState(body.jobId), match = /^cr-artifact:([a-f0-9]{64}):([a-f0-9]{64})$/.exec(String(body.ref));
          if (state?.status !== 'SUCCESS' || !match || match[1] !== key(body.jobId)) throw new Error('ARTIFACT_DENIED');
          await sourceCheck(state.request);
          return { request: state.request, filename: path.join(root, 'artifacts', match[1], match[2]), sha256: match[2] };
        });
        const controller = new AbortController(), set = deliveries.get(body.jobId) || new Set();
        set.add(controller); deliveries.set(body.jobId, set);
        const abort = () => controller.abort(); res.once('close', abort);
        controller.signal.addEventListener('abort', () => res.destroy(), { once: true });
        let file;
        try {
          file = await fs.open(admitted.filename, constants.O_RDONLY | constants.O_NOFOLLOW);
          const fixity = await hashOpenFile(file, 2 * 1024 ** 3);
          if (fixity.sha256 !== admitted.sha256) throw new Error('ARTIFACT_FIXITY_MISMATCH');
          const immutableStat = fixity.identity;
          async function requireImmutableFile() {
            const current = await file.stat({ bigint: true }), target = await fs.stat(admitted.filename, { bigint: true });
            if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some((field) => current[field] !== immutableStat[field])
              || target.dev !== immutableStat.dev || target.ino !== immutableStat.ino) throw new Error('ARTIFACT_CHANGED_DURING_DELIVERY');
          }
          const stream = file.createReadStream({ autoClose: false, highWaterMark: 64 * 1024, start: 0 });
          for await (const bytes of stream) {
            if (controller.signal.aborted || (await readState(body.jobId))?.status !== 'SUCCESS') throw new Error('ARTIFACT_DELETED');
            await sourceCheck(admitted.request, controller.signal);
            await requireImmutableFile();
            if (controller.signal.aborted || (await readState(body.jobId))?.status !== 'SUCCESS') throw new Error('ARTIFACT_DELETED');
            if (!res.headersSent) res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'content-length': fixity.byteSize });
            if (!res.write(bytes)) await once(res, 'drain', { signal: controller.signal });
          }
          await sourceCheck(admitted.request, controller.signal);
          await requireImmutableFile();
          if (controller.signal.aborted || (await readState(body.jobId))?.status !== 'SUCCESS') throw new Error('ARTIFACT_DELETED');
          res.end();
        } catch {
          if (res.headersSent || controller.signal.aborted) res.destroy();
          else send(res, 403, { ok: false, code: 'PRIVATE_RECONSTRUCTION_REJECTED' });
        } finally {
          await file?.close(); res.removeListener('close', abort); set.delete(controller);
          if (!set.size) deliveries.delete(body.jobId);
        }
        return;
      }
      send(res, 404, { ok: false, code: 'NOT_FOUND' });
    } catch { send(res, 403, { ok: false, code: 'PRIVATE_RECONSTRUCTION_REJECTED' }); }
  });
  server.requestTimeout = 30000;
  return { server, initialize, submit, cancel, active, perform };
}
if (require.main === module) {
  const config = { token: process.env.CAPTURED_REALITY_ENGINE_TOKEN, sourceSha: process.env.URAI_SOURCE_SHA, runtimeRevision: process.env.K_REVISION,
    resolverUrl: String(process.env.CAPTURED_REALITY_RESOLVER_URL || '').replace(/\/$/, ''), resolverToken: process.env.CAPTURED_REALITY_RESOLVER_TOKEN,
    callbackOrigin: process.env.CAPTURED_REALITY_CALLBACK_ORIGIN, storageRoot: process.env.CAPTURED_REALITY_ENGINE_PRIVATE_ROOT,
    spatialAuthorityHead: process.env.CAPTURED_REALITY_SPATIAL_AUTHORITY_HEAD, componentEnvelopeSha256: process.env.CAPTURED_REALITY_COMPONENT_ENVELOPE_SHA256,
    enabled: process.env.CAPTURED_REALITY_COMPUTE_ENABLED === 'true', computeAuthorityRef: process.env.CAPTURED_REALITY_COMPUTE_AUTHORITY_REF,
    local: ['local', 'test'].includes(process.env.URAI_ENV || ''), iterations: Number(process.env.CAPTURED_REALITY_MAX_ITERATIONS || 30000),
    computeBudgetReceipt: process.env.CAPTURED_REALITY_COMPUTE_BUDGET_RECEIPT_JSON ? JSON.parse(process.env.CAPTURED_REALITY_COMPUTE_BUDGET_RECEIPT_JSON) : undefined };
  const engine = createEngine(config); engine.initialize().then(() => engine.server.listen(Number(process.env.PORT || 8082), process.env.HOST || '127.0.0.1'))
    .catch(() => { process.stderr.write('PRIVATE_ENGINE_START_FAILED\n'); process.exitCode = 1; });
}
module.exports = { createEngine, validateRequest, commandPlan, runtimeReadiness, computeBudget, acceptedSourceManifestSha256, command };
