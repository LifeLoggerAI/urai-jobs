import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const producer = createRequire(import.meta.url)(process.env.CR_GAUSSIAN_SOURCE || '../workers/captured-reality-worker/gaussian-package.js');
// Exact consumer source from Spatial 9f59cd94a24e362a53b5ebf0c12eab986e207a6f.
// This executes its real validation/stream implementation with synthetic bytes.
const consumerSource = fs.readFileSync(new URL('./fixtures/captured-reality-spatial-splat-stream-9f59.ts', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(consumerSource).digest('hex'),
  'fcb01d265fe5e703e103708954f020720bd1d269bfa2668f112413bb37a58eee',
  'pinned consumer source must retain exact upstream bytes');
const exports = {};
vm.runInNewContext(ts.transpileModule(consumerSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText, { exports, Uint8Array, DataView, Number, Error, fetch });
const fields = ['x','y','z','f_dc_0','f_dc_1','f_dc_2','opacity','scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3'];
function ply(rows) {
  const header = Buffer.from('ply\nformat binary_little_endian 1.0\nelement vertex ' + rows.length + '\n'
    + fields.map(name => 'property float ' + name).join('\n') + '\nend_header\n');
  const binary = Buffer.alloc(rows.length * fields.length * 4);
  rows.forEach((row, index) => fields.forEach((name, field) => {
    const value = row[name] ?? (name === 'rot_0' ? 1 : 0);
    binary.writeFloatLE(value, (index * fields.length + field) * 4);
  }));
  return Buffer.concat([header, binary]);
}
for (const [label, rows] of [
  ['ordinary visible gaussian', [{}]],
  ['consumer position limit', [{ x: 1e7, y: -1e7 }]],
  ['large consumer-safe scale', [{ scale_0: Math.log(9999), scale_1: Math.log(9999), scale_2: Math.log(9999) }]],
  ['small consumer-safe scale', [{ scale_0: Math.log(1.01e-7), scale_1: Math.log(1.01e-7), scale_2: Math.log(1.01e-7) }]],
  ['mixed visible and transparent records', [{ opacity: -100 }, {}]],
]) {
  const result = producer.packageGaussian(ply(rows));
  assert.ok(exports.validateSplatRecords(result.runtime) > 0);
  const seen = [];
  const proof = await exports.streamCapturedRealitySplat({ url: 'https://synthetic-runtime.invalid',
    maxBytes: 64 * 1024 * 1024, chunkSize: 1, signal: new AbortController().signal,
    onHeader: value => assert.equal(value, result.runtime.length),
    onChunk: bytes => seen.push(Buffer.from(bytes)),
    fetcher: async () => new Response(result.runtime, { headers: { 'content-length': String(result.runtime.length) } }),
  });
  assert.equal(proof.pointCount, rows.length);
  assert.deepEqual(Buffer.concat(seen), result.runtime);
  console.log('[PASS] actual Gaussian producer -> pinned Spatial streaming consumer: ' + label);
}
for (const [label, row, error] of [
  ['position outside consumer range', { x: 1e7 + 100 }, /GAUSSIAN_RANGE_INVALID/],
  ['scale above consumer range', { scale_0: Math.log(10100) }, /GAUSSIAN_RANGE_INVALID/],
  ['scale below consumer range', { scale_0: Math.log(9e-8) }, /GAUSSIAN_RANGE_INVALID/],
  ['all transparent output', { opacity: -100 }, /GAUSSIAN_HAS_NO_VISIBLE_POINTS/],
]) {
  assert.throws(() => producer.packageGaussian(ply([row])), error);
  console.log('[PASS] producer rejects ' + label + ' before private runtime publication');
}
console.log('URAI_CR_PRODUCER_CONSUMER_SYNTHETIC_VALIDATION: complete; Spatial consumer SHA256=' +
  createHash('sha256').update(consumerSource).digest('hex') + '; no private reconstruction, CUDA, storage, GPU or device acceptance');
