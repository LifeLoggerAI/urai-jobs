import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Synthetic motion and tone bytes exercise actual source-time selection.
// They do not establish real-person, private-cloud or artistic acceptance.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const schemas = {};
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(transpile(fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieContract.ts', import.meta.url), 'utf8')), { exports: schemas, require });
const longform = {};
vm.runInNewContext(transpile(fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformContract.ts', import.meta.url), 'utf8')), {
  exports: longform, require(name) { return name === './studioLifeMovieContract.js' ? schemas : require(name); },
});
const app = { use() {}, get() {}, post() {}, listen() {} };
const worker = {};
let privateReads = 0;
vm.runInNewContext(fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8')
  + '\nmodule.exports = { parsePayload, renderLifeMovie, clipArgs };', {
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
  timeline: [{ sourceId: 'source-fixture', startMs: 0, endMs: 750, sourceStartMs: 1250 }],
  audioCues: [], subtitleText: '', spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
};
const job = value => ({ type: 'studio.render.video', tenantId: 'tenant-fixture', ownerUid: 'owner-fixture',
  jobId: 'job-fixture', leaseToken: 'lease-fixture', payload: value });
const reproduce = process.argv.includes('--reproduce');
if (reproduce) {
  assert.equal(schemas.StudioLifeMovieRenderPayloadSchema.safeParse(payload).success, false);
  assert.equal(worker.exports.parsePayload(job(payload)).timeline[0].sourceStartMs, undefined);
  console.log('[REPRODUCED] current admission rejects selected source time; worker drops the source offset');
} else {
  for (const offset of [0, 1250, 45 * 60 * 1000]) {
    const value = { ...payload, timeline: [{ ...payload.timeline[0], sourceStartMs: offset }] };
    assert.equal(schemas.StudioLifeMovieRenderPayloadSchema.safeParse(value).success, true);
    assert.equal(worker.exports.parsePayload(job(value)).timeline[0].sourceStartMs, offset);
  }
  const legacy = { ...payload, timeline: [{ sourceId: 'source-fixture', startMs: 0, endMs: 750 }] };
  assert.equal(schemas.StudioLifeMovieRenderPayloadSchema.safeParse(legacy).success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(worker.exports.parsePayload(job(legacy)).timeline)), legacy.timeline);
  for (const offset of [-1, .5, 45 * 60 * 1000 + 1, null, '1250', false, NaN, Infinity]) {
    const value = { ...payload, timeline: [{ ...payload.timeline[0], sourceStartMs: offset }] };
    assert.equal(schemas.StudioLifeMovieRenderPayloadSchema.safeParse(value).success, false, String(offset));
    assert.throws(() => worker.exports.parsePayload(job(value)), /invalid_timeline_source_start/);
    await assert.rejects(worker.exports.renderLifeMovie(job(value)), /invalid_timeline_source_start/);
    assert.equal(privateReads, 0);
  }
  const still = { ...payload, sources: [{ ...payload.sources[0], mimeType: 'image/png' }] };
  assert.equal(schemas.StudioLifeMovieRenderPayloadSchema.safeParse(still).success, false);
  assert.throws(() => worker.exports.parsePayload(job(still)), /image_source_start_must_be_zero/);
  assert.equal(privateReads, 0);
  const children = longform.planLifeMovieLongformSegments({ ...payload, schemaVersion: 'urai-life-movie-longform-v1',
    timeline: [{ sourceId: 'source-fixture', startMs: 0, endMs: 15000, sourceStartMs: 1000 },
      { sourceId: 'source-fixture', startMs: 15000, endMs: 30000, sourceStartMs: 16000 }] });
  assert.deepEqual(JSON.parse(JSON.stringify(children.map(child => child.payload.timeline[0].sourceStartMs))), [1000, 16000]);
  console.log('[PASS] selected source time survives admission and longform children; invalid values and still-image offsets fail before private reads; legacy timeline bytes retained');
}

// General source checks need no native binaries. Runtime CI passes --media
// only after provisioning actual FFmpeg/FFprobe.
if (reproduce || process.argv.includes('--media')) {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-source-interval-'));
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', ...args], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
}
function firstColor(file) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { timeout: 5000 });
  assert.equal(result.status, 0, String(result.stderr)); return [...result.stdout];
}
function audio(file, start = .15, duration = .3) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ss', String(start), '-t', String(duration), '-vn', '-ar', '48000', '-ac', '1', '-f', 's16le', 'pipe:1'], { timeout: 5000 });
  assert.equal(result.status, 0, String(result.stderr)); return result.stdout;
}
function frequency(bytes) {
  let crossings = 0;
  for (let i = 2; i < bytes.length; i += 2) if (bytes.readInt16LE(i - 2) <= 0 && bytes.readInt16LE(i) > 0) crossings++;
  return crossings / (bytes.length / 2 / 48000);
}
function energy(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) sum += (bytes.readInt16LE(i) / 32768) ** 2;
  return Math.sqrt(sum / (bytes.length / 2));
}
try {
  const source = path.join(dir, 'source.mp4');
  ffmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x320:r=30:d=1', '-f', 'lavfi', '-i', 'color=c=red:s=320x320:r=30:d=2',
    '-f', 'lavfi', '-i', 'aevalsrc=0.2*sin(2*PI*if(lt(t\\,1)\\,300\\,900)*t):s=48000:d=3',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source]);
  const output = path.join(dir, 'selected.mp4');
  ffmpeg(worker.exports.clipArgs(source, output, 'video/mp4', .75, 320, 320, 30, 1250));
  const color = firstColor(output), hz = frequency(audio(output));
  if (reproduce) {
    assert.ok(color[2] > 200 && color[0] < 30); assert.ok(Math.abs(hz - 300) < 20);
    console.log('[REPRODUCED] source selection at1.25s renders opening blue frames/300Hz audio instead of selected red frames/900Hz audio');
  } else {
    assert.ok(color[0] > 200 && color[2] < 30, `selected RGB:${color}`); assert.ok(Math.abs(hz - 900) < 20, `selected audio:${hz}Hz`);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,nb_frames', '-of', 'json', output], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr); const media = JSON.parse(probe.stdout);
    assert.ok(Math.abs(Number(media.format.duration) - .75) <= 1 / 30 + .023);
    assert.ok(Math.abs(Number(media.streams.find(stream => stream.codec_type === 'video').nb_frames) - .75 * 30) <= 1);
    const audioSource = path.join(dir, 'source.wav');
    ffmpeg(['-y', '-i', source, '-vn', audioSource]);
    const audioOutput = path.join(dir, 'audio-selected.mp4');
    ffmpeg(worker.exports.clipArgs(audioSource, audioOutput, 'audio/wav', .75, 320, 320, 30, 1250));
    assert.ok(Math.abs(frequency(audio(audioOutput)) - 900) < 20);
    const delayed = path.join(dir, 'delayed.mp4');
    ffmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=320x320:r=30:d=3', '-itsoffset', '1.25',
      '-f', 'lavfi', '-i', 'sine=frequency=900:sample_rate=48000:duration=1.5', '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', delayed]);
    const delayedOutput = path.join(dir, 'delayed-selected.mp4');
    ffmpeg(worker.exports.clipArgs(delayed, delayedOutput, 'video/mp4', 1, 320, 320, 30, 1000));
    assert.ok(energy(audio(delayedOutput, .04, .1)) < .001, 'camera delay must retain leading silence after source seek');
    assert.ok(energy(audio(delayedOutput, .4, .2)) > .04, 'camera speech/tone must enter at the retained source-relative time');
    console.log('[PASS] actual FFmpeg selected interval retains matching video/audio, exact output duration/frame budget and audio-only offset; synthetic media only');
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
