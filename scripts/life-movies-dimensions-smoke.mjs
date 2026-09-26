import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const schemaExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: schemaExports, require });
const app = { use() {}, get() {}, post() {}, listen() {} };
const express = Object.assign(() => app, { json: () => () => {} });
const worker = {};
vm.runInNewContext(fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8') + '\nmodule.exports = { parsePayload, renderSegments, gapArgs };', {
  module: worker, Buffer, console,
  process: { env: { GCS_BUCKET_NAME: 'private-fixture-bucket' } },
  require(name) {
    if (name === 'express') return express;
    if (name === 'firebase-admin') return { initializeApp() {} };
    return require(name);
  },
});
const payload = {
  schemaVersion: 'urai-life-movie-render-v1', projectId: 'project-1', renderPlanDigest: 'a'.repeat(64),
  outputPrefix: 'tenants/tenant-1/life-movies/project-1/render-1',
  width: 1920, height: 1080, fps: 30,
  sources: [{ id: 'source-1', bucket: 'private-fixture-bucket', objectPath: 'tenants/tenant-1/source.png', mimeType: 'image/png', provenance: 'original-source', sourceRefs: ['fixture'], consentRef: 'consent-1', ownerOrRightsRef: 'rights-1' }],
  timeline: [{ sourceId: 'source-1', startMs: 0, endMs: 1000 }],
  spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
};
function workerParse(value) {
  return worker.exports.parsePayload({ type: 'studio.render.video', tenantId: 'tenant-1', payload: value });
}
for (const [width, height] of [[320, 320], [1920, 1080], [3840, 2160]]) {
  const value = { ...payload, width, height };
  assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(value).success, true);
  assert.equal(workerParse(value).width, width);
}
for (const [width, height] of [[321, 1080], [1920, 1081], [3839, 3839], [318, 1080], [3842, 1080]]) {
  const value = { ...payload, width, height };
  assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(value).success, false, `admission must reject ${width}x${height}`);
  assert.throws(() => workerParse(value), /invalid_(width|height)/);
}
console.log('[PASS] Life Movies admission and worker reject dimensions unsupported by yuv420p');

const timing = workerParse({ ...payload, timeline: [
  { sourceId: 'source-1', startMs: 1500, endMs: 2000 },
  { sourceId: 'source-1', startMs: 500, endMs: 1000 },
] });
const segments = JSON.parse(JSON.stringify(worker.exports.renderSegments(timing.timeline)));
assert.deepEqual(segments, [
  { kind: 'gap', startMs: 0, endMs: 500 },
  { kind: 'source', sourceId: 'source-1', startMs: 500, endMs: 1000 },
  { kind: 'gap', startMs: 1000, endMs: 1500 },
  { kind: 'source', sourceId: 'source-1', startMs: 1500, endMs: 2000 },
]);
assert.equal(segments.reduce((total, item) => total + item.endMs - item.startMs, 0), 2000);
assert.equal(worker.exports.renderSegments(workerParse(payload).timeline).length, 1);
assert.throws(() => workerParse({ ...payload, timeline: [
  { sourceId: 'source-1', startMs: 0, endMs: 1000 },
  { sourceId: 'source-1', startMs: 500, endMs: 1500 },
] }), /overlapping_timeline/);
const args = worker.exports.gapArgs('gap.mp4', 0.5, 320, 320, 30);
assert.ok(args.includes('color=c=black:s=320x320:r=30'));
assert.ok(args.includes('anullsrc=channel_layout=stereo:sample_rate=48000'));
assert.equal(args[args.indexOf('-t') + 1], '0.5');
console.log('[PASS] Life Movies output timeline preserves leading/inter-clip gaps and chronological ordering');
