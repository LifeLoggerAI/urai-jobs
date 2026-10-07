import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const protectedPaths = [
  'workers/narrator-worker/src/protected-spend.ts',
  'workers/narrator-worker/src/protected-spend.js',
  'workers/narrator-worker/src/handlers/narrator-tts.ts',
  'workers/narrator-worker/src/handlers/narrator-tts.js',
];
const requiredPaths = [...protectedPaths, 'workers/narrator-worker/Dockerfile',
  'workers/narrator-worker/package.json', 'packages/shared-types/package.json',
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
function git(root, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', root, ...args],
    { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

/** Prepare source only. No provider, credential, deployment or spending authority is created. */
export function prepareNarratorBuildContext({ repositoryRoot, sourceSha, outputDirectory }) {
  if (!/^[a-f0-9]{40}$/.test(String(sourceSha || ''))) throw new Error('narrator_build_source_invalid');
  const root = fs.realpathSync(repositoryRoot);
  if (git(root, 'rev-parse', '--show-toplevel') !== root || git(root, 'rev-parse', 'HEAD') !== sourceSha) {
    throw new Error('narrator_build_source_mismatch');
  }
  if (git(root, 'status', '--porcelain', '--untracked-files=all')) throw new Error('narrator_build_source_dirty');
  const destination = path.resolve(outputDirectory);
  const parent = fs.realpathSync(path.dirname(destination));
  if (within(root, path.join(parent, path.basename(destination))) || fs.existsSync(destination)) {
    throw new Error('narrator_build_destination_invalid');
  }
  for (const file of requiredPaths) {
    if (!fs.lstatSync(path.join(root, file)).isFile() || git(root, 'ls-files', '--error-unmatch', '--', file) !== file) {
      throw new Error('narrator_build_required_source_missing');
    }
  }
  const entries = git(root, 'ls-tree', '-r', sourceSha, '--', 'workers/narrator-worker', 'packages/shared-types').split('\n');
  if (entries.some(entry => !entry.startsWith('100644 blob ') && !entry.startsWith('100755 blob '))) {
    throw new Error('narrator_build_unsafe_source_entry');
  }
  const runtimeRoot = path.join(destination, 'runtime-source');
  fs.mkdirSync(destination);
  try {
    fs.mkdirSync(runtimeRoot);
    git(runtimeRoot, 'init', '--quiet');
    git(runtimeRoot, 'fetch', '--no-tags', '--depth=1', root, sourceSha);
    git(runtimeRoot, 'sparse-checkout', 'init', '--cone');
    git(runtimeRoot, 'sparse-checkout', 'set', 'workers/narrator-worker', 'packages/shared-types');
    git(runtimeRoot, 'checkout', '--detach', sourceSha);
    if (git(runtimeRoot, 'rev-parse', 'HEAD') !== sourceSha || git(runtimeRoot, 'status', '--porcelain', '--untracked-files=all')) {
      throw new Error('narrator_build_checkout_invalid');
    }
    // This Git database is newly initialized, has no remotes or copied credentials,
    // and removes local path/reflog metadata before the immutable source archive.
    fs.rmSync(path.join(runtimeRoot, '.git', 'FETCH_HEAD'), { force: true });
    fs.rmSync(path.join(runtimeRoot, '.git', 'logs'), { recursive: true, force: true });
    if (git(runtimeRoot, 'remote')) throw new Error('narrator_build_remote_not_allowed');
    const files = requiredPaths.filter(p => p !== 'workers/narrator-worker/Dockerfile').map(file => {
      const bytes = fs.readFileSync(path.join(runtimeRoot, file));
      if (!bytes.equals(fs.readFileSync(path.join(root, file)))) throw new Error('narrator_build_source_bytes_changed');
      return { path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    });
    const receipt = { schemaVersion: 'urai-narrator-exact-git-build-context-v1',
      repository: 'LifeLoggerAI/urai-jobs', sourceSha, sourceTreeSha: git(root, 'rev-parse', 'HEAD^{tree}'),
      files, gitIndexReconstructionRequired: true, sourceOnly: true,
      spendAuthorized: false, deploymentAuthorized: false, runtimeAccepted: false };
    // Index stat timestamps vary between exports. Reconstruct from the exact Git
    // tree inside Docker; the archived object database/source bytes stay stable.
    fs.rmSync(path.join(runtimeRoot, '.git', 'index'), { force: true });
    fs.copyFileSync(path.join(root, 'workers/narrator-worker/Dockerfile'), path.join(destination, 'Dockerfile'));
    fs.writeFileSync(path.join(destination, '.dockerignore'), '**/node_modules\n**/dist\n**/.next\n**/.env\n**/.env.*\n!**/.env.example\n');
    fs.writeFileSync(path.join(destination, 'narrator-runtime-source.json'), JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2), value = name => args[args.indexOf(name) + 1];
    if (!args.includes('--source-sha') || !args.includes('--output')) throw new Error('narrator_build_arguments_required');
    const receipt = prepareNarratorBuildContext({ repositoryRoot: process.cwd(), sourceSha: value('--source-sha'), outputDirectory: value('--output') });
    process.stdout.write(JSON.stringify(receipt) + '\n');
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'narrator_build_context_failed') + '\n');
    process.exitCode = 1;
  }
}
