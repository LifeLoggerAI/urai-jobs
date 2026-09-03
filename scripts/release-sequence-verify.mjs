import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const plan = fs.readFileSync('functions/src/release/releaseSequencePlan.ts', 'utf8');
const api = fs.readFileSync('functions/src/release/releaseSequenceApi.ts', 'utf8');
const required = [
  "'v1'", "'v2'", "'v3'", "'v4'", "'v5'",
  "'audit'", "'world-spec'", "'asset-inventory'", "'forge-models'",
  "'integrate'", "'verify-web'", "'verify-device'", "'promote'",
  "mode: 'plan-only'", 'readyForExecution: false',
  "repository: 'LifeLoggerAI/asset-factory'",
  "path: 'image_asset_generator/canonical_version_catalog.json'",
  "label: 'URAI V1 — Genesis Public Route World'",
  "label: 'URAI V2 — Living System States'",
  "label: 'URAI V3 — Relationship, Shadow and Pattern World'",
  "label: 'URAI V4 — WebXR, AR and VR Pathway'",
  "label: 'URAI V5 — Mirror of Becoming and Autonomous Legacy'",
  'expectedOutputs: 53',
  'expectedOutputs: 80',
  'expectedOutputs: 14',
  'expectedOutputs: 39',
  'expectedOutputs: 27',
  "assetPrefix: 'assets/urai/v3'",
  "assetPrefix: 'assets/urai/xr'",
  "evidence: (v) => v === 'v4'",
  "'v4.quest-device-run'",
  'paidForgeRequiresExplicitAuthority: true',
];

for (const token of required) {
  if (!plan.includes(token)) {
    console.error(`Release sequence verifier missing token: ${token}`);
    process.exit(1);
  }
}

for (const forbidden of [
  "evidence: (v) => v === 'v3'",
  "'v3.quest-device-run'",
  "v3: 'Spatial/XR movement",
]) {
  if (plan.includes(forbidden)) {
    console.error(`Release sequence verifier found obsolete version mapping: ${forbidden}`);
    process.exit(1);
  }
}

for (const token of ['z.input<typeof ReleasePlanRequestSchema>', 'input: ReleasePlanInput = {}', 'ReleasePlanRequestSchema.parse(input)']) {
  if (!api.includes(token)) {
    console.error(`Release sequence API verifier missing token: ${token}`);
    process.exit(1);
  }
}

const runtime = spawnSync(process.execPath, ['scripts/release-plan-smoke.mjs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (runtime.status !== 0) process.exit(runtime.status ?? 1);

console.log('PASS canonical release sequence verifier');
