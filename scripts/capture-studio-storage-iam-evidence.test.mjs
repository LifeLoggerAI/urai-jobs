import test from 'node:test';
import assert from 'node:assert/strict';
import { captureIamEvidence, SCHEMA } from './review-only/capture-studio-storage-iam-evidence.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const scope = { projectId:'urai-review-1', bucket:'private-review-bucket', region:'us-central1' };
const policy = { version:3, bindings:[{role:'roles/storage.objectViewer',members:['serviceAccount:synthetic@urai-review-1.iam.gserviceaccount.com']}] };
function mock(commands, override={}) {
  return args => {
    commands.push(args);
    const s = args.join(' ');
    if (s.includes('get-ancestors')) return override.ancestors ?? [{type:'project',id:'urai-review-1'},{type:'organization',id:'1234'}];
    if (s.includes('get-iam-policy')) return override.policy ?? policy;
    if (s.includes('run services list')) return override.services ?? [{metadata:{name:'urai-studio-worker'},spec:{template:{spec:{serviceAccountName:'worker@urai-review-1.iam.gserviceaccount.com'}}} }];
    if (s.includes('run revisions list')) return override.revisions ?? [{metadata:{name:'urai-studio-worker-00001-a'},spec:{serviceAccountName:'worker@urai-review-1.iam.gserviceaccount.com'}}];
    throw Error('unexpected command');
  };
}
test('R536: project/bucket/inherited IAM plus Cloud Run identities are captured as offline HOLD evidence',()=>{
  const cmds=[];const r=captureIamEvidence(scope,mock(cmds));
  assert.equal(r.schemaVersion,SCHEMA); assert.equal(r.projectId,scope.projectId);
  assert.deepEqual(r.projectPolicy,policy); assert.deepEqual(r.bucketPolicy,policy);
  assert.equal(r.ancestorPolicies.length,1); assert.equal(r.ancestorPolicies[0].level,'organization');
  assert.equal(r.runServices[0].serviceAccount,'worker@urai-review-1.iam.gserviceaccount.com');
  assert.equal(r.revisionInventory[0].name,'urai-studio-worker-00001-a');
  assert.match(r.collectorCoverage,/ONE_REGION_ONLY/);assert.equal(cmds.length,6);
});
test('R536: every command is read-only and explicitly scoped to project',()=>{
  const commands=[];captureIamEvidence(scope,mock(commands));
  for(const a of commands){assert.ok(a.includes('--project'));assert.ok(a.includes(scope.projectId));assert.ok(a.includes('--format=json'));
    assert.doesNotMatch(a.join(' '),/\b(set|update|add|remove|delete|create|deploy|auth)\b/);}
});
test('R536: unknown identity never becomes an invented service principal',()=>{
  const s=captureIamEvidence(scope,mock([],{services:[{metadata:{name:'urai-studio-worker'}}]}));
  assert.equal(s.runServices[0].serviceAccount,null);
});
test('R536: invalid scope rejects before any command',()=>{
  for(const x of [{...scope,bucket:'gs://malformed'},{...scope,projectId:'--impersonate-service-account'},{...scope,region:'xyz'}]) {
    let calls=0;assert.throws(()=>captureIamEvidence(x,()=>{calls++;}),/INVALID_SCOPE/);assert.equal(calls,0);
  }
});
test('R536: collector fails closed on incomplete inherited policies',()=>{
  assert.throws(()=>captureIamEvidence(scope,mock([],{policy:{}})),/INCOMPLETE_POLICY/);
});
test('R536: malformed revision inventory cannot certify historical identities',()=>{
  assert.throws(()=>captureIamEvidence(scope,mock([],{revisions:[{}]})),/INCOMPLETE_RUNTIME_IDENTITY/);
});
test('R536: command failure cannot produce partial approval evidence',()=>{
  assert.throws(()=>captureIamEvidence(scope,()=>{throw Error('no permission');}),/no permission/);
});
test('R536: empty organization history is explicitly incomplete in data',()=>{
  const s=captureIamEvidence(scope,mock([],{ancestors:[{type:'project',id:'urai-review-1'}]}));
  assert.deepEqual(s.ancestorPolicies,[]);assert.match(s.collectorCoverage,/NOT_EFFECTIVE_IAM/);
});
test('R536: CLI rejects relative output before any Google CLI call',()=>{
  const script=fileURLToPath(new URL('./review-only/capture-studio-storage-iam-evidence.mjs',import.meta.url));
  const x=spawnSync(process.execPath,[script,'--project',scope.projectId,'--bucket',scope.bucket,'--region',scope.region,'--out','snapshot.json'],{encoding:'utf8'});
  assert.equal(x.status,1);assert.match(x.stderr,/CAPTURE_BLOCKED/);assert.doesNotMatch(x.stderr,/synthetic@/);
});
test('R536: CLI mocked Google reads produce private 0600 snapshot without leaking principals',()=>{
  const dir=mkdtempSync(join(tmpdir(),'urai-r536-'));
  try{
    const bin=join(dir,'bin'),work=join(dir,'workspace'),secure=join(dir,'private');
    mkdirSync(bin,{mode:0o700});mkdirSync(work,{mode:0o700});mkdirSync(secure,{mode:0o700});
    const fake=join(bin,'gcloud');
    writeFileSync(fake,`#!/usr/bin/env node\nconst s=process.argv.slice(2).join(' ');\nlet r;\nif(s.includes('get-ancestors'))r=[{type:'organization',id:'1234'}];\nelse if(s.includes('run services list'))r=[{metadata:{name:'urai-studio-worker'},spec:{template:{spec:{serviceAccountName:'synthetic@urai-review-1.iam.gserviceaccount.com'}}}}];\nelse if(s.includes('run revisions list'))r=[{metadata:{name:'urai-studio-worker-00001-a'},spec:{serviceAccountName:'synthetic@urai-review-1.iam.gserviceaccount.com'}}];\nelse r={version:3,bindings:[]};\nprocess.stdout.write(JSON.stringify(r));\n`);chmodSync(fake,0o700);
    const script=fileURLToPath(new URL('./review-only/capture-studio-storage-iam-evidence.mjs',import.meta.url));
    const out=join(secure,'evidence.json');
    const x=spawnSync(process.execPath,[script,'--project',scope.projectId,'--bucket',scope.bucket,'--region',scope.region,'--out',out],{cwd:work,encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH},timeout:15000});
    assert.equal(x.status,0,x.stderr);assert.match(x.stdout,/HOLD/);assert.doesNotMatch(x.stdout+x.stderr,/synthetic@/);
    assert.equal(statSync(out).mode&0o777,0o600);
    const saved=JSON.parse(readFileSync(out,'utf8'));assert.equal(saved.schemaVersion,SCHEMA);
    assert.equal(saved.revisionInventory[0].serviceAccount,'synthetic@urai-review-1.iam.gserviceaccount.com');
    const retry=spawnSync(process.execPath,[script,'--project',scope.projectId,'--bucket',scope.bucket,'--region',scope.region,'--out',out],{cwd:work,encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH},timeout:15000});
    assert.equal(retry.status,1,'must refuse overwriting private snapshot');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
