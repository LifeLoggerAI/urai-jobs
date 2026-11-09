// Synthetic diagnostic only; reuse the current engine's spending and subprocess controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { computeBudget, command } = require('../workers/captured-reality-worker/reconstruction-engine.js');
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const SHA = /^[a-f0-9]{64}$/, HEAD = /^[a-f0-9]{40}$/;
export const NODE_BASE_IMAGE = 'node@sha256:efd0ab5780c2d9ab1f0f869571a00d5edb17793bff4cce4a2792e3eb0ffc7562';
export const NERFSTUDIO_BASE_IMAGE = 'ghcr.io/nerfstudio-project/nerfstudio@sha256:b59b8e1012d7a43679d3234b3de9c8416a4b8435fcbf21b9d8c4494b8563f19e';
const MEMBERS = ['scripts/captured-reality-gpu-smoke.mjs', 'workers/captured-reality-worker/synthetic-gpu-smoke.py',
  'workers/captured-reality-worker/synthetic-gpu-smoke.case.json', 'workers/captured-reality-worker/Dockerfile.engine',
  'workers/captured-reality-worker/inspect-engine-runtime.py', 'workers/captured-reality-worker/reconstruction-engine.js',
  'workers/captured-reality-worker/private-media-resolver.js', 'workers/captured-reality-worker/reconstruction-holdout.js',
  'workers/captured-reality-worker/reconstruction-masks.js', 'workers/captured-reality-worker/reconstruction-evidence.js',
  'workers/captured-reality-worker/gaussian-package.js'];
