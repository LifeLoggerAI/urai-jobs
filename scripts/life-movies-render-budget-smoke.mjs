// Local, synthetic, no-provider execution proof. For the configured one-CPU,
// concurrency-two shape, invoke under taskset on one available logical CPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-render-budget-'));
const source = path.join(root, 'source.mp4');
const fixture = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30', '-t', '15', '-c:v', 'libx264', '-threads', '1', '-preset', 'medium', '-crf', '20', source], { encoding: 'utf8' });
assert.equal(fixture.status, 0, fixture.stderr);
const code = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const outputs = new Map();
const jobs = Array.from({ length: 2 }, (_, i) => ({
  jobId: `job-${i}`, tenantId: 'synthetic', ownerUid: 'synthetic', type: 'studio.render.video', leaseToken: `lease-${i}`,
  payload: {
    schemaVersion: 'urai-life-movie-render-v1', projectId: 'proof', renderPlanDigest: 'a'.repeat(64),
    sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`,
    sceneTruthDigest: 'b'.repeat(64),
    width: 1920, height: 1080, fps: 30,
    outputPrefix: `tenants/synthetic/life-movies/proof/render-${i}`,
    sources: [{ id: 'source', bucket: 'private-fixture', objectPath: 'tenants/synthetic/source.mp4', mimeType: 'video/mp4', provenance: 'original-source', sourceRefs: ['synthetic-testsrc2'], consentRef: 'fixture', ownerOrRightsRef: 'fixture' }],
    timeline: Array.from({ length: 3 }, (_, j) => ({ sourceId: 'source', startMs: j * 5000, endMs: (j + 1) * 5000 })),
    subtitleText: '', spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
  },
}));
const admin = {
  initializeApp() {},
  firestore: () => ({ collection: () => ({ doc: id => ({ get: async () => {
    const job = jobs.find(j => j.jobId === id);
    return { exists: Boolean(job), data: () => ({ ...job, status: 'RUNNING', execution: { leaseToken: job.leaseToken } }) };
  } }) }) }),
  storage: () => ({ bucket: () => ({ file: name => ({
    createReadStream: () => fs.createReadStream(source),
    createWriteStream: () => {
      const file = path.join(root, `output-${outputs.size}`);
      outputs.set(name, file);
      return fs.createWriteStream(file);
    },
    delete: async () => { if (outputs.has(name)) fs.rmSync(outputs.get(name), { force: true }); },
  }) }) }),
};
const app = { use() {}, get() {}, post() {}, listen() {} };
const worker = {};
vm.runInNewContext(code + '\nmodule.exports = { renderLifeMovie };', {
  module: worker, Buffer, AbortController, console: { log() {}, error() {} },
  process: { env: { GCS_BUCKET_NAME: 'private-fixture', URAI_ENV: 'test' } },
  require(name) {
    if (name === 'express') return Object.assign(() => app, { json: () => () => {} });
    if (name === 'firebase-admin') return admin;
    return require(name);
  },
});
try {
  const started = performance.now();
  const results = await Promise.all(jobs.map(job => worker.exports.renderLifeMovie(job)));
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs < 110000, 'both admitted renders must complete inside the unchanged worker deadline');
  const durations = [];
  for (const result of results) {
    assert.equal(result.ok, true);
    const mp4 = result.outputs.find(output => output.kind === 'mp4');
    const file = outputs.get(mp4.ref.replace('gs://private-fixture/', ''));
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    const info = JSON.parse(probe.stdout);
    assert.equal(info.streams.find(s => s.codec_type === 'video').codec_name, 'h264');
    assert.equal(info.streams.find(s => s.codec_type === 'audio').codec_name, 'aac');
    const duration = Number(info.format.duration);
    assert.ok(Math.abs(duration - 15) <= 1 / 30, `declared 15-second timeline must be preserved: ${duration}`);
    durations.push(duration);
  }
  console.log(JSON.stringify({ result: 'pass', renders: 2, profile: '1080p30 / 15s / three segments', elapsedMs, durations, workerDeadlineMs: 110000, providerCalls: 0, storage: 'local filesystem fixture', cloudPerformanceCertified: false }));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
