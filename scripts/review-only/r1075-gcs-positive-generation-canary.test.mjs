import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {APPROVAL,DENIED,positiveCanaryTargets,validatePositiveCanaryScope,
 probePositiveGenerationCanary} from './r1075-gcs-positive-generation-canary.mjs';
const scope=()=>({approval:APPROVAL,projectId:'urai-security-canary-abcde1',
 bucket:'urai-security-canary-abcde1-private',
 claimedBrokerPrincipal:'broker@urai-security-canary-abcde1.iam.gserviceaccount.com'});
const nonce='a'.repeat(32),token='synthetic-not-real-key',gen='9999999999999999999';
const text=(x)=>({status:200,text:async()=>JSON.stringify(x)});
function transport(variant={}){
 const events=[],objName=positiveCanaryTargets(scope(),nonce).objectName;
 const meta={bucket:scope().bucket,name:objName,generation:gen,size:'0'};
 const sender=async(url,opts)=>{
  events.push({url,opts});const i=events.length;
  assert.equal(opts.headers.Authorization,'Bearer '+token);
  assert.equal(opts.redirect,'error');
  if(variant.throwAt===i)throw new Error('secret '+token);
  if(i===1)return {status:variant.createStatus??200,text:async()=>JSON.stringify({...meta,...(variant.create||{})})};
  if(i===2)return {status:variant.readStatus??200,text:async()=>JSON.stringify({...meta,...(variant.read||{})})};
  if(i===3)return {status:variant.deleteStatus??204};
  if(i===4)return {status:variant.absentStatus??404};
  throw Error('unexpected extra provider call');
 };
 return {events,sender};
}
const probe=(t)=>probePositiveGenerationCanary({scope:scope(),token,nonce,transport:t.sender});
const denied=async fn=>assert.rejects(fn,e=>e.message.startsWith(DENIED));
test('positive canary scope can only target exact approved disposable bucket and principal',()=>{
 assert.equal(validatePositiveCanaryScope(scope()).projectId,scope().projectId);
 for(const bad of [{projectId:'urai-4dc1d'},{bucket:'urai-4dc1d.appspot.com'},
 {claimedBrokerPrincipal:'worker@urai-4dc1d.iam.gserviceaccount.com'},
 {approval:'go'},{unknownPermission:true}])
  assert.throws(()=>validatePositiveCanaryScope({...scope(),...bad}),new RegExp(DENIED));
});
test('positive canary path is nonce-scoped with create-if-absent',()=>{
 const x=positiveCanaryTargets(scope(),nonce),u=new URL(x.mediaUrl);
 assert.equal(u.searchParams.get('ifGenerationMatch'),'0');
 assert.equal(u.searchParams.get('name'),'security-broker-positive/'+nonce+'/generation-proof.bin');
 assert.equal(u.searchParams.get('uploadType'),'media');
 assert.throws(()=>positiveCanaryTargets(scope(),'../wrong'),new RegExp(DENIED));
});
test('successful provider sequence stays nonauthorizing and uses exact string generation',async()=>{
 const t=transport(),r=await probe(t);
 assert.equal(t.events.length,4);
 assert.deepEqual(t.events.map(x=>x.opts.method),['POST','GET','DELETE','GET']);
 assert.equal(t.events[0].opts.body.byteLength,0);
 const del=new URL(t.events[2].url);
 assert.equal(del.searchParams.get('generation'),gen);
 assert.equal(del.searchParams.get('ifGenerationMatch'),gen);
 assert.equal(r.objectGeneration,gen);
 for(const k of ['attemptedIdentityIndependentlyVerified','effectiveIamIndependentlyVerified',
   'oldOrAlternateWritersDenied','otherWritersDrained','customerDataDeletionAcknowledged',
   'productionAuthorized','launchApproved'])assert.equal(r[k],false,k);
 assert.equal(JSON.stringify(r).includes(token),false);
});
test('status 403/401/412/500 on create cannot be a PASS',async()=>{
 for(const status of [401,403,412,500]){const t=transport({createStatus:status});await denied(()=>probe(t));assert.equal(t.events.length,1);}
});
test('missing, numeric, mixed, or invalid generation prevents deletion',async()=>{
 for(const generation of [null,1,1e20,'0','01','x','123.4']){
  const t=transport({create:{generation}});await denied(()=>probe(t));assert.equal(t.events.length,1);
 }
});
test('forged bucket or object path prevents deletion',async()=>{
 for(const mutation of [{bucket:'foreign'},{name:'tenants/private/movie.mp4'},{size:'1'}]){
  const t=transport({create:mutation});await denied(()=>probe(t));assert.equal(t.events.length,1);
 }
});
test('metadata readback 403/404/500 cannot count as pinned object',async()=>{
 for(const status of [403,404,500]){const t=transport({readStatus:status});await denied(()=>probe(t));assert.equal(t.events.length,2);}
});
test('mismatched readback generation refuses deletion',async()=>{
 const t=transport({read:{generation:'12345'}});await denied(()=>probe(t));assert.equal(t.events.length,2);
});
test('delete 404/412/500 is not proof of pinned generation absence',async()=>{
 for(const status of [404,412,500]){const t=transport({deleteStatus:status});await denied(()=>probe(t));assert.equal(t.events.length,3);}
});
test('post-delete 200/403/500 cannot be turned into deletion ACK',async()=>{
 for(const status of [200,403,500]){const t=transport({absentStatus:status});await denied(()=>probe(t));assert.equal(t.events.length,4);}
});
test('provider exception never includes token in diagnostic',async()=>{
 for(const point of [1,2,3,4]){
  const t=transport({throwAt:point});await assert.rejects(()=>probe(t),e=>{
   assert.ok(e.message.startsWith(DENIED));assert.equal(e.message.includes(token),false);return true;
  });
 }
});
test('no valid token means no cloud requests',async()=>{
 let count=0;
 for(const tok of ['','abc','bad\nline','contains spaces'])await denied(()=>
  probePositiveGenerationCanary({scope:scope(),token:tok,nonce,transport:async()=>{count++;}}));
 assert.equal(count,0);
});
test('CLI refuses nonexplicit usage before reading any provider secret',()=>{
 const file=fileURLToPath(new URL('./r1075-gcs-positive-generation-canary.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[file],{encoding:'utf8',input:token,timeout:5000,
  env:{PATH:process.env.PATH,HOME:process.env.HOME,GOOGLE_CLOUD_PROJECT:'urai-4dc1d'}});
 assert.notEqual(p.status,0);assert.match(p.stderr,new RegExp(DENIED));assert.equal(p.stdout,'');
 assert.equal((p.stderr||'').includes(token),false);
});
