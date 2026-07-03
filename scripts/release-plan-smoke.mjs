import './release-plan-ordering-smoke.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const build = spawnSync('npm', ['run', 'build', '--prefix', 'functions'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const module = await import('../functions/lib/functions/release/releaseSequenceApi.js');
const plan = module.buildReleaseSequencePlan();
assert.deepEqual(plan.versions.map((item) => item.version), ['v1', 'v2', 'v3', 'v4', 'v5']);
assert.ok(plan.versions.every((item) => item.nextAction === 'audit'));
console.log('PASS release plan smoke');
