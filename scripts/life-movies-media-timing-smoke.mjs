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
vm.runInNewContext(fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8') + '\nmodule.exports = { parsePayload, renderSegments, gapArgs, clipArgs };', {
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
  sources: [{ id: 'source-1', bucket: 'private-fixture-bucket', objectPath: 'tenants/tenant-1/source.png', generation: '1793378565000001', mimeType: 'image/png', provenance: 'original-source', sourceRefs: ['fixture'], consentRef: 'consent-1', ownerOrRightsRef: 'rights-1' }],
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

const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const path = require('node:path');

const offsetPayload = {
  ...payload,
  sources: [{ ...payload.sources[0], mimeType: 'video/mp4' }],
  timeline: [{ sourceId: 'source-1', startMs: 0, endMs: 1000, sourceStartMs: 1250 }],
};
assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(offsetPayload).success, true);
const parsedOffset = workerParse(offsetPayload);
assert.equal(parsedOffset.timeline[0].sourceStartMs, 1250);
// clipArgs probes real streams before constructing a command. Use real
// generated fixtures rather than nonexistent source.mp4/source.wav paths.
const seekFixtureDir = fs.mkdtempSync(path.join(tmpdir(), 'urai-source-seek-'));
try {
  const videoFixture = path.join(seekFixtureDir, 'source.mp4');
  const audioFixture = path.join(seekFixtureDir, 'source.wav');
  const videoFixtureRun = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x320:r=30',
    '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', videoFixture,
  ], { encoding: 'utf8' });
  assert.equal(videoFixtureRun.status, 0, videoFixtureRun.stderr);
  const audioFixtureRun = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '3', audioFixture,
  ], { encoding: 'utf8' });
  assert.equal(audioFixtureRun.status, 0, audioFixtureRun.stderr);
  const clipSeek = worker.exports.clipArgs(
    videoFixture, path.join(seekFixtureDir, 'video-out.mp4'), 'video/mp4', 1, 320, 320, 30, 1250);
  assert.equal(clipSeek[clipSeek.indexOf('-ss') + 1], '1.25');
  assert.ok(clipSeek.indexOf('-ss') < clipSeek.indexOf('-i'));
  const audioSeek = worker.exports.clipArgs(
    audioFixture, path.join(seekFixtureDir, 'audio-out.mp4'), 'audio/wav', 1, 320, 320, 30, 1250);
  assert.equal(audioSeek[audioSeek.indexOf('-ss') + 1], '1.25');
  // The audio-only output also has a synthetic black-video input first.
  // The seek must precede the *second* -i (the selected audio file), not
  // the first -i (the generated black video).
  assert.ok(audioSeek.indexOf('-i') < audioSeek.indexOf('-ss'));
  assert.ok(audioSeek.indexOf('-ss') < audioSeek.lastIndexOf('-i'));
  assert.equal(audioSeek[audioSeek.lastIndexOf('-i') + 1], audioFixture);
} finally {
  fs.rmSync(seekFixtureDir, { recursive: true, force: true });
}
for (const invalid of [-1, 0.5, 45 * 60 * 1000 + 1, null, '1250', false, NaN, Infinity]) {
  const changed = { ...offsetPayload, timeline: [{ ...offsetPayload.timeline[0], sourceStartMs: invalid }] };
  assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(changed).success, false);
  assert.throws(() => workerParse(changed), /invalid_timeline_source_start/);
}
const imageOffset = { ...payload, timeline: [{ ...payload.timeline[0], sourceStartMs: 1250 }] };
assert.equal(schemaExports.StudioLifeMovieRenderPayloadSchema.safeParse(imageOffset).success, false);
assert.throws(() => workerParse(imageOffset), /image_source_start_must_be_zero/);
assert.throws(() => worker.exports.clipArgs('source.png', 'clip.mp4', 'image/png', 1, 320, 320, 30, 1250), /image_source_start_must_be_zero/);
console.log('[PASS] Source interval preserves video/audio seek and rejects invalid/image offsets');

console.log('[PASS] Life Movies output timeline preserves leading/inter-clip gaps and chronological ordering');

