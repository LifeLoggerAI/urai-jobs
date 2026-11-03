import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = resolve(import.meta.dirname, 'r426-original-source-evidence.mjs');
function sh(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, ...opts });
  assert.equal(result.status, 0, 'fixture command ' + cmd + ' ' + args.join(' ') + ' failed: ' + result.stderr);
  return result.stdout.trim();
}
function setup(failOn = '') {
  const base = mkdtempSync(join(tmpdir(), 'r426-synth-'));
  const repo = join(base, 'repo'), bin = join(base, 'bin'), evidence = join(base, 'evidence');
  mkdirSync(repo); mkdirSync(bin); mkdirSync(evidence);
  writeFileSync(join(repo,'package.json'), JSON.stringify({ name:'synthetic-fixture', packageManager:'pnpm@8.15.9' }));
  writeFileSync(join(repo,'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(repo,'pnpm-workspace.yaml'), "packages:\n  - '.'\n");
  writeFileSync(join(repo,'.gitignore'),'.mock-fail-on\n');
  sh('git',['init','-q'],{cwd:repo});
  sh('git',['config','user.email','synthetic@invalid.test'],{cwd:repo});
  sh('git',['config','user.name','Synthetic Test'],{cwd:repo});
  sh('git',['add','.'],{cwd:repo});
  sh('git',['commit','-qm','synthetic fixture'],{cwd:repo});
  const sha = sh('git',['rev-parse','HEAD'],{cwd:repo});
  const fake = '#!/bin/sh\nset -eu\nif [ -f .mock-fail-on ] && [ "$(cat .mock-fail-on)" = "$*" ]; then echo SYNTHETIC_FAILURE; exit 41; fi\necho SYNTHETIC_PASS "$*"; exit 0\n';
  for (const cmd of ['npm','corepack']) { const p=join(bin,cmd);writeFileSync(p,fake,{mode:0o755}); }
  if (failOn) writeFileSync(join(repo,'.mock-fail-on'),failOn);
  return {repo,bin,evidence,sha};
}
function execute(f,sha=f.sha, extraEnv={}) {
  const result=spawnSync(process.execPath,[runner],{cwd:f.repo,encoding:'utf8',timeout:20000,
    env:{...process.env,PATH:f.bin+':'+process.env.PATH,URAI_EXACT_SOURCE_SHA:sha,URAI_EVIDENCE_DIR:f.evidence,URAI_R426_HARNESS_TEST:'1',...extraEnv}});
  const path=join(f.evidence,'r426-report.json');
  return {result,receipt:existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null};
}
test('exact pinned synthetic source runs all stages, but cannot claim production proof',()=>{
  const {result,receipt}=execute(setup());
  assert.equal(result.status,0,result.stderr);
  assert.equal(receipt.status,'TEST_ONLY');
  assert.equal(receipt.steps.length,7);
  assert.ok(receipt.steps.every(step=>step.status==='PASS'&&step.logSha256.length===64));
});
test('failed original build stage is terminal; no downstream false PASS',()=>{
  const {result,receipt}=execute(setup('run build'));
  assert.equal(result.status,1);
  assert.equal(receipt.status,'FAIL_CLOSED');
  assert.equal(receipt.steps.length,3);
  assert.equal(receipt.steps[2].status,'FAIL');
  assert.equal(receipt.steps[2].exitCode,41);
  assert.match(receipt.failureCode,/STAGE_FAILED_root-build/);
});
test('mismatched source SHA aborts before dependency installation',()=>{
  const {result,receipt}=execute(setup(),'0'.repeat(40));
  assert.equal(result.status,1);
  assert.equal(receipt.status,'FAIL_CLOSED');
  assert.equal(receipt.steps.length,0);
  assert.equal(receipt.failureCode,'SOURCE_SHA_MISMATCH');
});
test('missing authoritative source pin never runs',()=>{
  const f=setup();
  const {result,receipt}=execute(f,'');
  assert.equal(result.status,2);
  assert.equal(receipt,null);
});

test('a real run refuses to execute without a durable evidence destination',()=>{
  const f=setup();
  const {result,receipt}=execute(f,f.sha,{URAI_R426_HARNESS_TEST:'0'});
  assert.equal(result.status,1);
  assert.equal(receipt.status,'FAIL_CLOSED');
  assert.equal(receipt.failureCode,'R427_EVIDENCE_DESTINATION_REQUIRED');
  assert.equal(receipt.steps.length,0);
});
test('untracked files fail original-source admission before install',()=>{
  const f=setup();
  writeFileSync(join(f.repo,'untracked-module.js'),'module.exports = { unsafe:true };');
  const {result,receipt}=execute(f);
  assert.equal(result.status,1);
  assert.equal(receipt.failureCode,'CHECKOUT_NOT_CLEAN');
  assert.equal(receipt.steps.length,0);
});
