import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {APPROVAL,DENIED,validateScope,makeCanaryTarget,probeDeniedCreate,scopeFromEnvironment} from './r1040-gcs-negative-data-plane-proof.mjs';
const base=()=>({approval:APPROVAL,projectId:'urai-security-canary-abcd1234',bucket:'urai-security-canary-abcd1234-private',claimedPrincipal:'legacy-worker@urai-lab-123.iam.gserviceaccount.com',role:'legacy'});
const token='synthetic-token-not-valid',nonce='a'.repeat(32);
const denied=(f)=>assert.throws(f,e=>String(e.message).startsWith(DENIED));
test('only exact disposable staging scopes pass',()=>{
 assert.equal(validateScope(base()).role,'legacy');
 for(const projectId of ['urai-4dc1d','urai-staging','demo-urai-jobs','urai-security-canary-','urai-security-canary-AAAA','urai-security-canary-abc'])
   denied(()=>validateScope({...base(),projectId}));
});
test('extra fields, wrong bucket, forged approval, invalid identity/role deny',()=>{
 denied(()=>validateScope({...base(),storageWriteAuthorized:true}));
 denied(()=>validateScope({...base(),bucket:'urai-4dc1d.appspot.com'}));
 denied(()=>validateScope({...base(),approval:'true'}));
 denied(()=>validateScope({...base(),claimedPrincipal:'admin@example.com'}));
 denied(()=>validateScope({...base(),role:'broker'}));
});
test('one exact GCS canary path and generation zero precondition',()=>{
 const t=makeCanaryTarget(base(),nonce),u=new URL(t.url);
 assert.equal(u.host,'storage.googleapis.com');
 assert.equal(u.pathname,'/upload/storage/v1/b/urai-security-canary-abcd1234-private/o');
 assert.equal(u.searchParams.get('ifGenerationMatch'),'0');
 assert.equal(u.searchParams.get('uploadType'),'media');
 assert.equal(u.searchParams.get('name'),'security-denial/'+nonce+'/deny-probe.bin');
 denied(()=>makeCanaryTarget(base(),'../../bad'));
});
test('real HTTP403 observation never converts into IAM or release certificate',async()=>{
 let count=0;const x=await probeDeniedCreate({scope:base(),token,nonce,transport:async(url,opts)=>{
 count++;assert.ok(url.startsWith('https://storage.googleapis.com/'));
 assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
 assert.equal(opts.headers.Authorization,'Bearer '+token);
 assert.equal(opts.body.byteLength,0);return {status:403};}});
 assert.equal(count,1);assert.equal(x.verdict,'OBSERVED_HTTP_403_CAUSE_UNVERIFIED');
 for(const k of ['attemptedCredentialIdentityIndependentlyVerified','effectiveIamIndependentlyVerified','bucketExistenceIndependentlyVerified','brokerSoleWriterVerified','activeStreamsDrained','deletionAcknowledged','productionAuthorized','launchApproved'])assert.equal(x[k],false,k);
 assert.equal(x.scopeDigest.length,64);assert.equal(JSON.stringify(x).includes(token),false);
});
test('unexpected allowed writes fail with canary reconciliation warning',async()=>{
 for(const status of [200,201])await assert.rejects(probeDeniedCreate({scope:base(),token,nonce,transport:async()=>({status})}),/DIRECT_WRITER_STILL_AUTHORIZED/);
});
test('401,404,412,429,500 and malformed responses are inconclusive, never approval',async()=>{
 for(const status of [401,404,412,429,500])await assert.rejects(probeDeniedCreate({scope:base(),token,nonce,transport:async()=>({status})}),/DENIAL_INCONCLUSIVE/);
 await assert.rejects(probeDeniedCreate({scope:base(),token,nonce,transport:async()=>({status:'403'})}),/INVALID_RESPONSE/);
});
test('transport failures are masked and not confused with denials',async()=>{
 await assert.rejects(probeDeniedCreate({scope:base(),token,nonce,transport:async()=>{throw Error('secret '+token);}}),/DATA_PLANE_REQUEST_UNAVAILABLE/);
});
test('untrusted tokens fail before any network call',async()=>{
 let calls=0;for(const bad of ['','abc','line\nbreak-token','has space','bad\r\nheader'])
  await assert.rejects(probeDeniedCreate({scope:base(),token:bad,nonce,transport:async()=>{calls++;return {status:403};}}),new RegExp(DENIED));
 assert.equal(calls,0);
});
test('scope-from-environment requires exact opt-in',()=>{
 const b=base(),env={URAI_GCS_NEGATIVE_APPROVAL:b.approval,URAI_GCS_NEGATIVE_PROJECT:b.projectId,URAI_GCS_NEGATIVE_BUCKET:b.bucket,URAI_GCS_NEGATIVE_CLAIMED_PRINCIPAL:b.claimedPrincipal,URAI_GCS_NEGATIVE_WRITER_ROLE:b.role};
 assert.deepEqual(scopeFromEnvironment(env),b);
 denied(()=>scopeFromEnvironment({...env,URAI_GCS_NEGATIVE_APPROVAL:'1'}));
});
test('CLI refuses missing live opt-in before reading credentials',()=>{
 const p=fileURLToPath(new URL('./r1040-gcs-negative-data-plane-proof.mjs',import.meta.url));
 const x=spawnSync(process.execPath,[p],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,HOME:process.env.HOME,GOOGLE_CLOUD_PROJECT:'urai-4dc1d'},input:'synthetic-secret-token'});
 assert.notEqual(x.status,0);assert.match(x.stderr,/LIVE_EXPLICIT_FLAG_REQUIRED/);assert.equal(x.stdout,'');
});
