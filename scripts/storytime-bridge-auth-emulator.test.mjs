import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';

// Test checked-in Storytime narrator bridge functions, not a rewritten authorizer.
// An emulator must not bypass the dedicated service identity.
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/jobs/storytimeNarratorBridge.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storytimeNarratorBridge.ts', source, ts.ScriptTarget.Latest, true);
const names = ['productionRuntime', 'configuredToken', 'authorized'];
const functions = names.map((name) => {
  const node = ast.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node?.body, 'missing checked-in Storytime function ' + name);
  return node.getText(ast);
});
const compiled = ts.transpileModule([...functions, 'module.exports = { authorized };'].join('\n'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadAuthorize({ env = {}, token = '', unavailableSecret = false } = {}) {
  const module = { exports: {} };
  const bridgeTokenSecret = { value: () => {
    if (unavailableSecret) throw new Error('synthetic_secret_unavailable');
    return token;
  } };
  vm.runInNewContext(compiled, { module, exports: module.exports, process: { env },
    bridgeTokenSecret, createHash, timingSafeEqual, Set, String });
  return module.exports.authorized;
}

test('Storytime narrator bridge rejects missing identity in emulator across environments', () => {
  for (const NODE_ENV of ['development', 'test', 'staging', 'production']) {
    const authorize = loadAuthorize({ env: { NODE_ENV, FUNCTIONS_EMULATOR: 'true' } });
    for (const header of ['', 'Bearer ', 'Bearer fabricated-token', 'Basic fabricated-token']) {
      assert.equal(authorize(header), false, 'anonymous emulator admission: ' + NODE_ENV);
    }
  }
});

test('Storytime narrator bridge accepts only the configured exact bearer', () => {
  const authorize = loadAuthorize({ env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true',
    URAI_STORYTIME_JOBS_BRIDGE_TOKEN: 'synthetic-storytime-token' } });
  assert.equal(authorize('Bearer synthetic-storytime-token'), true);
  for (const header of ['', 'Bearer incorrect', 'Basic synthetic-storytime-token',
    'bearer synthetic-storytime-token', 'Bearer synthetic-storytime-token ',
    'Bearer synthetic-storytime-token, Bearer second']) {
    assert.equal(authorize(header), false);
  }
});

test('Storytime narrator Secret Manager token takes precedence over environment fallback', () => {
  const authorize = loadAuthorize({ env: { NODE_ENV: 'production',
    URAI_STORYTIME_JOBS_BRIDGE_TOKEN: 'synthetic-env-incorrect' }, token: 'synthetic-secret-manager' });
  assert.equal(authorize('Bearer synthetic-secret-manager'), true);
  assert.equal(authorize('Bearer synthetic-env-incorrect'), false);
});

test('Storytime narrator unavailable secret denies without explicit synthetic fallback', () => {
  const noToken = loadAuthorize({ env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true' }, unavailableSecret: true });
  assert.equal(noToken('Bearer fabricated-token'), false);
  const fallback = loadAuthorize({ env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true',
    URAI_STORYTIME_JOBS_BRIDGE_TOKEN: 'synthetic-fallback' }, unavailableSecret: true });
  assert.equal(fallback('Bearer synthetic-fallback'), true);
  assert.equal(fallback('Bearer fabricated-token'), false);
});
