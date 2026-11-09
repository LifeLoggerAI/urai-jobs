import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const helper = join(dirname(fileURLToPath(import.meta.url)), 'r946-r879-source-pin-preflight.mjs');
function run(cmd,args, cwd) { const r=spawnSync(cmd,args,{cwd,encoding:'utf8'}); return r; }
function fixture(t, entries) {
  const cwd=mkdtempSync(join(tmpdir(),'r946-git-'));
  t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run('git',['init','-q'],cwd).status,0);
  assert.equal(run('git',['config','user.email','checks@example.invalid'],cwd).status,0);
  assert.equal(run('git',['config','user.name','Test Runner'],cwd).status,0);
  writeFileSync(join(cwd,'a.txt'),'a-original\n');
  const digest=run('git',['hash-object','a.txt'],cwd).stdout.trim();
  writeFileSync(join(cwd,'runner.sh'),entries(digest));
  assert.equal(run('git',['add','.'],cwd).status,0);
  assert.equal(run('git',['commit','-qm','fixture'],cwd).status,0);
  return {cwd,digest};
}
test('matching HEAD blob pin is accepted', t=>{
  const f=fixture(t,sha=>`check_blob 'a.txt' '${sha}'\n`);
  const r=run('node',[helper,'runner.sh'],f.cwd);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/R946_SOURCE_PIN_PREFLIGHT_PASS count=1/);
});
test('stale blob pin is refused even when file exists', t=>{
  const f=fixture(t,()=>`check_blob 'a.txt' '${'0'.repeat(40)}'\n`);
  const r=run('node',[helper,'runner.sh'],f.cwd);
  assert.equal(r.status,1);
  assert.match(r.stderr,/blob_mismatch a\.txt/);
});
test('missing checked path is refused', t=>{
  const f=fixture(t,sha=>`check_blob 'missing.txt' '${sha}'\n`);
  const r=run('node',[helper,'runner.sh'],f.cwd);
  assert.equal(r.status,1);
  assert.match(r.stderr,/actual=MISSING/);
});
test('duplicated check cannot inflate evidence', t=>{
  const f=fixture(t,sha=>`check_blob 'a.txt' '${sha}'\ncheck_blob 'a.txt' '${sha}'\n`);
  const r=run('node',[helper,'runner.sh'],f.cwd);
  assert.equal(r.status,1);
  assert.match(r.stderr,/duplicate_path/);
});
test('zero pinned paths fail closed', t=>{
  const f=fixture(t,()=>`# no check_blob assertions\n`);
  const r=run('node',[helper,'runner.sh'],f.cwd);
  assert.equal(r.status,2);
  assert.match(r.stderr,/no_literal_check_blob_pins/);
});
