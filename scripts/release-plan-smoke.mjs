import './release-plan-ordering-smoke.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const build = spawnSync('npm', ['run', 'build', '--prefix', 'functions'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const module = await import('../functions/lib/functions/release/releaseSequenceApi.js');
const plan = module.buildReleaseSequencePlan({ requestedThrough: 'verify-device' });
assert.equal(plan.schemaVersion, 2);
assert.deepEqual(plan.versions.map((item) => item.version), ['v1', 'v2', 'v3', 'v4', 'v5']);
assert.deepEqual(
  plan.versions.map((item) => item.assetContract.expectedOutputs),
  [53, 80, 14, 39, 27],
);
assert.deepEqual(
  plan.versions.map((item) => item.assetContract.assetPrefix),
  ['assets/urai', 'assets/urai/v2', 'assets/urai/v3', 'assets/urai/xr', 'assets/urai/v5'],
);
assert.match(plan.versions[2].label, /Relationship, Shadow and Pattern World/);
assert.match(plan.versions[3].label, /WebXR, AR and VR Pathway/);
assert.deepEqual(
  plan.versions[2].stages.find((stage) => stage.id === 'verify-device')?.requiredEvidence,
  ['v3.device-equivalent-or-waiver'],
);
assert.deepEqual(
  plan.versions[3].stages.find((stage) => stage.id === 'verify-device')?.requiredEvidence,
  ['v4.quest-device-run', 'v4.controller-or-hand-input', 'v4.comfort-review', 'v4.performance-receipt'],
);
assert.equal(plan.policy.paidForgeRequiresExplicitAuthority, true);
assert.equal(plan.assetVersionContractSource.repository, 'LifeLoggerAI/asset-factory');
assert.ok(plan.versions.every((item) => item.nextAction === 'audit'));
console.log('PASS canonical release plan smoke');
