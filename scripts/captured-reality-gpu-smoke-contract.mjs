import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { preparePlan, validatePlan, validateDispatch, executeSmoke, NODE_BASE_IMAGE, NERFSTUDIO_BASE_IMAGE } from './captured-reality-gpu-smoke.mjs';
const now = Date.parse('2026-10-08T12:00:00Z');
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('auth-free preparation must not request network'); };
let plan;
try {
  plan = await preparePlan({ sourceSha: 'a'.repeat(40), spatialAuthorityHead: 'b'.repeat(40) });
  await validatePlan(plan);
} finally { globalThis.fetch = originalFetch; }
assert.equal(plan.paidDispatch, false); assert.equal(plan.gpuExecuted, false);
assert.equal(plan.familySourceIncluded, false); assert.ok(!JSON.stringify(plan).includes('API_KEY'));
const image = `sha256:${'c'.repeat(64)}`;
const receipt = { schemaVersion: 'urai-prepaid-reconstruction-admission-v1', provider: 'runpod',
  operation: 'captured-reality.gaussian-reconstruction', suboperation: 'synthetic-gpu-kernel-smoke',
  jobId: plan.jobId, requestDigest: plan.requestDigest, sourceManifestSha256: plan.sourceManifestSha256,
  authorityRef: 'fixture_authority_01', budgetSourceRef: 'fixture_budget_01', prepaidVerified: true,
  newCardChargeAuthorized: false, maxAutomaticRetries: 0, estimatedCostUsd: 0.20, prepaidAvailableUsd: 1,
  maxRunMs: 180000, verifiedAt: new Date(now).toISOString(), syntheticDiagnostic: true, familySourceIncluded: false,
  externalTerminationBindingVerified: true, billingCapReadiness: true, providerMaximumRunMs: 720000, engineSourceSha: plan.engineSourceSha,
  spatialAuthorityHead: plan.spatialAuthorityHead, providerJobId: 'fixturepod01', terminationAuthorityRef: 'fixture_lease_01',
  registryImageDigest: image, nodeBaseImage: NODE_BASE_IMAGE, nerfstudioBaseImage: NERFSTUDIO_BASE_IMAGE,
  quotedGpuHourlyUsd: 0.59, maximumStorageAndOtherUsd: 0.001, costBoundIncludesStartup: true,
  providerMode: 'POD', cloudType: 'SECURE', providerCredentialScope: 'RUNPOD_READ_WRITE', providerCredentialPerPodScoped: false,
  localTerminationPolicy: { allowedPodId: 'fixturepod01', allowedActions: ['READ_POD', 'TERMINATE_POD'], allowCreate: false } };
assert.equal(validateDispatch(plan, receipt, image, now).provider, 'runpod');
assert.throws(() => validateDispatch(plan, { ...receipt, registryImageDigest: 'c'.repeat(64) }, 'c'.repeat(64), now), /IMAGE_OR_PROVIDER/);
for (const change of [{ estimatedCostUsd: 1.01 }, { estimatedCostUsd: 0.1 }, { prepaidAvailableUsd: 0.19 },
  { externalTerminationBindingVerified: false }, { providerMaximumRunMs: 720001 }, { maxAutomaticRetries: 1 },
  { newCardChargeAuthorized: true }, { sourceManifestSha256: 'e'.repeat(64) }, { requestDigest: 'd'.repeat(64) },
  { verifiedAt: new Date(now - 900001).toISOString() }, { localTerminationPolicy: { ...receipt.localTerminationPolicy, allowedPodId: 'otherpod01' } },
  { localTerminationPolicy: { ...receipt.localTerminationPolicy, allowCreate: true } }, { providerCredentialPerPodScoped: true },
  { registryImageDigest: `sha256:${'f'.repeat(64)}` }, { cloudType: 'COMMUNITY' }]) {
  assert.throws(() => validateDispatch(plan, { ...receipt, ...change }, image, now));
}
await assert.rejects(validatePlan({ ...plan, familySourceIncluded: true }));
await assert.rejects(validatePlan({ ...plan, requestDigest: 'f'.repeat(64) }));
const repeated = await fs.mkdtemp(path.join(os.tmpdir(), 'urai-synthetic-smoke-attempt-'));
try {
  await fs.writeFile(path.join(repeated, 'synthetic-attempt.json'), JSON.stringify({ classification: 'SYNTHETIC_CONTROL_FIXTURE' }));
  await assert.rejects(executeSmoke(plan, { ...receipt, verifiedAt: new Date().toISOString() }, { output: repeated, imageDigest: image }), /PRIOR_ATTEMPT/);
} finally { await fs.rm(repeated, { recursive: true, force: true }); }
process.stdout.write('[PASS] auth-free exact-source preparation plus19 synthetic price/cap/retry/source/image/scope/replay denials; no provider, GPU or spending authority claimed\n');
