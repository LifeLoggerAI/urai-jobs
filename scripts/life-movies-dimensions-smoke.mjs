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
vm.runInNewContext(fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8') + '\nmodule.exports = { parsePayload, renderSegments, gapArgs, LIFE_MOVIE_EXECUTION_BUDGET };', {
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
  sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`,
  sceneTruthDigest: 'b'.repeat(64),
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

assert.deepEqual(JSON.parse(JSON.stringify(worker.exports.LIFE_MOVIE_EXECUTION_BUDGET)),
  JSON.parse(JSON.stringify(schemaExports.LIFE_MOVIE_EXECUTION_BUDGET)));
for (const [width, height, fps, durationMs] of [
  [1920, 1080, 30, 15000], [3840, 2160, 30, 3750], [320, 320, 60, 30000],
]) {
  const value = { ...payload, width, height, fps, timeline: [{ sourceId: 'source-1', startMs: 0, endMs: durationMs }] };
  assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(value).success, true);
  assert.equal(workerParse(value).timeline[0].endMs, durationMs);
  const outside = { ...value, timeline: [{ sourceId: 'source-1', startMs: 0, endMs: durationMs + 1 }] };
  assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(outside).success, false);
  assert.throws(() => workerParse(outside), /synchronous_render_budget/);
}
for (const value of [
  { ...payload, width: 3840, height: 3840 },
  { ...payload, timeline: [{ sourceId: 'source-1', startMs: 2699000, endMs: 2700000 }] },
  { ...payload, sources: Array.from({ length: 13 }, (_, i) => ({ ...payload.sources[0], id: `source-${i + 1}` })) },
  { ...payload, timeline: Array.from({ length: 13 }, (_, i) => ({ sourceId: 'source-1', startMs: i * 100, endMs: (i + 1) * 100 })) },
]) {
  assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(value).success, false);
  assert.throws(() => workerParse(value), /synchronous_render_budget|life_movie_too_large/);
}
console.log('[PASS] Synchronous render budget parity, exact boundaries, gaps, source/item counts and long-form rejection');

// R1731 intentionally RED review-only regression: no GCS write after revocation ACK.
// Synthetic Firestore/storage mocks only; no customer media or cloud access.
async function checkNoPostAckWrite() {
  const src=fs.readFileSync(new URL('../workers/studio-worker/index.js',import.meta.url),'utf8');
  const slice=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
  const render=/^  async function uploadPrivateFile\(localPath, destination, contentType\) \{[\s\S]*?^  \}/m.exec(src);
  const assembly=/^    async function uploadPrivateFile\(localPath, destination, contentType\) \{[\s\S]*?^    \}/m.exec(src);
  assert.ok(render&&assembly,'both direct writer paths present');
  const normalized=s=>s.split('\n').map(x=>x.trim()).join('\n');
  assert.equal(normalized(render[0]),normalized(assembly[0]),'same unprotected upload on both paths');
  const code=slice('function canonicalJson(value)','function timingSafeTokenMatch')+
    slice('function safeSegment(value, field)','function safeObjectPath')+'\n'+render[0];
  for(const jobType of ['studio.render.video','studio.assemble.video']) {
    const job={jobId:'job1',jobType,leaseToken:'lease1',tenantId:'tenant1',
      ownerUid:'owner1',payload:{x:1},status:'RUNNING',execution:{leaseToken:'lease1'},
      consent:{purpose:'life-movie.render'}};
    let revoked=false,ack=false,start,finish;const committed=[];
    const started=new Promise(resolve=>{start=resolve});
    const barrier=new Promise(resolve=>{finish=resolve});
    const admin={firestore:()=>({collection:n=>({doc:()=>({get:async()=>n==='jobs'
      ?{exists:true,data:()=>job}:{exists:revoked,data:()=>({active:revoked})}})})})};
    const context={crypto:require('node:crypto'),admin,AbortController,setTimeout,
      clearTimeout,process,Error,JSON,Promise,Number,Set,control:null,writtenObjects:[],
      fs:{createReadStream:()=>({})},
      bucket:{file:destination=>({createWriteStream:()=>({destination})})},
      pipeline:async(_src,out,opts)=>{start();await barrier;if(opts.signal.aborted)
        throw opts.signal.reason;committed.push({destination:out.destination,afterAck:ack})}};
    vm.createContext(context);vm.runInContext(code,context);
    const control=vm.runInContext('createRenderControl',context)(job);
    context.control=control;
    try {
      await control.start();
      const write=vm.runInContext('uploadPrivateFile',context)(
        'synthetic','tenants/tenant1/life-movies/test.mp4','video/mp4');
      await started;
      job.status='CANCELLED';job.execution.leaseToken='revoked';revoked=true;ack=true;
      finish();
      await assert.rejects(write,/revok|fenc|denied|unauthoriz/i,
        jobType+': in-flight write completed after revocation ACK');
      assert.equal(committed.length,0,jobType+': post-ACK object persisted');
    } finally {finish();control.stop();}
  }
}
await checkNoPostAckWrite();


