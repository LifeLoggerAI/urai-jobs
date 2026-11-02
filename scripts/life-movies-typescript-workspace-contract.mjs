#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Each Life Movie contract uses the Functions workspace's declared TypeScript.
// Root hoisting, NODE_PATH or a global installation must not be prerequisites.
const paths = Object.freeze([
  'life-movies-admission-clock-race-contract.mjs',
  'life-movies-admission-preflight-contract.mjs',
  'life-movies-creation-admission-contract.mjs',
  'life-movies-source-rights-contract.mjs',
  'life-movies-firebase-source-rights-adapter-contract.mjs',
  'life-movies-trusted-admission-composition-contract.mjs',
]);
const expected = "createRequire(new URL('../functions/package.json', import.meta.url))('typescript')";
const read = url => readFileSync(new URL(url, import.meta.url), 'utf8');

test('TypeScript belongs to the declared Functions dependencies', () => {
  const pkg = JSON.parse(read('../functions/package.json'));
  assert.ok(pkg.dependencies?.typescript || pkg.devDependencies?.typescript);
});

test('root verify runs the resolver contract before application contracts', () => {
  const pkg = JSON.parse(read('../package.json'));
  const cmd = pkg.scripts?.['urai-jobs:verify'] ?? '';
  assert.ok(cmd.startsWith('node scripts/life-movies-typescript-workspace-contract.mjs && '));
});

for (const path of paths) {
  test(path + ' resolves TypeScript from Functions without root hoisting', () => {
    const source = read(path);
    assert.equal(source.split(expected).length - 1, 1, 'missing Functions owner resolver: ' + path);
    assert.doesNotMatch(source, /createRequire\(import\.meta\.url\)\('typescript'\)/);
    assert.doesNotMatch(source, /\brequire\('typescript'\)/);
  });
}

