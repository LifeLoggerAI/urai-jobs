import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { prepareNarratorBuildContext } from './prepare-narrator-build-context.mjs';
const prepareNarratorSourceContext = ({sourceRoot,expectedSha,context}) => prepareNarratorBuildContext({repositoryRoot:sourceRoot,sourceSha:expectedSha,outputDirectory:context});
const require = createRequire(new URL('../workers/narrator-worker/package.json', import.meta.url)), ts = require('typescript');
const proofModule = require('./runtime-source-proof.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-narrator-source-')), source = path.join(temp, 'source'), worker = 'workers/narrator-worker';
fs.mkdirSync(source);
const write = (relative, value) => { const p = path.join(source, relative); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, value); };
for (const name of ['package.json', `${worker}/package.json`, 'packages/shared-types/package.json']) write(name, '{}\n');
write('pnpm-lock.yaml', 'lockfileVersion: 6.0\n'); write('pnpm-workspace.yaml', 'packages: [workers/*]\n');
write(`${worker}/tsconfig.json`, JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'CommonJS', rootDir: 'src', outDir: 'dist', types: [], skipLibCheck: true }, include: ['src/**/*.ts'] }));
write(`${worker}/Dockerfile`, fs.readFileSync(new URL('../workers/narrator-worker/Dockerfile', import.meta.url)));
write(`${worker}/runtime-source-proof.cjs`, fs.readFileSync(new URL('../workers/narrator-worker/runtime-source-proof.cjs', import.meta.url)));
for (const name of ['protected-spend', 'handlers/narrator-tts']) {
  write(`${worker}/src/${name}.ts`, `export const synthetic = 1;\n`);
  write(`${worker}/src/${name}.js`, `exports.synthetic = 1;\n`);
}
write(`${worker}/src/other.ts`, 'export const other = 1;\n');
write('.gitignore', '**/dist/\n**/node_modules/\n');
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
git('init', '--quiet'); git('add', '.'); git('-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'Synthetic source authority');
const sha = git('rev-parse', 'HEAD'), context = path.join(temp, 'context'), root = path.join(context, 'runtime-source'); let count = 0;
const test = (label, fn) => { fn(); count++; console.log(`[PASS] ${label}`); };
const proofPath = path.join(root, worker, 'runtime-source-attestation.json');
function actualProductionSourceGuard() {
  const source = fs.readFileSync(new URL('../workers/narrator-worker/src/protected-spend.js', import.meta.url), 'utf8'), module = {exports:{}};
  const scopedRequire = name => name === '../runtime-source-proof.cjs' ? proofModule : require(name);
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {process:{cwd:()=>path.join(root,worker),env:{URAI_SOURCE_SHA:sha,NODE_ENV:'production'}},__dirname:path.join(root,worker,'dist'),Buffer,Headers,URL,AbortController,AbortSignal})(scopedRequire,module,module.exports);
  return module.exports.narratorExecutorSourceSha();
}
function changedProof(mutate, assertion) { const original = fs.readFileSync(proofPath); try { const p = JSON.parse(original); mutate(p); fs.writeFileSync(proofPath, JSON.stringify(p)); assertion(); } finally { fs.writeFileSync(proofPath, original); } }
function changedFile(relative, update, assertion) { const file = path.join(root, relative), original = fs.readFileSync(file); try { fs.writeFileSync(file, update); assertion(); } finally { fs.writeFileSync(file, original); } }
const archive = dir => execFileSync('bash', ['-c', 'set -euo pipefail; tar --sort=name --mtime="UTC 1970-01-01" --owner=0 --group=0 --numeric-owner --format=ustar -cf - -C "$1" . | gzip -n', 'synthetic', dir]);
try {
  const receipt = prepareNarratorSourceContext({ sourceRoot: source, expectedSha: sha, context });
  test('actual tracked source builds a source-commit proof without Git in context', () => { assert.equal(proofModule.verifySourceProof(root, sha).sourceSha, sha); assert.equal(fs.existsSync(path.join(root, '.git')), true); assert.equal(receipt.spendAuthorized, false); });
  test('context and receipt reproduce exactly in another new external directory', () => { const other = path.join(temp, 'context-2'); const r = prepareNarratorSourceContext({ sourceRoot: source, expectedSha: sha, context: other }); assert.deepEqual(r, receipt); assert.deepEqual(fs.readFileSync(proofPath), fs.readFileSync(path.join(other, 'runtime-source', worker, 'runtime-source-attestation.json'))); });
  test('exact source contexts produce byte-identical deterministic submit archives', () => assert.deepEqual(archive(context), archive(path.join(temp, 'context-2'))));
  execFileSync('git', ['-C',root,'read-tree','HEAD']);
  test('actual production paid helper rejects clean Git source without artifact seal', () => assert.throws(actualProductionSourceGuard));
  test('unsealed runtime cannot claim artifact integrity', () => assert.throws(() => proofModule.verifyRuntimeSourceProof(root, sha), /artifact_seal_missing/));
  test('declared source SHA cannot relabel another actual Git commit', () => assert.throws(() => proofModule.verifySourceProof(root, 'a'.repeat(40)), /identity_invalid/));
  test('altered commit bytes cannot claim original commit hash', () => changedProof(p => { p.objects.find(o => o.type === 'commit').data = Buffer.from('tree ' + 'a'.repeat(40) + '\n').toString('base64'); }, () => assert.throws(() => proofModule.verifySourceProof(root, sha), /object_hash_invalid/)));
  test('altered tree bytes cannot redirect original code authority', () => changedProof(p => { p.objects.find(o => o.type === 'tree').data = Buffer.from('forged tree').toString('base64'); }, () => assert.throws(() => proofModule.verifySourceProof(root, sha), /object_hash_invalid/)));
  test('missing mandatory source proof is rejected', () => changedProof(p => { p.files = p.files.filter(f => !f.path.endsWith('/protected-spend.ts')); }, () => assert.throws(() => proofModule.verifySourceProof(root, sha), /identity_invalid|required_source_missing/)));
  test('nonmandatory compiler input cannot be omitted from source membership', () => changedProof(p => { p.files = p.files.filter(f => !f.path.endsWith('/other.ts')); }, () => assert.throws(() => proofModule.verifySourceProof(root, sha), /complete_source_membership_missing/)));
  test('duplicate source proof is rejected', () => changedProof(p => p.files.push(p.files[0]), () => assert.throws(() => proofModule.verifySourceProof(root, sha), /duplicate_source/)));
  test('unsafe manifest path is rejected before reading outside source', () => changedProof(p => { p.files[0].path = '../secret'; }, () => assert.throws(() => proofModule.verifySourceProof(root, sha), /path_invalid/)));
  test('changed actual runtime source bytes are rejected', () => changedFile(`${worker}/src/protected-spend.ts`, 'export const forged = 2;', () => assert.throws(() => proofModule.verifySourceProof(root, sha), /source_bytes_invalid/)));
  test('source symlinks cannot escape the packaged context', () => { const p = path.join(root, worker, 'src/protected-spend.ts'), backup = p + '.bak'; fs.renameSync(p, backup); try { fs.symlinkSync(backup, p); assert.throws(() => proofModule.verifySourceProof(root, sha), /entry_invalid/); } finally { fs.unlinkSync(p); fs.renameSync(backup, p); } });
  const config = ts.readConfigFile(path.join(root, worker, 'tsconfig.json'), ts.sys.readFile), parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.join(root, worker));
  const program = ts.createProgram(parsed.fileNames, parsed.options); assert.equal(ts.getPreEmitDiagnostics(program).length, 0); program.emit();
  test('actual compiler output seals only after matching verified source bytes', () => { proofModule.sealArtifacts(root); assert.equal(proofModule.verifyRuntimeSourceProof(root, sha), sha); });
  test('actual production helper accepts only exact source and sealed compiler output integrity', () => assert.equal(actualProductionSourceGuard(),sha));
  test('actual production helper rejects altered compiled paid leaf before provider admission', () => changedFile(`${worker}/dist/protected-spend.js`, 'exports.forged = 2;', () => assert.throws(actualProductionSourceGuard)));
  test('modified compiled paid leaf cannot pass runtime admission source check', () => changedFile(`${worker}/dist/protected-spend.js`, 'exports.forged = 2;', () => assert.throws(() => proofModule.verifyRuntimeSourceProof(root, sha), /artifact_bytes_invalid/)));
  test('unaccounted executable output is rejected', () => { const p = path.join(root, worker, 'dist/foreign.js'); fs.writeFileSync(p, 'forged'); try { assert.throws(() => proofModule.verifyRuntimeSourceProof(root, sha), /artifact_set_invalid/); } finally { fs.unlinkSync(p); } });
  test('artifact symlinks are rejected', () => { const p = path.join(root, worker, 'dist/foreign.js'); fs.symlinkSync('protected-spend.js', p); try { assert.throws(() => proofModule.verifyRuntimeSourceProof(root, sha), /artifact_symlink/); } finally { fs.unlinkSync(p); } });
  test('missing actual compiled leaf is rejected', () => { const p = path.join(root, worker, 'dist/protected-spend.js'), bytes = fs.readFileSync(p); fs.unlinkSync(p); try { assert.throws(() => proofModule.verifyRuntimeSourceProof(root, sha), /artifact_set_invalid/); } finally { fs.writeFileSync(p, bytes); } });
  test('compiler seal cannot replace mismatched actual emitted bytes', () => changedFile(`${worker}/dist/protected-spend.js`, 'exports.forged = 2;', () => assert.throws(() => proofModule.sealArtifacts(root), /compiler_output_bytes_invalid/)));
  test('output path mutation cannot admit files outside dist', () => changedProof(p => { p.artifacts[0].path = 'package.json'; }, () => assert.throws(() => proofModule.verifyRuntimeSourceProof(root, sha), /artifact_set_invalid/)));
  test('source package refuses an obsolete or declared-only head', () => assert.throws(() => prepareNarratorSourceContext({ sourceRoot: source, expectedSha: 'a'.repeat(40), context: path.join(temp, 'bad-head') }), /source_mismatch/));
  test('source package refuses existing or internal overwrite targets', () => { assert.throws(() => prepareNarratorSourceContext({ sourceRoot: source, expectedSha: sha, context }), /destination_invalid/); assert.throws(() => prepareNarratorSourceContext({ sourceRoot: source, expectedSha: sha, context: path.join(source, 'context') }), /destination_invalid/); });
  test('dirty source cannot be materialized as exact source', () => { const p = path.join(source, worker, 'src/protected-spend.ts'), bytes = fs.readFileSync(p); fs.appendFileSync(p, '// changed'); try { assert.throws(() => prepareNarratorSourceContext({ sourceRoot: source, expectedSha: sha, context: path.join(temp, 'dirty') }), /source_dirty/); } finally { fs.writeFileSync(p, bytes); } });
  test('untracked worker inputs are not silently admitted', () => { const p = path.join(source, worker, 'unexpected.env'); fs.writeFileSync(p, 'synthetic'); try { assert.throws(() => prepareNarratorSourceContext({ sourceRoot: source, expectedSha: sha, context: path.join(temp, 'untracked') }), /source_dirty/); } finally { fs.unlinkSync(p); } });
  console.log(`Narrator runtime source/package: ${count} passed; actual compiler/source/file/archive paths; image builds:0; provider calls:0; spending:0.`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