const dir = fs.mkdtempSync(path.join(tmpdir(),'urai-gap-proof-'));
try {
 const output=path.join(dir,'gap.mp4');
 const run=spawnSync('ffmpeg',worker.exports.gapArgs(output,.5,320,320,30),{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output],{encoding:'utf8'});
 assert.equal(probe.status,0,probe.stderr);
 const info=JSON.parse(probe.stdout);
 assert.equal(info.streams.find(s=>s.codec_type==='video').pix_fmt,'yuv420p');
 assert.ok(info.streams.some(s=>s.codec_type==='audio'));
 assert.ok(Math.abs(Number(info.format.duration)-.5)<=1/30);
 console.log('[PASS] Actual FFmpeg gap: black320x320 yuv420p video + stereo silence, duration='+info.format.duration);
const source=path.join(dir,'short.mp4');
 const make=spawnSync('ffmpeg',['-y','-f','lavfi','-i','color=c=blue:s=320x320:r=30','-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000','-t','0.2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source],{encoding:'utf8'});assert.equal(make.status,0,make.stderr);
 const padded=path.join(dir,'padded.mp4');
 const rendered=spawnSync('ffmpeg',worker.exports.clipArgs(source,padded,'video/mp4',.5,320,320,30),{encoding:'utf8'});assert.equal(rendered.status,0,rendered.stderr);
 const read=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',padded],{encoding:'utf8'});assert.equal(read.status,0,read.stderr);
 const duration=Number(JSON.parse(read.stdout).format.duration);console.log('Short source requested0.5s, actual='+duration);
 assert.ok(Math.abs(duration-.5)<=1/30,'short source must preserve declared output duration');
const audio=path.join(dir,'short.wav');
 const audioSource=spawnSync('ffmpeg',['-y','-i',source,'-vn',audio],{encoding:'utf8'});assert.equal(audioSource.status,0,audioSource.stderr);
 const audioOutput=path.join(dir,'audio-padded.mp4');
 const audioRender=spawnSync('ffmpeg',worker.exports.clipArgs(audio,audioOutput,'audio/wav',.5,320,320,30),{encoding:'utf8'});assert.equal(audioRender.status,0,audioRender.stderr);
 const audioProbe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',audioOutput],{encoding:'utf8'});assert.equal(audioProbe.status,0,audioProbe.stderr);
 const audioDuration=Number(JSON.parse(audioProbe.stdout).format.duration);
 assert.ok(Math.abs(audioDuration-.5)<=1/30,'short audio must preserve declared output duration');
 console.log('[PASS] Actual FFmpeg short video/audio retain0.5s declared timeline duration');

 // Real source seeking: the first half is red and the second half blue.
 // A 2.5-second source offset must produce blue pixels, not the first red frames.
 const colors = ['red', 'blue'];
 const clips = colors.map((color) => path.join(dir, color + '-source.mp4'));
 for (let index = 0; index < colors.length; index += 1) {
   const colored = spawnSync('ffmpeg', [
     '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=' + colors[index] + ':s=320x320:r=30',
     '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clips[index],
   ], { encoding: 'utf8' });
   assert.equal(colored.status, 0, colored.stderr);
 }
 const listPath = path.join(dir, 'source-selection-concat.txt');
 fs.writeFileSync(listPath, clips.map((file) => "file '" + file + "'").join('\n') + '\n');
 const twoColorSource = path.join(dir, 'two-color-source.mp4');
 const combined = spawnSync('ffmpeg', [
   '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', twoColorSource,
 ], { encoding: 'utf8' });
 assert.equal(combined.status, 0, combined.stderr);
 const seekOutput = path.join(dir, 'seek-selected.mp4');
 const sourceOffsetMs = 2500;
 const seek = spawnSync('ffmpeg',
   worker.exports.clipArgs(twoColorSource, seekOutput, 'video/mp4', 1, 320, 320, 30, sourceOffsetMs),
   { encoding: 'utf8' });
 assert.equal(seek.status, 0, seek.stderr);
 const pixels = spawnSync('ffmpeg', [
   '-v', 'error', '-i', seekOutput, '-frames:v', '1', '-f', 'rawvideo',
   '-pix_fmt', 'rgb24', '-',
 ], { maxBuffer: 2 * 1024 * 1024 });
 assert.equal(pixels.status, 0, String(pixels.stderr));
 const [red, green, blue] = pixels.stdout.subarray(0, 3);
 assert.ok(blue > 140 && red < 75 && green < 75,
   'the 2.5-second selected clip must begin in blue frames; got RGB(' + [red, green, blue].join(',') + ')');
 const seekDuration = spawnSync('ffprobe', [
   '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', seekOutput,
 ], { encoding: 'utf8' });
 assert.equal(seekDuration.status, 0, seekDuration.stderr);
 const selectedSeconds = Number(JSON.parse(seekDuration.stdout).format.duration);
 assert.ok(Math.abs(selectedSeconds - 1) <= 1 / 30,
   'selected output must retain the declared one-second duration; got ' + selectedSeconds);
 console.log('[PASS] Actual FFmpeg 2.5-second source seek selects blue second-half frames for a one-second output');

} finally {fs.rmSync(dir,{recursive:true,force:true})}
