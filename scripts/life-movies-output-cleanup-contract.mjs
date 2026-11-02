import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { cleanupPinnedPrivateOutputs } = require('../workers/studio-worker/private-output-cleanup.js');
const worker = readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const n = (s) => (worker.match(s) ?? []).length;
assert.equal(n(/writtenObjects\.push\(\{ destination, generation: uploadedGeneration \}\)/g), 2);
assert.equal(n(/pendingUnfencedOutputWrite = true;/g), 2);
assert.equal(n(/pendingUnfencedOutputWrite = false;/g), 4);
assert.equal(n(/await cleanupPinnedPrivateOutputs\(bucket, writtenObjects,/g), 2);
assert.doesNotMatch(worker, /bucket\.file\(destination\)\.delete\(/);
let passed = 5;
const calls = [];
const bucket = { file(destination, options) {
  return { async delete(opts) { calls.push({ destination, options, opts }); } };
} };
await cleanupPinnedPrivateOutputs(bucket, [{destination:'tenant/output.mp4',generation:'1793378565000001'}], 'render_cleanup_incomplete');
assert.equal(calls.length, 1);
assert.equal(calls[0].options.generation, 1793378565000001);
assert.equal(calls[0].options.preconditionOpts.ifGenerationMatch, '1793378565000001');
assert.deepEqual(calls[0].opts, {ignoreNotFound:true});
passed += 4;
for (const generation of [null, undefined, 0, '0', '01', '9007199254740992', '-1']) {
  const before = calls.length;
  await assert.rejects(cleanupPinnedPrivateOutputs(bucket, [{destination:'tenant/x',generation}], 'render_cleanup_incomplete'), /render_cleanup_incomplete/);
  assert.equal(calls.length, before);
  passed++;
}
const replaced = { file() { return { async delete() { const e = new Error('generation replaced'); e.code = 412; throw e; } }; } };
await assert.rejects(cleanupPinnedPrivateOutputs(replaced,[{destination:'tenant/x',generation:'7'}],'assembly_cleanup_incomplete'), /assembly_cleanup_incomplete/);
passed++;
await cleanupPinnedPrivateOutputs(bucket, [], 'render_cleanup_incomplete');
passed++;
console.log('[PASS] '+passed+' synthetic generation-fenced output cleanup checks; no cloud access.');
