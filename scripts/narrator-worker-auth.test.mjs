import assert from 'node:assert/strict';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

// Execute the checked-in narrator HTTP authentication function, not a
// rewritten policy. All tokens below are synthetic and never sent externally.
const ts = createRequire(new URL('../workers/narrator-worker/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../workers/narrator-worker/src/runtime.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('runtime.ts', source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'requireWorkerAuth');
assert.ok(fn?.body, 'original narrator runtime missing requireWorkerAuth');
const compiled = ts.transpileModule(fn.getText(ast) + '\nmodule.exports={requireWorkerAuth};', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);

function auth({token, env = 'local', emulator = true, header = ''}) {
  const logs = [];
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports,
    process: { env: {
      URAI_ENV: env,
      FUNCTIONS_EMULATOR: emulator ? 'true' : undefined,
      URAI_JOBS_WORKER_TOKEN: token,
    }},
    String, createHash, timingSafeEqual,
    log: (severity, event, fields) => logs.push({severity, event, fields}),
  });
  let status, result, next = 0;
  const req = { requestId: 'synthetic-id', header: name => name === 'authorization' ? header : '' };
  const res = {
    status(value) { status = value; return this; },
    send(value) { result = value; return this; },
  };
  module.exports.requireWorkerAuth(req, res, () => next++);
  return { status, result, next, logs };
}

test('missing bearer secret must deny local/test/emulator/staging/production traffic', () => {
  for (const env of ['local', 'test', 'development', 'staging', 'production']) {
    for (const emulator of [true, false]) {
      for (const header of ['', 'Bearer fake']) {
        const result = auth({token: undefined, env, emulator, header});
        assert.equal(result.next, 0, 'anonymous admission: ' + env + '/' + emulator);
        assert.equal(result.status, 503);
      }
    }
  }
});
test('whitespace-only secret is never valid authority', () => {
  const result = auth({token: '   ', env: 'test', header: 'Bearer    '});
  assert.equal(result.next, 0);
  assert.equal(result.status, 503);
});
test('exact configured synthetic token authenticates in all environments', () => {
  for (const env of ['local', 'test', 'staging', 'production']) {
    const result = auth({token: 'synthetic-token', env, header: 'Bearer synthetic-token'});
    assert.equal(result.next, 1);
    assert.equal(result.status, undefined);
  }
});
test('wrong scheme, spelling, bearer encoding, or trailing bytes rejects', () => {
  for (const header of ['', 'Bearer wrong', 'Basic synthetic-token',
    'bearer synthetic-token', 'Bearer synthetic-token ',
    'Bearer synthetic-token,Bearer stolen']) {
    const result = auth({token: 'synthetic-token', header});
    assert.equal(result.next, 0);
    assert.equal(result.status, 401);
  }
});
test('auth event logs do not disclose the configured synthetic secret', () => {
  for (const header of ['Bearer false', 'Bearer synthetic-token']) {
    const result = auth({token: 'synthetic-token', header});
    assert.doesNotMatch(JSON.stringify(result.logs), /synthetic-token/);
  }
});
