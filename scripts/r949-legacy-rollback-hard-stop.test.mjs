import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/rollback-on-smoke-failure.yml', import.meta.url), 'utf8');
const lines = workflow.split(/\r?\n/);
const runLine = lines.findIndex((line) => /^\s{8}run: \|\s*$/.test(line));
if (runLine < 0) throw new Error('legacy rollback hard-stop step missing');
const commands = lines.slice(runLine + 1).filter((line) => line.trim()).map((line) => {
  if (!/^\s{10}/.test(line)) throw new Error('unexpected YAML command indentation');
  return line.slice(10);
}).join('\n');

test('legacy rollback still requires explicit manual dispatch', () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:|^\s+schedule:|^\s+pull_request:/m);
});

test('legacy rollback contains no checkout or mutation path', () => {
  assert.doesNotMatch(workflow, /\buses:\s*actions\/checkout/);
  assert.doesNotMatch(commands, /\b(gcloud|firebase|curl|wget|git|npm|pnpm)\b/);
  assert.match(commands, /\bexit 1\b/);
});

test('legacy rollback refuses success and reports safe next action', () => {
  const result = spawnSync('bash', ['-c', commands], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /\[BLOCKED\].*does not restore a revision/);
  assert.match(result.stderr, /independently approved Cloud Run rollback/);
  assert.match(result.stderr, /Production release remains HOLD/);
});

test('canonical deploy workflow remains separate from deprecated rollback', () => {
  const canonical = readFileSync(new URL('../.github/workflows/urai-jobs-production-deploy.yml', import.meta.url), 'utf8');
  assert.match(canonical, /^name: URAI Jobs Canonical Production Deploy/m);
  assert.match(canonical, /scripts\/verify-rollback-revision\.mjs/);
  assert.doesNotMatch(workflow, /scripts\/deploy-workers|scripts\/deploy-firebase|services update-traffic/);
});
