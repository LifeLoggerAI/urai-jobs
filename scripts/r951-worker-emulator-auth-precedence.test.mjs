import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Read the original checked-in worker guard expressions; no HTTP/cloud/provider calls.
const entries = [
  {
    name: 'Asset',
    file: '../workers/asset-worker/index.js',
    variable: 'localBypass',
    expression: "!productionRuntime && (runtimeEnv === 'local' || runtimeEnv === 'test' || process.env.FUNCTIONS_EMULATOR === 'true')",
    guard: 'if (!workerToken && localBypass) return next();',
  },
  {
    name: 'Studio',
    file: '../workers/studio-worker/index.js',
    variable: 'localBypass',
    expression: "!productionRuntime && (env === 'local' || env === 'test' || process.env.FUNCTIONS_EMULATOR === 'true')",
    guard: 'if (!expectedToken && localBypass) return next();',
  },
  {
    name: 'Private Source',
    file: '../workers/private-source-worker/src/index.ts',
    variable: 'local',
    expression: "!productionRuntime() && (['local', 'test'].includes(runtimeEnv()) || process.env.FUNCTIONS_EMULATOR === 'true')",
    guard: 'if (!token && local) return next();',
  },
  {
    name: 'legacy Spatial',
    file: '../workers/spatial-worker/index.js',
    variable: 'localBypass',
    expression: "!productionRuntime && (env === 'local' || env === 'test' || process.env.FUNCTIONS_EMULATOR === 'true')",
    guard: 'if (!expectedToken && localBypass) return next();',
  },
];
for (const entry of entries) {
  test(entry.name + ' never permits missing-token bypass in production/staging, even with emulator flag', () => {
    const source = readFileSync(new URL(entry.file, import.meta.url), 'utf8');
    const pattern = new RegExp('^\\s*const ' + entry.variable + ' = ([^\\n;]+);', 'm');
    const match = source.match(pattern);
    assert.ok(match, entry.name + ': missing local bypass declaration');
    assert.equal(match[1], entry.expression, entry.name + ': original guard expression changed');
    assert.ok(source.includes(entry.guard), entry.name + ': missing bearer guard call');
    for (const env of ['prod', 'production', 'staging', 'local', 'test', 'development']) {
      for (const emulator of [false, true]) {
        const production = ['prod', 'production', 'staging'].includes(env);
        const context = {
          env,
          runtimeEnv: entry.name === 'Private Source' ? () => env : env,
          productionRuntime: entry.name === 'Private Source' ? () => production : production,
          process: { env: { FUNCTIONS_EMULATOR: emulator ? 'true' : undefined } },
        };
        const actual = vm.runInNewContext(match[1], context);
        const expected = !production && (env === 'local' || env === 'test' || emulator);
        assert.equal(actual, expected, entry.name + '/' + env + '/emulator=' + emulator);
      }
    }
  });
}
