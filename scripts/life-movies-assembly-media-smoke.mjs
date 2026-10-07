import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { Readable, Writable } from 'node:stream';
import { spawn, spawnSync } from 'node:child_process';

// Real FFmpeg bytes through the real render and assembly functions. Firestore
// and private GCS are explicit in-memory adapters, not deployed-runtime proof.
const require = createRequire(import.meta.url);
const code = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-assembly-media-'));
const tenantId = 'tenant-fixture-1';
const projectId = 'project-fixture-1';
const bucketName = 'private-fixture-bucket';
const prefix = `tenants/${tenantId}/life-movies/${projectId}`;
const sourceObject = `tenants/${tenantId}/synthetic-motion.mp4`;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const objects = new Map();
const evidence = { schemaVersion: 'urai-life-movie-assembly-source-test-v1', sourceSha: process.env.URAI_SOURCE_SHA || null,
  sourceClass: 'SYNTHETIC_TEST_FIXTURE', backend: 'IN_MEMORY_FIRESTORE_AND_PRIVATE_GCS_ADAPTERS',
  providerCalled: false, privateSourceProcessed: false, productionAccepted: false,
  finalLifeMovieAccepted: false, literalIdentityAccepted: false, tests: [] };

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
}
function makeMovie(name, { width = 320, height = 320, fps = 30, duration = 15, audio = true,
  codec = 'libx264', sar = '1', profile } = {}) {
  const file = path.join(root, name);
  const args = ['-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=${fps}`];
  if (audio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000');
  args.push('-t', String(duration), '-vf', `setsar=${sar}`, '-c:v', codec, '-threads', '1', '-pix_fmt', 'yuv420p');
  if (codec === 'libx264') args.push('-preset', 'medium', '-crf', '20');
  if (profile) args.push('-profile:v', profile);
  if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  args.push('-movflags', '+faststart', file);
  ffmpeg(args);
  return fs.readFileSync(file);
}

function harness(job, options = {}) {
  const current = { ...structuredClone(job), status: 'RUNNING', execution: { leaseToken: job.leaseToken } };
  const state = { current, downloads: 0, uploads: [], deleted: [], children: new Set(), consentRevoked: false };
  const app = { use() {}, get() {}, post() {}, listen() {} };
  const express = Object.assign(() => app, { json: () => () => {} });
  const admin = {
    initializeApp() {},
    firestore: () => ({ collection: (collection) => ({ doc: () => ({ get: async () =>
      collection === 'jobs' ? { exists: true, data: () => state.current }
        : { exists: state.consentRevoked, data: () => ({ active: state.consentRevoked }) },
    }) }) }),
    storage: () => ({ bucket: (bucket) => ({ file: (name) => ({
      createReadStream() {
        assert.equal(bucket, bucketName);
        state.downloads++;
        assert.ok(objects.has(name), `unknown fixture object ${name}`);
        return Readable.from([objects.get(name)]);
      },
      createWriteStream(metadata) {
        assert.equal(bucket, bucketName);
        assert.equal(metadata.metadata.cacheControl, 'private, no-store');
        state.uploads.push(name);
        const chunks = [];
        return new Writable({ write(chunk, _encoding, callback) {
          if (options.failUpload && state.uploads.length === 2) return callback(new Error('fixture_upload_failed'));
          chunks.push(Buffer.from(chunk)); callback();
        }, final(callback) {
          objects.set(name, Buffer.concat(chunks));
          if (options.cancelUpload) state.current.status = 'CANCELLED';
          callback();
        } });
      },
      async delete() { state.deleted.push(name); objects.delete(name); },
    }) }) }),
  };
  const worker = {};
  vm.runInNewContext(code + '\nmodule.exports = { renderLifeMovie, assembleLifeMovie, parseAssemblyPayload, shiftSrt, probeNormalizedMovie };', {
    module: worker, Buffer, AbortController, console: { log() {}, error() {} },
    process: { env: { GCS_BUCKET_NAME: bucketName, URAI_ENV: 'test', URAI_STUDIO_LEASE_POLL_MS: '25' } },
    require(name) {
      if (name === 'express') return express;
      if (name === 'firebase-admin') return admin;
      if (name === 'node:child_process') return { spawnSync, spawn(command, args, options) {
        const child = spawn(command, args, options);
        state.children.add(child); child.on('close', () => state.children.delete(child));
        return child;
      } };
      return require(name);
    },
  });
  return { worker: worker.exports, state };
}
function test(name) { evidence.tests.push(name); console.log(`[PASS] ${name}`); }
function location(ref) {
  assert.ok(ref.startsWith(`gs://${bucketName}/`));
  return ref.slice(`gs://${bucketName}/`.length);
}
function assertOutputs(result) {
  for (const artifact of result.outputs) {
    assert.equal(sha256(objects.get(location(artifact.ref))), artifact.checksum);
  }
}
async function rejectAssembly(job, pattern, options = {}) {
  const h = harness(job, options);
  await assert.rejects(h.worker.assembleLifeMovie(job), pattern);
  assert.equal(h.state.children.size, 0, 'FFmpeg must be reaped before cleanup');
  for (const object of h.state.uploads) assert.equal(objects.has(object), false, 'failed uploads must be removed');
  return h;
}

try {
  objects.set(sourceObject, makeMovie('motion-source.mp4'));
  const segments = [];
  const ranges = [[400, 15400], [16000, 31000], [31000, 46000], [46000, 61000]];
  for (const [index, [startMs, endMs]] of ranges.entries()) {
    const job = { jobId: `render-fixture-${index}`, tenantId, ownerUid: 'owner-fixture-1',
      type: 'studio.render.video', leaseToken: `lease-fixture-${index}`, consent: { purpose: 'life-movie.render' },
      payload: { schemaVersion: 'urai-life-movie-render-v1', projectId, renderPlanDigest: 'a'.repeat(64),
        sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`, sceneTruthDigest: 'b'.repeat(64),
        width: 320, height: 320, fps: 30,
        sources: [{ id: 'motion-fixture', bucket: bucketName, objectPath: sourceObject, mimeType: 'video/mp4',
          provenance: 'interpretive', sourceRefs: ['synthetic-motion-and-test-tone'], consentRef: 'fixture-consent', ownerOrRightsRef: 'fixture-rights' }],
        timeline: [{ sourceId: 'motion-fixture', startMs: 0, endMs: endMs - startMs }],
        audioCues: [], subtitleText: `1\n00:00:00,000 --> 00:00:15,000\nSynthetic motion segment ${index}\n`,
        outputPrefix: `${prefix}/segments/${String(index).padStart(4, '0')}`,
        spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false } };
    const h = harness(job);
    const result = await h.worker.renderLifeMovie(job);
    assert.equal(result.ok, true); assertOutputs(result);
    assert.equal(h.state.children.size, 0);
    const video = result.outputs.find((item) => item.kind === 'mp4');
    const subtitle = result.outputs.find((item) => item.kind === 'srt');
    segments.push({ index, startMs, endMs, videoRef: video.ref, videoChecksum: video.checksum,
      subtitleRef: subtitle.ref, subtitleChecksum: subtitle.checksum });
  }
  test('four real 15-second motion/audio child renders with exact private output hashes');
  const job = { jobId: 'assembly-fixture-1', tenantId, ownerUid: 'owner-fixture-1',
    type: 'studio.assemble.video', leaseToken: 'assembly-fixture-lease', consent: { purpose: 'life-movie.render' },
    payload: { schemaVersion: 'urai-life-movie-assembly-v1', planId: 'plan-fixture-1', projectId,
      renderPlanDigest: 'a'.repeat(64), sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`,
      sceneTruthDigest: 'b'.repeat(64), width: 320, height: 320, fps: 30, outputPrefix: `${prefix}/final/`,
      segments, publicReleaseAuthorized: false, providerGenerationAuthorized: false } };
  const h = harness(job);
  const result = await h.worker.assembleLifeMovie(job);
  assert.equal(result.ok, true); assertOutputs(result); assert.equal(h.state.children.size, 0);
  const movie = result.outputs.find((item) => item.kind === 'mp4');
  const subtitles = objects.get(location(result.outputs.find((item) => item.kind === 'srt').ref)).toString();
  assert.match(subtitles, /00:00:00,400 --> 00:00:15,400/);
  assert.match(subtitles, /00:00:16,000 --> 00:00:31,000/);
  assert.match(subtitles, /00:00:46,000 --> 00:01:01,000/);
  const receipt = JSON.parse(objects.get(location(result.outputs.find((item) => item.kind === 'manifest').ref)));
  assert.equal(receipt.timelineDurationMs, 61000);
  assert.equal(receipt.finalMedia.videoFrames, 1830);
  assert.ok(Math.abs(receipt.finalMedia.durationMs - 61000) <= 60);
  assert.equal(receipt.literalMediaAccepted, false);
  assert.equal(receipt.identityAccepted, false);
  assert.equal(receipt.productionAccepted, false);
  const finalPath = path.join(root, 'synthetic-61-second-diagnostic.mp4');
  fs.writeFileSync(finalPath, objects.get(location(movie.ref)));
  const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', finalPath, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(decode.status, 0, decode.stderr);
  assert.equal(decode.stderr.trim(), '', 'assembled media must fully decode without an error');
  test('actual 61-second H.264/AAC assembly fully decodes; gaps, captions and 1830 frames stay on declared timeline');
  evidence.diagnostic = { durationMs: receipt.finalMedia.durationMs, declaredDurationMs: 61000,
    videoFrames: receipt.finalMedia.videoFrames, outputs: result.outputs.map(({ kind, checksum }) => ({ kind, sha256: checksum })) };

  async function rejectMedia(name, bytes, expected) {
    const changed = structuredClone(job);
    const object = `${prefix}/segments/rejected-${name}.mp4`;
    objects.set(object, bytes);
    changed.payload.segments[0].videoRef = `gs://${bucketName}/${object}`;
    changed.payload.segments[0].videoChecksum = sha256(bytes);
    await rejectAssembly(changed, expected);
    test(`hash-correct ${name} media is rejected before final upload`);
  }
  await rejectMedia('wrong-dimensions', makeMovie('wrong-dimensions.mp4', { width: 640 }), /assembly_media_profile_mismatch/);
  await rejectMedia('wrong-fps', makeMovie('wrong-fps.mp4', { fps: 25 }), /assembly_media_profile_mismatch/);
  await rejectMedia('missing-audio', makeMovie('missing-audio.mp4', { audio: false }), /assembly_media_profile_mismatch/);
  await rejectMedia('wrong-codec', makeMovie('wrong-codec.mp4', { codec: 'mpeg4' }), /assembly_media_profile_mismatch/);
  await rejectMedia('non-square-pixels', makeMovie('wrong-sar.mp4', { sar: '2' }), /assembly_media_profile_mismatch/);
  await rejectMedia('short-duration', makeMovie('short-duration.mp4', { duration: 2 }), /assembly_media_duration_mismatch/);
  await rejectMedia('incompatible-h264-configuration', makeMovie('baseline.mp4', { profile: 'baseline' }), /assembly_media_configuration_mismatch/);
  const damaged = Buffer.from(objects.get(location(segments[0].videoRef)));
  const mediaOffset = damaged.indexOf(Buffer.from('mdat'));
  assert.ok(mediaOffset > 0);
  // Keep MP4 metadata/SPS/configuration, but corrupt compressed media packets.
  damaged.fill(0xff, mediaOffset + 4, Math.min(damaged.length, mediaOffset + 4096));
  await rejectMedia('damaged-compressed-packets', damaged, /ffmpeg_failed|assembly_media_probe_failed/);

  const badHash = structuredClone(job); badHash.payload.segments[0].videoChecksum = 'f'.repeat(64);
  await rejectAssembly(badHash, /assembly_segment_checksum_mismatch/);
  test('byte corruption/hash mismatch rejects assembly');
  for (const outputPrefix of [`${prefix}/final-evil`, `${prefix}/segments/untrusted`,
    'tenants/another-tenant/life-movies/project-fixture-1/final/']) {
    const changed = structuredClone(job); changed.payload.outputPrefix = outputPrefix;
    const rejected = await rejectAssembly(changed, /assembly_output_prefix_mismatch|output_prefix_outside_tenant_project/);
    assert.equal(rejected.state.downloads, 0);
  }
  test('canonical final root is accepted while sibling and foreign-tenant output prefixes are rejected');
  for (const [text, expected] of [
    ['1\n00:00:01,000 --> 00:00:16,000\nOutside child\n', /assembly_subtitle_outside_segment/],
    ['1\n00:61:00,000 --> 00:61:01,000\nInvalid minute\n', /assembly_subtitle_invalid/],
    ['1\n00:00:61,000 --> 00:01:02,000\nInvalid second\n', /assembly_subtitle_invalid/],
  ]) {
    const changed = structuredClone(job), object = `${prefix}/segments/rejected-subtitles.srt`, bytes = Buffer.from(text);
    objects.set(object, bytes); changed.payload.segments[0].subtitleRef = `gs://${bucketName}/${object}`;
    changed.payload.segments[0].subtitleChecksum = sha256(bytes);
    await rejectAssembly(changed, expected);
  }
  test('hash-correct captions outside child duration or with invalid minutes/seconds are rejected');
  for (const mutate of [
    (value) => { value.payload.segments[0].endMs = value.payload.segments[0].startMs + 15001; },
    (value) => { value.payload.segments[0].startMs = 45 * 60 * 1000; value.payload.segments[0].endMs = 45 * 60 * 1000 + 1; },
  ]) {
    const changed = structuredClone(job); mutate(changed);
    const rejected = await rejectAssembly(changed, /assembly_duration_budget_exceeded/);
    assert.equal(rejected.state.downloads, 0);
  }
  test('15-second child and 45-minute parent ceilings fail closed before downloading');
  const cancelled = await rejectAssembly(job, /render_lease_revoked/, { cancelUpload: true });
  assert.equal(cancelled.state.deleted.length, 1);
  const failed = await rejectAssembly(job, /fixture_upload_failed/, { failUpload: true });
  assert.equal(failed.state.deleted.length, 2);
  const revoked = harness(job); revoked.state.consentRevoked = true;
  await assert.rejects(revoked.worker.assembleLifeMovie(job), /render_consent_revoked/);
  assert.equal(revoked.state.downloads, 0);
  test('assembly cancellation, consent revocation and upload failure remove partial output');

  const outputArg = process.argv.indexOf('--evidence-dir');
  if (outputArg >= 0) {
    assert.ok(process.argv[outputArg + 1], 'evidence directory required');
    const out = path.resolve(process.argv[outputArg + 1]); fs.mkdirSync(out, { recursive: true });
    fs.copyFileSync(finalPath, path.join(out, 'synthetic-61-second-diagnostic.mp4'));
    fs.writeFileSync(path.join(out, 'assembly-source-test-receipt.json'), JSON.stringify(evidence, null, 2) + '\n');
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
