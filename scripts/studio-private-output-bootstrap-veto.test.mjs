/**
 * R525: review-only early Studio-deploy and broad Storage IAM bootstrap denial.
 * All tests are local, synthetic, and do not call any cloud provider.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = name => join(root, 'scripts', name);
const approved = script('deploy-workers-approved.sh');
const direct = script('deploy-workers.sh');
const bootstrap = script('bootstrap-managed-worker-iam.sh');
const source = name => readFileSync(script(name), 'utf8');
const run = (target, vars = {}) => spawnSync('bash', [target], {
  cwd: root, encoding: 'utf8', timeout: 15000,
  env: { ...process.env, ...vars },
});
function denied(result, code) {
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, new RegExp(code), result.stderr);
}

test('R525: both deploy paths deny Studio before secrets or rollback preflight', () => {
  for (const target of [approved, direct]) {
    const result = run(target, {
      URAI_JOBS_DEPLOY_WORKERS: 'studio-worker',
      DEPLOY_TARGET_SECRET_VERSIONS_JSON: '',
      GCLOUD_PROJECT: '', GITHUB_SHA: '', GITHUB_RUN_ID: '',
      DEPLOY_ROLLBACK_SHA: '',
    });
    denied(result, 'STUDIO_WORKER_DEPLOY_HARD_OFF');
    assert.doesNotMatch(result.stderr, /must contain the verified deployment source SHA|is required/);
  }
});

test('R525: Studio mixed selections cannot be disguised as non-Studio', () => {
  for (const target of [approved, direct]) {
    for (const workers of ['narrator-worker,studio-worker', 'studio-worker,asset-worker',
      'private-source-worker, studio-worker ', 'studio-worker,captured-reality-worker']) {
      denied(run(target, { URAI_JOBS_DEPLOY_WORKERS: workers }), 'STUDIO_WORKER_DEPLOY_HARD_OFF');
    }
  }
});

test('R525: environment-spoofed permissions cannot open either deploy path', () => {
  const overrides = {
    URAI_JOBS_DEPLOY_WORKERS: 'studio-worker',
    URAI_STUDIO_STORAGE_IAM_VERIFIED: 'true',
    URAI_STUDIO_ALLOW_UPLOADS: 'true',
    URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED: 'true',
    GENESIS_RELEASE_APPROVAL: 'APPROVED',
    URAI_ENV: 'production',
  };
  for (const target of [approved, direct]) {
    const result = run(target, overrides);
    denied(result, 'STUDIO_WORKER_DEPLOY_HARD_OFF');
    assert.doesNotMatch(result.stderr, /APPROVED/);
  }
});

test('R525: invalid or duplicate worker selections fail before other prerequisites', () => {
  for (const target of [approved, direct]) {
    for (const workers of ['studio-worker,studio-worker', 'asset-worker,',
      'asset-worker,asset-worker', 'unapproved-worker']) {
      denied(run(target, { URAI_JOBS_DEPLOY_WORKERS: workers }), 'WORKER_SELECTION_UNVERIFIED');
    }
  }
});

test('R525: non-Studio deploy still enforces ordinary credentials and source gates', () => {
  for (const target of [approved, direct]) {
    const result = run(target, { URAI_JOBS_DEPLOY_WORKERS: 'asset-worker',
      GCLOUD_PROJECT: '', DEPLOY_TARGET_SECRET_VERSIONS_JSON: '' });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /STUDIO_WORKER_DEPLOY_HARD_OFF/);
  }
});

test('R525: generic IAM bootstrap cannot grant bucket objectAdmin', () => {
  const result = run(bootstrap, {
    PROJECT_ID: 'urai-jobs',
    WORKER_SERVICE_ACCOUNT_EMAIL: 'synthetic-review-only@example.invalid',
    GCS_BUCKET_NAME: 'synthetic-review-only',
  });
  denied(result, 'MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF');
});

test('R525: IAM bootstrap invokes neither gcloud nor gsutil under override attempts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'urai-r525-fake-cli-'));
  const marker = join(directory, 'mutation-called');
  try {
    for (const name of ['gcloud', 'gsutil']) {
      const tool = join(directory, name);
      writeFileSync(tool, '#!/bin/sh\nprintf "CALLED\\n" >> "$URAI_R525_MUTATION_MARKER"\nexit 0\n');
      chmodSync(tool, 0o755);
    }
    const result = run(bootstrap, {
      PATH: directory + ':' + process.env.PATH,
      URAI_R525_MUTATION_MARKER: marker,
      WORKER_SERVICE_ACCOUNT_NAME: 'studio-worker',
      WORKER_SERVICE_ACCOUNT_EMAIL: 'synthetic-review-only@example.invalid',
      GCS_BUCKET_NAME: 'synthetic-review-only',
      URAI_STUDIO_STORAGE_IAM_VERIFIED: 'true',
      URAI_STORAGE_BROKER_APPROVED: 'true',
      GENESIS_RELEASE_APPROVAL: 'APPROVED',
      URAI_ENV: 'production',
    });
    denied(result, 'MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF');
    assert.equal(existsSync(marker), false, 'no cloud command may be invoked');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('R525: bootstrap veto is ordered before historical broad IAM commands', () => {
  const s = source('bootstrap-managed-worker-iam.sh');
  const guard = s.indexOf('MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF');
  const exit = s.indexOf('\nexit 1\n', guard);
  assert.ok(guard > 0 && exit > guard);
  for (const cloud of ['gcloud config set project', 'gcloud services enable',
    'gcloud projects add-iam-policy-binding', 'gsutil iam ch']) {
    assert.ok(s.indexOf(cloud) > exit, 'cloud command must follow unconditional exit: '+cloud);
  }
  assert.doesNotMatch(s.slice(0, exit), /if .*APPROVED|if .*ALLOW|if .*VERIFIED/);
});

test('R525: each deploy wrapper has exactly one early Studio veto', () => {
  for (const name of ['deploy-workers-approved.sh', 'deploy-workers.sh']) {
    const s = source(name);
    const guard = s.indexOf('node scripts/studio-worker-deploy-veto.mjs');
    const firstRequiredEnv = name === 'deploy-workers-approved.sh'
      ? s.indexOf('DEPLOY_TARGET_SECRET_VERSIONS_JSON is required')
      : s.indexOf('GCLOUD_PROJECT is required');
    assert.ok(guard > 0 && firstRequiredEnv > guard);
    assert.equal((s.match(/node scripts\/studio-worker-deploy-veto\.mjs/g) ?? []).length, 1);
  }
});

test('R525: all three modified shell scripts remain parseable', () => {
  const result = spawnSync('bash', ['-n', approved, direct, bootstrap], {
    cwd: root, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(result.status, 0, result.stderr);
});
test('R526: protected release preflight blocks Studio before SHA/cloud preflight', () => {
  const workflow = readFileSync(join(root, '.github/workflows/urai-jobs-production-deploy.yml'), 'utf8');
  const stepStart = workflow.indexOf('      - name: Validate exact inputs and clean source');
  const shellStart = workflow.indexOf('          set -euo pipefail', stepStart);
  const guardStart = workflow.indexOf('          if [ "${INPUT_INCLUDE_STUDIO_WORKER:-}" != \'false\' ]; then', shellStart);
  const shaCheck = workflow.indexOf('          [[ "$INPUT_EXPECTED_SHA" =~', shellStart);
  const authStep = workflow.indexOf('name: Authenticate to Google Cloud with workload identity');
  assert.ok(stepStart >= 0 && shellStart > stepStart &&
    guardStart > shellStart && shaCheck > guardStart && authStep > shaCheck,
    'Studio veto must precede exact-SHA checks and protected authentication');
  assert.equal(workflow.match(/STUDIO_WORKER_PROTECTED_RELEASE_HARD_OFF/g)?.length, 1);
  // Run the actual YAML-owned guard body as isolated shell, never the entire
  // workflow. No checkout, secrets, authenticated cloud CLI, or IAM is used.
  const guard = workflow.slice(guardStart, shaCheck).trimEnd().split('\n')
    .map((line) => line.slice(10)).join('\n');
  for (const selection of ['true', '', 'True', '1']) {
    const result = spawnSync('bash', ['-c', 'set -euo pipefail\n' + guard + '\necho SHOULD_NOT_RUN'], {
      encoding: 'utf8', env: { ...process.env, INPUT_INCLUDE_STUDIO_WORKER: selection },
    });
    denied(result, 'STUDIO_WORKER_PROTECTED_RELEASE_HARD_OFF');
    assert.doesNotMatch(result.stdout, /SHOULD_NOT_RUN/);
  }
  const safe = spawnSync('bash', ['-c', 'set -euo pipefail\n' + guard + '\necho NONSTUDIO_ONLY'], {
    encoding: 'utf8', env: { ...process.env, INPUT_INCLUDE_STUDIO_WORKER: 'false' },
  });
  assert.equal(safe.status, 0, safe.stderr);
  assert.match(safe.stdout, /NONSTUDIO_ONLY/);
});

console.log('R525_EARLY_STUDIO_AND_STORAGE_IAM_VETO_TESTS_REGISTERED cloud=false');
