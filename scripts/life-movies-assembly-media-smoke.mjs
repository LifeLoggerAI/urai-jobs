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
function videoPackets(filePath) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_packets',
    '-show_data_hash', 'sha256', '-show_entries', 'packet=pts,dts,duration,data_hash', '-of', 'json', filePath],
  { encoding: 'utf8', timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).packets;
}
function decodedAudioClock(filePath, durationMs) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_frames',
    '-show_entries', 'frame=pts,pkt_duration,nb_samples', '-of', 'json', filePath],
  { encoding: 'utf8', timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const frames = JSON.parse(result.stdout).frames;
  assert.ok(frames.length > 0);
  let samples = 0, maxClockErrorSamples = 0;
  for (const frame of frames) {
    assert.ok(Number.isInteger(frame.pts) && Number.isInteger(frame.nb_samples) && frame.nb_samples > 0);
    maxClockErrorSamples = Math.max(maxClockErrorSamples, Math.abs(samples - frame.pts));
    samples += frame.nb_samples;
  }
  const last = frames.at(-1);
  return { sampleRate: 48000, frames: frames.length, decodedSamples: samples, maxClockErrorSamples,
    declaredSamples: durationMs * 48, packetEndSamples: last.pts + last.pkt_duration,
    terminalPaddingSamples: samples - durationMs * 48 };
}
function copiedVideoReference(entries, durationSeconds, name) {
  // A lossless video-only reference accounts for concat's H.264 header
  // conversion. It never decodes/re-encodes video or implements audio repair.
  const list = path.join(root, `${name}-video-copy-reference.txt`);
  fs.writeFileSync(list, entries.map(entry =>
    `file '${entry.filePath}'\nduration ${entry.durationMs / 1000}`).join('\n') + '\n');
  const output = path.join(root, `${name}-video-copy-reference.mp4`);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-map', '0:v:0',
    '-copyts', '-t', String(durationSeconds), '-c:v', 'copy', '-movflags', '+faststart', output]);
  return videoPackets(output);
}
function audioActivity(filePath, windows) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', filePath, '-map', '0:a:0',
    '-ar', '48000', '-ac', '1', '-f', 's16le', '-'], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  return windows.map(([start, end, active]) => {
    let peak = 0;
    for (let sample = Math.round(start * 48000); sample < Math.round(end * 48000); sample++) {
      peak = Math.max(peak, Math.abs(result.stdout.readInt16LE(sample * 2)));
    }
    assert.ok(active ? peak > 500 : peak < 100,
      `declared ${active ? 'child tone' : 'silent gap'} must remain at ${start}-${end}s: peak ${peak}`);
    return { startSeconds: start, endSeconds: end, active, peakS16: peak };
  });
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
  job.consent = { purpose: 'life-movie.render', policyVersion: 'fixture-v1', decisionReceiptId: 'fixture-receipt' };
  const current = { ...structuredClone(job), status: 'RUNNING', execution: { leaseToken: job.leaseToken } };
  const state = { current, downloads: 0, uploads: [], deleted: [], metadata: new Map(), children: new Set(), ffmpegCalls: [], consentRevoked: false,
    fences: new Map(options.fences || []), reads: [] };
  const app = { use() {}, get() {}, post() {}, listen() {} };
  const express = Object.assign(() => app, { json: () => () => {} });
  const admin = {
    initializeApp() {},
    firestore: () => ({ runTransaction: callback => callback({ get: ref => ref.get() }),
      collection: (collection) => ({ doc: (id) => ({ get: async () => {
        state.reads.push(collection + '/' + id);
        if (collection === 'jobs') return { exists: true, data: () => structuredClone(state.current) };
        if (collection === 'jobConsentBlocks') return { exists: state.consentRevoked, data: () => ({ active: state.consentRevoked }) };
        if (['uraiPrivateLifeModelOwnerFences', 'privacyDeletionTombstones'].includes(collection)) {
          const data = state.fences.get(collection + '/' + id);
          return { exists: data !== undefined, data: () => data === undefined ? undefined : structuredClone(data) };
        }
        throw new Error('unexpected fixture authority read');
      } }) }) }),
    storage: () => ({ bucket: (bucket) => ({ file: (name) => ({
      createReadStream() {
        assert.equal(bucket, bucketName);
        state.downloads++;
        assert.ok(objects.has(name), `unknown fixture object ${name}`);
        return Readable.from([objects.get(name)]);
      },
      createWriteStream(metadata) {
        const uploadFile = this;
        assert.equal(bucket, bucketName);
        assert.equal(metadata.metadata.cacheControl, 'private, no-store');
        assert.equal(metadata.preconditionOpts.ifGenerationMatch, 0);
        state.uploads.push(name);
        const chunks = [];
        return new Writable({ write(chunk, _encoding, callback) {
          if (options.failUpload && state.uploads.length === 2) return callback(new Error('fixture_upload_failed'));
          chunks.push(Buffer.from(chunk)); callback();
        }, final(callback) {
          objects.set(name, Buffer.concat(chunks));
          state.metadata.set(name, { generation: String(state.uploads.length + 100), ...metadata.metadata });
          uploadFile.metadata = state.metadata.get(name);
          this.emit('response', { statusCode: 200 });
          if (options.cancelUpload) state.current.status = 'CANCELLED';
          if (options.deleteOwnerDuringUpload && state.uploads.length === 1) {
            const uid = state.current.ownerUid, kind = options.deleteOwnerDuringUpload;
            state.fences.set(kind === 'local' ? 'uraiPrivateLifeModelOwnerFences/' + sha256(uid) : 'privacyDeletionTombstones/' + uid,
              kind === 'local' ? { ownerHash: sha256(uid), deleted: true } : { uid, active: true });
          }
          callback();
        } });
      },
      async getMetadata() {
        if (!state.metadata.has(name)) throw Object.assign(new Error('fixture_missing_object'), { code: 404 });
        return [state.metadata.get(name)];
      },
      async delete(options) {
        assert.equal(options.ifGenerationMatch, state.metadata.get(name).generation);
        state.deleted.push(name); objects.delete(name);
      },
    }) }) }),
  };
  const worker = {};
  vm.runInNewContext(code + '\nmodule.exports = { renderLifeMovie, assembleLifeMovie, parseAssemblyPayload, shiftSrt, probeNormalizedMovie, createRenderControl, gapArgs, clipArgs };', {
    module: worker, Buffer, AbortController, console: { log() {}, error() {} },
    process: { env: { GCS_BUCKET_NAME: bucketName, URAI_ENV: 'test', URAI_STUDIO_LEASE_POLL_MS: '25' } },
    require(name) {
      if (name === 'express') return express;
      if (name === 'firebase-admin') return admin;
      if (name === 'node:child_process') return { spawnSync, spawn(command, args, options) {
        if (command === 'ffmpeg') state.ffmpegCalls.push([...args]);
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
async function ownerControlProof(reproduce = false) {
  for (const type of ['studio.render.video', 'studio.assemble.video']) {
    const job = { jobId: 'owned-synthetic-control', type, ownerUid: 'owner-fixture-1', tenantId,
      leaseToken: 'owned-synthetic-lease', consent: { purpose: 'life-movie.render' }, payload: { source: 'synthetic' } };
    for (const kind of ['local', 'central']) {
      const pathFor = uid => kind === 'local' ? 'uraiPrivateLifeModelOwnerFences/' + sha256(uid) : 'privacyDeletionTombstones/' + uid;
      const dead = uid => kind === 'local' ? { ownerHash: sha256(uid), deleted: true } : { uid, active: true };
      for (const when of ['before admission', 'identity mismatch', 'after admission']) {
        const data = when === 'identity mismatch'
          ? (kind === 'local' ? { ownerHash: sha256('foreign-owner'), deleted: false } : { uid: 'foreign-owner', active: false }) : dead(job.ownerUid);
        const h = harness(job, { fences: when === 'after admission' ? [] : [[pathFor(job.ownerUid), data]] });
        const control = h.worker.createRenderControl(job);
        try {
          if (when === 'after admission') { await control.start(); h.state.fences.set(pathFor(job.ownerUid), data); }
          const run = () => when === 'after admission' ? control.check() : control.start();
          if (reproduce) await run(); else await assert.rejects(run(), /render_owner_deleted/);
          assert.equal(h.state.downloads, 0); assert.equal(h.state.uploads.length, 0);
          test(type + ' ' + kind + ' owner fence ' + when);
        } finally { control.stop(); }
      }
    }
    for (const own of [true, false]) {
      const uid = own ? job.ownerUid : 'unrelated-owner';
      const h = harness(job, { fences: [
        ['uraiPrivateLifeModelOwnerFences/' + sha256(uid), { ownerHash: sha256(uid), deleted: !own }],
        ['privacyDeletionTombstones/' + uid, { uid, active: !own }],
      ] });
      const control = h.worker.createRenderControl(job);
      try { await control.start(); await control.check(); test(type + (own ? ' inactive identity-bound fences remain admissible' : ' unrelated owner deletion does not widen scope')); }
      finally { control.stop(); }
    }
  }
}
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
  await assert.rejects((job.jobType || job.type) === 'studio.render.video'
    ? h.worker.renderLifeMovie(job) : h.worker.assembleLifeMovie(job), pattern);
  assert.equal(h.state.children.size, 0, 'FFmpeg must be reaped before cleanup');
  for (const object of h.state.uploads) assert.equal(objects.has(object), false, 'failed uploads must be removed');
  return h;
}

try {
  if (process.argv.includes('--owner-control-only') || process.argv.includes('--owner-control-baseline')) {
    await ownerControlProof(process.argv.includes('--owner-control-baseline'));
  } else {
  objects.set(sourceObject, makeMovie('motion-source.mp4'));
  const segments = [];
  const videoReferenceEntries = [];
  let previousEnd = 0;
  let renderAuthorityJob;
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
    renderAuthorityJob ||= structuredClone(job);
    const h = harness(job);
    const result = await h.worker.renderLifeMovie(job);
    assert.equal(result.ok, true); assertOutputs(result);
    assert.equal(h.state.children.size, 0);
    const video = result.outputs.find((item) => item.kind === 'mp4');
    const subtitle = result.outputs.find((item) => item.kind === 'srt');
    if (startMs > previousEnd) {
      const gap = path.join(root, `expected-gap-${index}.mp4`);
      ffmpeg(h.worker.gapArgs(gap, (startMs - previousEnd) / 1000, 320, 320, 30));
      videoReferenceEntries.push({ filePath: gap, durationMs: startMs - previousEnd });
    }
    const child = path.join(root, `actual-render-${index}.mp4`);
    fs.writeFileSync(child, objects.get(location(video.ref)));
    videoReferenceEntries.push({ filePath: child, durationMs: endMs - startMs });
    previousEnd = endMs;
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
  const expectedVideoPackets = copiedVideoReference(videoReferenceEntries, 61, 'assembly');
  const actualVideoPackets = videoPackets(finalPath);
  assert.equal(actualVideoPackets.length, 1830);
  assert.deepEqual(actualVideoPackets, expectedVideoPackets, 'assembly must copy every compressed video packet and its declared timing');
  test('all 1830 compressed H.264 packets and declared PTS/DTS remain identical to actual children and gaps');
  evidence.diagnostic = { durationMs: receipt.finalMedia.durationMs, declaredDurationMs: 61000,
    videoFrames: receipt.finalMedia.videoFrames, videoPacketCopySha256: sha256(JSON.stringify(actualVideoPackets)),
    outputs: result.outputs.map(({ kind, checksum }) => ({ kind, sha256: checksum })) };

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
  assert.equal(failed.state.deleted.length, 1, 'cleanup removes only the successfully created first generation');
  const revoked = harness(job); revoked.state.consentRevoked = true;
  await assert.rejects(revoked.worker.assembleLifeMovie(job), /render_consent_revoked/);
  assert.equal(revoked.state.downloads, 0);
  test('assembly cancellation, consent revocation and upload failure remove partial output');
  for (const kind of ['local', 'central']) {
    const removed = await rejectAssembly(job, /render_owner_deleted/, { deleteOwnerDuringUpload: kind });
    assert.equal(removed.state.deleted.length, 1);
    test('assembly ' + kind + ' owner deletion during first upload denies remaining output and removes attempt bytes');
    const rendered = await rejectAssembly(renderAuthorityJob, /render_owner_deleted/, { deleteOwnerDuringUpload: kind });
    assert.equal(rendered.state.deleted.length, 1);
    test('render ' + kind + ' owner deletion during first upload denies remaining output and removes attempt bytes');
  }
  await ownerControlProof();

  const ordinaryCases = [];
  const referenceEntries = [];
  const ordinarySource = path.join(root, 'ordinary-clock-source.mp4');
  fs.writeFileSync(ordinarySource, objects.get(sourceObject));
  const referenceWorker = harness(renderAuthorityJob).worker;
  for (const [index, durationMs] of [400, 1500, 600, 1500].entries()) {
    const clip = path.join(root, `ordinary-copy-reference-${index}.mp4`);
    ffmpeg(index % 2 === 0 ? referenceWorker.gapArgs(clip, durationMs / 1000, 320, 320, 30)
      : referenceWorker.clipArgs(ordinarySource, clip, 'video/mp4', durationMs / 1000, 320, 320, 30));
    referenceEntries.push({ filePath: clip, durationMs });
  }
  const ordinaryReferencePackets = copiedVideoReference(referenceEntries, 4, 'ordinary');
  for (const withCue of [false, true]) {
    const ordinaryJob = structuredClone(renderAuthorityJob);
    const name = withCue ? 'camera-cue' : 'no-cue';
    ordinaryJob.jobId = `ordinary-clock-${name}-fixture`;
    ordinaryJob.payload.timeline = [{ sourceId: 'motion-fixture', startMs: 400, endMs: 1900 },
      { sourceId: 'motion-fixture', startMs: 2500, endMs: 4000 }];
    ordinaryJob.payload.subtitleText = '1\n00:00:00,400 --> 00:00:01,900\nFirst motion\n\n2\n00:00:02,500 --> 00:00:04,000\nSecond motion\n';
    ordinaryJob.payload.audioCues = withCue ? [{ sourceId: 'motion-fixture', role: 'dialogue',
      startMs: 400, endMs: 1900, sourceStartMs: 0, gainDb: 0 }] : [];
    const ordinary = harness(ordinaryJob);
    const result = await ordinary.worker.renderLifeMovie(ordinaryJob);
    assert.equal(result.ok, true); assertOutputs(result);
    assert.equal(ordinary.state.children.size, 0);
    const filePath = path.join(root, `synthetic-4-second-ordinary-${name}-diagnostic.mp4`);
    fs.writeFileSync(filePath, objects.get(location(result.outputs.find(item => item.kind === 'mp4').ref)));
    ffmpeg(['-xerror', '-i', filePath, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-']);
    assert.equal(objects.get(location(result.outputs.find(item => item.kind === 'srt').ref)).toString(), ordinaryJob.payload.subtitleText);
    const receipt = JSON.parse(objects.get(location(result.outputs.find(item => item.kind === 'manifest').ref)));
    assert.equal(receipt.media.durationMs, 4000);
    assert.equal(receipt.media.videoFrames, 120);
    const packets = videoPackets(filePath);
    assert.equal(packets.length, 120);
    assert.deepEqual(packets, ordinaryReferencePackets,
      'ordinary output must preserve every compressed video packet and its declared timing');
    ordinaryCases.push({ name, filePath, calls: ordinary.state.ffmpegCalls,
      diagnostic: { name, durationMs: 4000, videoFrames: 120, videoPacketCopySha256: sha256(JSON.stringify(packets)),
        outputs: result.outputs.map(({ kind, checksum }) => ({ kind, sha256: checksum })),
        audioClock: decodedAudioClock(filePath, 4000) } });
  }
  evidence.ordinaryDiagnostics = ordinaryCases.map(item => item.diagnostic);

  // Exercise source offsets through the complete ordinary producer, not just
  // its FFmpeg argument helper. Output time and recorded-source time differ.
  const intervalSource = path.join(root, 'selected-interval-source.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=320x320:r=30:d=2',
    '-f', 'lavfi', '-i', 'color=c=red:s=320x320:r=30:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=900:sample_rate=48000:duration=4',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', intervalSource]);
  const intervalObject = `tenants/${tenantId}/selected-interval-source.mp4`;
  objects.set(intervalObject, fs.readFileSync(intervalSource));
  const intervalJob = structuredClone(renderAuthorityJob);
  intervalJob.jobId = 'ordinary-source-offset-fixture';
  intervalJob.payload.sources[0].objectPath = intervalObject;
  intervalJob.payload.timeline = [{ sourceId: 'motion-fixture', startMs: 0, endMs: 1000, sourceStartMs: 2500 }];
  intervalJob.payload.subtitleText = '1\n00:00:00,000 --> 00:00:01,000\nSelected synthetic source interval\n';
  const interval = harness(intervalJob);
  const intervalResult = await interval.worker.renderLifeMovie(intervalJob);
  assertOutputs(intervalResult);
  const intervalMovie = path.join(root, 'synthetic-selected-source-interval-diagnostic.mp4');
  fs.writeFileSync(intervalMovie, objects.get(location(intervalResult.outputs.find(item => item.kind === 'mp4').ref)));
  const color = spawnSync('ffmpeg', ['-v', 'error', '-i', intervalMovie, '-frames:v', '1',
    '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { timeout: 5000 });
  assert.equal(color.status, 0, String(color.stderr));
  assert.ok(color.stdout[0] > 200 && color.stdout[2] < 30, 'complete producer must render selected red source interval, not opening blue frames');
  const intervalReceipt = JSON.parse(objects.get(location(intervalResult.outputs.find(item => item.kind === 'manifest').ref)));
  assert.equal(intervalReceipt.timeline[0].sourceStartMs, 2500);
  assert.equal(intervalReceipt.media.durationMs, 1000); assert.equal(intervalReceipt.media.videoFrames, 30);
  assert.equal(intervalReceipt.sources[0].downloadedBytes.sha256, sha256(objects.get(intervalObject)));
  assert.equal(intervalReceipt.literalMediaAccepted, false); assert.equal(intervalReceipt.identityAccepted, false);
  test('actual complete ordinary producer selects later source frames, retains source offset/hash/SceneTruth and publishes normalized private adapter output');

  try {
    evidence.diagnostic.audioClock = decodedAudioClock(finalPath, 61000);
    assert.ok(evidence.diagnostic.audioClock.maxClockErrorSamples <= 1,
      `AAC joins must not accumulate decoded samples beyond their PTS: ${evidence.diagnostic.audioClock.maxClockErrorSamples} samples`);
    assert.equal(evidence.diagnostic.audioClock.packetEndSamples, 61000 * 48);
    assert.ok(evidence.diagnostic.audioClock.terminalPaddingSamples >= 0
      && evidence.diagnostic.audioClock.terminalPaddingSamples < 1024,
    'only one terminal AAC packet may contain padding beyond the declared timeline');
    evidence.diagnostic.audioActivity = audioActivity(finalPath, [[.1, .2, false], [.7, .8, true],
      [15.2, 15.3, true], [15.65, 15.75, false], [16.3, 16.4, true], [30.8, 30.9, true],
      [31.2, 31.3, true], [45.8, 45.9, true], [46.2, 46.3, true], [60.8, 60.9, true]]);
    test('decoded AAC clock has no internal join accumulation and only bounded terminal packet padding');
    for (const item of ordinaryCases) {
      const { diagnostic, calls, filePath, name } = item;
      assert.ok(diagnostic.audioClock.maxClockErrorSamples <= 1,
        `ordinary AAC joins must not accumulate decoded samples beyond their PTS: ${diagnostic.audioClock.maxClockErrorSamples} samples`);
      assert.equal(diagnostic.audioClock.packetEndSamples, 4000 * 48);
      assert.ok(diagnostic.audioClock.terminalPaddingSamples >= 0 && diagnostic.audioClock.terminalPaddingSamples < 1024);
      diagnostic.audioActivity = audioActivity(filePath,
        [[.1, .2, false], [.7, .8, true], [1.7, 1.8, true], [2.1, 2.2, false], [2.8, 2.9, true], [3.8, 3.9, true]]);
      const finalAudioCalls = calls.filter(args => args[args.indexOf('-f') + 1] === 'concat' || args.includes('-filter_complex'));
      diagnostic.finalAacEncodings = finalAudioCalls.filter(args => args[args.indexOf('-c:a') + 1] === 'aac').length;
      assert.equal(diagnostic.finalAacEncodings, 1, 'ordinary concat/mix must encode the final AAC stream once');
      test(`actual ordinary ${name} AAC clock, silent gaps, motion packets and captions stay on the declared timeline`);
    }
  } finally {
    const outputArg = process.argv.indexOf('--evidence-dir');
    if (outputArg >= 0) {
      assert.ok(process.argv[outputArg + 1], 'evidence directory required');
      const out = path.resolve(process.argv[outputArg + 1]); fs.mkdirSync(out, { recursive: true });
      fs.copyFileSync(finalPath, path.join(out, 'synthetic-61-second-diagnostic.mp4'));
      for (const item of ordinaryCases) fs.copyFileSync(item.filePath, path.join(out, path.basename(item.filePath)));
      fs.writeFileSync(path.join(out, 'assembly-source-test-receipt.json'), JSON.stringify(evidence, null, 2) + '\n');
    }
  }
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
