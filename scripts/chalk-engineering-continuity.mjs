// UrAi Jobs engineering checkpoint prototype. NOT a production job admission.
// Use an owner-scoped, authenticated durable adapter in the deployed worker.
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const VERSION = 'urai-engineering-continuity-v1';
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error('ENGINEERING_' + code); };
const valid = (regex, value) => typeof value === 'string' && regex.test(value);

export class EngineeringContinuityStore {
  constructor({ directory, now = () => Date.now(), maxAttempts = 3 }) {
    if (!directory || !Number.isInteger(maxAttempts) || maxAttempts < 1) fail('CONFIG');
    this.directory = directory;
    this.now = now;
    this.maxAttempts = maxAttempts;
  }
  path(jobId) {
    if (!valid(ID, jobId)) fail('JOB_ID');
    return join(this.directory, jobId + '.json');
  }
  async withLock(jobId, callback) {
    const path = this.path(jobId);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lock = await open(path + '.lock', 'wx', 0o600).catch(err => {
      if (err?.code === 'EEXIST') fail('LOCKED');
      throw err;
    });
    try { return await callback(path); }
    finally { await lock.close(); await rm(path + '.lock', { force: true }); }
  }
  async load(path) {
    let envelope;
    try { envelope = JSON.parse(await readFile(path, 'utf8')); }
    catch (err) { if (err?.code === 'ENOENT') return null; fail('CHECKPOINT_CORRUPT'); }
    const state = envelope?.state;
    if (!state || typeof state !== 'object' || Array.isArray(state) ||
      !valid(DIGEST, envelope.integrity) ||
      hash(JSON.stringify(state)) !== envelope.integrity ||
      state.version !== VERSION || !valid(ID, state.jobId) ||
      !valid(ID, state.ownerUid) || !valid(SHA, state.baseSha) ||
      !valid(DIGEST, state.requestDigest) ||
      !Number.isInteger(state.revision) || !Number.isInteger(state.generation) ||
      !Number.isInteger(state.attempts) ||
      !['QUEUED', 'RUNNING', 'COMPLETED', 'CANCELLED'].includes(state.status)) fail('CHECKPOINT_CORRUPT');
    return state;
  }
  async save(path, state) {
    const temp = path + '.' + process.pid + '.' + hash(String(Math.random())).slice(0, 12) + '.tmp';
    const handle = await open(temp, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify({ state, integrity: hash(JSON.stringify(state)) }));
      await handle.sync();
    } finally { await handle.close(); }
    try { await rename(temp, path); }
    catch (err) { await rm(temp, { force: true }); throw err; }
    return state;
  }
  owner(state, ownerUid) {
    if (state.ownerUid !== ownerUid) fail('OWNER_DENIED');
  }
  async create({ jobId, ownerUid, repository, baseSha, requestDigest }) {
    if (!valid(ID, ownerUid) ||
      typeof repository !== 'string' || !/^LifeLoggerAI\/[A-Za-z0-9_.-]{2,90}$/.test(repository) ||
      !valid(SHA, baseSha) || !valid(DIGEST, requestDigest)) fail('INPUT');
    return this.withLock(jobId, async path => {
      const existing = await this.load(path);
      if (existing) {
        this.owner(existing, ownerUid);
        if (existing.repository !== repository || existing.baseSha !== baseSha ||
          existing.requestDigest !== requestDigest) fail('IDEMPOTENCY_CONFLICT');
        return existing;
      }
      return this.save(path, {
        version: VERSION, jobId, ownerUid, repository, baseSha, requestDigest,
        status: 'QUEUED', revision: 0, generation: 0, attempts: 0,
        lease: null, result: null, updatedAt: this.now()
      });
    });
  }
  async read({ jobId, ownerUid }) {
    const state = await this.load(this.path(jobId));
    if (!state) fail('NOT_FOUND');
    this.owner(state, ownerUid);
    return state;
  }
  async claim({ jobId, ownerUid, token, leaseMs = 60000 }) {
    if (typeof token !== 'string' || token.length < 16 ||
      !Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 3600000) fail('LEASE_INPUT');
    return this.withLock(jobId, async path => {
      const state = await this.load(path);
      if (!state) fail('NOT_FOUND');
      this.owner(state, ownerUid);
      if (['COMPLETED', 'CANCELLED'].includes(state.status)) fail('TERMINAL');
      const now = this.now();
      if (state.status === 'RUNNING' && state.lease?.expiresAt > now) fail('LEASE_ACTIVE');
      if (state.attempts >= this.maxAttempts) fail('ATTEMPTS_EXHAUSTED');
      return this.save(path, {
        ...state, status: 'RUNNING', generation: state.generation + 1,
        attempts: state.attempts + 1, revision: state.revision + 1,
        lease: { tokenHash: hash(token), expiresAt: now + leaseMs }, updatedAt: now
      });
    });
  }
  async complete({ jobId, ownerUid, token, generation, expectedRevision, resultDigest, sourceSha }) {
    if (!valid(DIGEST, resultDigest) || !valid(SHA, sourceSha)) fail('RESULT_INPUT');
    return this.withLock(jobId, async path => {
      const state = await this.load(path);
      if (!state) fail('NOT_FOUND');
      this.owner(state, ownerUid);
      if (state.status === 'COMPLETED' && state.result?.resultDigest === resultDigest &&
        state.result?.sourceSha === sourceSha && state.result?.generation === generation) return state;
      if (state.status !== 'RUNNING' || state.generation !== generation ||
        state.revision !== expectedRevision || state.lease?.tokenHash !== hash(String(token)) ||
        state.lease.expiresAt <= this.now()) fail('STALE_AUTHORITY');
      return this.save(path, {
        ...state, status: 'COMPLETED', revision: state.revision + 1,
        lease: null, result: { generation, resultDigest, sourceSha }, updatedAt: this.now()
      });
    });
  }
  async cancel({ jobId, ownerUid, expectedRevision }) {
    return this.withLock(jobId, async path => {
      const state = await this.load(path);
      if (!state) fail('NOT_FOUND');
      this.owner(state, ownerUid);
      if (state.revision !== expectedRevision || state.status === 'COMPLETED') fail('STALE_AUTHORITY');
      if (state.status === 'CANCELLED') return state;
      return this.save(path, {
        ...state, status: 'CANCELLED', generation: state.generation + 1,
        revision: state.revision + 1, lease: null, updatedAt: this.now()
      });
    });
  }
}
