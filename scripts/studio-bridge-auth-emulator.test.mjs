import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';

// Execute the original checked-in authentication functions, not a rewritten
// approximation. Keep Functions emulator as an untrusted network environment.
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const paths = [
  '../functions/src/jobs/studioLifeMovieBridge.ts',
  '../functions/src/jobs/studioLifeMovieLongformBridge.ts',
];

function loadAuthorizer(path, { env = {}, secret = '', throwSecret = false } = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const names = ['productionRuntime', 'configuredToken', 'authorized'];
  const functions = names.map((name) => {
    const node = ast.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name);
    assert.ok(node?.body, `missing Jobs bridge function ${name} in ${path}`);
    return node.getText(ast);
  });
  const compiled = ts.transpileModule([...functions, 'module.exports = { authorized };'].join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const bridgeTokenSecret = { value: () => {
    if (throwSecret) throw new Error('synthetic_secret_unavailable');
    return secret;
  }};
  vm.runInNewContext(compiled, { module, exports: module.exports, process: { env },
    bridgeTokenSecret, createHash, timingSafeEqual, Error, String, Set });
  return module.exports.authorized;
}

for (const path of paths) {
  const label = path.includes('Longform') ? 'longform' : 'shortform';
  test(`${label}: emulator missing token never authenticates any Authorization header`, () => {
    for (const NODE_ENV of ['development', 'test', 'staging', 'production']) {
      const authorize = loadAuthorizer(path, { env: { NODE_ENV, FUNCTIONS_EMULATOR: 'true' } });
      for (const value of ['', 'Bearer ', 'Bearer fake-token', 'Bearer synthetic-test-token', 'Basic opaque']) {
        assert.equal(authorize(value), false, `${label} accepted missing secret in ${NODE_ENV}`);
      }
    }
  });
  test(`${label}: exact configured environment bearer identity authenticates in emulator and staging`, () => {
    for (const NODE_ENV of ['development', 'production']) {
      const authorize = loadAuthorizer(path, { env: { NODE_ENV, FUNCTIONS_EMULATOR: 'true',
        URAI_STUDIO_JOBS_BRIDGE_TOKEN: 'synthetic-test-token' } });
      assert.equal(authorize('Bearer synthetic-test-token'), true);
      for (const invalid of ['', 'Bearer bad', 'Basic synthetic-test-token', 'bearer synthetic-test-token',
        'Bearer synthetic-test-token ', 'Bearer synthetic-test-token, Bearer other']) {
        assert.equal(authorize(invalid), false);
      }
    }
  });
  test(`${label}: Secret Manager value overrides incompatible emulator environment fallback`, () => {
    const authorize = loadAuthorizer(path, { env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true',
      URAI_STUDIO_JOBS_BRIDGE_TOKEN: 'wrong-fallback' }, secret: 'secret-identity' });
    assert.equal(authorize('Bearer secret-identity'), true);
    assert.equal(authorize('Bearer wrong-fallback'), false);
  });
  test(`${label}: unavailable Secret Manager reader does not authorize without explicit fallback token`, () => {
    const noToken = loadAuthorizer(path, { env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true' }, throwSecret: true });
    assert.equal(noToken('Bearer fabricated'), false);
    const fallback = loadAuthorizer(path, { env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true',
      URAI_STUDIO_JOBS_BRIDGE_TOKEN: 'synthetic-fallback' }, throwSecret: true });
    assert.equal(fallback('Bearer synthetic-fallback'), true);
  });
}
