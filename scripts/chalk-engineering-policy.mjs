// Chalk nonproduction policy. Server-only pre-dispatch validation; NOT authentication.
// Trusted Admin must issue the grant and atomically reserve quota with Jobs lease.
// Never surface emergencyDisabled as a model/user-controllable parameter.
import { isChalkRepositoryIdentity } from './chalk-repository-identity.mjs';
const SHA=/^[a-f0-9]{40}$/, DIGEST=/^[a-f0-9]{64}$/, ID=/^[A-Za-z0-9_-]{8,64}$/;
const TOOLS=new Set(['github.inspect','source.checkout','tests.node22','firestore.emulator','github.draft-pr','evidence.read']);
const deny=reason=>{throw Error('CHALK_POLICY_'+reason)};
const matches=(p,v)=>typeof v==='string'&&p.test(v);
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
export function authorizeChalkEngineeringStep({actor,job,grant,action,nowMs,emergencyDisabled=true}){
 if(emergencyDisabled!==false)deny('DISABLED');
 if(!Number.isSafeInteger(nowMs)||nowMs<0)deny('CLOCK');
 if(!actor||!matches(ID,actor.uid)||actor.authenticated!==true||
   !['admin','founder'].includes(actor.role)||!Array.isArray(actor.permissions)||
   !actor.permissions.includes('engineering:operate'))deny('ACTOR');
 if(!job||!matches(ID,job.jobId)||job.ownerUid!==actor.uid||
   (job.type!==undefined&&job.type!=='engineering.verify')||
   (job.jobType!==undefined&&job.jobType!=='engineering.verify')||
   (job.type===undefined&&job.jobType===undefined)||job.status!=='RUNNING'||
   !job.payload||!isChalkRepositoryIdentity(job.payload.repository)||
   !matches(SHA,job.payload.baseSha)||!matches(DIGEST,job.payload.requestDigest))deny('JOB');
 if(!keys(grant,['id','jobId','ownerUid','repository','sourceSha','requestDigest','environment',
   'allowedTools','expiresAtMs','revoked','maxActions','actionsUsed','maxStepMs','providerSpendUsd'])||
   !matches(ID,grant.id)||grant.jobId!==job.jobId||grant.ownerUid!==actor.uid||
   grant.repository!==job.payload.repository||grant.sourceSha!==job.payload.baseSha||
   grant.requestDigest!==job.payload.requestDigest||grant.environment!=='nonproduction'||
   grant.revoked!==false||!Number.isSafeInteger(grant.expiresAtMs)||
   grant.expiresAtMs<=nowMs||grant.expiresAtMs>nowMs+3600000||
   !Number.isSafeInteger(grant.maxActions)||grant.maxActions<1||grant.maxActions>100||
   !Number.isSafeInteger(grant.actionsUsed)||grant.actionsUsed<0||
   grant.actionsUsed>=grant.maxActions||!Number.isSafeInteger(grant.maxStepMs)||
   grant.maxStepMs<1000||grant.maxStepMs>120000||grant.providerSpendUsd!==0||
   !Array.isArray(grant.allowedTools)||grant.allowedTools.length<1||
   new Set(grant.allowedTools).size!==grant.allowedTools.length||
   !grant.allowedTools.every(x=>TOOLS.has(x)))deny('GRANT');
 if(!keys(action,['tool','repository','sourceSha','requestDigest','environment','maxDurationMs','parameters'])||
   !TOOLS.has(action.tool)||!grant.allowedTools.includes(action.tool)||
   action.repository!==grant.repository||action.sourceSha!==grant.sourceSha||
   action.requestDigest!==grant.requestDigest||action.environment!=='nonproduction'||
   !Number.isSafeInteger(action.maxDurationMs)||action.maxDurationMs<1000||
   action.maxDurationMs>grant.maxStepMs)deny('ACTION');
 const p=action.parameters;
 if(!p||typeof p!=='object'||Array.isArray(p))deny('PARAMETERS');
 if(action.tool==='tests.node22'){
   if(!keys(p,['testFiles'])||!Array.isArray(p.testFiles)||p.testFiles.length<1||
     p.testFiles.length>16||new Set(p.testFiles).size!==p.testFiles.length||
     !p.testFiles.every(s=>typeof s==='string'&&
       /^[A-Za-z0-9_./-]+\.test\.mjs$/.test(s)&&!s.includes('\\')&&
       !s.includes('//')&&!s.startsWith('/')&&!s.split('/').some(x=>x==='..'||x==='.')))
     deny('TEST_FILES');
 }else if(action.tool==='github.draft-pr'){
   if(!keys(p,['branch','baseBranch','draft'])||p.draft!==true||
     !matches(/^review\/chalk-[a-z0-9][a-z0-9-]{2,70}$/,p.branch)||
     !['main','repair/chalk-engineering-continuity-20261022',
       'review/chalk-pinned-source-completion-20261022'].includes(p.baseBranch))deny('DRAFT_ONLY');
 }else if(Object.keys(p).length)deny('PARAMETERS');
 return Object.freeze({allowed:true,jobId:job.jobId,grantId:grant.id,tool:action.tool,
   repository:grant.repository,sourceSha:grant.sourceSha,
   requestDigest:grant.requestDigest,maxDurationMs:action.maxDurationMs});
}
export const CHALK_NONPRODUCTION_TOOLS=Object.freeze([...TOOLS]);