export async function preparePlan({ sourceSha, spatialAuthorityHead, root = repoRoot, maxEstimatedCostUsd = 0.25 }) {
  if (!HEAD.test(sourceSha || '') || !HEAD.test(spatialAuthorityHead || '')
      || !Number.isFinite(maxEstimatedCostUsd) || maxEstimatedCostUsd <= 0 || maxEstimatedCostUsd > 0.25) throw new Error('SMOKE_PREPARATION_INVALID');
  const files = [];
  for (const name of MEMBERS) {
    const bytes = await fs.readFile(path.join(root, name)); files.push({ path: name, sha256: sha(bytes), byteSize: bytes.length });
  }
  const plan = { schemaVersion: 'urai-synthetic-gpu-smoke-plan-v1', jobId: 'cr_synthetic_gpu_smoke_20261008_01',
    engineSourceSha: sourceSha, spatialAuthorityHead, syntheticDiagnostic: true, familySourceIncluded: false,
    nodeBaseImage: NODE_BASE_IMAGE, nerfstudioBaseImage: NERFSTUDIO_BASE_IMAGE,
    sourceManifestSha256: files.find(f => f.path.endsWith('.case.json')).sha256, files,
    maxAutomaticRetries: 0, commandMaxRunMs: 180000, providerMaximumRunMs: 720000,
    maxEstimatedCostUsd, gpuExecuted: false, containerBuilt: false, paidDispatch: false,
    externalTerminationBindingVerified: false, billingCapReadiness: false, providerEnforcedDeadlineVerified: false };
  plan.requestDigest = sha(Buffer.from(JSON.stringify(plan)));
  return plan;
}
export async function validatePlan(plan, root = repoRoot) {
  if (plan?.schemaVersion !== 'urai-synthetic-gpu-smoke-plan-v1' || plan.syntheticDiagnostic !== true
      || plan.familySourceIncluded !== false || plan.maxAutomaticRetries !== 0 || plan.commandMaxRunMs !== 180000
      || plan.providerMaximumRunMs !== 720000 || !HEAD.test(plan.engineSourceSha || '')
      || !HEAD.test(plan.spatialAuthorityHead || '') || !SHA.test(plan.sourceManifestSha256 || '')
      || !SHA.test(plan.requestDigest || '') || plan.nodeBaseImage !== NODE_BASE_IMAGE
      || plan.nerfstudioBaseImage !== NERFSTUDIO_BASE_IMAGE || !Number.isFinite(plan.maxEstimatedCostUsd)
      || plan.maxEstimatedCostUsd <= 0 || plan.maxEstimatedCostUsd > 0.25
      || !Array.isArray(plan.files) || plan.files.length !== MEMBERS.length
      || JSON.stringify(plan.files.map(f => f.path)) !== JSON.stringify(MEMBERS)) throw new Error('SMOKE_PLAN_INVALID');
  const { requestDigest, ...prepared } = plan;
  if (sha(Buffer.from(JSON.stringify(prepared))) !== requestDigest) throw new Error('SMOKE_REQUEST_DIGEST_MISMATCH');
  for (const entry of plan.files) {
    const bytes = await fs.readFile(path.join(root, entry.path));
    if (bytes.length !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error('SMOKE_PACKAGE_FIXITY_MISMATCH');
  }
}
export function validateDispatch(plan, receipt, observedImageDigest, now = Date.now()) {
  // No synthetic fixture approval is substituted for these actual coordinator observations.
  if (receipt?.syntheticDiagnostic !== true || receipt.suboperation !== 'synthetic-gpu-kernel-smoke'
      || receipt.familySourceIncluded !== false || receipt.externalTerminationBindingVerified !== true || receipt.billingCapReadiness !== true
      || receipt.providerMaximumRunMs !== plan.providerMaximumRunMs || receipt.engineSourceSha !== plan.engineSourceSha
      || receipt.spatialAuthorityHead !== plan.spatialAuthorityHead || receipt.provider !== 'runpod'
      || !/^[a-z0-9]{6,50}$/.test(receipt.providerJobId || '') || !receipt.terminationAuthorityRef
      || !/^sha256:[a-f0-9]{64}$/.test(observedImageDigest || '')
      || receipt.registryImageDigest !== observedImageDigest
      || receipt.nodeBaseImage !== plan.nodeBaseImage || receipt.nerfstudioBaseImage !== plan.nerfstudioBaseImage
      || !Number.isFinite(receipt.quotedGpuHourlyUsd) || receipt.quotedGpuHourlyUsd <= 0
      || !Number.isFinite(receipt.maximumStorageAndOtherUsd) || receipt.maximumStorageAndOtherUsd < 0
      || receipt.costBoundIncludesStartup !== true || receipt.estimatedCostUsd > plan.maxEstimatedCostUsd
      || receipt.estimatedCostUsd < receipt.quotedGpuHourlyUsd * plan.providerMaximumRunMs / 3600000 + receipt.maximumStorageAndOtherUsd) {
    throw new Error('SMOKE_PRICE_CAP_IMAGE_OR_PROVIDER_AUTHORITY_MISSING');
  }
  if (receipt.providerMode !== 'POD' || receipt.cloudType !== 'SECURE'
      || receipt.providerCredentialScope !== 'RUNPOD_READ_WRITE' || receipt.providerCredentialPerPodScoped !== false
      || receipt.localTerminationPolicy?.allowedPodId !== receipt.providerJobId
      || JSON.stringify(receipt.localTerminationPolicy?.allowedActions) !== JSON.stringify(['READ_POD', 'TERMINATE_POD'])
      || receipt.localTerminationPolicy?.allowCreate !== false) throw new Error('SMOKE_TERMINATION_CREDENTIAL_SCOPE_INVALID');
  return computeBudget({ computeAuthorityRef: receipt.authorityRef, computeBudgetReceipt: receipt, maxRunMs: plan.commandMaxRunMs },
    { jobId: plan.jobId, requestDigest: plan.requestDigest, sourceManifestSha256: plan.sourceManifestSha256 }, now);
}
export async function executeSmoke(plan, receipt, { root = repoRoot, output, imageDigest }) {
  await validatePlan(plan, root); validateDispatch(plan, receipt, imageDigest);
  if (!output) throw new Error('PRIVATE_SMOKE_OUTPUT_REQUIRED');
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  // A callback/reporting failure must never silently repeat paid CUDA work.
  await fs.writeFile(path.join(output, 'synthetic-attempt.json'), JSON.stringify({ jobId: plan.jobId,
    requestDigest: plan.requestDigest, sourceManifestSha256: plan.sourceManifestSha256,
    providerJobId: receipt.providerJobId, automaticRetries: 0 }) + '\n', { mode: 0o600, flag: 'wx' })
    .catch(error => { if (error.code === 'EEXIST') throw new Error('SMOKE_PRIOR_ATTEMPT_REQUIRES_PROVIDER_RECONCILIATION'); throw error; });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), plan.commandMaxRunMs);
  try {
    await command('python3', [path.join(root, 'workers/captured-reality-worker/synthetic-gpu-smoke.py'), '--case',
      path.join(root, 'workers/captured-reality-worker/synthetic-gpu-smoke.case.json'), '--output', output],
      { cwd: root, signal: controller.signal, logfile: path.join(output, 'gpu-smoke-command.log'), timeoutMs: plan.commandMaxRunMs });
  } finally { clearTimeout(timer); }
  const result = JSON.parse(await fs.readFile(path.join(output, 'synthetic-gpu-receipt.json')));
  if (result.gpuKernelExecuted !== true || result.familyReconstruction !== false || result.sourceCaseSha256 !== plan.sourceManifestSha256)
    throw new Error('SMOKE_RESULT_BINDING_INVALID');
  await fs.writeFile(path.join(output, 'execution-binding.json'), JSON.stringify({ jobId: plan.jobId,
    engineSourceSha: plan.engineSourceSha, spatialAuthorityHead: plan.spatialAuthorityHead,
    sourceManifestSha256: plan.sourceManifestSha256, requestDigest: plan.requestDigest,
    registryImageDigest: imageDigest, providerJobId: receipt.providerJobId,
    reservationSha256: sha(Buffer.from(JSON.stringify(receipt))), providerTerminationVerified: false,
    actualProviderCostUsd: null, familyReconstruction: false }, null, 2) + '\n', { mode: 0o600 });
  return { gpuSmokeExecuted: true, familyReconstruction: false, providerTerminationAndCostReadbackStillRequired: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--prepare') {
    const plan = await preparePlan({ sourceSha: process.argv[3], spatialAuthorityHead: process.argv[4] });
    await fs.writeFile(process.argv[5], JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
    process.stdout.write(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', requestDigest: plan.requestDigest, sourceManifestSha256: plan.sourceManifestSha256 }) + '\n');
  } else {
    const plan = JSON.parse(await fs.readFile(process.argv[3])); await validatePlan(plan);
    if (process.argv[2] === '--validate-only') process.stdout.write(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', gpuExecuted: false, paidDispatch: false }) + '\n');
    else if (process.argv[2] === '--run') {
      const receipt = JSON.parse(await fs.readFile(process.env.URAI_SMOKE_ADMISSION_PATH || ''));
      const result = await executeSmoke(plan, receipt, { output: process.env.URAI_SMOKE_OUTPUT, imageDigest: process.env.URAI_ENGINE_IMAGE_DIGEST });
      process.stdout.write(JSON.stringify(result) + '\n');
    } else throw new Error('SMOKE_EXPLICIT_OPERATION_REQUIRED');
  }
}
