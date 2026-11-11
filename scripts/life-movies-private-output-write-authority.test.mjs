import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const authorityPath = '../workers/studio-worker/private-output-write-authority.js';
const brokerPath = '../workers/studio-worker/private-output-broker-boundary.js';
const { assertPrivateOutputWriteAuthority, privateOutputWriteAuthorityAvailable } = require(authorityPath);
const { privateOutputBrokerCertified, submitPrivateOutputToExclusiveBroker } = require(brokerPath);
const authoritySource = readFileSync(new URL(authorityPath, import.meta.url), 'utf8');
const brokerSource = readFileSync(new URL(brokerPath, import.meta.url), 'utf8');
const worker = readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');

test('R518: private write authority remains permanently hard-off', () => {
  assert.equal(privateOutputWriteAuthorityAvailable(), false);
  for (const env of ['test', 'local', 'staging', 'production']) {
    const old = process.env.URAI_ENV;
    const oldOverride = process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED;
    try {
      process.env.URAI_ENV = env;
      process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED = 'true';
      assert.equal(privateOutputWriteAuthorityAvailable(), false);
      assert.throws(assertPrivateOutputWriteAuthority,
        { message: 'life_movie_storage_enforced_write_authority_unavailable' });
    } finally {
      if (old === undefined) delete process.env.URAI_ENV;
      else process.env.URAI_ENV = old;
      if (oldOverride === undefined) delete process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED;
      else process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED = oldOverride;
    }
  }
  assert.match(authoritySource, /return false;/);
  assert.doesNotMatch(authoritySource, /process\.env|process\['env'\]/);
});

test('R1061: both render and assembly must use the exclusive broker boundary before any GCS write', () => {
  const marker = 'async function uploadPrivateFile(localPath, destination, contentType, expectedHash) {';
  const fragments = worker.split(marker);
  assert.equal(fragments.length, 3, 'both private output upload helpers must exist');
  for (const source of fragments.slice(1)) {
    const end = source.indexOf('return uploadedGeneration;');
    assert.ok(end > 0, 'generation receipt branch must remain explicit');
    const helper = source.slice(0, end);
    const guard = helper.indexOf('assertPrivateOutputWriteAuthority();');
    const lease = helper.indexOf('await control.check();');
    const pending = helper.indexOf('pendingUnfencedOutputWrite = true;');
    const broker = helper.indexOf('await submitPrivateOutputToExclusiveBroker(');
    assert.ok(guard >= 0 && guard < lease && lease < pending && pending < broker,
      'old fail-closed authority and current revocation checks must precede broker request');
    assert.ok(helper.includes('expectedHash'), 'broker request must bind expected digest');
    assert.ok(helper.includes('pinnedUploadedOutputGeneration(brokerReceipt.generation)'));
    assert.doesNotMatch(helper, /createWriteStream|\.upload\(|\.save\(/);
  }
  assert.equal((worker.match(/assertPrivateOutputWriteAuthority\(\);/g) ?? []).length, 2);
  assert.equal((worker.match(/submitPrivateOutputToExclusiveBroker\(\{/g) ?? []).length, 2);
  assert.match(worker, /storageEnforcedWriteAuthority: privateOutputWriteAuthorityAvailable\(\)/);
  assert.match(worker, /consentAuthorityConnected: lifeMovieConsentAuthorityAvailable\(\)/);
});

test('R1061: no direct GCS output writer survives; no alternate mutation API appears', () => {
  assert.equal((worker.match(/\bfile\.createWriteStream\s*\(/g) ?? []).length, 0);
  assert.equal((worker.match(/\bbucket\.file\(destination\)/g) ?? []).length, 0);
  assert.equal((worker.match(/\bfs\.createWriteStream\s*\(/g) ?? []).length, 2,
    'two local temporary-file writers remain unchanged');
  assert.equal((worker.match(/\.createWriteStream\s*\(/g) ?? []).length, 2);
  assert.doesNotMatch(worker, /\b(?:bucket|file)\.(?:upload|save|compose|copy|rewrite)\s*\(/,
    'direct Storage mutation cannot be reintroduced without independent review');
  assert.equal((worker.match(/cleanupPinnedPrivateOutputs\(/g) ?? []).length, 2,
    'existing exact-generation cleanup path must remain preserved');
});

test('R1061: the broker boundary cannot be activated by any worker input or environment', async () => {
  assert.equal(privateOutputBrokerCertified(), false);
  const old = process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED;
  const old2 = process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY;
  try {
    process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED = 'true';
    process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY = 'true';
    assert.equal(privateOutputBrokerCertified(), false);
    for (const intent of [undefined, {}, {
      ownerUid: 'synthetic-owner', tenantId: 'synthetic-tenant', jobId: 'synthetic-job',
      localPath: '/tmp/synthetic.mp4', destination: 'synthetic/output.mp4',
      expectedHash: '0'.repeat(64), bucketName: 'synthetic-bucket',
    }]) {
      await assert.rejects(submitPrivateOutputToExclusiveBroker(intent),
        { message: 'life_movie_exclusive_storage_broker_unavailable' });
    }
  } finally {
    if (old === undefined) delete process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED;
    else process.env.URAI_PRIVATE_OUTPUT_WRITE_AUTHORIZED = old;
    if (old2 === undefined) delete process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY;
    else process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY = old2;
  }
  assert.match(brokerSource, /return false;/);
  assert.doesNotMatch(brokerSource, /process\.env|require\(.+firebase|createWriteStream|fetch\(|return true/);
});

test('R518: private consent and durable Storage authority are never represented as cleared', () => {
  assert.match(worker, /function lifeMovieConsentAuthorityAvailable\(\) \{\s*return false;\s*\}/);
  assert.match(authoritySource, /durable|revocation epochs/);
  assert.doesNotMatch(authoritySource, /return true;|Boolean\(process\.env/);
});

console.log('R1061_BROKER_ONLY_PRIVATE_OUTPUT_TEST checks=5 hardOff=true cloud=false');
