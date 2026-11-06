import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { Readable, Writable } from 'node:stream';
import { spawn, spawnSync } from 'node:child_process';

const require = createRequire(new URL('../workers/studio-worker/index.js', import.meta.url));
const code = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-cancellation-proof-'));
const source = path.join(root, 'source.wav');
const fixture = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', source], { encoding: 'utf8' });
assert.equal(fixture.status, 0, fixture.stderr);
const baseJob = {
  jobId: 'job-fixture-1', tenantId: 'tenant-fixture-1', ownerUid: 'owner-fixture-1',
  type: 'studio.render.video', leaseToken: 'fixture-lease',
  payload: {
    schemaVersion: 'urai-life-movie-render-v1', projectId: 'project-fixture-1', renderPlanDigest: 'a'.repeat(64),
    sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`,
    sceneTruthDigest: 'b'.repeat(64),
    width: 320, height: 320, fps: 30,
    sources: [{ id: 'source-1', bucket: 'private-fixture-bucket', objectPath: 'tenants/tenant-fixture-1/source.wav', generation: '1793378565000001',
      mimeType: 'audio/wav', provenance: 'original-source', sourceRefs: ['synthetic-test-tone'],
      consentRef: 'fixture-consent', ownerOrRightsRef: 'fixture-rights' }],
    timeline: [{ sourceId: 'source-1', startMs: 0, endMs: 500 }],
    subtitleText: '', outputPrefix: 'tenants/tenant-fixture-1/life-movies/project-fixture-1/render-1',
    spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
  },
};

function harness(options = {}) {
  const job = structuredClone(baseJob);
  if (options.longRender) job.payload.timeline[0].endMs = 30000;
  const current = { ...structuredClone(job), status: 'RUNNING', execution: { leaseToken: job.leaseToken },
    consent: { purpose: 'life-movie.render', policyVersion: '1.1.0', decisionReceiptId: 'a'.repeat(64) } };
  const state = { current, reads: 0, downloads: 0, uploads: [], deleted: [], objects: new Map(), metadata: new Map(), children: new Set(), consentRevoked: false };
  const app = { use() {}, get() {}, post() {}, listen() {} };
  const express = Object.assign(() => app, { json: () => () => {} });
  const admin = {
    initializeApp() {},
    firestore: () => ({ collection: (collection) => ({ doc: () => ({ get: async () => {
      state.reads++;
      if (options.authorityError) throw new Error('private backend diagnostic must not escape');
      if (options.hungAuthority) return new Promise(() => {});
      return collection === 'jobs'
        ? { exists: true, data: () => state.current }
        : collection === 'users' ? { exists: !options.ownerMissing, data: () => ({ dataRightsDeletionPendingCentralPrivacy: Boolean(options.ownerDeletionPending) }) }
        : { exists: state.consentRevoked, data: () => ({ active: state.consentRevoked }) };
    } }) }) }),
    storage: () => ({ bucket: () => ({ file: (name) => ({
      createReadStream() {
        state.downloads++;
        if (options.cancelDownload) {
          setTimeout(() => { state.current.status = 'CANCELLED'; }, 10);
          return new Readable({ read() {} });
        }
        return fs.createReadStream(source);
      },
      createWriteStream(metadata) {
        state.uploads.push({ name, metadata });
        const chunks = [];
        return new Writable({
          write(chunk, _encoding, callback) {
            chunks.push(Buffer.from(chunk));
            if (options.failUpload && state.uploads.length === 2) return callback(new Error('fixture_upload_failed'));
            callback();
          },
          final(callback) {
            if (options.failUpload && state.uploads.length === 2) return callback(new Error('fixture_upload_failed'));
            state.objects.set(name, Buffer.concat(chunks));
            state.metadata.set(name, { generation: String(1793378565000020 + state.uploads.length),
              metadata: metadata.metadata.metadata });
            if (options.cancelUpload) state.current.status = 'CANCELLED';
            callback();
          },
        });
      },
      async getMetadata() { return [state.metadata.get(name)]; },
      async delete() {
        if (options.failCleanup) throw new Error('fixture_delete_failed');
        state.deleted.push(name); state.objects.delete(name);
      },
    }) }) }),
  };
  const worker = {};
  vm.runInNewContext(code + '\nmodule.exports = {renderLifeMovie, createRenderControl, run};', {
    module: worker, Buffer, AbortController, console: { log() {}, error() {} },
    process: { env: { GCS_BUCKET_NAME: 'private-fixture-bucket', URAI_ENV: 'test',
      URAI_STUDIO_LEASE_POLL_MS: '25', URAI_STUDIO_RENDER_TIMEOUT_MS: options.timeout || '10000' } },
    require(name) {
      if (name === 'express') return express;
      if (name === 'firebase-admin') return admin;
      // Synthetic-only render/cleanup test double. Do not modify the real
      // private-output-write-authority source or interpret these as cloud IAM passes.
      if (name === './private-output-write-authority' && options.syntheticOutputAuthority) {
        return { assertPrivateOutputWriteAuthority() {}, privateOutputWriteAuthorityAvailable: () => true };
      }
      if (name === 'node:child_process') return { spawnSync, spawn(command, args, opts) {
        const child = spawn(command, args, opts);
        state.children.add(child);
        child.on('close', () => state.children.delete(child));
        if (options.cancelRender) setTimeout(() => { state.current.status = 'CANCELLED'; }, 30);
        return child;
      } };
      return require(name);
    },
  });
  return { job, state, worker: worker.exports };
}

async function rejected(options, expected, mutate) {
  const h = harness(options);
  mutate?.(h);
  const started = Date.now();
  await assert.rejects(h.worker.renderLifeMovie(h.job), expected);
  assert.ok(Date.now() - started < 5000, 'cancelled/deadline work must stop promptly');
  assert.equal(h.state.children.size, 0, 'FFmpeg must be reaped before cleanup returns');
  if (!options.failCleanup) assert.equal(h.state.objects.size, 0, 'failed/cancelled attempt must retain no completed objects');
  return h;
}

try {
  for (const status of ['PENDING', 'CANCELLED', 'SUCCESS', 'DEAD']) {
    const h = await rejected({}, /render_lease_revoked/, ({ state }) => { state.current.status = status; });
    assert.equal(h.state.downloads, 0);
  }
  await rejected({}, /render_lease_revoked/, ({ state }) => { state.current.execution.leaseToken = 'new-attempt'; });
  await rejected({}, /render_job_binding_mismatch/, ({ state }) => { state.current.tenantId = 'another-tenant'; });
  await rejected({}, /render_job_binding_mismatch/, ({ state }) => { state.current.payload.timeline[0].endMs = 1000; });
  await rejected({ authorityError: true }, /render_authority_unavailable/);
  await rejected({ ownerMissing: true }, /render_authority_unavailable/);
  await rejected({ ownerDeletionPending: true }, /render_owner_deletion_pending/);
  await rejected({ hungAuthority: true, timeout: '75' }, /render_deadline_exceeded/);
  await rejected({}, /render_consent_revoked/, ({ state, job }) => {
    state.consentRevoked = true;
  });
  await rejected({ cancelDownload: true }, /render_lease_revoked/);
  await rejected({ longRender: true, cancelRender: true }, /render_lease_revoked/);
  await rejected({ longRender: true, timeout: '75' }, /render_deadline_exceeded/);
  // Verify the unchanged production interlock actually refuses output writes.
  await rejected({}, /life_movie_storage_enforced_write_authority_unavailable/);
  const cancelled = await rejected({ cancelUpload: true, syntheticOutputAuthority: true }, /render_lease_revoked/);
  assert.equal(cancelled.state.deleted.length, 1);
  const failed = await rejected({ failUpload: true, syntheticOutputAuthority: true }, /render_cleanup_incomplete/);
  assert.equal(failed.state.deleted.length, 1);
  await rejected({ cancelUpload: true, failCleanup: true, syntheticOutputAuthority: true }, /render_cleanup_incomplete/);

  const successes = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const h = harness({ syntheticOutputAuthority: true });
    const result = await h.worker.renderLifeMovie(h.job);
    assert.equal(result.ok, true);
    assert.equal(h.state.objects.size, 3);
    assert.equal(h.state.children.size, 0);
    for (const upload of h.state.uploads) assert.equal(upload.metadata.metadata.cacheControl, 'private, no-store');
    const movie = result.outputs.find((x) => x.kind === 'mp4');
    const bytes = h.state.objects.get(movie.ref.replace('gs://private-fixture-bucket/', ''));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), movie.checksum);
    const outputPath = path.join(root, `result-${attempt}.mp4`);
    fs.writeFileSync(outputPath, bytes);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', outputPath], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    const info = JSON.parse(probe.stdout);
    assert.equal(info.streams.find((x) => x.codec_type === 'video').codec_name, 'h264');
    assert.equal(info.streams.find((x) => x.codec_type === 'audio').codec_name, 'aac');
    assert.ok(Math.abs(Number(info.format.duration) - 0.5) <= 1 / 30);
    const manifest = JSON.parse(h.state.objects.get(result.outputs.find((x) => x.kind === 'manifest').ref.replace('gs://private-fixture-bucket/', '')));
    assert.equal(manifest.sources[0].downloadedBytes.sha256, crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'));
    successes.push(movie.ref);
  }
  assert.notEqual(successes[0], successes[1], 'separate attempts must not overwrite each other');
  console.log('[PASS] Life Movies: production output-write interlock DENIED; fictional-only positive render/cleanup test double; stale/cancelled leases, owner deletion, consent revocation, FFmpeg cancellation/deadline, cleanup and two MP4 renders');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
