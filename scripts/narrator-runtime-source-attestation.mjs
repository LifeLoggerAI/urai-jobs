/** Add an observation-only source proof to the existing canonical sparse Git context. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
export function createNarratorSourceAttestation({ root, sourceSha }) {
  const worker = 'workers/narrator-worker';
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { timeout: 5000, maxBuffer: 16_777_216 });
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || git('rev-parse', 'HEAD').toString().trim() !== sourceSha || git('status', '--porcelain', '--untracked-files=all').length) throw new Error('narrator_attestation_clean_source_required');
  const validator = createRequire(import.meta.url)(path.join(root, worker, 'runtime-source-proof.cjs'));
  const paths = git('ls-files', '-z').toString().split('\0').filter(p => p && (['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(p) || p.startsWith(`${worker}/`) || p.startsWith('packages/shared-types/'))).sort();
  const objects = new Map(), add = (type, sha) => { if (!objects.has(sha)) { const bytes = git('cat-file', type, sha); if (validator.gitHash(type, bytes) !== sha) throw new Error('narrator_attestation_object_hash_invalid'); objects.set(sha, { type, sha, data: bytes.toString('base64') }); } };
  add('commit', sourceSha); add('tree', git('rev-parse', `${sourceSha}^{tree}`).toString().trim());
  const files = paths.map(relative => {
    const absolute = path.join(root, relative), stat = fs.lstatSync(absolute); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('narrator_attestation_source_entry_invalid');
    const bytes = fs.readFileSync(absolute), gitBlob = git('rev-parse', `${sourceSha}:${relative}`).toString().trim();
    if (validator.gitHash('blob', bytes) !== gitBlob) throw new Error('narrator_attestation_source_bytes_changed');
    const parts = relative.split('/'); for (let count = 1; count < parts.length; count++) add('tree', git('rev-parse', `${sourceSha}:${parts.slice(0, count).join('/')}`).toString().trim());
    return { path: relative, bytes: bytes.length, gitBlob, sha256: validator.sha256(bytes) };
  });
  const proof = { schemaVersion: 'urai-narrator-runtime-source-attestation-1', sourceSha, files, objects: [...objects.values()].sort((a, b) => a.sha.localeCompare(b.sha)), providerCallAuthorized: false, productionVerified: false };
  const target = path.join(root, worker, 'runtime-source-attestation.json'); fs.writeFileSync(target, `${JSON.stringify(proof, null, 2)}\n`);
  validator.verifySourceProof(root, sourceSha);
  fs.appendFileSync(path.join(root, '.git', 'info', 'exclude'), '\n/workers/narrator-worker/runtime-source-attestation.json\n');
  return { proofSha256: validator.sha256(fs.readFileSync(target)), sourceFileCount: files.length };
}
