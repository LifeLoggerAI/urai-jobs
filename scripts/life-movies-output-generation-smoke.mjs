import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-life-movie-generation-'));
const localPath = path.join(root, 'synthetic.bin');
fs.writeFileSync(localPath, 'synthetic-private-output');
const app = { use() {}, get() {}, post() {}, listen() {} };
const worker = { exports: {} };
vm.runInNewContext(source + '\nmodule.exports = { createPrivateOutputControl };', {
  module: worker, Buffer, AbortController, console: { log() {}, error() {} }, process: { env: { URAI_ENV: 'test' } },
  require(name) {
    if (name === 'express') return Object.assign(() => app, { json: () => () => {} });
    if (name === 'firebase-admin') return { initializeApp() {} };
    return require(name);
  },
});
function fixture(options = {}) {
  const state = { object: options.existing || null, nextGeneration: 100, checks: 0, deletes: [], writes: [] };
  const control = { signal: new AbortController().signal, wait: value => value,
    async check() { state.checks++; if (options.revokeAfterWrite && state.object) throw new Error('render_owner_deleted'); } };
  const file = {
    createWriteStream(config) {
      state.writes.push(config);
      assert.equal(config.preconditionOpts.ifGenerationMatch, 0);
      const chunks = [];
      return new Writable({ write(chunk, _encoding, done) { chunks.push(chunk); done(); }, final(done) {
        if (state.object) return done(Object.assign(new Error('synthetic precondition failed'), { code: 412 }));
        state.object = { generation: String(state.nextGeneration++), metadata: structuredClone(config.metadata.metadata),
          bytes: Buffer.concat(chunks) };
        file.metadata = structuredClone(state.object);
        this.emit('response', { statusCode: 200 });
        done();
      } });
    },
    async getMetadata() {
      if (options.failMetadata) throw new Error('synthetic metadata unavailable');
      if (!state.object) throw Object.assign(new Error('synthetic not found'), { code: 404 });
      if (options.replaceBeforeObserve) state.object.generation = '101';
      return [{ generation: state.object.generation, metadata: structuredClone(state.object.metadata) }];
    },
    async delete(config) {
      state.deletes.push(config);
      if (options.failDelete) throw new Error('synthetic delete unavailable');
      if (options.replaceBeforeDelete) state.object = { ...state.object, generation: String(state.nextGeneration++) };
      if (state.object && config.ifGenerationMatch !== state.object.generation) {
        throw Object.assign(new Error('synthetic generation changed'), { code: 412 });
      }
      state.object = null;
    },
  };
  const output = worker.exports.createPrivateOutputControl({ file: () => file },
    { jobId: 'fixture-job', ownerUid: 'fixture-owner', leaseToken: 'fixture-lease' }, 'fixture-attempt', control);
  return { state, output };
}
let cases = 0;
try {
  const valid = fixture();
  await valid.output.upload(localPath, 'fixture-output', 'video/mp4');
  assert.equal(valid.state.object.bytes.toString(), 'synthetic-private-output');
  assert.equal(valid.state.checks, 2, 'current authority must be checked after Storage metadata before success');
  await valid.output.cleanup();
  assert.equal(valid.state.object, null);
  assert.equal(valid.state.deletes[0].ifGenerationMatch, '100'); cases++;

  const revoked = fixture({ revokeAfterWrite: true });
  await assert.rejects(revoked.output.upload(localPath, 'fixture-output', 'video/mp4'), /render_owner_deleted/);
  await revoked.output.cleanup(); assert.equal(revoked.state.object, null); cases++;

  for (const mutate of [
    h => { h.state.object.generation = '101'; },
    h => { h.state.object.metadata.uraiLifeMovieOwnerSha256 = 'foreign-owner'; },
    h => { h.state.object.metadata.uraiLifeMovieJobId = 'foreign-job'; },
    h => { h.state.object.generation = 'invalid'; },
  ]) {
    const h = fixture(); await h.output.upload(localPath, 'fixture-output', 'video/mp4'); mutate(h);
    await assert.rejects(h.output.cleanup(), /render_output_cleanup_incomplete/);
    assert.ok(h.state.object, 'generation/owner drift must preserve the replacement object');
    assert.equal(h.state.deletes.length, 0); cases++;
  }
  const collision = fixture({ existing: { generation: '99', metadata: { foreign: true }, bytes: Buffer.from('original') } });
  await assert.rejects(collision.output.upload(localPath, 'fixture-output', 'video/mp4'), /precondition failed/);
  await assert.rejects(collision.output.cleanup(), /render_output_cleanup_incomplete/);
  assert.equal(collision.state.object.bytes.toString(), 'original'); assert.equal(collision.state.deletes.length, 0); cases++;

  const readRace = fixture({ replaceBeforeObserve: true });
  await assert.rejects(readRace.output.upload(localPath, 'fixture-output', 'video/mp4'), /render_output_generation_changed/);
  await assert.rejects(readRace.output.cleanup(), /render_output_cleanup_incomplete/);
  assert.equal(readRace.state.object.generation, '101'); assert.equal(readRace.state.deletes.length, 0); cases++;

  for (const options of [{ replaceBeforeDelete: true }, { failDelete: true }]) {
    const h = fixture(options); await h.output.upload(localPath, 'fixture-output', 'video/mp4');
    await assert.rejects(h.output.cleanup(), /render_output_cleanup_incomplete/);
    assert.ok(h.state.object); assert.equal(h.state.deletes[0].ifGenerationMatch, '100'); cases++;
  }
  const unavailable = fixture({ failMetadata: true });
  await assert.rejects(unavailable.output.upload(localPath, 'fixture-output', 'video/mp4'), /metadata unavailable/);
  await assert.rejects(unavailable.output.cleanup(), /render_output_cleanup_incomplete/);
  assert.ok(unavailable.state.object); assert.equal(unavailable.state.deletes.length, 0); cases++;

  const absent = fixture(); await absent.output.upload(localPath, 'fixture-output', 'video/mp4');
  absent.state.object = null; await absent.output.cleanup(); assert.equal(absent.state.deletes.length, 0); cases++;
  console.log(`[PASS] ${cases} actual Life Movie generation/control cases; create-only writes, current-authority publication, pinned cleanup, replacement preservation and explicit cleanup uncertainty; provider calls:0; cloud acceptance:false`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
