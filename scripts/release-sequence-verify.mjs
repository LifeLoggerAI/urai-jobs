import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const plan = fs.readFileSync('functions/src/release/releaseSequencePlan.ts', 'utf8');
const api = fs.readFileSync('functions/src/release/releaseSequenceApi.ts', 'utf8');
const required = [
  "'v1'", "'v2'", "'v3'", "'v4'", "'v5'",
  "'audit'", "'world-spec'", "'asset-inventory'", "'forge-models'",
  "'integrate'", "'verify-web'", "'verify-device'", "'promote'",
  "mode: 'plan-only'", 'readyForExecution: false',
];

for (const token of required) {
  if (!plan.includes(token)) {
    console.error(`Release sequence verifier missing token: ${token}`);
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

console.log('PASS release sequence verifier');
