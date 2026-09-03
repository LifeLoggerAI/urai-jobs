import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const build = spawnSync('npm', ['run', 'build', '--prefix', 'functions'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const module = await import('../functions/lib/functions/release/releaseSequenceApi.js');
const plan = module.buildReleaseSequencePlan({
  versions: ['v1'],
  requestedThrough: 'world-spec',
  evidence: { 'v1.world-spec': true },
});

assert.equal(plan.versions[0].stages[0].status, 'READY');
assert.equal(plan.versions[0].stages[1].status, 'BLOCKED');
assert.equal(plan.versions[0].nextAction, 'audit');
console.log('PASS release plan ordering smoke');
