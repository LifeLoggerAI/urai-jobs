import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { EngineeringContinuityStore } from './chalk-engineering-continuity.mjs';

const input = {
  jobId: 'eng-work-1234',
  ownerUid: 'owner-12345',
  repository: 'LifeLoggerAI/urai-spatial',
  baseSha: 'a'.repeat(40),
  requestDigest: 'b'.repeat(64)
};
const token = 'original-worker-lease-token';
const second = 'second-worker-lease-token';
const digest = 'c'.repeat(64), sourceSha = input.baseSha;

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'urai-chalk-'));
  let now = 100000;
  const store = new EngineeringContinuityStore({ directory, now: () => now, maxAttempts: 2 });
  try { await fn({ directory, store, tick: t => { now += t; } }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
test('cross-process restart resumes a checkpoint and fences the dead worker', () => fixture(async ({ directory, store, tick }) => {
  await store.create(input);
  const first = await store.claim({ jobId: input.jobId, ownerUid: input.ownerUid, token, leaseMs: 1000 });
  tick(1001);
  const mod = new URL('./chalk-engineering-continuity.mjs', import.meta.url).href;
  const js = `import {EngineeringContinuityStore} from ${JSON.stringify(mod)};
    const s = new EngineeringContinuityStore({directory:${JSON.stringify(directory)}, now:()=>101001, maxAttempts:2});
    const a=await s.read({jobId:'eng-work-1234',ownerUid:'owner-12345'});
    if(a.generation!==1)process.exit(2);
    const b=await s.claim({jobId:'eng-work-1234',ownerUid:'owner-12345',token:'second-worker-lease-token',leaseMs:1000});
    console.log(JSON.stringify({generation:b.generation,revision:b.revision}));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', js], { encoding:'utf8' });
  assert.equal(child.status,0,child.stderr);
  const recovered = JSON.parse(child.stdout);
  assert.equal(recovered.generation,2);
  await assert.rejects(store.complete({jobId:input.jobId,ownerUid:input.ownerUid,token,generation:first.generation,expectedRevision:first.revision,resultDigest:digest,sourceSha}), /STALE_AUTHORITY/);
  const done = await store.complete({jobId:input.jobId,ownerUid:input.ownerUid,token:second,generation:recovered.generation,expectedRevision:recovered.revision,resultDigest:digest,sourceSha});
  assert.equal(done.status,'COMPLETED');
}));
test('duplicate request retains identity but changed request fails', () => fixture(async ({ store }) => {
  const a=await store.create(input);
  assert.deepEqual(await store.create(input),a);
  await assert.rejects(store.create({...input,requestDigest:'f'.repeat(64)}),/IDEMPOTENCY_CONFLICT/);
}));
test('cross-owner access is denied', () => fixture(async ({ store }) => {
  await store.create(input);
  await assert.rejects(store.read({jobId:input.jobId,ownerUid:'someone-else'}),/OWNER_DENIED/);
  await assert.rejects(store.claim({jobId:input.jobId,ownerUid:'someone-else',token}),/OWNER_DENIED/);
}));
test('corrupted state is blocked rather than silently restarted', () => fixture(async ({ store,directory }) => {
  await store.create(input);
  const p=join(directory,input.jobId+'.json');
  const x=JSON.parse(await readFile(p,'utf8'));
  x.state.status='COMPLETED';
  await writeFile(p,JSON.stringify(x));
  await assert.rejects(store.read({jobId:input.jobId,ownerUid:input.ownerUid}),/CHECKPOINT_CORRUPT/);
}));
test('cancellation invalidates the execution lease', () => fixture(async ({ store }) => {
  await store.create(input);
  const a=await store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token});
  assert.equal((await store.cancel({jobId:input.jobId,ownerUid:input.ownerUid,expectedRevision:a.revision})).status,'CANCELLED');
  await assert.rejects(store.complete({jobId:input.jobId,ownerUid:input.ownerUid,token,generation:a.generation,expectedRevision:a.revision,resultDigest:digest,sourceSha}),/STALE_AUTHORITY/);
}));
test('retry limit rejects repeated interruption and duplicate active leases', () => fixture(async ({store,tick}) => {
  await store.create(input);
  await store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token,leaseMs:1000});
  await assert.rejects(store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token:second}),/LEASE_ACTIVE/);
  tick(1001);
  await store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token:second,leaseMs:1000});
  tick(1001);
  await assert.rejects(store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token:'third-worker-secret-token'}),/ATTEMPTS_EXHAUSTED/);
}));
test('completion receipt is immutable under replay', () => fixture(async ({store}) => {
  await store.create(input);
  const a=await store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token});
  const args={jobId:input.jobId,ownerUid:input.ownerUid,token,generation:a.generation,expectedRevision:a.revision,resultDigest:digest,sourceSha};
  const first=await store.complete(args);
  assert.deepEqual(await store.complete(args),first);
  await assert.rejects(store.complete({...args,resultDigest:'e'.repeat(64)}),/STALE_AUTHORITY/);
}));
test('bad paths, repositories and lease tokens fail closed', () => fixture(async ({store}) => {
  await assert.rejects(store.create({...input,jobId:'../escape'}),/JOB_ID/);
  await assert.rejects(store.create({...input,repository:'other/repo'}),/INPUT/);
  await store.create(input);
  await assert.rejects(store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token:'short'}),/LEASE_INPUT/);
}));

test('SIGKILL while holding local lock does not prevent worker recovery', () => fixture(async ({directory,store}) => {
  await store.create(input);
  const url = new URL('./chalk-engineering-continuity.mjs', import.meta.url).href;
  const code = `import {EngineeringContinuityStore} from ${JSON.stringify(url)};
    const store = new EngineeringContinuityStore({ directory: ${JSON.stringify(directory)} });
    await store.withLock('eng-work-1234', async () => {
      process.stdout.write('LOCKED\\n');
      await new Promise(() => {});
    });`;
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', code],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await Promise.race([
      new Promise((resolve,reject)=>{
        let chunk='';
        child.stdout.on('data', d => {chunk+=d.toString(); if (chunk.includes('LOCKED')) resolve();});
        child.on('error',reject);
        child.on('exit',()=>reject(new Error('worker exited before lock')));
      }),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('lock acquisition timeout')),4000))
    ]);
  } finally {
    child.kill('SIGKILL');
    await new Promise(resolve => child.once('exit',resolve));
  }
  const state = await store.claim({jobId:input.jobId,ownerUid:input.ownerUid,token:'replacement-worker-lease-token'});
  assert.equal(state.status, 'RUNNING');
  assert.equal(state.attempts,1);
}));
