/**
 * R1017 source guard: no test mode / environment setting can enable
 * private Life Movie output writes in the legacy direct-write worker.
 *
 * This is a regression guard, NOT a GCS IAM or revocation-fence certificate.
 * The independently authenticated, sole-writer Storage broker is still P0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const authorityPath = join(root, 'workers/studio-worker/private-output-write-authority.js');
const workerPath = join(root, 'workers/studio-worker/index.js');
const revocationPath = join(root, 'functions/src/privacy/lifeMovieDerivativeRevocation.ts');
const {
  privateOutputWriteAuthorityAvailable,
  assertPrivateOutputWriteAuthority,
} = require(authorityPath);

const ERR = 'life_movie_storage_enforced_write_authority_unavailable';

test('legacy direct Storage output is unconditionally disabled', () => {
  assert.equal(privateOutputWriteAuthorityAvailable(), false);
  assert.throws(() => assertPrivateOutputWriteAuthority(), { message: ERR });
});

test('environment spoofing and test mode cannot turn on private output', () => {
  const envKeys = [
    'NODE_ENV', 'URAI_ENV', 'URAI_PRIVATE_OUTPUT_WRITES',
    'URAI_PRIVATE_OUTPUT_WRITE_AUTHORITY', 'URAI_STORAGE_WRITE_BROKER_READY',
    'URAI_STUDIO_PRIVATE_WRITER', 'GCS_BUCKET_NAME',
  ];
  const original = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  try {
    for (const value of ['1', 'true', 'enabled', 'test', 'production']) {
      for (const key of envKeys) process.env[key] = value;
      assert.equal(privateOutputWriteAuthorityAvailable(), false);
      assert.throws(() => assertPrivateOutputWriteAuthority(), { message: ERR });
    }
  } finally {
    for (const key of envKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test('R1061: Studio upload helpers have two broker-only paths with no direct GCS writer', () => {
  const source = readFileSync(workerPath, 'utf8');
  const uploadStarts = [...source.matchAll(/async function uploadPrivateFile\\s*\\(/g)].map(m => m.index);
  const brokerCalls = [...source.matchAll(/await submitPrivateOutputToExclusiveBroker\\(\\{/g)].map(m => m.index);
  const outputStreams = [...source.matchAll(/\\bfile\\.createWriteStream\\s*\\(/g)].map(m => m.index);
  assert.equal(uploadStarts.length, 2, 'unexpected private output helper count: re-audit worker');
  assert.equal(brokerCalls.length, 2, 'both output paths must route to trusted broker boundary');
  assert.equal(outputStreams.length, 0, 'direct GCS output streaming may not reappear');
  for (let i = 0; i < uploadStarts.length; i++) {
    const start = uploadStarts[i], broker = brokerCalls[i];
    assert.ok(broker > start, 'broker appears before its output helper');
    const preBroker = source.slice(start, broker);
    assert.ok(preBroker.length < 1800, 'unexpected upload body needs manual re-audit');
    const guard = preBroker.indexOf('assertPrivateOutputWriteAuthority();');
    const consentCheck = preBroker.indexOf('await control.check();');
    assert.ok(guard >= 0 && consentCheck > guard,
      'hard-off and current consent control checks must precede broker request');
    assert.ok(preBroker.includes('pendingUnfencedOutputWrite = true;'),
      'in-flight marker must remain unresolved if broker rejects');
    if (i + 1 < uploadStarts.length) {
      assert.ok(broker < uploadStarts[i + 1], 'broker call mapped to wrong upload function');
    }
  }
  const boundary = require(join(root, 'workers/studio-worker/private-output-broker-boundary.js'));
  assert.equal(boundary.privateOutputBrokerCertified(), false);
  assert.equal(typeof boundary.submitPrivateOutputToExclusiveBroker, 'function');
});

test('Studio readiness cannot claim a private Storage write authority without hard-off check', () => {
  const source = readFileSync(workerPath, 'utf8');
  assert.match(source, /storageEnforcedWriteAuthority:\s*privateOutputWriteAuthorityAvailable\(\)/);
});

test('revocation code refuses permanent deletion or future-write guarantee', () => {
  const source = readFileSync(revocationPath, 'utf8');
  assert.match(source, /privateOutputDeletionAcknowledged:\s*false/);
  assert.match(source, /storageWriteFenceVerified:\s*false/);
  assert.doesNotMatch(source, /privateOutputDeletionAcknowledged:\s*true/);
  assert.doesNotMatch(source, /storageWriteFenceVerified:\s*true/);
});

test('revocation must retain unresolved in-flight veto and prefix inventory', () => {
  const source = readFileSync(revocationPath, 'utf8');
  assert.match(source, /life_movie_revocation_inflight_unresolved/);
  assert.match(source, /assertNoUnattributedLifeMovieOutputs\s*\(/);
  assert.match(source, /life_movie_revocation_output_generation_changed/);
});
