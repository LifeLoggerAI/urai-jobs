import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertSafeWorkerDeployment } from './studio-worker-deploy-veto.mjs';

const script = fileURLToPath(new URL('./studio-worker-deploy-veto.mjs', import.meta.url));
const execWith = (value, extra = {}) => spawnSync(process.execPath, [script], {
  encoding: 'utf8',
  env: { ...process.env, WORKERS_CSV: value, ...extra },
});

test('studio is denied as the only selection', () => {
  assert.throws(() => assertSafeWorkerDeployment('studio-worker'), /STUDIO_WORKER_DEPLOY_HARD_OFF/);
});

test('studio is denied with other workers, regardless of position', () => {
  const examples = [
    'narrator-worker,studio-worker',
    'studio-worker,asset-worker',
    'asset-worker,studio-worker,narrator-worker',
    ' studio-worker ',
    'asset-worker, studio-worker ',
    'asset-worker,\n studio-worker\t',
  ];
  for (const value of examples) {
    assert.throws(() => assertSafeWorkerDeployment(value), /STUDIO_WORKER_DEPLOY_HARD_OFF/, value);
  }
});

test('studio denial is unaffected by environment overrides', () => {
  const output = execWith('studio-worker', {
    URAI_STUDIO_STORAGE_IAM_VERIFIED: 'true',
    URAI_STUDIO_ALLOW_UPLOADS: 'true',
    URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED: 'true',
    GENESIS_RELEASE_APPROVAL: 'APPROVED',
    URAI_ENV: 'test',
  });
  assert.equal(output.status, 1);
  assert.match(output.stderr, /STUDIO_WORKER_DEPLOY_HARD_OFF/);
  assert.doesNotMatch(output.stderr, /APPROVED/);
});

test('all currently allowed non-Studio worker names remain eligible', () => {
  const inputs = [
    'narrator-worker', 'asset-worker',
    'private-source-worker', 'captured-reality-worker',
    'narrator-worker,asset-worker',
    'private-source-worker,captured-reality-worker',
  ];
  for (const value of inputs) {
    assert.deepEqual(assertSafeWorkerDeployment(value), value.split(','));
    assert.equal(execWith(value).status, 0);
  }
});

test('no empty, repeated or unrecognized worker selection is accepted', () => {
  for (const value of [
    '', ' ', 'studio-worker,', ',studio-worker',
    'asset-worker,', ',narrator-worker',
    'asset-worker,asset-worker', 'studio-worker,studio-worker',
    'STUDIO-WORKER', 'other-worker', 'narrator-worker,unapproved-worker',
  ]) {
    assert.throws(() => assertSafeWorkerDeployment(value), /WORKER_SELECTION_UNVERIFIED/);
    assert.equal(execWith(value).status, 1);
  }
});

test('missing selection fails closed', () => {
  assert.throws(() => assertSafeWorkerDeployment(undefined), /WORKER_SELECTION_UNVERIFIED/);
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'WORKERS_CSV')),
  });
  assert.equal(result.status, 1);
});

test('the denial code cannot be switched on through environment flags', () => {
  const src = readFileSync(script, 'utf8');
  assert.match(src, /throw new Error\(DENIED\)/);
  assert.doesNotMatch(src, /ALLOW_STUDIO|BYPASS_STUDIO|process\.env\.URAI_STUDIO/);
  assert.match(src, /No environment variable, bearer token or caller-supplied approval/);
});
