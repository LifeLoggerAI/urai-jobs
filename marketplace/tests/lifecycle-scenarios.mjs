import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';

// Real compiled onRequest + loopback HTTP. Auth/Firestore are explicit synthetic
// interfaces: no emulator, cloud, provider, upload, UI or release acceptance.
assert.equal(Number(process.versions.node.split('.')[0]),22,'declared Node22 required');
const functionsDir=resolve(dirname(fileURLToPath(import.meta.url)),'../functions');
const pkg=JSON.parse(await readFile(resolve(functionsDir,'package.json'),'utf8'));
const mainUrl=pathToFileURL(resolve(functionsDir,pkg.main)).href;
const runtimeUrl=pathToFileURL(resolve(functionsDir,'lib/functions/firebase-admin-runtime.js')).href;
const env={URAI_JOBS_FIREBASE_PROJECT_ID:'demo-marketplace-source-proof',URAI_JOBS_STORAGE_BUCKET:'demo-marketplace-source-proof.invalid',URAI_JOBS_ALLOWED_ORIGIN:'http://127.0.0.1'};
Object.assign(process.env,env);
async function mount(handler){
  const server=createServer(async(req,res)=>{
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const raw=Buffer.concat(chunks).toString('utf8');req.body=raw?JSON.parse(raw):undefined;
      req.path=new URL(req.url,'http://127.0.0.1').pathname;req.get=req.header=name=>req.headers[name.toLowerCase()];
      res.status=code=>{res.statusCode=code;return res;};res.set=(key,value)=>{res.setHeader(key,value);return res;};
      res.json=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};
      res.send=body=>{res.end(body);return res;};await handler(req,res);
    }catch{res.statusCode=500;res.end(JSON.stringify({fixtureError:'FIXTURE_INTERNAL_ERROR'}));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return{server,base:'http://127.0.0.1:'+server.address().port};
}
// Fresh process imports the real factory too; default hold never creates an app.
const heldSource=[
"import assert from 'node:assert/strict';import{createServer}from'node:http';import{getApps}from'firebase-admin/app';",
mount.toString(),'const{marketplaceApi}=await import('+JSON.stringify(mainUrl)+');',
"assert.equal(marketplaceApi.__endpoint.platform,'gcfv2');assert.equal(getApps().length,0);",
"const{server,base}=await mount(marketplaceApi);try{for(const[method,path,status]of[['GET','/api/marketplace/jobs',503],['POST','/api/marketplace/profiles',503],['PATCH','/api/marketplace/applications/fixture/withdraw',503],['GET','/api/marketplace/health',200],['OPTIONS','/api/marketplace/profiles',204]]){",
"const response=await fetch(base+path,{method,headers:{Origin:'http://127.0.0.1','Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});assert.equal(response.status,status);if(status===503)assert.equal((await response.json()).code,'MARKETPLACE_LAUNCH_BLOCKED');if(path.endsWith('/health'))assert.equal((await response.json()).ready,false);}",
"assert.equal((await fetch(base+'/api/marketplace/health',{headers:{Origin:'https://foreign.invalid'}})).status,403);assert.equal(getApps().length,0);",
"const malformed=await fetch(base+'/api/marketplace/profiles',{method:'POST',headers:{Origin:'http://127.0.0.1','Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,500);assert.deepEqual(await malformed.json(),{fixtureError:'FIXTURE_INTERNAL_ERROR'});",
"assert.equal(getApps().length,0);console.log(JSON.stringify({node:process.version,platform:'gcfv2',defaultHoldCases:6,fixtureErrorResponseCases:1,firebaseAppsInitialized:0,adapter:'none'}));",
"}finally{await new Promise(r=>server.close(r));}"].join('\n');
const held=spawnSync(process.execPath,['--input-type=module','-e',heldSource],{cwd:functionsDir,env:{...process.env,URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED:'false'},encoding:'utf8',timeout:20000});
assert.equal(held.status,0,held.stderr+held.stdout);
const defaultHold=JSON.parse(held.stdout.trim().split('\n').at(-1));
console.log('PASS genuine compiled entry import/default hold over HTTP (6 cases)');
const failingFixture=await mount(()=>{throw new Error('synthetic-fixture-private-detail');});
try{
  const response=await fetch(failingFixture.base+'/owned-fixture');
  assert.equal(response.status,500);
  const body=await response.text();
  assert.deepEqual(JSON.parse(body),{fixtureError:'FIXTURE_INTERNAL_ERROR'});
  assert.equal(body.includes('synthetic-fixture-private-detail'),false);
  assert.equal(body.includes('Error:'),false);
}finally{await new Promise(r=>failingFixture.server.close(r));}
console.log('PASS fixture HTTP errors disclose no exception detail (2 cases)');
const copy=value=>value===undefined?undefined:structuredClone(value);
function normalize(value,stamp){
  if(value===undefined)throw Error('synthetic Firestore rejects undefined');
  if(value===null||typeof value!=='object')return value;
  if(value.constructor?.name==='ServerTimestampTransform')return stamp;
  if(Array.isArray(value))return value.map(item=>normalize(item,stamp));
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalize(item,stamp)]));
}
class Doc{
  constructor(db,name,id){Object.assign(this,{db,name,id,key:name+'/'+id});}
  async get(){return this.db.snapshot(this);}
  async set(data){this.db.put(this.key,normalize(data,++this.db.clock));}
  async update(data){assert(this.db.docs.has(this.key));this.db.put(this.key,{...this.db.data(this.key),...normalize(data,++this.db.clock)});}
}
class Query{
  constructor(db,name,filters=[],count=Infinity){Object.assign(this,{db,name,filters,count});}
  doc(id){return new Doc(this.db,this.name,id??'audit-'+ ++this.db.autoId);}
  where(field,op,value){assert.equal(op,'==');return new Query(this.db,this.name,[...this.filters,[field,value]],this.count);}
  orderBy(){return this;}
  limit(count){return new Query(this.db,this.name,this.filters,count);}
  async get(){return this.db.query(this);}
}
class SyntheticFirestore{
  constructor(){this.reset();}
  reset(){this.docs=new Map();this.versions=new Map();this.epochs=new Map();this.clock=0;this.autoId=0;this.writes=[];this.retries=0;this.onRead=null;this.beforeCommit=null;}
  collection(name){assert.equal(typeof name,'string');assert(name);return new Query(this,name);}
  put(key,data){this.docs.set(key,copy(data));this.changed(key);}
  erase(key){this.docs.delete(key);this.changed(key);}
  changed(key){this.versions.set(key,(this.versions.get(key)||0)+1);const name=key.slice(0,key.indexOf('/'));this.epochs.set(name,(this.epochs.get(name)||0)+1);}
  data(key){return copy(this.docs.get(key));}
  snapshot(ref){const data=this.data(ref.key);return{id:ref.id,exists:data!==undefined,data:()=>copy(data)};}
  query(q){const docs=[...this.docs.keys()].filter(key=>key.startsWith(q.name+'/')).map(key=>this.snapshot(new Doc(this,q.name,key.slice(q.name.length+1)))).filter(doc=>q.filters.every(([field,value])=>doc.data()?.[field]===value)).slice(0,q.count);return{docs,empty:!docs.length,size:docs.length};}
  async runTransaction(callback){
    for(let attempt=0;attempt<6;attempt++){
      const reads=new Map(),queries=new Map(),writes=[];
      const transaction={
        get:async ref=>{
          assert.equal(writes.length,0,'all reads before writes');let result;
          if(ref instanceof Doc){reads.set(ref.key,this.versions.get(ref.key)||0);result=this.snapshot(ref);}
          else{queries.set(ref.name,this.epochs.get(ref.name)||0);result=this.query(ref);for(const doc of result.docs)reads.set(ref.name+'/'+doc.id,this.versions.get(ref.name+'/'+doc.id)||0);}
          if(this.onRead)await this.onRead(ref instanceof Doc?ref.key:ref.name+'/*',attempt);return result;
        },
        create:(ref,data)=>{writes.push({kind:'create',ref,data});return transaction;},
        set:(ref,data)=>{writes.push({kind:'set',ref,data});return transaction;},
        update:(ref,data)=>{writes.push({kind:'update',ref,data});return transaction;}
      };
      const result=await callback(transaction);if(this.beforeCommit)await this.beforeCommit({attempt,writes});
      if([...reads].some(([key,v])=>(this.versions.get(key)||0)!==v)||[...queries].some(([name,v])=>(this.epochs.get(name)||0)!==v)){this.retries++;continue;}
      const stamp=++this.clock;
      for(const w of writes){if(w.kind==='create')assert(!this.docs.has(w.ref.key));if(w.kind==='update')assert(this.docs.has(w.ref.key));}
      for(const w of writes){const value=normalize(w.data,stamp);this.put(w.ref.key,w.kind==='update'?{...this.docs.get(w.ref.key),...value}:value);this.writes.push({kind:w.kind,key:w.ref.key});}
      return result;
    }throw Error('synthetic contention exceeded');
  }
}
const db=new SyntheticFirestore(),authUsers=new Map(),tokens=new Map(),metrics={storageCalls:0,verifyCalls:0,currentUserCalls:0};
globalThis[Symbol.for('urai.marketplace.synthetic.runtime')]={
  firestore:db,auth:{
    async verifyIdToken(token,revoked){metrics.verifyCalls++;assert.equal(revoked,true);const value=tokens.get(token);if(!value||value.revoked)throw Error('synthetic invalid/revoked token');return copy(value);},
    async getUser(uid){metrics.currentUserCalls++;assert(authUsers.has(uid));return copy(authUsers.get(uid));}
  },storage:{bucket(){metrics.storageCalls++;throw Error('Storage/provider execution forbidden');}}
};
const loader='export async function load(url,context,nextLoad){if(url==='+JSON.stringify(runtimeUrl)+')return{format:"module",shortCircuit:true,source:"export const initializeMarketplaceAdminRuntime=()=>globalThis[Symbol.for(\\\"urai.marketplace.synthetic.runtime\\\")];"};return nextLoad(url,context);}';
register('data:text/javascript,'+encodeURIComponent(loader),import.meta.url);
const{marketplaceApi}=await import(mainUrl);assert.equal(marketplaceApi.__endpoint.platform,'gcfv2');
const{server,base}=await mount(marketplaceApi);
// Confined to synthetic process; enabling a fixture is not a real approval.
process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='true';
const C={profiles:'marketplaceCandidateProfiles',employers:'marketplaceEmployers',jobs:'marketplacePublicJobs',apps:'marketplaceJobApplications',audit:'marketplaceAuditLogs'};
const pc={purpose:'career.profile',policyVersion:'fixture-v1',decisionReceiptId:'synthetic-profile-decision'};
const ac={purpose:'career.application',policyVersion:'fixture-v1',decisionReceiptId:'synthetic-application-decision'};
const profile=extra=>({displayName:'Synthetic Candidate',expectedRevision:0,consentGranted:true,consent:pc,skills:['Testing'],...extra});
const application=extra=>({jobId:'job',employerId:'employer',profileRevision:1,consentGranted:true,consent:ac,answers:{availability:'Synthetic answer'},...extra});
const aid=(uid='candidate',job='job',tenant='tenant')=>'application-'+createHash('sha256').update(JSON.stringify([tenant,uid,job])).digest('hex');
const appKey=id=>C.apps+'/'+id;
const withdrawal=id=>'/api/marketplace/applications/'+encodeURIComponent(id)+'/withdraw';
const review=id=>'/api/marketplace/employers/employer/applications/'+encodeURIComponent(id);
function account(uid,tenantId='tenant',admin=false){
  const customClaims=admin?{admin:true}:{};
  authUsers.set(uid,{uid,email:uid+'@example.invalid',disabled:false,tokensValidAfterTime:'fixture-time',customClaims});
  tokens.set(uid,{uid,...customClaims});db.put('users/'+uid,{uid,tenantId,role:admin?'admin':'user',disabled:false,deleted:false,accountRevision:0});
}
function seededProfile(uid='candidate',tenantId='tenant'){db.put(C.profiles+'/'+uid,{uid,tenantId,displayName:'Synthetic '+uid,email:uid+'@example.invalid',skills:['Testing'],location:'Synthetic',revision:1,consent:pc,createdAt:1});}
function reset(){
  db.reset();authUsers.clear();tokens.clear();for(const uid of['candidate','candidate2','owner','owner2'])account(uid);
  account('outsider','other-tenant');account('admin','tenant',true);account('otherAdmin','other-tenant',true);
  seededProfile();seededProfile('candidate2');seededProfile('outsider','other-tenant');
  for(const[id,owner]of[['employer','owner'],['employer2','owner2']])db.put(C.employers+'/'+id,{id,tenantId:'tenant',ownerUid:owner,createdBy:owner,companyName:'Preexisting approved synthetic employer',status:'approved'});
  db.put(C.jobs+'/job',{id:'job',tenantId:'tenant',employerId:'employer',createdBy:'owner',title:'Synthetic role',description:'No hiring action',status:'published',moderationStatus:'approved',publishedAt:1});
}
const change=(key,patch)=>db.put(key,{...db.data(key),...patch});
function onceRead(key,action){db.onRead=async actual=>{if(key===actual){db.onRead=null;await action();}};}
const blockKey=(uid,purpose)=>'jobConsentBlocks/'+createHash('sha256').update(uid+'\n'+purpose).digest('hex');
function revoke(uid,purpose,corrupt=false){
  const eventId='synthetic-revocation-'+uid+'-'+purpose;
  const data={active:true,consumerId:'urai-jobs',eventId,ownerUid:uid,purpose,policyVersion:'fixture-v1',decisionReceiptId:'synthetic-revoked-decision',status:'blocked'};
  data.integrityHash=createHash('sha256').update([eventId,uid,purpose,data.policyVersion,data.decisionReceiptId,data.status].join('\n')).digest('hex');
  db.put(blockKey(uid,purpose),{...data,...(corrupt?{integrityHash:'corrupt'}:{})});db.put('jobConsentEventReceipts/'+createHash('sha256').update(eventId).digest('hex'),data);
}
async function request(method,path,token,body){
  const response=await fetch(base+path,{method,headers:{Origin:env.URAI_JOBS_ALLOWED_ORIGIN,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text(),result=text?JSON.parse(text):null;assert(!result?.fixtureError,text);return{status:response.status,body:result};
}
async function success(method,path,token,body){const result=await request(method,path,token,body);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.ok,true);return result.body;}
async function denied(method,path,token,body,code,status){const count=db.writes.length;const result=await request(method,path,token,body);assert.equal(result.body?.ok,false,JSON.stringify(result));assert.equal(result.body.code,code,JSON.stringify(result));assert.equal(result.status,status,JSON.stringify(result));assert.equal(db.writes.length,count,'no partial rejected writes');return result.body;}
const createApp=(uid='candidate',extra)=>success('POST','/api/marketplace/applications',uid,application(extra));
const cases=[];
async function check(name,run){reset();await run();cases.push(name);console.log('PASS '+name);}
try{
  await check('actual profile body persistence/readback/revision retains createdAt',async()=>{
    db.erase(C.profiles+'/candidate');await success('POST','/api/marketplace/profiles','candidate',profile({resumePath:'marketplace/resumes/candidate/synthetic'}));
    const stored=db.data(C.profiles+'/candidate');assert.equal(stored.uid,'candidate');assert.equal(stored.tenantId,'tenant');assert.equal(stored.displayName,'Synthetic Candidate');
    assert.equal((await success('GET','/api/marketplace/profiles/me','candidate')).profile.displayName,stored.displayName);
    await success('POST','/api/marketplace/profiles/me','candidate',profile({expectedRevision:1,displayName:'Changed'}));assert.equal(db.data(C.profiles+'/candidate').createdAt,stored.createdAt);assert.equal(db.data(C.profiles+'/candidate').revision,2);
  });
  await check('missing/malformed/revoked Auth denies writes',async()=>{
    await denied('POST','/api/marketplace/profiles',undefined,profile(),'AUTH_REQUIRED',401);
    await denied('POST','/api/marketplace/profiles','invalid',profile(),'INVALID_AUTHORIZATION_HEADER',401);
    tokens.get('candidate').revoked=true;await denied('POST','/api/marketplace/profiles','candidate',profile(),'INVALID_AUTHORIZATION_HEADER',401);
  });
  await check('body UID/tenant/role spoof and foreign resume/bounds denied',async()=>{
    for(const key of['uid','tenantId','admin','role'])await denied('POST','/api/marketplace/profiles','candidate',profile({[key]:'owner'}),'VALIDATION_FIELD_NOT_ALLOWED',400);
    await denied('POST','/api/marketplace/profiles','candidate',profile({resumePath:'marketplace/resumes/candidate2/private'}),'RESUME_OWNER_REQUIRED',403);
    await denied('POST','/api/marketplace/profiles','candidate',profile({displayName:'x'.repeat(257)}),'VALIDATION_REQUIRED_STRING',400);
    await denied('POST','/api/marketplace/profiles','candidate',profile({skills:['x'.repeat(257)]}),'VALIDATION_STRING_LIST',400);
    await denied('POST','/api/marketplace/profiles','candidate',['bad'],'VALIDATION_BODY',400);
    await denied('POST','/api/marketplace/profiles','candidate',profile({experience:'x'.repeat(66000)}),'VALIDATION_BODY_SIZE',400);
  });
  await check('protected account disabled/deleted/suspended/missing denies lifecycle',async()=>{
    for(const patch of[{disabled:true},{deleted:true},{status:'suspended'}]){change('users/candidate',patch);await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'ACCOUNT_NOT_ACTIVE',403);account('candidate');}
    db.erase('users/candidate');await denied('POST','/api/marketplace/profiles','candidate',profile(),'ACCOUNT_NOT_ACTIVE',403);
  });
  await check('live Auth disable and token tenant mismatch deny disclosure',async()=>{
    authUsers.get('candidate').disabled=true;await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'ACCOUNT_NOT_ACTIVE',403);
    authUsers.get('candidate').disabled=false;tokens.get('candidate').firebase={tenant:'other-tenant'};await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'TENANT_MISMATCH',403);
  });
  await check('account tenant/revision mutation during await retries then denies',async()=>{
    onceRead(C.profiles+'/candidate',()=>change('users/candidate',{tenantId:'other-tenant',accountRevision:1}));
    await denied('POST','/api/marketplace/profiles','candidate',profile({expectedRevision:1}),'ACCOUNT_AUTHORITY_CHANGED',403);assert.equal(db.retries,1);
  });
  await check('late live Auth disable fences profile response',async()=>{
    onceRead(C.profiles+'/candidate',()=>{authUsers.get('candidate').disabled=true;});await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'ACCOUNT_NOT_ACTIVE',403);
  });
  await check('stale profile revision and foreign tenant cannot overwrite',async()=>{
    await denied('POST','/api/marketplace/profiles','candidate',profile(),'PROFILE_REVISION_CHANGED',409);
    change(C.profiles+'/candidate',{tenantId:'other-tenant'});await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'TENANT_MISMATCH',403);
    await denied('POST','/api/marketplace/profiles','candidate',profile({expectedRevision:1}),'TENANT_MISMATCH',403);
  });
  await check('explicit profile consent/purpose plus canonical revocation bind read/write',async()=>{
    await denied('POST','/api/marketplace/profiles','candidate',profile({consentGranted:false,expectedRevision:1}),'CONSENT_REQUIRED',403);
    await denied('POST','/api/marketplace/profiles','candidate',profile({consent:ac,expectedRevision:1}),'CONSENT_REQUIRED',403);
    revoke('candidate','career.profile');await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'CONSENT_REVOKED',403);
    await denied('POST','/api/marketplace/profiles','candidate',profile({expectedRevision:1}),'CONSENT_REVOKED',403);
  });
  await check('malformed canonical revocation integrity fails closed',async()=>{
    revoke('candidate','career.profile',true);await denied('GET','/api/marketplace/profiles/me','candidate',undefined,'CONSENT_AUTHORITY_INVALID',403);
  });
  await check('onboarding persists owned pending employer/job and keeps publication closed',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',companyName:'Synthetic onboarding'});
    const employer=(await success('GET','/api/marketplace/employers/newEmployer','owner')).employer;assert.equal(employer.ownerUid,'owner');assert.equal(employer.tenantId,'tenant');assert.equal(employer.status,'pending_review');
    await success('POST','/api/marketplace/jobs','owner',{jobId:'newJob',employerId:'newEmployer',title:'Synthetic draft',description:'No live hiring'});
    assert.equal(db.data(C.jobs+'/newJob').status,'pending_review');await denied('POST','/api/marketplace/admin/jobs/newJob/approve','admin',{},'EMPLOYER_NOT_ACTIVE',403);
    await denied('GET','/api/marketplace/jobs/newJob',undefined,undefined,'JOB_NOT_FOUND',404);
  });
  await check('canonical employer name/create/creator contract persists and contradictory aliases/ownership fail closed',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'canonicalOnboarding',orgName:'Canonical synthetic name'});
    const created=(await success('GET','/api/marketplace/employers/canonicalOnboarding','owner')).employer;
    assert.equal(created.orgName,'Canonical synthetic name');assert.equal(created.companyName,created.orgName);assert.equal(created.status,'pending_review');
    await denied('POST','/api/marketplace/employers','owner',{employerId:'conflict',orgName:'Canonical',companyName:'Contradiction'},'VALIDATION_CONFLICTING_FIELD',400);
    await denied('POST','/api/marketplace/employers','owner',{employerId:'invalid',orgName:'x'.repeat(257)},'VALIDATION_REQUIRED_STRING',400);
    for(const key of['ownerUid','createdBy','tenantId','role'])await denied('POST','/api/marketplace/employers','owner',{employerId:'spoof',orgName:'Canonical',[key]:'owner2'},'VALIDATION_FIELD_NOT_ALLOWED',400);
    await success('POST','/api/marketplace/employers','owner',{employerId:'equalAlias',orgName:'Equal',companyName:'Equal'});
    const canonical=db.data(C.employers+'/employer');delete canonical.ownerUid;delete canonical.companyName;canonical.orgName='Protected canonical employer';db.put(C.employers+'/employer',canonical);
    assert.equal((await success('GET','/api/marketplace/employers/employer','owner')).employer.orgName,canonical.orgName);
    await denied('GET','/api/marketplace/employers/employer','owner2',undefined,'EMPLOYER_OWNER_REQUIRED',403);
    await success('POST','/api/marketplace/jobs','owner',{jobId:'canonicalJob',employerId:'employer',title:'Synthetic canonical role',description:'No real hiring'});
    assert.equal(db.data(C.jobs+'/canonicalJob').companyName,canonical.orgName);
    await success('POST','/api/marketplace/admin/jobs/canonicalJob/approve','admin',{});
    assert.equal((await success('GET','/api/marketplace/jobs/canonicalJob')).job.companyName,canonical.orgName);
    await createApp('candidate',{jobId:'canonicalJob'});
    assert.equal((await success('GET','/api/marketplace/employers/employer/applications','owner')).applications.length,1);
    change(C.employers+'/employer',{ownerUid:'owner2'});
    await denied('GET','/api/marketplace/employers/employer','owner',undefined,'EMPLOYER_OWNER_REQUIRED',403);
    await denied('POST','/api/marketplace/jobs','owner',{jobId:'contradictoryJob',employerId:'employer',title:'Synthetic',description:'Synthetic'},'EMPLOYER_OWNER_REQUIRED',403);
    assert.equal(db.data(C.jobs+'/contradictoryJob'),undefined);
  });
  await check('employer/job overwrite and cross-owner/tenant access denied',async()=>{
    const original=db.data(C.employers+'/employer');await denied('POST','/api/marketplace/employers','owner2',{employerId:'employer',companyName:'Spoof'},'EMPLOYER_ALREADY_EXISTS',409);assert.deepEqual(db.data(C.employers+'/employer'),original);
    await denied('GET','/api/marketplace/employers/employer','owner2',undefined,'EMPLOYER_OWNER_REQUIRED',403);await denied('GET','/api/marketplace/employers/employer','outsider',undefined,'TENANT_MISMATCH',403);
    await denied('POST','/api/marketplace/jobs','owner2',{jobId:'new',employerId:'employer',title:'Synthetic',description:'Synthetic'},'EMPLOYER_OWNER_REQUIRED',403);
    await denied('POST','/api/marketplace/jobs','owner',{jobId:'job',employerId:'employer',title:'Overwrite',description:'Synthetic'},'JOB_ALREADY_EXISTS',409);
  });
  await check('authorized rejection remains available for pending/inactive employer jobs and cannot publish/reopen',async()=>{
    for(const status of[undefined,'unknown','pending_review','paused','rejected']){
      reset();const employer=db.data(C.employers+'/employer');if(status===undefined)delete employer.status;else employer.status=status;db.put(C.employers+'/employer',employer);
      change(C.jobs+'/job',{status:'pending_review',moderationStatus:'pending'});
      await success('POST','/api/marketplace/admin/jobs/job/reject','admin',{reason:'Synthetic rejection'});
      assert.equal(db.data(C.jobs+'/job').status,'rejected');assert.equal(db.data(C.jobs+'/job').rejectedBy,'admin');
      await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'JOB_NOT_EDITABLE',409);
    }
  });
  await check('preexisting approved employer posting and current admin publication persist',async()=>{
    await success('POST','/api/marketplace/jobs','owner',{jobId:'newJob',employerId:'employer',title:'Synthetic new role',description:'Synthetic'});
    assert.equal((await success('GET','/api/marketplace/admin/review-queue','admin')).jobs.length,1);await success('POST','/api/marketplace/admin/jobs/newJob/approve','admin',{});
    const job=(await success('GET','/api/marketplace/jobs/newJob')).job;assert.equal(job.status,'published');assert.equal(job.approvedBy,'admin');assert.equal(job.createdBy,'owner');
  });
  await check('admin requires live claim AND protected role AND tenant',async()=>{
    change(C.jobs+'/job',{status:'pending_review',moderationStatus:'pending'});await denied('POST','/api/marketplace/admin/jobs/job/approve','candidate',{},'ADMIN_REQUIRED',403);
    authUsers.get('admin').customClaims={};await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'ADMIN_REQUIRED',403);
    authUsers.get('admin').customClaims={admin:true};change('users/admin',{role:'user'});await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'ADMIN_REQUIRED',403);
    await denied('POST','/api/marketplace/admin/jobs/job/approve','otherAdmin',{},'TENANT_MISMATCH',403);
  });
  await check('late Auth claim downgrade denies publication',async()=>{
    change(C.jobs+'/job',{status:'pending_review',moderationStatus:'pending'});onceRead(C.employers+'/employer',()=>{authUsers.get('admin').customClaims={};});
    await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'ACCOUNT_AUTHORITY_CHANGED',403);assert.equal(db.data(C.jobs+'/job').status,'pending_review');
  });
  await check('protected admin role downgrade forces retry before publication',async()=>{
    change(C.jobs+'/job',{status:'pending_review',moderationStatus:'pending'});onceRead(C.jobs+'/job',()=>change('users/admin',{role:'user',accountRevision:1}));
    await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'ACCOUNT_AUTHORITY_CHANGED',403);assert.equal(db.retries,1);
  });
  for(const status of[undefined,'unknown','lead','pending_review','paused','rejected'])await check('employer '+String(status)+' denies publish/apply/applicant read/review',async()=>{
    await createApp();const employer=db.data(C.employers+'/employer');if(status===undefined)delete employer.status;else employer.status=status;db.put(C.employers+'/employer',employer);
    await denied('POST','/api/marketplace/applications','candidate2',application(),'EMPLOYER_NOT_ACTIVE',403);
    await denied('GET','/api/marketplace/employers/employer/applications','owner',undefined,'EMPLOYER_NOT_ACTIVE',403);
    await denied('PATCH',review(aid()),'owner',{status:'reviewing'},'EMPLOYER_NOT_ACTIVE',403);
    change(C.jobs+'/job',{status:'pending_review',moderationStatus:'pending'});await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'EMPLOYER_NOT_ACTIVE',403);
  });
  await check('application persists authenticated snapshot and scoped readback',async()=>{
    const result=await createApp();assert.equal(result.applicationId,aid());const stored=db.data(appKey(aid()));assert.equal(stored.candidateUid,'candidate');assert.equal(stored.tenantId,'tenant');assert.equal(stored.status,'submitted');assert.equal(stored.candidateSnapshot.email,'candidate@example.invalid');
    assert.equal((await success('GET','/api/marketplace/applications/me','candidate')).applications.length,1);assert.equal((await success('GET','/api/marketplace/applications/me','candidate2')).applications.length,0);
    assert.equal((await success('GET','/api/marketplace/employers/employer/applications','owner')).applications[0].id,aid());
  });
  await check('application UID/tenant/resume/employer/stale profile forgery denied',async()=>{
    await denied('POST','/api/marketplace/applications','candidate',application({candidateUid:'candidate2'}),'VALIDATION_FIELD_NOT_ALLOWED',400);
    await denied('POST','/api/marketplace/applications','candidate',application({tenantId:'other-tenant'}),'VALIDATION_FIELD_NOT_ALLOWED',400);
    await denied('POST','/api/marketplace/applications','candidate',application({resumePath:'marketplace/resumes/candidate2/private'}),'RESUME_OWNER_REQUIRED',403);
    await denied('POST','/api/marketplace/applications','candidate',application({employerId:'employer2'}),'EMPLOYER_MISMATCH',403);
    await denied('POST','/api/marketplace/applications','candidate',application({profileRevision:0}),'PROFILE_REVISION_CHANGED',409);await denied('POST','/api/marketplace/applications','outsider',application(),'TENANT_MISMATCH',403);
  });
  await check('draft/closed/paused/rejected/unmoderated jobs cannot receive applications',async()=>{
    for(const status of['draft','pending_review','closed','paused','rejected']){change(C.jobs+'/job',{status});await denied('POST','/api/marketplace/applications','candidate',application(),'JOB_NOT_PUBLISHED',403);}
    change(C.jobs+'/job',{status:'published',moderationStatus:'pending'});await denied('POST','/api/marketplace/applications','candidate',application(),'JOB_NOT_PUBLISHED',403);
  });
  await check('explicit application consent/purpose and canonical revocation',async()=>{
    await denied('POST','/api/marketplace/applications','candidate',application({consentGranted:false}),'CONSENT_REQUIRED',403);await denied('POST','/api/marketplace/applications','candidate',application({consent:pc}),'CONSENT_REQUIRED',403);
    revoke('candidate','career.application');await denied('POST','/api/marketplace/applications','candidate',application(),'CONSENT_REVOKED',403);
    reset();revoke('candidate','career.profile');await denied('POST','/api/marketplace/applications','candidate',application(),'CONSENT_REVOKED',403);
  });
  await check('revocation after absent-block read retries before application write',async()=>{
    onceRead(blockKey('candidate','career.application'),()=>revoke('candidate','career.application'));await denied('POST','/api/marketplace/applications','candidate',application(),'CONSENT_REVOKED',403);assert.equal(db.retries,1);
  });
  await check('simultaneous duplicates commit exactly one application',async()=>{
    let reached=0,release;const barrier=new Promise(r=>{release=r;});
    db.beforeCommit=async({attempt,writes})=>{if(attempt===0&&writes.some(w=>w.ref.key===appKey(aid()))){reached++;if(reached===2)release();await barrier;}};
    const results=await Promise.all([request('POST','/api/marketplace/applications','candidate',application()),request('POST','/api/marketplace/applications','candidate',application())]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(results.find(r=>r.status===409).body.code,'DUPLICATE_APPLICATION');assert.equal(db.writes.filter(w=>w.key.startsWith(C.apps+'/')).length,1);assert.equal(db.retries,1);
  });
  await check('retained legacy duplicate prevents new application/implicit migration',async()=>{
    db.put(appKey('candidate:job'),{candidateUid:'candidate',jobId:'job',employerId:'employer',status:'submitted'});const legacy=db.data(appKey('candidate:job'));
    await denied('POST','/api/marketplace/applications','candidate',application(),'DUPLICATE_APPLICATION',409);assert.deepEqual(db.data(appKey('candidate:job')),legacy);assert.equal(db.data(appKey(aid())),undefined);
  });
  await check('job close during apply retries then rejects',async()=>{
    onceRead(C.jobs+'/job',()=>change(C.jobs+'/job',{status:'closed'}));await denied('POST','/api/marketplace/applications','candidate',application(),'JOB_NOT_PUBLISHED',403);assert.equal(db.retries,1);
  });
  await check('late live Auth change during apply denies final persistence',async()=>{
    onceRead(C.jobs+'/job',()=>{authUsers.get('candidate').customClaims={role:'changed'};});await denied('POST','/api/marketplace/applications','candidate',application(),'ACCOUNT_AUTHORITY_CHANGED',403);
  });
  await check('foreign employer owner/tenant cannot disclose/review applications',async()=>{
    await createApp();await denied('GET','/api/marketplace/employers/employer/applications','owner2',undefined,'EMPLOYER_OWNER_REQUIRED',403);await denied('PATCH',review(aid()),'owner2',{status:'reviewing'},'EMPLOYER_OWNER_REQUIRED',403);
    await denied('GET','/api/marketplace/employers/employer/applications','outsider',undefined,'TENANT_MISMATCH',403);await denied('PATCH','/api/marketplace/employers/employer2/applications/'+aid(),'owner2',{status:'reviewing'},'EMPLOYER_MISMATCH',403);
  });
  await check('candidate disabled/revoked consent stops employer disclosure/review',async()=>{
    await createApp();authUsers.get('candidate').disabled=true;await denied('GET','/api/marketplace/employers/employer/applications','owner',undefined,'ACCOUNT_NOT_ACTIVE',403);
    authUsers.get('candidate').disabled=false;revoke('candidate','career.application');await denied('GET','/api/marketplace/employers/employer/applications','owner',undefined,'CONSENT_REVOKED',403);
    await denied('PATCH',review(aid()),'owner',{status:'reviewing'},'CONSENT_REVOKED',403);
  });
  await check('late candidate Auth disable/owner change fence disclosure/review',async()=>{
    await createApp();onceRead(blockKey('candidate','career.application'),()=>{authUsers.get('candidate').disabled=true;});await denied('GET','/api/marketplace/employers/employer/applications','owner',undefined,'ACCOUNT_NOT_ACTIVE',403);
    authUsers.get('candidate').disabled=false;onceRead(C.jobs+'/job',()=>{authUsers.get('owner').customClaims={role:'changed'};});await denied('PATCH',review(aid()),'owner',{status:'reviewing'},'ACCOUNT_AUTHORITY_CHANGED',403);
  });
  await check('owned reviewing withdrawal/idempotence and review audit persist',async()=>{
    await createApp();await denied('PATCH',withdrawal(aid()),'candidate2',{},'APPLICATION_OWNER_REQUIRED',403);
    await success('PATCH',review(aid()),'owner',{status:'reviewing',note:'Synthetic review'});assert.equal(db.data(appKey(aid())).reviewedBy,'owner');assert.equal(db.writes.filter(w=>w.key.startsWith(C.audit+'/')).length,1);
    await success('PATCH',withdrawal(aid()),'candidate',{});const count=db.writes.length;await success('PATCH',withdrawal(aid()),'candidate',{});assert.equal(db.writes.length,count);assert.equal(db.data(appKey(aid())).status,'withdrawn');await denied('PATCH',review(aid()),'owner',{status:'reviewing'},'APPLICATION_NOT_REVIEWABLE',409);
  });
  await check('revoked candidate can stop; receipt excludes snapshot/employer omits it',async()=>{
    await createApp();revoke('candidate','career.application');await success('PATCH',withdrawal(aid()),'candidate',{});
    const receipt=(await success('GET','/api/marketplace/applications/me','candidate')).applications[0];assert.deepEqual(Object.keys(receipt).sort(),['employerId','id','jobId','status']);assert.equal(receipt.status,'withdrawn');assert.equal((await success('GET','/api/marketplace/employers/employer/applications','owner')).applications.length,0);
  });
  await check('withdrawal during review read prevents resurrection on retry',async()=>{
    await createApp();onceRead(appKey(aid()),()=>change(appKey(aid()),{status:'withdrawn'}));await denied('PATCH',review(aid()),'owner',{status:'reviewing'},'APPLICATION_NOT_REVIEWABLE',409);assert.equal(db.retries,1);assert.equal(db.data(appKey(aid())).status,'withdrawn');
  });
  await check('simultaneous review/withdrawal serialize to stopped state',async()=>{
    await createApp();let reached=0,release;const barrier=new Promise(r=>{release=r;});
    db.beforeCommit=async({attempt,writes})=>{if(attempt===0&&writes.some(w=>w.ref.key===appKey(aid())&&w.kind==='update')){reached++;if(reached===2)release();await barrier;}};
    const results=await Promise.all([request('PATCH',review(aid()),'owner',{status:'reviewing'}),request('PATCH',withdrawal(aid()),'candidate',{})]);assert.equal(results[1].status,200);assert([200,409].includes(results[0].status));assert.equal(db.data(appKey(aid())).status,'withdrawn');assert(db.retries>=1);
  });
  await check('canonical legacy tuple supports actual encoded-colon HTTP review/withdraw',async()=>{
    await createApp();const stored=db.data(appKey(aid()));db.erase(appKey(aid()));db.put(appKey('candidate:job'),{...stored,id:'candidate:job'});
    assert.equal((await success('GET','/api/marketplace/applications/me','candidate')).applications[0].id,'candidate:job');await success('PATCH',review('candidate:job'),'owner',{status:'reviewing'});await success('PATCH',withdrawal('candidate:job'),'candidate',{});assert.equal(db.data(appKey('candidate:job')).status,'withdrawn');
  });
  await check('unbound legacy retained but denied; malformed encoded IDs fail closed',async()=>{
    db.put(appKey('candidate:job'),{candidateUid:'candidate',jobId:'job',employerId:'employer',status:'submitted'});await denied('PATCH',withdrawal('candidate:job'),'candidate',{},'TENANT_MISMATCH',403);await denied('PATCH',review('candidate:job'),'owner',{status:'reviewing'},'TENANT_MISMATCH',403);
    await denied('PATCH','/api/marketplace/applications/candidate%2Fjob/withdraw','candidate',{},'VALIDATION_IDENTIFIER',400);await denied('PATCH','/api/marketplace/applications/candidate%ZZjob/withdraw','candidate',{},'VALIDATION_IDENTIFIER',400);
  });
  await check('owner close persists; closed job review/moderation cannot reopen',async()=>{
    await createApp();await denied('POST','/api/marketplace/jobs/job/close','owner2',{},'JOB_OWNER_REQUIRED',403);await success('POST','/api/marketplace/jobs/job/close','owner',{});assert.equal(db.data(C.jobs+'/job').closedBy,'owner');
    await denied('PATCH',review(aid()),'owner',{status:'advanced'},'JOB_NOT_PUBLISHED',403);await denied('POST','/api/marketplace/admin/jobs/job/approve','admin',{},'JOB_NOT_EDITABLE',409);await denied('GET','/api/marketplace/jobs/job',undefined,undefined,'JOB_NOT_FOUND',404);
  });
  await check('canonical terminal review status persists and cannot reopen/withdraw',async()=>{
    await createApp();await denied('PATCH',review(aid()),'owner',{status:'accepted'},'APPLICATION_STATUS_INVALID',400);await success('PATCH',review(aid()),'owner',{status:'advanced'});assert.equal(db.data(appKey(aid())).status,'advanced');
    await denied('PATCH',withdrawal(aid()),'candidate',{},'APPLICATION_NOT_PENDING',409);await denied('PATCH',review(aid()),'owner',{status:'reviewing'},'APPLICATION_NOT_REVIEWABLE',409);
  });
  await check('new employer approval persists and unlocks the authorized posting/application journey',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic newly reviewed employer'});
    await success('POST','/api/marketplace/jobs','owner',{jobId:'newJob',employerId:'newEmployer',title:'Synthetic role',description:'No real hiring'});
    const before=db.data(C.employers+'/newEmployer');
    const queue=await success('GET','/api/marketplace/admin/review-queue','admin');
    assert.equal(queue.employers.length,1);assert.equal(queue.employers[0].id,'newEmployer');
    await success('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'});
    const approved=db.data(C.employers+'/newEmployer');assert.equal(approved.status,'approved');assert.equal(approved.moderationStatus,'approved');
    assert.equal(approved.approvedBy,'admin');assert.equal(approved.createdAt,before.createdAt);assert.equal(approved.createdBy,'owner');assert.equal(approved.ownerUid,'owner');
    assert.equal(db.data(C.jobs+'/newJob').status,'pending_review','employer approval does not approve a job');
    const audit=db.writes.filter(w=>w.key.startsWith(C.audit+'/'));assert.equal(audit.length,1);
    const decision=db.data(audit[0].key);assert.equal(decision.actorUid,'admin');assert.equal(decision.tenantId,'tenant');assert.equal(decision.targetId,'newEmployer');assert.equal(decision.action,'employer.approved');
    assert.equal((await success('GET','/api/marketplace/admin/review-queue','admin')).employers.length,0);
    await success('POST','/api/marketplace/admin/jobs/newJob/approve','admin',{});
    const job=(await success('GET','/api/marketplace/jobs/newJob')).job;assert.equal(job.status,'published');
    await createApp('candidate',{jobId:'newJob',employerId:'newEmployer'});
    assert.equal((await success('GET','/api/marketplace/employers/newEmployer/applications','owner')).applications.length,1);
  });
  await check('employer rejection persists audit and cannot be reopened by replay',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic rejected employer'});
    const before=db.data(C.employers+'/newEmployer');
    await success('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'reject',reason:'Synthetic moderation reason'});
    const rejected=db.data(C.employers+'/newEmployer');assert.equal(rejected.status,'rejected');assert.equal(rejected.moderationStatus,'rejected');assert.equal(rejected.rejectedBy,'admin');assert.equal(rejected.rejectedReason,'Synthetic moderation reason');assert.equal(rejected.createdAt,before.createdAt);
    const audits=db.writes.filter(w=>w.key.startsWith(C.audit+'/'));assert.equal(audits.length,1);assert.equal(db.data(audits[0].key).action,'employer.rejected');
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'EMPLOYER_NOT_EDITABLE',409);
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'reject'},'EMPLOYER_NOT_EDITABLE',409);
  });
  await check('employer moderation requires live admin claim, protected role, current account and tenant',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer',undefined,{action:'approve'},'AUTH_REQUIRED',401);
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer','candidate',{action:'approve'},'ADMIN_REQUIRED',403);
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer','otherAdmin',{action:'approve'},'TENANT_MISMATCH',403);
    authUsers.get('admin').customClaims={};await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'ADMIN_REQUIRED',403);
    authUsers.get('admin').customClaims={admin:true};change('users/admin',{role:'user'});await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'ADMIN_REQUIRED',403);
    change('users/admin',{role:'admin'});tokens.get('admin').revoked=true;await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'INVALID_AUTHORIZATION_HEADER',401);
  });
  await check('employer moderation rejects missing records, unsafe identifiers, spoofed fields and unsupported actions',async()=>{
    await denied('PATCH','/api/marketplace/admin/employers/missing','admin',{action:'approve'},'EMPLOYER_NOT_FOUND',404);
    await denied('PATCH','/api/marketplace/admin/employers/%2Funsafe','admin',{action:'approve'},'VALIDATION_IDENTIFIER',400);
    for(const action of[undefined,'pause','approved',true])await denied('PATCH','/api/marketplace/admin/employers/employer','admin',{...(action===undefined?{}:{action})},'VALIDATION_EMPLOYER_MODERATION',400);
    for(const field of['tenantId','ownerUid','approvedBy','status'])await denied('PATCH','/api/marketplace/admin/employers/employer','admin',{action:'approve',[field]:'spoof'},'VALIDATION_FIELD_NOT_ALLOWED',400);
    await denied('PATCH','/api/marketplace/admin/employers/employer','admin',{action:'approve'},'EMPLOYER_NOT_EDITABLE',409);
  });
  await check('employer approval rejects disabled, deleted, missing and foreign-tenant owner accounts',async()=>{
    for(const invalid of['disabled','deleted','missing','foreign','live-disabled']){
      reset();await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
      if(invalid==='missing')db.erase('users/owner');else if(invalid==='foreign')change('users/owner',{tenantId:'other-tenant'});else if(invalid==='live-disabled')authUsers.get('owner').disabled=true;else change('users/owner',{[invalid]:true});
      await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},invalid==='foreign'?'TENANT_MISMATCH':'ACCOUNT_NOT_ACTIVE',403);
      assert.equal(db.data(C.employers+'/newEmployer').status,'pending_review');
    }
  });
  await check('late admin Auth downgrade denies employer approval without partial audit',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
    onceRead(C.employers+'/newEmployer',()=>{authUsers.get('admin').customClaims={};});
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'ACCOUNT_AUTHORITY_CHANGED',403);
  });
  await check('admin Auth remains the final employer-approval decision after owner Auth awaits',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
    const auth=globalThis[Symbol.for('urai.marketplace.synthetic.runtime')].auth;const getUser=auth.getUser;let reads=0;
    auth.getUser=async uid=>{const user=await getUser(uid);if(uid==='owner'&&++reads===2)authUsers.get('admin').customClaims={};return user;};
    try{await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'ACCOUNT_AUTHORITY_CHANGED',403);}
    finally{auth.getUser=getUser;}
    assert.equal(reads,2);assert.equal(db.data(C.employers+'/newEmployer').status,'pending_review');
  });
  await check('admin protected-role downgrade retries and denies employer approval',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
    onceRead(C.employers+'/newEmployer',()=>change('users/admin',{role:'user',accountRevision:1}));
    await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'ACCOUNT_AUTHORITY_CHANGED',403);assert.equal(db.retries,1);
  });
  await check('late owner account and Auth revocation fence employer approval',async()=>{
    for(const storage of['protected','Auth']){
      reset();await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
      onceRead('users/owner',()=>{if(storage==='Auth')authUsers.get('owner').disabled=true;else change('users/owner',{deleted:true,accountRevision:1});});
      await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},'ACCOUNT_NOT_ACTIVE',403);
      assert.equal(db.data(C.employers+'/newEmployer').status,'pending_review');
    }
  });
  await check('employer ownership or review-data mutation cannot redirect an in-flight approval',async()=>{
    for(const mutation of[{ownerUid:'owner2',createdBy:'owner2'},{orgName:'Changed after admission',companyName:'Changed after admission'},{tenantId:'other-tenant'}]){
      reset();await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
      onceRead(C.employers+'/newEmployer',()=>change(C.employers+'/newEmployer',mutation));
      await denied('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action:'approve'},mutation.tenantId?'TENANT_MISMATCH':'EMPLOYER_REVIEW_CHANGED',mutation.tenantId?403:409);
      assert.equal(db.data(C.employers+'/newEmployer').status,'pending_review');
    }
  });
  await check('concurrent employer approval/rejection commit exactly one decision and audit',async()=>{
    await success('POST','/api/marketplace/employers','owner',{employerId:'newEmployer',orgName:'Synthetic'});
    const results=await Promise.all(['approve','reject'].map(action=>request('PATCH','/api/marketplace/admin/employers/newEmployer','admin',{action})));
    assert.equal(results.filter(x=>x.status===200).length,1);assert.equal(results.filter(x=>x.status===409).length,1);
    assert.equal(db.writes.filter(w=>w.key.startsWith(C.audit+'/')).length,1);assert(['approved','rejected'].includes(db.data(C.employers+'/newEmployer').status));
  });
  await check('upload unavailable even enabled fixture launch; no signer/Storage call',async()=>{
    await denied('POST','/api/marketplace/resume-intent','candidate',{contentType:'application/pdf'},'RESUME_UPLOAD_UNAVAILABLE',503);assert.equal(metrics.storageCalls,0);
  });
  assert.equal(metrics.storageCalls,0);
  console.log(JSON.stringify({ok:true,node:process.version,actualPackageMain:pkg.main,actualHttpsPlatform:marketplaceApi.__endpoint.platform,defaultHold,fixtureErrorResponseCases:defaultHold.fixtureErrorResponseCases+1,actualLoopbackCases:cases.length,cases,
    persistence:'synthetic versioned Firestore interface with conflict retries; current Auth interface',
    authFirestoreAtomicity:'separate services; Auth re-read at final decision; no atomic cross-service claim',
    consent:'supplied purpose metadata plus existing Jobs revocation authority; no canonical positive-grant proof',
    employerApproval:'actual new-employer approval/rejection and newly-approved application journey; explicit Auth/Firestore interfaces only',
    realFirestoreEmulator:false,realAuthEmulator:false,cloudRequests:0,providerJobs:0,storageCalls:0,candidateEmployerUiAcceptance:false,deployedOrReleaseAcceptance:false}));
}finally{process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='false';await new Promise(r=>server.close(r));delete globalThis[Symbol.for('urai.marketplace.synthetic.runtime')];}
