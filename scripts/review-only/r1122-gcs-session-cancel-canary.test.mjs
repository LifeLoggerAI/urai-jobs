import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVAL,DENIED,validateSessionCanaryScope,makeSessionCanaryTargets,probeSessionCancellation
} from './r1122-gcs-session-cancel-canary.mjs';
const project='urai-security-canary-r1122',nonce='a'.repeat(32),token='syntheticBrokerTokenNotReal';
const scope=()=>({approval:APPROVAL,projectId:project,bucket:project+'-private',
  claimedBrokerPrincipal:'broker-one@'+project+'.iam.gserviceaccount.com'});
const target=()=>makeSessionCanaryTargets(scope(),nonce);
const location=()=>target().startUrl+'&upload_id=SYNTHETIC_UPLOAD_ID_12345';
const response=(status,loc=null)=>({status,headers:{get:k=>k==='location'?loc:null}});
const deny=fn=>assert.rejects(fn,new RegExp(DENIED));
function sequence(overrides={}){
  const calls=[],stages=['POST','DELETE','PUT','PUT','GET'];
  const statuses=[200,499,410,410,404].map((v,i)=>overrides[i]??v);
  const send=async (url,options)=>{
    const idx=calls.length;calls.push({url,options});
    assert.equal(options.method,stages[idx],'stage '+idx);
    return response(statuses[idx],idx===0?location():null);
  };
  return {calls,send};
}
test('scope strictly limits to disposable project and exact bucket',()=>{
  assert.equal(validateSessionCanaryScope(scope()).bucket,project+'-private');
  for(const bad of [
    {...scope(),projectId:'urai-staging'},
    {...scope(),projectId:'urai-4dc1d'},
    {...scope(),bucket:'urai-staging.firebasestorage.app'},
    {...scope(),claimedBrokerPrincipal:'broker-one@different.iam.gserviceaccount.com'},
    {...scope(),approval:'unreviewed'},
    {...scope(),productionAuthorized:true},
  ]) assert.throws(()=>validateSessionCanaryScope(bad),new RegExp(DENIED));
  assert.throws(()=>makeSessionCanaryTargets(scope(),'not-a-nonce'),new RegExp(DENIED));
});
test('one cancelled synthetic session requires 499, 410/404 rejections and object 404',async()=>{
  const t=sequence();const r=await probeSessionCancellation({scope:scope(),token,transport:t.send,nonce});
  assert.equal(t.calls.length,5);
  assert.equal(t.calls[0].url,target().startUrl);
  assert.equal(t.calls[0].options.headers.Authorization,'Bearer '+token);
  for(const i of [1,2,3])assert.equal(t.calls[i].url,location());
  for(const i of [1,2,3])assert.equal(t.calls[i].options.headers.Authorization,undefined);
  assert.equal(t.calls[3].options.body.byteLength,1);
  assert.equal(t.calls[4].url,target().metadataUrl);
  assert.equal(r.sessionCancelledHttp499Observed,true);
  assert.equal(r.syntheticByteResumeRejectedAfterCancel,true);
  assert.equal(r.customerDataDeletionAcknowledged,false);
  assert.equal(r.allResumableSessionsInventoried,false);
  assert.equal(r.privateMediaWritesEnabled,false);
  assert.equal(r.launchApproved,false);
  assert.equal(JSON.stringify(r).includes('upload_id'),false);
  assert.equal(JSON.stringify(r).includes(token),false);
});
test('post-cancel 404 status and 410 resume both qualify as negative canary',async()=>{
  const t=sequence({2:404,3:410});
  const r=await probeSessionCancellation({scope:scope(),token,transport:t.send,nonce});
  assert.equal(r.sessionStatusRejectedAfterCancel,true);
});
test('creator-only absent source token denies before provider contact',async()=>{
  const t=sequence();await deny(probeSessionCancellation({scope:scope(),token:'bad',transport:t.send,nonce}));
  assert.equal(t.calls.length,0);
});
test('external or redirected Location is rejected without following it',async()=>{
  for(const bad of [
    location().replace('storage.googleapis.com','example.invalid'),
    location().replace('https://','http://'),
    location().replace(project+'-private','otherbucket'),
    location().replace('upload_id=','upload_id=X&upload_id='),
    location().replace('uploadType=resumable','uploadType=media'),
    location().replace('upload_id=','token_secret='),
    location()+'#fragment'
  ]){
    const calls=[];
    const transport=async(url,options)=>{calls.push(options.method);return response(200,bad)};
    await deny(probeSessionCancellation({scope:scope(),token,transport,nonce}));
    assert.deepEqual(calls,['POST']);
  }
});
test('missing Location cannot imply session cancellation',async()=>{
  const calls=[];
  await deny(probeSessionCancellation({scope:scope(),token,nonce,
    transport:async(url,options)=>{calls.push(options.method);return response(200,null)}}));
  assert.deepEqual(calls,['POST']);
});
test('cancel 204, 403, 404 or 500 does not count as JSON API 499 confirmation',async()=>{
  for(const s of [204,403,404,500]){
    const t=sequence({1:s});await deny(probeSessionCancellation({scope:scope(),token,transport:t.send,nonce}));
    assert.equal(t.calls[1].options.method,'DELETE');
  }
});
test('successful post-cancel status response 200 or pending 308 denies',async()=>{
  for(const s of [200,308]){
    const t=sequence({2:s});await deny(probeSessionCancellation({scope:scope(),token,transport:t.send,nonce}));
  }
});
test('a post-cancel byte write 200 or 201 fails closed even if status query was denied',async()=>{
  for(const s of [200,201]){
    const t=sequence({3:s});await deny(probeSessionCancellation({scope:scope(),token,transport:t.send,nonce}));
  }
});
test('metadata 200, 403, 500 or 412 is never proof of object absence',async()=>{
  for(const s of [200,403,500,412]){
    const t=sequence({4:s});await deny(probeSessionCancellation({scope:scope(),token,transport:t.send,nonce}));
  }
});
test('provider exception cannot leak token or session URL through errors',async()=>{
  const secret='Bearer '+token+' '+location();
  const provider=async()=>{throw Error(secret)};
  await assert.rejects(probeSessionCancellation({scope:scope(),token,transport:provider,nonce}),e=>{
    assert.equal(e.message,DENIED);assert.equal(e.message.includes(token),false);
    assert.equal(e.message.includes('upload_id'),false);return true;
  });
});
test('missing transport and invalid nonce both deny without network',async()=>{
  await deny(probeSessionCancellation({scope:scope(),token,transport:null,nonce}));
  await deny(probeSessionCancellation({scope:scope(),token,transport:()=>{throw Error('bad');},nonce:'oops'}));
});
