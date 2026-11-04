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
    if (s.includes('run jobs executions list')) return override.executions?.[args[5]] ?? [];
    if (s.includes('run jobs list')) return override.jobs ?? [];
    if (s.includes('run jobs describe')) return override.jobDetails?.[args[3]] ?? {metadata:{name:args[3]}};
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
  assert.equal(r.collectionRegion,scope.region);assert.match(r.collectorCoverage,/ONE_REGION_ONLY/);assert.equal(cmds.length,7);assert.deepEqual(r.runJobs,[]);
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
    writeFileSync(fake,`#!/usr/bin/env node\nconst s=process.argv.slice(2).join(' ');\nlet r;\nif(s.includes('get-ancestors'))r=[{type:'organization',id:'1234'}];\nelse if(s.includes('run services list'))r=[{metadata:{name:'urai-studio-worker'},spec:{template:{spec:{serviceAccountName:'synthetic@urai-review-1.iam.gserviceaccount.com'}}}}];\nelse if(s.includes('run revisions list'))r=[{metadata:{name:'urai-studio-worker-00001-a'},spec:{serviceAccountName:'synthetic@urai-review-1.iam.gserviceaccount.com'}}];\nelse if(s.includes('run jobs list'))r=[];\nelse r={version:3,bindings:[]};\nprocess.stdout.write(JSON.stringify(r));\n`);chmodSync(fake,0o700);
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

test('R537: Cloud Run Jobs v1 and v2 independently declared principals are inventoried',()=>{
  const calls=[];
  const jobs=[{metadata:{name:'urai-life-movie-job'}},{name:'projects/urai-review-1/locations/us-central1/jobs/urai-audio-job'}];
  const jobDetails={
    'urai-life-movie-job':{metadata:{name:'urai-life-movie-job'},spec:{template:{spec:{template:{spec:{serviceAccountName:'legacy-job@urai-review-1.iam.gserviceaccount.com'}}}}}},
    'urai-audio-job':{name:'projects/urai-review-1/locations/us-central1/jobs/urai-audio-job',template:{template:{serviceAccount:'audio-job@urai-review-1.iam.gserviceaccount.com'}}}
  };
  const evidence=captureIamEvidence(scope,mock(calls,{jobs,jobDetails}));
  assert.deepEqual(evidence.runJobs,[
    {name:'urai-life-movie-job',serviceAccount:'legacy-job@urai-review-1.iam.gserviceaccount.com'},
    {name:'urai-audio-job',serviceAccount:'audio-job@urai-review-1.iam.gserviceaccount.com'}
  ]);
  assert.equal(calls.filter(x=>x.slice(0,3).join(' ')==='run jobs describe').length,2);
  assert.equal(calls.length,11);
  assert.deepEqual(evidence.runJobExecutions,[]);
  assert.equal(calls.filter(x=>x.slice(0,4).join(' ')==='run jobs executions list').length,2);
});
test('R537: Cloud Run Job with no principal remains explicit unknown, not silently absent',()=>{
  const data=captureIamEvidence(scope,mock([],{jobs:[{metadata:{name:'unresolved-job'}}]}));
  assert.deepEqual(data.runJobs,[{name:'unresolved-job',serviceAccount:null}]);
});
test('R537: duplicate job identity cannot create misleading completeness',()=>{
  assert.throws(()=>captureIamEvidence(scope,mock([],{jobs:[{metadata:{name:'same-job'}},{name:'same-job'}]})),/DUPLICATE_JOB_IDENTITY/);
});
test('R537: unknown or mismatched job description fails closed',()=>{
  const jobs=[{metadata:{name:'listed-job'}}];
  assert.throws(()=>captureIamEvidence(scope,mock([],{jobs,jobDetails:{'listed-job':{metadata:{name:'different-job'}}}})),/JOB_DETAILS_MISMATCH/);
  assert.throws(()=>captureIamEvidence(scope,mock([],{jobs,jobDetails:{'listed-job':{}}})),/INCOMPLETE_RUNTIME_IDENTITY/);
});
test('R537: unavailable job description fails closed before writing any raw IAM snapshot',()=>{
  const run=args => {if(args.slice(0,3).join(' ')==='run jobs describe')throw Error('read denied');
    return mock([],{jobs:[{metadata:{name:'an-app-job'}}]})(args);};
  assert.throws(()=>captureIamEvidence(scope,run),/read denied/);
});
test('R584: execution history is listed for each Job with project, region, bounded read-only flags',()=>{
  const commands=[];
  const evidence=captureIamEvidence(scope,mock(commands,{
    jobs:[{metadata:{name:'urai-life-movie-job'}}],
    jobDetails:{'urai-life-movie-job':{metadata:{name:'urai-life-movie-job'},spec:{template:{spec:{serviceAccountName:'job@urai-review-1.iam.gserviceaccount.com'}}}}},
    executions:{'urai-life-movie-job':[
      {metadata:{name:'urai-life-movie-job-00001',labels:{'run.googleapis.com/job':'urai-life-movie-job'}},
       status:{completionTime:'2026-11-03T12:00:00Z',runningCount:0,conditions:[{type:'Completed',status:'True'}]}},
      {metadata:{name:'urai-life-movie-job-00002'},status:{runningCount:1}}
    ]}
  }));
  assert.deepEqual(evidence.runJobExecutions,[
    {jobName:'urai-life-movie-job',name:'urai-life-movie-job-00001',lifecycle:'RECORDED_TERMINAL'},
    {jobName:'urai-life-movie-job',name:'urai-life-movie-job-00002',lifecycle:'ACTIVE_OR_UNVERIFIED'}
  ]);
  const query=commands.find(x=>x.slice(0,4).join(' ')==='run jobs executions list');
  assert.ok(query);assert.ok(query.includes('--limit'));assert.ok(query.includes('500'));
  assert.ok(query.includes('--project'));assert.ok(query.includes('--region'));
  assert.doesNotMatch(query.join(' '),/\b(?:execute|cancel|delete|deploy)\b/);
});
test('R584: unresolved or malformed execution identities cannot become clean snapshots',()=>{
  const job=[{metadata:{name:'urai-life-movie-job'}}];
  const details={'urai-life-movie-job':{metadata:{name:'urai-life-movie-job'}}};
  for (const executions of [
    [null], [{}], [{metadata:{name:'invalid name'}}],
    [{metadata:{name:'exec1',labels:{'run.googleapis.com/job':'other-job'}}}],
    [{metadata:{name:'exec1'}},{metadata:{name:'exec1'}}]
  ]) {
    assert.throws(()=>captureIamEvidence(scope,mock([],
      {jobs:job,jobDetails:details,executions:{'urai-life-movie-job':executions}})),
      /EXECUTION_(?:INVENTORY|IDENTITY|JOB_SCOPE)/);
  }
});
test('R584: execution limit and denied history API fail closed before evidence is saved',()=>{
  const name='urai-life-movie-job';
  const jobs=[{metadata:{name}}],jobDetails={[name]:{metadata:{name}}};
  const excessive=Array.from({length:500},(_,i)=>({metadata:{name:'exec-'+i}}));
  assert.throws(()=>captureIamEvidence(scope,mock([],
    {jobs,jobDetails,executions:{[name]:excessive}})),/EXECUTION_HISTORY_AT_LIMIT/);
  const run=args=>{
    if (args.slice(0,4).join(' ')==='run jobs executions list') throw Error('forbidden execution listing');
    return mock([],{jobs,jobDetails})(args);
  };
  assert.throws(()=>captureIamEvidence(scope,run),/forbidden execution listing/);
});
