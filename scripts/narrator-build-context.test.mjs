import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { prepareNarratorBuildContext } from './prepare-narrator-build-context.mjs';

const require = createRequire(import.meta.url);
const sourceRoot = path.resolve(new URL('..', import.meta.url).pathname);
const roots = [];
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-narrator-build-')); roots.push(parent);
  const root = path.join(parent, 'source'); fs.mkdirSync(root);
  const files = ['workers/narrator-worker/src/protected-spend.ts', 'workers/narrator-worker/src/protected-spend.js',
    'workers/narrator-worker/src/handlers/narrator-tts.ts', 'workers/narrator-worker/src/handlers/narrator-tts.js',
    'workers/narrator-worker/Dockerfile', 'workers/narrator-worker/package.json', 'packages/shared-types/package.json',
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    'workers/narrator-worker/runtime-source-proof.cjs', 'workers/narrator-worker/tsconfig.json'];
  for (const file of files) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(sourceRoot, file), target); }
  fs.writeFileSync(path.join(root, '.gitignore'), '**/node_modules/\n**/dist/\n');
  git(root, 'init', '--quiet'); git(root, 'add', '.');
  git(root, '-c', 'user.name=Synthetic Build Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'Synthetic exact narrator source');
  const sha = git(root, 'rev-parse', 'HEAD'), output = path.join(parent, 'context');
  return { parent, root, sha, output, prepare: () => prepareNarratorBuildContext({ repositoryRoot: root, sourceSha: sha, outputDirectory: output }) };
}
function actualSourceCheck(runtimeRoot, expectedSha) {
  const source = fs.readFileSync(path.join(runtimeRoot, 'workers/narrator-worker/src/protected-spend.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
    process: { cwd: () => runtimeRoot, env: { URAI_SOURCE_SHA: expectedSha } },
    Buffer, Headers, URL, AbortController, AbortSignal,
  })(require, module, module.exports);
  return module.exports.narratorExecutorSourceSha();
}

test('exact sparse Git context satisfies the actual paid-leaf source guard', () => {
  const f = fixture(), receipt = f.prepare(), runtime = path.join(f.output, 'runtime-source');
  assert.equal(fs.existsSync(path.join(runtime, '.git', 'index')), false);
  git(runtime, 'read-tree', 'HEAD');
  assert.equal(actualSourceCheck(runtime, f.sha), f.sha);
  assert.equal(receipt.sourceTreeSha, git(f.root, 'rev-parse', 'HEAD^{tree}'));
  assert.equal(git(runtime, 'remote'), ''); assert.equal(git(runtime, 'status', '--porcelain', '--', 'workers/narrator-worker', 'packages/shared-types', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'), '');
  assert.equal(fs.existsSync(path.join(runtime, '.git', 'FETCH_HEAD')), false);
  assert.equal(fs.existsSync(path.join(runtime, '.git', 'logs')), false);
  assert.equal(receipt.spendAuthorized, false); assert.equal(receipt.deploymentAuthorized, false); assert.equal(receipt.runtimeAccepted, false);
  assert.equal(fs.readFileSync(path.join(runtime, 'pnpm-lock.yaml'), 'utf8'), fs.readFileSync(path.join(f.root, 'pnpm-lock.yaml'), 'utf8'));
  assert.throws(() => actualSourceCheck(runtime, 'f'.repeat(40)), /build differs/);
  const protectedFile = path.join(runtime, 'workers/narrator-worker/src/protected-spend.ts');
  fs.appendFileSync(protectedFile, '\n// synthetic mutation\n');
  assert.throws(() => actualSourceCheck(runtime, f.sha), /source dirty/);
});
test('dirty source and a mismatched head produce no build context', () => {
  const f = fixture(); fs.appendFileSync(path.join(f.root, 'package.json'), '\n');
  assert.throws(f.prepare, /source_dirty/); assert.equal(fs.existsSync(f.output), false);
  assert.throws(() => prepareNarratorBuildContext({ repositoryRoot: f.root, sourceSha: 'f'.repeat(40), outputDirectory: f.output }), /source_mismatch/);
});
test('repeated exports preserve identical archived source and Git object bytes', () => {
  const f = fixture(); f.prepare(); const other = path.join(f.parent, 'context-two');
  prepareNarratorBuildContext({ repositoryRoot: f.root, sourceSha: f.sha, outputDirectory: other });
  function files(root, prefix = '') {
    return fs.readdirSync(path.join(root, prefix)).sort().flatMap(name => {
      const file = path.join(prefix, name), stat = fs.lstatSync(path.join(root, file));
      return stat.isDirectory() ? files(root, file) : [file];
    });
  }
  const paths = files(f.output); assert.deepEqual(paths, files(other));
  for (const file of paths) assert.deepEqual(fs.readFileSync(path.join(f.output, file)), fs.readFileSync(path.join(other, file)), file);
});
test('unsafe tracked worker entries are rejected before export', () => {
  const f = fixture(); fs.symlinkSync('package.json', path.join(f.root, 'workers/narrator-worker/unsafe-link'));
  git(f.root, 'add', '.'); git(f.root, '-c', 'user.name=Synthetic Build Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'Synthetic unsafe entry');
  assert.throws(() => prepareNarratorBuildContext({ repositoryRoot: f.root, sourceSha: git(f.root, 'rev-parse', 'HEAD'), outputDirectory: f.output }), /unsafe_source_entry/);
  assert.equal(fs.existsSync(f.output), false);
});
test('existing or source-internal destinations cannot be overwritten', () => {
  const f = fixture(); fs.mkdirSync(f.output); fs.writeFileSync(path.join(f.output, 'retained.txt'), 'retained');
  assert.throws(f.prepare, /destination_invalid/); assert.equal(fs.readFileSync(path.join(f.output, 'retained.txt'), 'utf8'), 'retained');
  assert.throws(() => prepareNarratorBuildContext({ repositoryRoot: f.root, sourceSha: f.sha, outputDirectory: path.join(f.root, 'context') }), /destination_invalid/);
});
test('Docker and deployment use the protected Git context and frozen workspace graph', () => {
  const docker = fs.readFileSync(path.join(sourceRoot, 'workers/narrator-worker/Dockerfile'), 'utf8');
  assert.ok(docker.includes('COPY runtime-source/ ./'));
  assert.ok(docker.includes('pnpm install --frozen-lockfile --filter narrator-worker...'));
  assert.ok(docker.includes('WORKDIR /app/workers/narrator-worker'));
  assert.ok(!docker.includes("delete pkg.dependencies"));
  const wrapper = fs.readFileSync(path.join(sourceRoot, 'scripts/deploy-workers-approved.sh'), 'utf8');
  assert.ok(wrapper.includes('prepare-narrator-build-context.mjs --source-sha "$GITHUB_SHA"'));
  assert.ok(wrapper.includes('-C "$build_dir"'));
});
process.on('exit', () => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });
