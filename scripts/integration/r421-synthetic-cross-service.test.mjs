import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
'use strict';
const assert=require('node:assert/strict');
const {test,after}=require('node:test');
const crypto=require('node:crypto');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.R421_COMPILED_ROOT;
if (!base) throw new Error('R421 requires its verified wrapper; run r421-run-synthetic-cross-service.mjs');
const pj=(name)=>require(path.join(base,'privacy/functions/src',name+'.js'));
const jj=(name)=>require(path.join(base,'jobs/functions/src/privacy',name+'.js'));
const sj=(name)=>require(path.join(base,'jobs/functions/src/jobs',name+'.js'));
const st=(name)=>require(path.join(base,'studio/apps/studio/lib',name+'.js'));
const jobsIdentity=jj('lifeMovieJobsTokenProvider');
const jobsTransport=jj('lifeMovieConsentTransport');
const jobsClient=jj('lifeMovieJobsPrivacyClient');
const jobsPreflight=jj('lifeMovieAdmissionPreflight');
const jobsGate=jj('lifeMovieConsentGate');
const jobsScope=sj('studioLifeMovieContract');
const privacyIdentity=pj('life-movie-jobs-identity');
const privacyAuth=pj('life-movie-render-authorization');
const privacyReceipt=pj('life-movie-scoped-receipt');
const privacyAuthority=pj('cross-user-authority');
const studio=st('studio-life-movie-jobs-client');
const realFetch=globalThis.fetch;
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const project='urai-4dc1d';const region='us-central1';const uid='synthetic-urai-jobs-service';
const ownerUid='synthetic-user-01',tenantId='synthetic-tenant-01',apiKey='syntheticWebAPIKeyUsedOnlyForTests0001';
const source={id:'synthetic-photo-01',bucket:'synthetic-media-bucket',objectPath:`tenants/${tenantId}/originals/synthetic-image.jpg`,generation:'123',mimeType:'image/jpeg',provenance:'original-source',sourceRefs:['synthetic-photograph'],consentRef:'synthetic-consent-ref',ownerOrRightsRef:'synthetic-owner-rights'};
const selection={projectId:'synthetic-project-01',renderPlanDigest:'a'.repeat(64),sources:[source]};
const scope=jobsScope.deriveStudioLifeMovieRenderScope(selection);
let state;
const reset=()=>{state={record:null,deletionActive:false,tokenRevoked:false,rightsOk:true,failRightsAt:0,rightsChecks:0,forceTokenClaims:{},forceTokenSignature:false,trace:[],jobs:[],providerHits:0,allowPrivacyHttp:true};};
function makeGrant(){const grant={uid:ownerUid,tenantId,purpose:'life-movie.render',consentTier:'C6',status:'granted',policyVersion:'1.1.0',expiresAt:new Date(Date.now()+120_000).toISOString(),surface:'synthetic-owner-opt-in',jurisdiction:'synthetic',noticeVersion:'synthetic-v1',noticeHash:'b'.repeat(64),evidenceHash:'c'.repeat(64),renderScope:{...scope},updatedAt:new Date().toISOString()};return {...grant,receiptHash:privacyReceipt.hashLifeMovieScopedReceipt(grant)};}
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function signJwt(claims){const header=b64({alg:'RS256',typ:'JWT'}),payload=b64(claims),content=header+'.'+payload;return content+'.'+crypto.sign('RSA-SHA256',Buffer.from(content),privateKey).toString('base64url');}
function verifiedJwt(token){const pieces=String(token).split('.');if(pieces.length!==3)throw Error('bad segments');const header=JSON.parse(Buffer.from(pieces[0],'base64url'));if(header.alg!=='RS256'||!crypto.verify('RSA-SHA256',Buffer.from(pieces[0]+'.'+pieces[1]),publicKey,Buffer.from(pieces[2],'base64url')))throw Error('bad signature');const payload=JSON.parse(Buffer.from(pieces[1],'base64url'));const now=Math.floor(Date.now()/1000);if(!Number.isSafeInteger(payload.exp)||payload.exp<=now||state.tokenRevoked)throw Error('revoked');return {...payload,uid:payload.sub};}
function idToken(){const now=Math.floor(Date.now()/1000);const payload={aud:project,iss:`https://securetoken.google.com/${project}`,sub:uid,iat:now,exp:now+3600,system:true,role:'system',consumerId:'urai-jobs',firebase:{sign_in_provider:'custom'},...state.forceTokenClaims};return state.forceTokenSignature?signJwt(payload).slice(0,-7)+'abcdefg':signJwt(payload);}
function json(res,status,value){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
function collect(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',part=>{raw+=part;if(raw.length>32000)reject(Error('oversize'))});req.on('end',()=>{try{resolve(JSON.parse(raw))}catch(e){reject(e)}});req.on('error',reject)})}
async function rightsCheck({ownerUid:owner,tenantId:tenant,renderScope}){
  state.rightsChecks++;
  if(!state.rightsOk||(state.failRightsAt&&state.rightsChecks>=state.failRightsAt))throw Error('synthetic rights revoked');
  if(owner!==ownerUid||tenant!==tenantId||renderScope.sourceSetDigest!==scope.sourceSetDigest)throw Error('mismatched rights');
  return {ownerUid:owner,tenantId:tenant,renderScope:{...renderScope},verifiedAt:new Date().toISOString(),rightsEventId:'synthetic-rights-'+state.rightsChecks};
}
const fetchAdapter=async(url,opts={})=>{
 const name=String(url);let route;
 if(name===`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`)route='/identity';
 else if(name===`https://${region}-${project}.cloudfunctions.net/verifyLifeMovieRenderConsent`)route='/privacy';
 else if(name==='https://jobs.synthetic.test/bridge')route='/jobs';
 else throw Error('wrong authority URL');
 return realFetch(`http://127.0.0.1:${server.address().port}${route}`,opts);
};
function currentJobsClient(){return jobsClient.createAuthenticatedJobsPrivacyConsentClient({firebaseProjectId:project,region,dedicatedJobsUid:uid,firebaseWebApiKey:apiKey},{adminAuth:{app:{options:{projectId:project}},async createCustomToken(gotUid,claims){assert.equal(gotUid,uid);assert.deepEqual(claims,{system:true,role:'system',consumerId:'urai-jobs'});return signJwt({iss:'synthetic-custom-token',sub:gotUid,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...claims})}},fetchImpl:fetchAdapter});}
function currentPreflight(){return jobsPreflight.createLifeMovieAdmissionPreflight({verifySourceRights:rightsCheck,getCurrentPrivacyDecision:currentJobsClient()});}
async function onPrivacy(req,res){
 if(!state.allowPrivacyHttp)return json(res,503,{error:'synthetic_privacy_unavailable'});
 const authorization=req.headers.authorization||'';let claims;try{claims=verifiedJwt(authorization.replace(/^Bearer /,''))}catch{return json(res,403,{error:'unauthenticated'})}
 const actor={uid:claims.uid,token:claims};const authority=privacyAuthority.crossUserAuthority(claims);
 if(!authority||authority.role!=='system'||authority.consumerId!=='urai-jobs'||!privacyIdentity.isTrustedJobsConsentCaller(actor,uid))return json(res,403,{error:'invalid_privacy_caller'});
 const trusted=await privacyIdentity.isTrustedActiveJobsConsentCaller(actor,uid,authorization,async(jwt,checkRevoked)=>{assert.equal(checkRevoked,true);return verifiedJwt(jwt)});
 if(!trusted)return json(res,403,{error:'revoked_jobs_identity'});
 let body;try{body=await collect(req)}catch{return json(res,400,{error:'invalid_call'})}
 const data=body.data;if(!data||!data.renderScope||data.policyVersion!=='1.1.0'||typeof data.correlationId!=='string')return json(res,400,{error:'invalid_payload'});
 const evaluated=privacyAuth.evaluateLifeMovieRenderAuthorization({record:state.record,deletionActive:state.deletionActive,subjectUid:data.subjectUid,tenantId:data.tenantId,decisionReceiptId:data.decisionReceiptId,policyVersion:data.policyVersion,renderScope:data.renderScope});
 state.trace.push({stage:'privacy',decision:evaluated.reason,allowed:evaluated.allowed});
 const result={allowed:evaluated.allowed,reason:evaluated.reason,subjectUid:data.subjectUid,tenantId:data.tenantId,correlationId:data.correlationId,purpose:'life-movie.render',policyVersion:evaluated.evaluated.policyVersion,requiredTier:evaluated.evaluated.requiredTier,receiptHash:evaluated.allowed?data.decisionReceiptId:null,expiresAt:evaluated.allowed?state.record.expiresAt:null,renderScope:evaluated.allowed?data.renderScope:null,evaluatedAt:evaluated.evaluated.evaluatedAt,decisionEventId:'synthetic-event-01'};
 return json(res,200,{result});
}
async function onJobs(req,res){
 if(req.headers.authorization!=='Bearer synthetic-studio-bridge-token')return json(res,403,{ok:false,error:'bridge_unauthenticated'});
 let data;try{data=await collect(req)}catch{return json(res,400,{ok:false,error:'malformed_body'})}
 state.trace.push({stage:'studio_jobs',action:data.action});
 if(data.action!=='create')return json(res,404,{ok:false,error:'life_movie_not_found'});
 if(data.tenantId!==tenantId||data.userId!==ownerUid)return json(res,403,{ok:false,error:'owner_tenant_mismatch'});
 try{await currentPreflight()({ownerUid:data.userId,tenantId:data.tenantId,consent:data.consent,selection:{projectId:data.payload.projectId,renderPlanDigest:data.payload.renderPlanDigest,sources:data.payload.sources}})}
 catch(e){return json(res,403,{ok:false,error:'life_movie_admission_authority_unavailable'});}
 // The actual pinned Jobs authority gate is deliberately closed. Do not emit a fake job.
 if(jobsGate.deferLifeMovieJob({type:'studio.render.video'}))return json(res,412,{ok:false,error:jobsGate.LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE});
 throw Error('UNSAFE: TEST MUST NEVER REACH RENDER ADMISSION');
}
const server=http.createServer(async(req,res)=>{state.providerHits++;try{if(req.url==='/identity'){
 const data=await collect(req);let custom;try{custom=verifiedJwt(data.token)}catch{return json(res,403,{error:'invalid_custom_token'})}
 if(custom.sub!==uid)return json(res,403,{error:'custom_uid_mismatch'});
 return json(res,200,{localId:uid,idToken:idToken(),expiresIn:'3600'});
}if(req.url==='/privacy')return onPrivacy(req,res);if(req.url==='/jobs')return onJobs(req,res);return json(res,404,{error:'unknown_route'})}catch(e){return json(res,500,{error:'synthetic_server_error'})}});
reset();
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
after(async()=>{globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve))});
function validRequest(){const grant=makeGrant();state.record=grant;return {ownerUid,tenantId,consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:grant.receiptHash},selection:JSON.parse(JSON.stringify(selection))}}
function studioCreate(r){return {action:'create',tenantId:r.tenantId,userId:r.ownerUid,idempotencyKey:'synthetic-idempotent-01',consent:r.consent,payload:r.selection}}
function configureStudio(){process.env.NODE_ENV='test';process.env.URAI_STUDIO_JOBS_DISPATCH_ENABLED='true';process.env.URAI_JOBS_BRIDGE_URL='https://jobs.synthetic.test/bridge';process.env.URAI_STUDIO_JOBS_BRIDGE_TOKEN='synthetic-studio-bridge-token';globalThis.fetch=fetchAdapter}
async function expectReject(fn,re){await assert.rejects(fn,re)}

test('Jobs transport signs its own dedicated Firebase-style identity and Privacy verifies signed caller and scoped grant',async()=>{reset();const r=validRequest();const out=await currentPreflight()(r);assert.equal(out.renderScope.sourceSetDigest,scope.sourceSetDigest);assert.equal(state.rightsChecks,2);assert.deepEqual(state.trace,[{stage:'privacy',decision:'ALLOWED',allowed:true}]);assert.equal(jobsGate.lifeMovieConsentAuthorityAvailable(),false)});

test('Studio calls real bridge client, Jobs evaluates consent but hard-off rejects render creation',async()=>{reset();const r=validRequest();configureStudio();assert.equal(studio.studioJobsBridgeStatus().dispatchAvailable,true);await expectReject(()=>studio.callStudioJobsBridge(studioCreate(r)),/life_movie_consent_authority_unavailable/);assert.equal(state.jobs.length,0);assert.equal(state.trace[0].action,'create');assert.equal(state.trace.at(-1).allowed,true)});

test('Playback request cannot return fabricated private movie without an accepted job',async()=>{reset();configureStudio();await expectReject(()=>studio.callStudioJobsBridge({action:'playback',tenantId,userId:ownerUid,jobId:'synthetic-missing-job'}),/life_movie_not_found/);assert.equal(state.jobs.length,0)});

test('Privacy denies revoked consent, even with a correctly signed Jobs identity',async()=>{reset();const r=validRequest();state.record={...state.record,status:'revoked'};await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace[0].decision,'REVOKED');assert.equal(state.jobs.length,0)});

test('Privacy rejects missing scoped receipt',async()=>{reset();const r=validRequest();state.record=null;await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace[0].decision,'MISSING_CONSENT')});

test('Privacy denies expired scoped grant',async()=>{reset();const r=validRequest();state.record={...state.record,expiresAt:new Date(Date.now()-60_000).toISOString()};await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace[0].decision,'EXPIRED')});

test('Privacy denies active deletion tombstone',async()=>{reset();const r=validRequest();state.deletionActive=true;await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace[0].decision,'ACCOUNT_DELETED')});

test('Privacy rejects unknown deletion authority',async()=>{reset();const r=validRequest();state.deletionActive=undefined;await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace[0].decision,'ACCOUNT_DELETION_STATE_UNVERIFIED')});

test('Tampered tenant record cannot reuse another tenant scoped receipt',async()=>{reset();const r=validRequest();state.record={...state.record,tenantId:'other-tenant'};await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace[0].decision,'SCOPED_RECEIPT_INTEGRITY_MISMATCH')});

test('Source generation alteration cannot reuse old authorization hash',async()=>{reset();const r=validRequest();r.selection.sources[0].generation='124';await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable|life_movie_source_rights_unverified/);assert.equal(state.jobs.length,0)});

test('Revoked server-owned media rights at second check invalidate preflight',async()=>{reset();const r=validRequest();state.failRightsAt=2;await expectReject(()=>currentPreflight()(r),/life_movie_source_rights_unverified/);assert.equal(state.rightsChecks,2);assert.equal(state.trace[0].allowed,true)});

test('Revoked signed Jobs ID token cannot be accepted by Privacy',async()=>{reset();const r=validRequest();state.tokenRevoked=true;await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.jobs.length,0)});

test('Mis-signed Firebase-style token fails Privacy signature verification',async()=>{reset();const r=validRequest();state.forceTokenSignature=true;await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.jobs.length,0)});

test('Wrong issuer/audience in bearer token cannot reach Privacy grant',async()=>{reset();const r=validRequest();state.forceTokenClaims={aud:'foreign-project'};await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.trace.length,0)});

test('Missing dedicated Jobs token endpoint fails closed',async()=>{reset();const r=validRequest();state.allowPrivacyHttp=false;await expectReject(()=>currentPreflight()(r),/life_movie_admission_authority_unavailable/);assert.equal(state.jobs.length,0)});

test('Studio refuses wrong owner and tenant independently of scoped Privacy permit',async()=>{reset();const r=validRequest();configureStudio();await expectReject(()=>studio.callStudioJobsBridge(studioCreate({...r,ownerUid:'foreign-owner'})),/owner_tenant_mismatch/);assert.equal(state.trace.filter(x=>x.stage==='privacy').length,0)});

test('Studio cannot send malformed consent or public insecure bridge URL',async()=>{reset();const r=validRequest();configureStudio();await expectReject(()=>studio.callStudioJobsBridge({...studioCreate(r),consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'fake'}}),/life_movie_invalid_render_consent/);process.env.URAI_JOBS_BRIDGE_URL='http://evil.example/bridge';assert.equal(studio.studioJobsBridgeStatus().dispatchAvailable,false);await expectReject(()=>studio.callStudioJobsBridge(studioCreate(r)),/bridge_url_unconfigured_or_invalid/)});

test('Privileged system claims without a valid verified Firebase signature never authorize Privacy caller',async()=>{reset();const claims={uid,system:true,role:'system',consumerId:'urai-jobs',firebase:{sign_in_provider:'custom'}};assert.equal(privacyIdentity.isTrustedJobsConsentCaller({uid,token:claims},uid),true);const accepted=await privacyIdentity.isTrustedActiveJobsConsentCaller({uid,token:claims},uid,'Bearer a.b.c',async()=>{throw Error('invalid signature')});assert.equal(accepted,false);assert.equal(privacyAuthority.crossUserAuthority(Object.create({system:true,consumerId:'urai-jobs'})),null)});
