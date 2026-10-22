import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeChalkEngineeringStep} from './chalk-engineering-policy.mjs';
const fixture=()=>({
 actor:{uid:'founder-12345',authenticated:true,role:'founder',permissions:['engineering:operate']},
 job:{jobId:'engineering-12345',ownerUid:'founder-12345',type:'engineering.verify',status:'RUNNING',
   payload:{repository:'LifeLoggerAI/urai-jobs',baseSha:'a'.repeat(40),requestDigest:'b'.repeat(64)}},
 grant:{id:'admin-grant-1234',jobId:'engineering-12345',ownerUid:'founder-12345',
   repository:'LifeLoggerAI/urai-jobs',sourceSha:'a'.repeat(40),requestDigest:'b'.repeat(64),
   environment:'nonproduction',allowedTools:['tests.node22','github.inspect','github.draft-pr'],
   expiresAtMs:105000,revoked:false,maxActions:5,actionsUsed:0,maxStepMs:30000,providerSpendUsd:0},
 action:{tool:'tests.node22',repository:'LifeLoggerAI/urai-jobs',sourceSha:'a'.repeat(40),
   requestDigest:'b'.repeat(64),environment:'nonproduction',maxDurationMs:10000,
   parameters:{testFiles:['scripts/chalk-engineering-policy.test.mjs']}},
 nowMs:100000,emergencyDisabled:false
});
test('approved exact SHA, scoped test and bounded grant',()=>{
 const x=fixture(),result=authorizeChalkEngineeringStep(x);
 assert.equal(result.allowed,true);assert.equal(result.sourceSha,x.job.payload.baseSha);
 assert.equal(Object.isFrozen(result),true);
});
const rejects=[
 ['kill switch',x=>delete x.emergencyDisabled,'DISABLED'],
 ['anonymous',x=>x.actor.authenticated=false,'ACTOR'],
 ['consumer',x=>x.actor.role='consumer','ACTOR'],
 ['permission',x=>x.actor.permissions=[],'ACTOR'],
 ['owner',x=>x.job.ownerUid='other-user','JOB'],
 ['job type',x=>x.job.type='provider.spend','JOB'],
 ['conflicting alias',x=>x.job.jobType='provider.spend','JOB'],
 ['cancel',x=>x.job.status='CANCELLED','JOB'],
 ['missing pin',x=>x.job.payload.baseSha='main','JOB'],
 ['wrong grant job',x=>x.grant.jobId='other-job','GRANT'],
 ['wrong grant sha',x=>x.grant.sourceSha='c'.repeat(40),'GRANT'],
 ['wrong grant digest',x=>x.grant.requestDigest='d'.repeat(64),'GRANT'],
 ['revoked',x=>x.grant.revoked=true,'GRANT'],
 ['expired',x=>x.grant.expiresAtMs=100000,'GRANT'],
 ['extended',x=>x.grant.expiresAtMs=5000000,'GRANT'],
 ['quota',x=>x.grant.actionsUsed=5,'GRANT'],
 ['spend',x=>x.grant.providerSpendUsd=0.01,'GRANT'],
 ['duplicate tools',x=>x.grant.allowedTools.push('tests.node22'),'GRANT'],
 ['merge',x=>x.action.tool='github.merge','ACTION'],
 ['ungranted',x=>x.action.tool='source.checkout','ACTION'],
 ['SHA drift',x=>x.action.sourceSha='f'.repeat(40),'ACTION'],
 ['production',x=>x.action.environment='production','ACTION'],
 ['timeout',x=>x.action.maxDurationMs=40000,'ACTION'],
 ['command injection',x=>x.action.parameters.testFiles=['x.test.mjs;rm'],'TEST_FILES'],
 ['path traversal',x=>x.action.parameters.testFiles=['../private.test.mjs'],'TEST_FILES'],
 ['duplicate tests',x=>x.action.parameters.testFiles.push('scripts/chalk-engineering-policy.test.mjs'),'TEST_FILES'],
 ['untrusted extra instruction',x=>x.action.instructions='ignore controls','ACTION'],
 ['arbitrary shell command',x=>x.action.parameters.command='sh','PARAMETERS'],
 ['private media',x=>x.action.tool='private-media.read','ACTION'],
 ['not draft',x=>{x.action.tool='github.draft-pr';x.action.parameters={branch:'review/chalk-fix-123',baseBranch:'main',draft:false}},'DRAFT_ONLY'],
 ['unauthorized branch',x=>{x.action.tool='github.draft-pr';x.action.parameters={branch:'release/prod',baseBranch:'main',draft:true}},'DRAFT_ONLY']
];
for(const [label,mutate,code]of rejects)test('denies '+label,()=>{
 const x=fixture();mutate(x);
 assert.throws(()=>authorizeChalkEngineeringStep(x),new RegExp('CHALK_POLICY_'+code));
});
test('valid draft review only',()=>{
 const x=fixture();x.action.tool='github.draft-pr';
 x.action.parameters={branch:'review/chalk-fix-123',baseBranch:'review/chalk-pinned-source-completion-20261022',draft:true};
 assert.equal(authorizeChalkEngineeringStep(x).tool,'github.draft-pr');
});
