import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { archiveReconstructionEvidence, storeEvidenceFile, hashFile } = require('../workers/captured-reality-worker/reconstruction-evidence.js');
const { sha } = require('../workers/captured-reality-worker/private-media-resolver.js');

async function fixture(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'urai-evidence-synthetic-'));
  const workspace = path.join(root, 'workspace'), training = path.join(workspace, '06_training', 'configuration');
  await fs.mkdir(training, { recursive: true, mode: 0o700 });
  const configurationPath = path.join(training, 'config.yml'), transformsPath = path.join(workspace, 'cameras.json'), logfile = path.join(workspace, 'private-command.log');
  const checkpoint = path.join(training, 'step-000000009.ckpt');
  for (const [filename, value] of [[configurationPath, 'synthetic: true'], [transformsPath, '{"frames":[]}'], [logfile, 'synthetic log'], [checkpoint, 'synthetic checkpoint']]) await fs.writeFile(filename, value, { mode: 0o600 });
  const options = { workspace, configurationPath, transformsPath, logfile, artifactRoot: path.join(root, 'artifacts'), jobKey: 'a'.repeat(64) };
  try { await callback({ root, training, checkpoint, options }); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('checkpoint/config/camera/log archive survives ephemeral deletion with exact fixity', async () => fixture(async ({ options }) => {
  const result = await archiveReconstructionEvidence(options);
  await fs.rm(options.workspace, { recursive: true, force: true });
  assert.equal(result.manifest.checkpointAvailable, true);
  assert.equal(result.manifest.resumeAutomaticallyAuthorized, false);
  assert.equal(result.manifest.publicReleaseAuthorized, false);
  assert.deepEqual(result.manifest.artifacts.map((artifact) => artifact.role), ['configuration', 'cameras', 'checkpoint', 'processing-log']);
  assert.equal(JSON.stringify(result.manifest).includes(options.workspace), false);
  for (const artifact of result.manifest.artifacts) {
    const filename = path.join(options.artifactRoot, artifact.sha256);
    assert.equal((await fs.stat(filename)).mode & 0o077, 0);
    assert.deepEqual(await hashFile(filename, 1024), { sha256: artifact.sha256, byteSize: artifact.byteSize });
  }
}));

test('content-addressed archival is idempotent and never overwrites a corrupted output', async () => fixture(async ({ options }) => {
  const first = await archiveReconstructionEvidence(options), second = await archiveReconstructionEvidence(options);
  assert.equal(first.sha256, second.sha256);
  const checkpoint = first.manifest.artifacts.find((artifact) => artifact.role === 'checkpoint');
  await fs.writeFile(path.join(options.artifactRoot, checkpoint.sha256), 'corruption');
  await assert.rejects(archiveReconstructionEvidence(options), /EXISTING_FIXITY_MISMATCH/);
}));

test('missing real checkpoint cannot become an archival reconstruction claim', async () => fixture(async ({ checkpoint, options }) => {
  await fs.rm(checkpoint); await assert.rejects(archiveReconstructionEvidence(options), /CHECKPOINT_MISSING/);
}));

test('checkpoint symlinks and outside-workspace configuration are denied', async () => fixture(async ({ root, checkpoint, training, options }) => {
  const outside = path.join(root, 'outside.ckpt'); await fs.writeFile(outside, 'outside private bytes');
  await fs.rm(checkpoint); await fs.symlink(outside, path.join(training, 'linked.ckpt'));
  await assert.rejects(archiveReconstructionEvidence(options), /SYMLINK_DENIED/);
  await fs.rm(path.join(training, 'linked.ckpt')); await fs.writeFile(checkpoint, 'synthetic checkpoint');
  await assert.rejects(archiveReconstructionEvidence({ ...options, configurationPath: outside }), /PATH_DENIED/);
}));

test('file, aggregate and object-count budgets are enforced without retaining temporary copies', async () => fixture(async ({ options }) => {
  await assert.rejects(archiveReconstructionEvidence({ ...options, limits: { maxFiles: 64, maxFileBytes: 4, maxTotalBytes: 1024 } }), /FILE_BUDGET_INVALID/);
  await assert.rejects(archiveReconstructionEvidence({ ...options, limits: { maxFiles: 64, maxFileBytes: 1024, maxTotalBytes: 1 } }), /TOTAL_BYTE_LIMIT/);
  await assert.rejects(archiveReconstructionEvidence({ ...options, limits: { maxFiles: 3, maxFileBytes: 1024, maxTotalBytes: 1024 } }), /FILE_COUNT_LIMIT/);
  assert.ok(!(await fs.readdir(options.artifactRoot)).some((filename) => filename.startsWith('.evidence-')));
}));

test('streamed file copying records exact bytes and denies invalid object identity', async () => fixture(async ({ checkpoint, options }) => {
  const buffer = Buffer.alloc(2 * 1024 * 1024 + 7, 57); await fs.writeFile(checkpoint, buffer);
  const result = await storeEvidenceFile(checkpoint, options.artifactRoot, options.jobKey);
  assert.equal(result.sha256, sha(buffer)); assert.equal(result.byteSize, buffer.length);
  assert.deepEqual(await fs.readFile(path.join(options.artifactRoot, result.sha256)), buffer);
  await assert.rejects(storeEvidenceFile(checkpoint, options.artifactRoot, '../invalid'), /IDENTITY/);
}));
