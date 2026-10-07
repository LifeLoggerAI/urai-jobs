'use strict';
/** Source membership is proved by actual Git object bytes; build seals never authorize spend. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const gitHash = (type, bytes) => crypto.createHash('sha1').update(Buffer.from(`${type} ${bytes.length}\0`)).update(bytes).digest('hex');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const worker = 'workers/narrator-worker';
const mandatory = [`${worker}/src/protected-spend.ts`, `${worker}/src/protected-spend.js`, `${worker}/src/handlers/narrator-tts.ts`, `${worker}/src/handlers/narrator-tts.js`, `${worker}/runtime-source-proof.cjs`, `${worker}/package.json`, `${worker}/tsconfig.json`, 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'packages/shared-types/package.json'];
const need = (condition, reason) => { if (!condition) throw new Error(`narrator_runtime_source_${reason}`); };
function safePath(value) {
  need(typeof value === 'string' && value.length < 512 && value.split('/').every(part => part && part !== '.' && part !== '..' && /^[A-Za-z0-9_.-]+$/.test(part)), 'path_invalid');
  return value;
}
function fileBytes(root, relative) {
  const parts = safePath(relative).split('/'); let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part); const stat = fs.lstatSync(current);
    need(!stat.isSymbolicLink() && (index === parts.length - 1 ? stat.isFile() : stat.isDirectory()), 'entry_invalid');
  }
  const stat = fs.statSync(current); need(stat.size <= 16_777_216, 'file_oversized');
  return fs.readFileSync(current);
}
function readProof(root) {
  const bytes = fileBytes(root, `${worker}/runtime-source-attestation.json`);
  need(bytes.length <= 2_097_152, 'proof_oversized');
  let proof; try { proof = JSON.parse(bytes); } catch { throw new Error('narrator_runtime_source_proof_invalid'); }
  need(proof?.schemaVersion === 'urai-narrator-runtime-source-attestation-1' && Array.isArray(proof.files) && Array.isArray(proof.objects), 'proof_invalid');
  return proof;
}
function treeEntries(bytes) {
  const result = new Map(); let cursor = 0;
  while (cursor < bytes.length) {
    const space = bytes.indexOf(32, cursor), nul = bytes.indexOf(0, space + 1);
    need(space > cursor && nul > space && nul + 21 <= bytes.length, 'tree_invalid');
    const mode = bytes.subarray(cursor, space).toString('ascii'), name = bytes.subarray(space + 1, nul).toString('utf8');
    need(['40000', '100644', '100755', '120000', '160000'].includes(mode) && name && !name.includes('/') && !result.has(name), 'tree_entry_invalid');
    result.set(name, { mode, sha: bytes.subarray(nul + 1, nul + 21).toString('hex') }); cursor = nul + 21;
  }
  return result;
}
function verifySourceProof(root, expectedSha) {
  need(/^[a-f0-9]{40}$/.test(expectedSha || ''), 'expected_sha_invalid');
  const proof = readProof(root); need(proof.sourceSha === expectedSha && proof.files.length >= mandatory.length && proof.files.length <= 512 && proof.objects.length <= 256, 'identity_invalid');
  const objects = new Map();
  for (const object of proof.objects) {
    need(object && ['commit', 'tree'].includes(object.type) && /^[a-f0-9]{40}$/.test(object.sha || '') && typeof object.data === 'string' && object.data.length <= 1_398_104 && !objects.has(object.sha), 'object_invalid');
    const bytes = Buffer.from(object.data, 'base64'); need(bytes.toString('base64') === object.data && gitHash(object.type, bytes) === object.sha, 'object_hash_invalid');
    objects.set(object.sha, { ...object, bytes });
  }
  const commit = objects.get(expectedSha); need(commit?.type === 'commit', 'commit_missing');
  const match = /^tree ([a-f0-9]{40})\n/.exec(commit.bytes.toString('utf8')); need(match, 'commit_tree_invalid');
  const treeFor = sha => { const object = objects.get(sha); need(object?.type === 'tree', 'tree_missing'); return treeEntries(object.bytes); };
  const seen = new Set();
  for (const file of proof.files) {
    const sourcePath = safePath(file.path); need(!seen.has(sourcePath), 'duplicate_source'); seen.add(sourcePath);
    let treeSha = match[1], entry; const parts = sourcePath.split('/');
    for (const [index, part] of parts.entries()) {
      entry = treeFor(treeSha).get(part); need(entry, 'source_membership_invalid');
      if (index < parts.length - 1) { need(entry.mode === '40000', 'directory_invalid'); treeSha = entry.sha; }
      else need(['100644', '100755'].includes(entry.mode), 'source_mode_invalid');
    }
    const bytes = fileBytes(root, sourcePath);
    need(Number.isSafeInteger(file.bytes) && file.bytes === bytes.length && file.gitBlob === entry.sha && gitHash('blob', bytes) === entry.sha && file.sha256 === sha256(bytes), 'source_bytes_invalid');
  }
  need(mandatory.every(p => seen.has(p)), 'required_source_missing');
  const requireSubtree = base => {
    let treeSha = match[1];
    for (const part of base.split('/')) { const entry = treeFor(treeSha).get(part); need(entry?.mode === '40000', 'required_directory_missing'); treeSha = entry.sha; }
    const visit = (sha, prefix) => { for (const [name, entry] of treeFor(sha)) { const relative = `${prefix}/${name}`; if (entry.mode === '40000') visit(entry.sha, relative); else { need(['100644', '100755'].includes(entry.mode) && seen.has(relative), 'complete_source_membership_missing'); } } };
    visit(treeSha, base);
  };
  requireSubtree(worker); requireSubtree('packages/shared-types');
  return proof;
}
function artifactFiles(root) {
  const files = [], base = `${worker}/dist`;
  function walk(relative) {
    const absolute = path.join(root, relative); need(fs.lstatSync(absolute).isDirectory(), 'artifact_directory_invalid');
    for (const name of fs.readdirSync(absolute).sort()) {
      safePath(name); const child = `${relative}/${name}`, stat = fs.lstatSync(path.join(root, child)); need(!stat.isSymbolicLink(), 'artifact_symlink');
      if (stat.isDirectory()) walk(child); else { need(stat.isFile(), 'artifact_entry_invalid'); files.push(child); }
    }
  }
  walk(base); return files;
}
function verifyRuntimeSourceProof(root, expectedSha) {
  const proof = verifySourceProof(root, expectedSha);
  need(proof.compilerVersion === '5.9.3' && Array.isArray(proof.artifacts) && proof.artifacts.length > 0 && proof.artifacts.length <= 512, 'artifact_seal_missing');
  const expected = proof.artifacts.map(x => safePath(x.path));
  need(expected.every(p => p.startsWith(`${worker}/dist/`)) && new Set(expected).size === expected.length && JSON.stringify([...expected].sort()) === JSON.stringify(artifactFiles(root).sort()), 'artifact_set_invalid');
  for (const artifact of proof.artifacts) { const bytes = fileBytes(root, artifact.path); need(artifact.bytes === bytes.length && artifact.sha256 === sha256(bytes), 'artifact_bytes_invalid'); }
  need(expected.includes(`${worker}/dist/protected-spend.js`) && expected.includes(`${worker}/dist/handlers/narrator-tts.js`), 'required_artifact_missing');
  return proof.sourceSha;
}
function sealArtifacts(root) {
  const proof = readProof(root); verifySourceProof(root, proof.sourceSha);
  const ts = require('typescript'); need(ts.version === '5.9.3', 'compiler_version_invalid');
  const configPath = path.join(root, worker, 'tsconfig.json'), config = ts.readConfigFile(configPath, ts.sys.readFile); need(!config.error, 'compiler_config_invalid');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)); need(!parsed.errors.length, 'compiler_config_invalid');
  const program = ts.createProgram(parsed.fileNames, parsed.options); need(!ts.getPreEmitDiagnostics(program).length, 'compiler_diagnostics');
  const emitted = new Map(), result = program.emit(undefined, (filename, text) => emitted.set(path.relative(root, filename).split(path.sep).join('/'), Buffer.from(text)));
  need(!result.emitSkipped && !result.diagnostics.length && emitted.size > 0, 'compiler_emit_invalid');
  const actual = artifactFiles(root); need(JSON.stringify([...emitted.keys()].sort()) === JSON.stringify(actual.sort()), 'compiler_output_set_invalid');
  for (const [relative, bytes] of emitted) need(fileBytes(root, relative).equals(bytes), 'compiler_output_bytes_invalid');
  proof.compilerVersion = ts.version;
  proof.artifacts = [...emitted].sort(([a], [b]) => a.localeCompare(b)).map(([relative, bytes]) => ({ path: relative, bytes: bytes.length, sha256: sha256(bytes) }));
  fs.writeFileSync(path.join(root, worker, 'runtime-source-attestation.json'), `${JSON.stringify(proof, null, 2)}\n`);
  verifyRuntimeSourceProof(root, proof.sourceSha); return proof;
}
module.exports = { gitHash, sha256, verifySourceProof, verifyRuntimeSourceProof, sealArtifacts };
if (require.main === module) {
  try { const root = process.cwd(), action = process.argv[2], expected = process.argv[3] || readProof(root).sourceSha;
    if (action === 'verify-source') verifySourceProof(root, expected);
    else if (action === 'seal') sealArtifacts(root);
    else if (action === 'verify-runtime') verifyRuntimeSourceProof(root, expected);
    else throw new Error('narrator_runtime_source_action_invalid');
    console.log('[PASS] narrator exact source/artifact integrity only; provider authorization remains closed');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
