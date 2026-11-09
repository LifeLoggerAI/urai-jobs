import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const schema = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: schema, require });
const app = { use() {}, get() {}, post() {}, listen() {} };
const worker = {};
let privateReads = 0;
vm.runInNewContext(fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8')
  + '\nmodule.exports = { parsePayload, renderLifeMovie };', {
  module: worker, Buffer, AbortController, console,
  process: { env: { GCS_BUCKET_NAME: 'private-fixture-bucket', URAI_ENV: 'test' } },
  require(name) {
    if (name === 'express') return Object.assign(() => app, { json: () => () => {} });
    if (name === 'firebase-admin') return { initializeApp() {}, storage() { privateReads++; throw new Error('unexpected_private_storage_read'); } };
    return require(name);
  },
});
const payload = {
  schemaVersion: 'urai-life-movie-render-v1', projectId: 'project-fixture', renderPlanDigest: 'a'.repeat(64),
  sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`, sceneTruthDigest: 'b'.repeat(64),
  outputPrefix: 'tenants/tenant-fixture/life-movies/project-fixture/render-1', width: 320, height: 320, fps: 30,
  sources: [{ id: 'source-fixture', bucket: 'private-fixture-bucket', objectPath: 'tenants/tenant-fixture/source.mp4',
    mimeType: 'video/mp4', provenance: 'original-source', sourceRefs: ['synthetic-source-reference'], consentRef: 'fixture-consent', ownerOrRightsRef: 'fixture-rights' }],
  timeline: [{ sourceId: 'source-fixture', startMs: 0, endMs: 1000 }],
  audioCues: [], spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
};
const job = text => ({ type: 'studio.render.video', tenantId: 'tenant-fixture', ownerUid: 'owner-fixture',
  jobId: 'job-fixture', leaseToken: 'lease-fixture', payload: { ...payload, subtitleText: text } });
const denied = [
  ['malformed text', 'not an SRT caption'],
  ['outside timeline', '1\n00:00:00,000 --> 00:00:01,001\nFixture caption\n'],
  ['reversed time', '1\n00:00:00,900 --> 00:00:00,100\nFixture caption\n'],
  ['zero duration', '1\n00:00:00,100 --> 00:00:00,100\nFixture caption\n'],
  ['invalid seconds', '1\n00:00:60,000 --> 00:00:60,100\nFixture caption\n'],
  ['invalid minutes', '1\n00:60:00,000 --> 00:60:00,100\nFixture caption\n'],
  ['missing caption', '1\n00:00:00,000 --> 00:00:00,500\n'],
  ['malformed second cue', '1\n00:00:00,000 --> 00:00:00,500\nFixture caption\n\n2\ninvalid timing\nSecond fixture\n'],
];
let cases = 0;
for (const [name, text] of denied) {
  if (process.argv.includes('--reproduce')) {
    assert.equal(schema.StudioLifeMovieRenderPayloadSchema.safeParse(job(text).payload).success, true);
    assert.equal(worker.exports.parsePayload(job(text)).subtitleText, text);
    console.log(`[REPRODUCED] ordinary Functions and worker accept ${name}`); cases++; continue;
  }
  assert.equal(schema.StudioLifeMovieRenderPayloadSchema.safeParse(job(text).payload).success, false, name);
  assert.throws(() => worker.exports.parsePayload(job(text)), /life_movie_subtitle_(invalid|outside_timeline)/, name);
  await assert.rejects(worker.exports.renderLifeMovie(job(text)), /life_movie_subtitle_(invalid|outside_timeline)/, name);
  assert.equal(privateReads, 0, 'invalid captions must fail before private data, queue execution or FFmpeg');
  console.log(`[PASS] ordinary Functions and worker deny ${name} before private storage`); cases++;
}
if (!process.argv.includes('--reproduce')) {
  for (const text of ['', ' \r\n ', '1\n00:00:00,000 --> 00:00:01,000\nExact endpoint\n',
    '1\r\n00:00:00,001 --> 00:00:00,999\r\nपहली पंक्ति\r\n第二行\r\n',
    '00:00:00,000 --> 00:00:00,500\nCaption without input index\n']) {
    assert.equal(schema.StudioLifeMovieRenderPayloadSchema.safeParse(job(text).payload).success, true);
    assert.equal(worker.exports.parsePayload(job(text)).subtitleText, text, 'valid original caption bytes remain unchanged'); cases++;
  }
  console.log(`[PASS] ${cases} ordinary caption admission/worker parity cases; original UTF-8/CRLF, empty captions and exact endpoint preserved; cloud acceptance:false`);
}
