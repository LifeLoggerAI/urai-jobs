const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');

const SHA256 = /^[a-f0-9]{64}$/;
const DEFAULT_LIMITS = { maxFiles: 64, maxFileBytes: 2 * 1024 ** 3, maxTotalBytes: 8 * 1024 ** 3 };
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function hashOpenFile(file, limit) {
  const before = await file.stat({ bigint: true });
  const stat = await file.stat();
  if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size < 1 || stat.size > limit) throw new Error('EVIDENCE_FILE_BUDGET_INVALID');
  const hash = crypto.createHash('sha256'); let received = 0;
  for await (const bytes of file.createReadStream({ autoClose: false, start: 0 })) {
    received += bytes.length; if (received > stat.size || received > limit) throw new Error('EVIDENCE_FILE_CHANGED');
    hash.update(bytes);
  }
  if (received !== stat.size) throw new Error('EVIDENCE_FILE_CHANGED');
  const after = await file.stat({ bigint: true });
  if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some((field) => before[field] !== after[field])) throw new Error('EVIDENCE_FILE_CHANGED');
  return { sha256: hash.digest('hex'), byteSize: stat.size, identity: after };
}
async function hashFile(filename, limit) {
  const file = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const { sha256, byteSize } = await hashOpenFile(file, limit);
    return { sha256, byteSize };
  } finally { await file.close(); }
}

async function storeEvidenceFile(filename, artifactRoot, jobKey, { maxBytes = DEFAULT_LIMITS.maxFileBytes } = {}) {
  if (!SHA256.test(String(jobKey)) || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('EVIDENCE_IDENTITY_INVALID');
  await fs.mkdir(artifactRoot, { recursive: true, mode: 0o700 });
  const file = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  const temp = path.join(artifactRoot, `.evidence-${crypto.randomBytes(16).toString('hex')}`);
  let destination;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size < 1 || stat.size > maxBytes) throw new Error('EVIDENCE_FILE_BUDGET_INVALID');
    destination = await fs.open(temp, 'wx', 0o600);
    const hash = crypto.createHash('sha256'); let received = 0;
    for await (const bytes of file.createReadStream({ autoClose: false })) {
      received += bytes.length;
      if (received > stat.size || received > maxBytes) throw new Error('EVIDENCE_FILE_CHANGED');
      hash.update(bytes); let offset = 0;
      while (offset < bytes.length) {
        const { bytesWritten } = await destination.write(bytes, offset, bytes.length - offset);
        if (bytesWritten < 1) throw new Error('EVIDENCE_WRITE_FAILED');
        offset += bytesWritten;
      }
    }
    if (received !== stat.size) throw new Error('EVIDENCE_FILE_CHANGED');
    await destination.sync(); await destination.close(); destination = null;
    const sha256 = hash.digest('hex'), target = path.join(artifactRoot, sha256);
    try { await fs.link(temp, target); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = await hashFile(target, maxBytes);
      if (existing.sha256 !== sha256 || existing.byteSize !== received) throw new Error('EVIDENCE_EXISTING_FIXITY_MISMATCH');
    }
    return { ref: `cr-artifact:${jobKey}:${sha256}`, sha256, byteSize: received };
  } finally {
    await destination?.close(); await file.close(); await fs.rm(temp, { force: true });
  }
}

async function checkpointFiles(root, maxFiles) {
  const files = [];
  async function visit(directory) {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error('EVIDENCE_SYMLINK_DENIED');
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (entry.isFile() && entry.name.endsWith('.ckpt')) {
        files.push(filename);
        if (files.length > maxFiles) throw new Error('EVIDENCE_FILE_COUNT_LIMIT');
      }
    }
  }
  await visit(root); return files;
}

async function archiveReconstructionEvidence({ workspace, configurationPath, transformsPath, logfile, artifactRoot, jobKey, binding = {}, limits = DEFAULT_LIMITS }) {
  const root = await fs.realpath(workspace);
  async function governedFile(filename) {
    const candidate = path.resolve(filename), relative = path.relative(root, candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || await fs.realpath(candidate) !== candidate) throw new Error('EVIDENCE_PATH_DENIED');
    return candidate;
  }
  if (![limits.maxFiles, limits.maxFileBytes, limits.maxTotalBytes].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error('EVIDENCE_BUDGET_INVALID');
  const checkpoints = await checkpointFiles(path.join(root, '06_training'), limits.maxFiles);
  if (!checkpoints.length) throw new Error('ARCHIVAL_CHECKPOINT_MISSING');
  const sources = [{ role: 'configuration', filename: configurationPath }, { role: 'cameras', filename: transformsPath },
    ...checkpoints.map((filename, index) => ({ role: 'checkpoint', sequence: index, filename }))];
  try { if ((await fs.stat(logfile)).size > 0) sources.push({ role: 'processing-log', filename: logfile }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (sources.length > limits.maxFiles) throw new Error('EVIDENCE_FILE_COUNT_LIMIT');
  let bytes = 0; const artifacts = [];
  for (const source of sources) {
    const filename = await governedFile(source.filename), stat = await fs.stat(filename);
    bytes += stat.size; if (bytes > limits.maxTotalBytes) throw new Error('EVIDENCE_TOTAL_BYTE_LIMIT');
    const artifact = await storeEvidenceFile(filename, artifactRoot, jobKey, { maxBytes: limits.maxFileBytes });
    artifacts.push({ role: source.role, ...(source.sequence === undefined ? {} : { sequence: source.sequence }), ...artifact });
  }
  if (Object.keys(binding).some((key) => !['sourceManifestSha256', 'engineSourceSha', 'spatialAuthorityHead', 'requestDigest', 'componentEnvelopeSha256'].includes(key))
    || Object.entries(binding).some(([key, value]) => !((key === 'engineSourceSha' || key === 'spatialAuthorityHead') ? /^[a-f0-9]{40}$/ : SHA256).test(String(value)))) throw new Error('EVIDENCE_BINDING_INVALID');
  const manifest = { schemaVersion: 'urai-archival-reconstruction-evidence-v1', binding, artifacts, totalByteSize: bytes,
    checkpointAvailable: true, resumeAutomaticallyAuthorized: false, publicReleaseAuthorized: false };
  const manifestBytes = Buffer.from(JSON.stringify(manifest)), manifestHash = digest(manifestBytes);
  const target = path.join(artifactRoot, manifestHash);
  try { await fs.writeFile(target, manifestBytes, { mode: 0o600, flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST' || digest(await fs.readFile(target)) !== manifestHash) throw error; }
  return { manifest, ref: `cr-artifact:${jobKey}:${manifestHash}`, sha256: manifestHash, byteSize: manifestBytes.length };
}

module.exports = { archiveReconstructionEvidence, storeEvidenceFile, hashFile, hashOpenFile };
