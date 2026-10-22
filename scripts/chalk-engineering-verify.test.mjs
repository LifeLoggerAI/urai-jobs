import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { EngineeringContinuityStore } from './chalk-engineering-continuity.mjs';
import { verifyPinnedSource } from './chalk-engineering-verify.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'urai-chalk-verify-'));
  const workspace = join(root, 'workspace');
  await mkdir(join(workspace, 'test'), { recursive: true });
  await writeFile(join(workspace, 'test', 'safe.test.mjs'), "import test from 'node:test'; test('genuine pinned work', () => {});\n");
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  git('init','-q'); git('add','.'); git('-c','user.name=UrAi test','-c','user.email=local@example.invalid','commit','-qm','fixture');
  const baseSha = git('rev-parse', 'HEAD');
  const store = new EngineeringContinuityStore({directory:join(root,'checkpoints')});
  const jobId='engineering-123456', ownerUid='founder-123456', token='worker-lease-token-abcdef';
  const create = (sha=baseSha)=>store.create({jobId, ownerUid, repository:'LifeLoggerAI/urai-spatial', baseSha:sha, requestDigest:'a'.repeat(64)});
  const verify = args=>verifyPinnedSource({store,jobId,ownerUid,token,workspace,testFile:'test/safe.test.mjs',...args});
  try { await run({root,workspace,store,create,verify,jobId,ownerUid,baseSha,git}); }
  finally { await rm(root, {recursive:true,force:true}); }
}

test('real pinned Node test completes, persisted receipt replays without reexecution',()=>fixture(async({store,create,verify,jobId,ownerUid,baseSha})=>{
  await create(); const first=await verify();
  assert.equal(first.replay,false);
  assert.equal(first.state.result.sourceSha,baseSha);
  assert.match(first.state.result.resultDigest,/^[a-f0-9]{64}$/);
  const replay=await verify();
  assert.equal(replay.replay,true);
  assert.deepEqual(replay.state,await store.read({jobId,ownerUid}));
}));
test('rejects wrong pinned source before claiming a worker lease',()=>fixture(async({store,create,verify,jobId,ownerUid})=>{
  await create('f'.repeat(40));
  await assert.rejects(verify(),/SOURCE_SHA_MISMATCH/);
  assert.equal((await store.read({jobId,ownerUid})).status,'QUEUED');
}));
test('rejects tracked source modifications even when HEAD is correct',()=>fixture(async({workspace,store,create,verify,jobId,ownerUid})=>{
  await create();
  await writeFile(join(workspace,'test','safe.test.mjs'),"import test from 'node:test'; test('modified',()=>{});\n");
  await assert.rejects(verify(),/UNCLEAN_WORKTREE/);
  assert.equal((await store.read({jobId,ownerUid})).status,'QUEUED');
}));
test('rejects untracked files because they can change test imports',()=>fixture(async({workspace,create,verify})=>{
  await create(); await writeFile(join(workspace,'test','extra.mjs'),'export default 1;\n');
  await assert.rejects(verify(),/UNCLEAN_WORKTREE/);
}));
test('refuses traversal and non-test executable paths',()=>fixture(async({create,verify})=>{
  await create();
  await assert.rejects(verify({testFile:'../outside.test.mjs'}),/VERIFY_PATH/);
  await assert.rejects(verify({testFile:'scripts/deploy.sh'}),/VERIFY_PATH/);
}));

test('rejects Git-ignored executable files that are absent from pinned source',()=>fixture(async({workspace,create,verify})=>{
  await writeFile(join(workspace,'.gitignore'),'test/ignored-module.mjs\n');
  execFileSync('git',['add','.gitignore'],{cwd:workspace});
  execFileSync('git',['-c','user.name=UrAi test','-c','user.email=local@example.invalid','commit','-qm','pin ignore rules'],{cwd:workspace});
  // The base SHA changed when we committed .gitignore; use the new exact pin.
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:workspace,encoding:'utf8'}).trim();
  await create(sha);
  await writeFile(join(workspace,'test','ignored-module.mjs'),"throw Error('unexpected code');\n");
  await assert.rejects(verify(),/UNCLEAN_WORKTREE/);
}));
