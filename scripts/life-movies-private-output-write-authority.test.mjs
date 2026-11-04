import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const authorityPath = '../workers/studio-worker/private-output-write-authority.js';
const { assertPrivateOutputWriteAuthority, privateOutputWriteAuthorityAvailable } = require(authorityPath);
const authoritySource = readFileSync(new URL(authorityPath, import.meta.url), 'utf8');
const worker = readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');

test('R518: direct private output authority remains hard-off for all environments', () => {
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

test('R518: both render and assembly paths enforce hard-off before first byte', () => {
  const source = worker.match(/async function uploadPrivateFile\(localPath, destination, contentType, expectedHash\) \{[\s\S]*?\n\s+\}/g) ?? [];
  assert.equal(source.length, 2, 'both longform assembly and render upload helpers must exist');
  for (const helper of source) {
    const guard = helper.indexOf('assertPrivateOutputWriteAuthority();');
    const check = helper.indexOf('await control.check();');
    const pending = helper.indexOf('pendingUnfencedOutputWrite = true;');
    const create = helper.indexOf('file.createWriteStream(');
    assert.ok(guard >= 0 && guard < check && check < pending && pending < create,
      'hard-off authorization must precede checks, upload reservations and streaming');
  }
  assert.equal((worker.match(/assertPrivateOutputWriteAuthority\(\);/g) ?? []).length, 2);
  assert.match(worker, /storageEnforcedWriteAuthority: privateOutputWriteAuthorityAvailable\(\)/);
  assert.match(worker, /consentAuthorityConnected: lifeMovieConsentAuthorityAvailable\(\)/);
});

test('R519: direct Storage writer count cannot expand without explicit review', () => {
  // Verify all direct worker write APIs, not just the two known helpers.
  // This source tripwire is NOT a substitute for authenticated Storage IAM.
  assert.equal((worker.match(/\.createWriteStream\s*\(/g) ?? []).length, 4,
    'exactly two local file writes and two guarded GCS file writes expected');
  assert.equal((worker.match(/\bfs\.createWriteStream\s*\(/g) ?? []).length, 2);
  assert.equal((worker.match(/\bfile\.createWriteStream\s*\(/g) ?? []).length, 2);
  assert.equal((worker.match(/\bbucket\.file\(destination\);/g) ?? []).length, 2);
  assert.doesNotMatch(worker, /\b(?:bucket|file)\.(?:upload|save|compose|copy|rewrite)\s*\(/,
    'alternate direct GCS write API requires explicit independent review');
});

test('R518: neither permission nor revocation is represented as cleared', () => {
  assert.match(worker, /function lifeMovieConsentAuthorityAvailable\(\) \{\s*return false;\s*\}/);
  assert.match(authoritySource, /durable|revocation epochs/);
  assert.doesNotMatch(authoritySource, /return true;|Boolean\(process\.env/);
});

console.log('R520_DIRECT_PRIVATE_OUTPUT_WRITE_FENCE_TEST_ONLY checks=4 hardOff=true cloud=false');
