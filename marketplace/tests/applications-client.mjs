import assert from 'node:assert/strict';
import {createApplicationsClient} from '../app/applications-client.mjs';
import {firebaseProfileSession} from '../app/profile-client.mjs';

// Reuses the existing compiled onRequest + actual HTTP harness. The inherited
// Auth/Firestore/consent interfaces are owned fixtures, not live providers.
export async function runApplicationsClientScenarios({check,base,origin,createApp,db,C,aid,change,revoke,reset,authUsers,tokens,success}) {
  const gate=()=>{let release;const promise=new Promise(r=>release=r);return{promise,release};};
  const user=uid=>({uid,async getIdToken(force){assert.equal(force,true);return uid;}});
  function fixture(uid='candidate',overrides={}) {
    let currentUser=user(uid);const callbacks=new Set(),requests=[];
    const auth={get currentUser(){return currentUser;}};
    const session=firebaseProfileSession(auth,(_auth,callback)=>{assert.equal(_auth,auth);callbacks.add(callback);callback(currentUser);return()=>callbacks.delete(callback);});
    const send=async(path,options)=>{
      assert(/^\/api\/marketplace\/applications\/me(?:\?after=[^&]+)?$/.test(path)||/^\/api\/marketplace\/jobs\/[A-Za-z0-9_-]+$/.test(path)||/^\/api\/marketplace\/applications\/[^/]+\/withdraw$/.test(path));
      assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
      requests.push({path,method:options.method,body:options.body??null});
      return fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});
    };
    const client=createApplicationsClient({session,fetch:send,...overrides});
    return{client,requests,send,user,callbacks,get currentUser(){return currentUser;},setUser(next){currentUser=next;for(const callback of callbacks)callback(next);},silentUser(next){currentUser=next;},refresh(){for(const callback of callbacks)callback(currentUser);}};
  }
  await check('Career application client reads only current candidate/tenant persisted applications with real public title',async()=>{
    await createApp();await createApp('candidate2');const ours=db.data(C.apps+'/'+aid());db.put(C.apps+'/application-'+'f'.repeat(64),{...ours,tenantId:'other'});
    const f=fixture();await f.client.load();const s=f.client.snapshot();assert.equal(s.phase,'ready');assert.equal(s.items.length,1);assert.equal(s.items[0].id,aid());assert.equal(s.items[0].title,'Synthetic role');assert.equal(s.items[0].status,'submitted');
    assert.deepEqual(Object.keys(s.items[0]).sort(),['employerId','id','jobId','status','title']);assert(!JSON.stringify(s).includes('candidateSnapshot'));assert(!JSON.stringify(s).includes('Synthetic answer'));f.client.dispose();
  });
  await check('Career application client empty state is a successful current-account read, not denied fallback',async()=>{
    const f=fixture();await f.client.load();assert.equal(f.client.snapshot().phase,'empty');assert.equal(f.requests.length,1);assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();
  });
  await check('Career application client confirmed withdrawal persists and survives new client readback',async()=>{
    await createApp();const f=fixture();await f.client.load();await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'withdrawn');assert.equal(f.client.snapshot().items[0].status,'withdrawn');
    assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');const patch=f.requests.find(x=>x.method==='PATCH');assert.equal(patch.body,'{}');assert.equal(patch.path,'/api/marketplace/applications/'+aid()+'/withdraw');
    const writes=db.writes.length;await f.client.withdraw(aid());assert.equal(db.writes.length,writes);f.client.dispose();const fresh=fixture();await fresh.client.load();assert.equal(fresh.client.snapshot().items[0].status,'withdrawn');fresh.client.dispose();
  });
  await check('Career application client reviewing withdrawal succeeds; advanced/rejected/unknown cannot become withdrawn',async()=>{
    for(const status of ['reviewing','advanced','rejected','unsupported']) {
      reset();await createApp();change(C.apps+'/'+aid(),{status});const f=fixture();await f.client.load();const writes=db.writes.length;await f.client.withdraw(aid());
      if(status==='reviewing'){assert.equal(f.client.snapshot().phase,'withdrawn');assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');}
      else {assert.equal(db.writes.length,writes);assert.equal(f.requests.filter(x=>x.method==='PATCH').length,0);assert.equal(f.client.snapshot().items[0].status,status==='unsupported'?'unknown':status);}f.client.dispose();
    }
  });
  await check('Career application client canonical legacy encoded-colon ID remains usable',async()=>{
    await createApp();const stored=db.data(C.apps+'/'+aid());db.erase(C.apps+'/'+aid());db.put(C.apps+'/candidate:job',{...stored,id:'candidate:job'});
    const f=fixture();await f.client.load();await f.client.withdraw('candidate:job');assert.equal(f.client.snapshot().phase,'withdrawn');assert.equal(db.data(C.apps+'/candidate:job').status,'withdrawn');
    assert.equal(f.requests.find(x=>x.method==='PATCH').path,'/api/marketplace/applications/candidate%3Ajob/withdraw');f.client.dispose();
  });
  await check('Career application client withdrawn receipt works after consent revocation without redisclosing snapshots',async()=>{
    await createApp();const f=fixture();await f.client.load();revoke('candidate','career.application');revoke('candidate','career.profile');await f.client.withdraw(aid());
    assert.equal(f.client.snapshot().phase,'withdrawn');assert.equal(f.client.snapshot().items[0].status,'withdrawn');assert(!JSON.stringify(f.client.snapshot()).includes('Synthetic candidate'));
    f.client.dispose();const fresh=fixture();await fresh.client.load();assert.equal(fresh.client.snapshot().phase,'ready');assert.equal(fresh.client.snapshot().items[0].status,'withdrawn');fresh.client.dispose();
  });
  await check('Career application client missing/closed public job does not invent title or block owned withdrawal',async()=>{
    await createApp();await success('POST','/api/marketplace/jobs/job/close','owner',{});const f=fixture();await f.client.load();assert.equal(f.client.snapshot().phase,'ready');assert.equal(f.client.snapshot().items[0].title,null);
    await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'withdrawn');f.client.dispose();
  });
  await check('Career application client live SDK token refresh preserves valid load and withdrawal',async()=>{
    await createApp();const f=fixture();f.currentUser.getIdToken=async force=>{assert.equal(force,true);f.refresh();return'candidate';};
    await f.client.load();assert.equal(f.client.snapshot().phase,'ready');await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'withdrawn');f.client.dispose();
  });
  await check('Career application client Auth/account/tenant/consent denials erase previous private list',async()=>{
    for(const deny of [()=>{authUsers.get('candidate').disabled=true;},()=>{tokens.get('candidate').firebase={tenant:'other'};},()=>{tokens.get('candidate').revoked=true;},()=>revoke('candidate','career.application')]) {
      reset();await createApp();const f=fixture();await f.client.load();assert.equal(f.client.snapshot().items.length,1);deny();await f.client.load();assert.equal(f.client.snapshot().phase,'denied');assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();
    }
    for(const code of ['auth/user-disabled','auth/user-token-expired','auth/invalid-user-token']) {
      reset();await createApp();const f=fixture();await f.client.load();f.currentUser.getIdToken=async()=>{const error=Error('private fixture detail');error.code=code;throw error;};await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'denied');assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();
    }
  });
  await check('Career application client concurrent terminal review rejects withdrawal and requires fresh status',async()=>{
    await createApp();const f=fixture();await f.client.load();await success('PATCH','/api/marketplace/employers/employer/applications/'+aid(),'owner',{status:'advanced'});
    const writes=db.writes.length;await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'conflict');assert.equal(f.client.snapshot().stale,true);assert.equal(db.writes.length,writes);
    await f.client.withdraw(aid());assert.equal(db.writes.length,writes);await f.client.load();assert.equal(f.client.snapshot().items[0].status,'advanced');f.client.dispose();
  });
  await check('Career application client post-ack divergent receipt never claims checked withdrawal',async()=>{
    await createApp();let alter=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const r=await f.send(path,options);if(alter&&options.method==='PATCH')change(C.apps+'/'+aid(),{status:'reviewing'});return r;}});
    await f.client.load();alter=true;await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'withdrawal-unverified');assert.equal(f.client.snapshot().code,'APPLICATION_WITHDRAWAL_UNVERIFIED');const writes=db.writes.length;await f.client.withdraw(aid());assert.equal(db.writes.length,writes);f.client.dispose();
  });
  await check('Career application client interrupted readback preserves uncertainty and safely recovers persisted stop',async()=>{
    await createApp();let fail=false,f;f=fixture('candidate',{fetch:(path,options)=>{if(fail&&path.endsWith('/me'))throw Error('private fixture failure');return f.send(path,options);}});
    await f.client.load();fail=true;await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'withdrawal-unverified');assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');const count=f.requests.length;
    await f.client.withdraw(aid());assert.equal(f.requests.length,count);fail=false;await f.client.load();assert.equal(f.client.snapshot().items[0].status,'withdrawn');f.client.dispose();
  });
  await check('Career application client lost acknowledgment cannot retry blindly or claim cancellation',async()=>{
    await createApp();let fail=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(fail&&options.method==='PATCH')throw Error('fixture lost ack');return response;}});
    await f.client.load();fail=true;await f.client.withdraw(aid());assert.equal(f.client.snapshot().phase,'withdrawal-uncertain');assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');
    const count=f.requests.length;await f.client.withdraw(aid());assert.equal(f.requests.length,count);fail=false;await f.client.load();assert.equal(f.client.snapshot().items[0].status,'withdrawn');f.client.dispose();
  });
  await check('Career application client silent account switch rejects old withdrawal before rebinding',async()=>{
    await createApp();const f=fixture();await f.client.load();const count=f.requests.length,writes=db.writes.length;f.silentUser(f.user('candidate2'));await f.client.withdraw(aid());
    assert.equal(f.requests.length,count);assert.equal(db.writes.length,writes);assert.equal(f.client.snapshot().uid,'candidate2');assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();
  });
  await check('Career application client late old response cannot restore private list after account switch',async()=>{
    await createApp();const waiting=gate(),arrived=gate();let delay=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const r=await f.send(path,options);if(delay&&path.endsWith('/me')){arrived.release();await waiting.promise;}return r;}});
    await f.client.load();delay=true;const old=f.client.load();await arrived.promise;f.setUser(f.user('candidate2'));assert.deepEqual(f.client.snapshot().items,[]);waiting.release();await old;
    assert.equal(f.client.snapshot().uid,'candidate2');assert.deepEqual(f.client.snapshot().items,[]);delay=false;await f.client.load();assert.equal(f.client.snapshot().phase,'empty');f.client.dispose();
  });
  await check('Career application client silent switch during public label await clears previous private rows',async()=>{
    await createApp();const waiting=gate(),arrived=gate();let delay=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const r=await f.send(path,options);if(delay&&path.includes('/jobs/')){arrived.release();await waiting.promise;}return r;}});
    await f.client.load();delay=true;const pending=f.client.load();await arrived.promise;f.silentUser(f.user('candidate2'));waiting.release();await pending;
    assert.equal(f.client.snapshot().uid,'candidate2');assert.deepEqual(f.client.snapshot().items,[]);assert.equal(f.client.snapshot().phase,'idle');f.client.dispose();
  });
  await check('Career application client explicit interrupt stops waiting, not server withdrawal, and reload verifies',async()=>{
    await createApp();const waiting=gate(),arrived=gate();let delay=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const r=await f.send(path,options);if(delay&&options.method==='PATCH'){arrived.release();await waiting.promise;}return r;}});
    await f.client.load();delay=true;const pending=f.client.withdraw(aid());await arrived.promise;assert.equal(f.client.snapshot().phase,'withdrawing');assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');
    f.client.interrupt();assert.equal(f.client.snapshot().phase,'interrupted');assert.equal(f.client.snapshot().stale,true);waiting.release();await pending;assert.equal(f.client.snapshot().phase,'interrupted');delay=false;await f.client.load();assert.equal(f.client.snapshot().items[0].status,'withdrawn');f.client.dispose();
  });
  await check('Career application client launch hold is unavailable; scoped connection failure recovers',async()=>{
    process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='false';try{const f=fixture();await f.client.load();assert.equal(f.client.snapshot().code,'MARKETPLACE_LAUNCH_BLOCKED');assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();}finally{process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='true';}
    let fail=true,f;f=fixture('candidate',{fetch:(path,options)=>{if(fail)throw Error('private fixture detail');return f.send(path,options);}});await f.client.load();assert.equal(f.client.snapshot().phase,'error');assert(!JSON.stringify(f.client.snapshot()).includes('private fixture detail'));fail=false;await f.client.load();assert.equal(f.client.snapshot().phase,'empty');f.client.dispose();
  });
  await check('Career application client foreign/malformed response and spoofed action cannot disclose or withdraw',async()=>{
    const f=fixture('candidate',{fetch:async()=>new Response(JSON.stringify({ok:true,applications:[{id:aid('candidate2'),jobId:'job',employerId:'employer',status:'submitted',candidateUid:'candidate2',candidateSnapshot:{displayName:'foreign secret'}}]}),{status:200})});
    await f.client.load();assert.equal(f.client.snapshot().code,'APPLICATION_RESPONSE_INVALID');assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();
    await createApp();const real=fixture();await real.client.load();const count=real.requests.length;await real.client.withdraw('../admin');await real.client.withdraw(aid('candidate2'));assert.equal(real.requests.length,count);assert.equal(db.data(C.apps+'/'+aid()).status,'submitted');real.client.dispose();
  });
  await check('Career application client disposal erases rows and blocks a late request result',async()=>{
    await createApp();const waiting=gate(),arrived=gate();let f;f=fixture('candidate',{fetch:async(path,options)=>{const r=await f.send(path,options);arrived.release();await waiting.promise;return r;}});
    const pending=f.client.load();await arrived.promise;f.client.dispose();assert.equal(f.callbacks.size,0);waiting.release();await pending;assert.deepEqual(f.client.snapshot().items,[]);
  });
  const settledWithin=async promise=>{
    let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('owned client wait exceeded regression bound')),1000);})]);}finally{clearTimeout(timer);}
  };
  await check('Career application client stale-before-factory starts no old token or transport work',async()=>{
    const f=fixture();let tokenCalls=0;f.currentUser.getIdToken=async()=>{tokenCalls++;throw Error('must never start');};
    const unsubscribe=f.client.subscribe(s=>{if(s.phase==='loading')f.silentUser(f.user('candidate2'));});
    await settledWithin(f.client.load());assert.equal(tokenCalls,0);assert.equal(f.requests.length,0);assert.equal(f.client.snapshot().uid,'candidate2');assert.deepEqual(f.client.snapshot().items,[]);unsubscribe();f.client.dispose();
  });
  await check('Career application client interrupted SDK wait settles and observes late rejection without restoring rows',async()=>{
    await createApp();const f=fixture();await f.client.load();const arrived=gate();let rejectToken;const errors=[];
    const onUnhandled=error=>errors.push(error);process.on('unhandledRejection',onUnhandled);
    try {
      f.currentUser.getIdToken=()=>{arrived.release();return new Promise((_,reject)=>{rejectToken=reject;});};
      const pending=f.client.load();await arrived.promise;f.client.interrupt();await settledWithin(pending);assert.equal(f.client.snapshot().phase,'interrupted');
      const state=f.client.snapshot();rejectToken(Error('owned late SDK rejection'));await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));assert.deepEqual(errors,[]);assert.deepEqual(f.client.snapshot(),state);
    }finally{process.off('unhandledRejection',onUnhandled);f.client.dispose();}
  });
  await check('Career application client shared deadline bounds hung SDK fetch and JSON waits with no late adoption',async()=>{
    for(const boundary of ['token','fetch','json']) {
      reset();await createApp();const waiting=gate(),arrived=gate();let hold=true,f;
      f=fixture('candidate',{waitTimeoutMs:25,fetch:async(path,options)=>{
        const response=await f.send(path,options);if(hold&&path.endsWith('/me')) {
          if(boundary==='fetch'){arrived.release();await waiting.promise;}
          if(boundary==='json')return{ok:response.ok,json:async()=>{arrived.release();await waiting.promise;return response.json();}};
        }return response;
      }});
      if(boundary==='token')f.currentUser.getIdToken=async()=>{arrived.release();await waiting.promise;return'candidate';};
      const pending=f.client.load();await arrived.promise;await settledWithin(pending);assert.equal(f.client.snapshot().phase,'timed-out');assert.equal(f.client.snapshot().code,'APPLICATION_REQUEST_TIMEOUT');assert.deepEqual(f.client.snapshot().items,[]);
      waiting.release();await new Promise(r=>setImmediate(r));assert.equal(f.client.snapshot().phase,'timed-out');if(boundary==='token')assert.equal(f.requests.length,0);f.client.dispose();
    }
  });
  await check('Career application client silent session change during hung SDK still has bounded wait and clears private rows',async()=>{
    await createApp();const f=fixture('candidate',{waitTimeoutMs:25});await f.client.load();const arrived=gate();
    f.currentUser.getIdToken=()=>{arrived.release();return new Promise(()=>{});};const pending=f.client.load();await arrived.promise;f.silentUser(f.user('candidate2'));
    await settledWithin(pending);assert.equal(f.client.snapshot().uid,'candidate2');assert.equal(f.client.snapshot().phase,'idle');assert.deepEqual(f.client.snapshot().items,[]);f.client.dispose();
  });
  await check('Career application client timed-out actual withdrawal has uncertain receipt and manual persisted recovery',async()=>{
    await createApp();const waiting=gate(),arrived=gate();let hold=false,f;
    f=fixture('candidate',{waitTimeoutMs:50,fetch:async(path,options)=>{const response=await f.send(path,options);if(hold&&options.method==='PATCH'){arrived.release();await waiting.promise;}return response;}});
    await f.client.load();hold=true;const pending=f.client.withdraw(aid());await arrived.promise;await settledWithin(pending);assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');assert.equal(f.client.snapshot().phase,'withdrawal-uncertain');assert.equal(f.client.snapshot().stale,true);
    const requests=f.requests.length;await f.client.withdraw(aid());assert.equal(f.requests.length,requests);waiting.release();hold=false;await f.client.load();assert.equal(f.client.snapshot().items[0].status,'withdrawn');f.client.dispose();
  });
  async function history(count){
    await createApp();const source=db.data(C.apps+'/'+aid()),job=db.data(C.jobs+'/job');db.erase(C.apps+'/'+aid());
    for(let n=0;n<count;n++){const jobId='job'+String(n).padStart(3,'0'),id='candidate:'+jobId;db.put(C.jobs+'/'+jobId,{...job,id:jobId,title:'Owned synthetic historical job '+n});db.put(C.apps+'/'+id,{...source,id,jobId});}
  }
  await check('Career application client manually retains 121 owned applications across pages and verifies last-page withdrawal',async()=>{
    await history(121);const f=fixture();await f.client.load();assert.equal(f.client.snapshot().items.length,50);assert.equal(f.client.snapshot().nextCursor,'candidate:job049');
    await f.client.loadMore();assert.equal(f.client.snapshot().items.length,100);assert.equal(f.client.snapshot().nextCursor,'candidate:job099');await f.client.loadMore();assert.equal(f.client.snapshot().items.length,121);assert.equal(f.client.snapshot().nextCursor,null);
    const count=f.requests.length;await f.client.loadMore();assert.equal(f.requests.length,count);assert.equal(new Set(f.client.snapshot().items.map(x=>x.id)).size,121);
    await f.client.withdraw('candidate:job120');assert.equal(f.client.snapshot().phase,'withdrawn');assert.equal(f.client.snapshot().items.length,121);assert.equal(f.client.snapshot().items.at(-1).status,'withdrawn');assert.equal(db.data(C.apps+'/candidate:job120').status,'withdrawn');
    assert.equal(f.requests.findLast(x=>x.path.includes('/applications/me')).path,'/api/marketplace/applications/me?after=candidate%3Ajob099');f.client.dispose();
  });
  await check('Career application cursor is subject/tenant scoped and rejects arbitrary limits or duplicate query input',async()=>{
    await history(51);const get=path=>success('GET',path,'candidate');const first=await get('/api/marketplace/applications/me');assert.equal(first.applications.length,50);assert.equal(first.nextCursor,'candidate:job049');
    const last=await get('/api/marketplace/applications/me?after=candidate%3Ajob049');assert.equal(last.applications.length,1);assert.equal(last.nextCursor,null);
    const own=db.data(C.apps+'/candidate:job049');db.put(C.apps+'/candidate2:foreign',{...own,id:'candidate2:foreign',candidateUid:'candidate2'});db.put(C.apps+'/candidate:foreignTenant',{...own,id:'candidate:foreignTenant',tenantId:'other'});
    for(const suffix of ['after=candidate2%3Aforeign','after=candidate%3AforeignTenant','after=candidate%3Amissing','after=candidate%3Ajob049&limit=1000','after=candidate%3Ajob049&uid=candidate2','after=candidate%3Ajob049&after=candidate%3Ajob048']){
      const response=await fetch(base+'/api/marketplace/applications/me?'+suffix,{headers:{Origin:origin,Authorization:'Bearer candidate'}});assert.equal(response.status,400);const body=await response.json();assert.equal(body.code,'VALIDATION_APPLICATION_CURSOR');assert.equal(body.applications,undefined);
    }
  });
  await check('Career application pagination stale cursor and connection failure require reload without duplicates or automatic retry',async()=>{
    await history(51);const f=fixture();await f.client.load();db.erase(C.apps+'/candidate:job049');await f.client.loadMore();assert.equal(f.client.snapshot().code,'VALIDATION_APPLICATION_CURSOR');assert.equal(f.client.snapshot().stale,true);assert.equal(f.client.snapshot().items.length,50);
    const count=f.requests.length;await f.client.loadMore();assert.equal(f.requests.length,count);await f.client.load();assert.equal(f.client.snapshot().items.length,50);assert.equal(f.client.snapshot().nextCursor,null);assert.equal(new Set(f.client.snapshot().items.map(x=>x.id)).size,50);f.client.dispose();
  });
  await check('Career application pagination fresh current account and consent admission erase previous pages on revocation',async()=>{
    for(const deny of[()=>revoke('candidate','career.application'),()=>{authUsers.get('candidate').disabled=true;},()=>{tokens.get('candidate').firebase={tenant:'other'};}]){
      reset();await history(51);const f=fixture();await f.client.load();deny();await f.client.loadMore();assert.equal(f.client.snapshot().phase,'denied');assert.deepEqual(f.client.snapshot().items,[]);assert.equal(f.client.snapshot().nextCursor,null);f.client.dispose();
    }
  });
  await check('Career application pagination guards duplicate loads and keeps concurrent owned stops idempotent',async()=>{
    await history(51);const waiting=gate(),arrived=gate();let hold=true,f;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(hold&&path.includes('?after=')){arrived.release();await waiting.promise;}return response;}});await f.client.load();const pending=f.client.loadMore();await arrived.promise;const count=f.requests.length;await f.client.loadMore();assert.equal(f.requests.length,count);waiting.release();await pending;hold=false;
    await success('PATCH','/api/marketplace/applications/candidate%3Ajob050/withdraw','candidate',{});await f.client.withdraw('candidate:job050');assert.equal(f.client.snapshot().phase,'withdrawn');assert.equal(f.client.snapshot().items.at(-1).status,'withdrawn');assert.equal(f.client.snapshot().items.length,51);f.client.dispose();
  });
  await check('Career application pagination account switch during delayed next page clears all retained rows',async()=>{
    await history(51);const waiting=gate(),arrived=gate();let f;f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(path.includes('?after=')){arrived.release();await waiting.promise;}return response;}});
    await f.client.load();const pending=f.client.loadMore();await arrived.promise;f.setUser(f.user('candidate2'));await settledWithin(pending);waiting.release();await new Promise(r=>setImmediate(r));assert.equal(f.client.snapshot().uid,'candidate2');assert.deepEqual(f.client.snapshot().items,[]);assert.equal(f.client.snapshot().nextCursor,null);f.client.dispose();
  });
  await check('Career application withdrawal keeps every loaded ID when concurrent insertion shifts originating page boundary',async()=>{
    await history(121);let insert=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(insert&&options.method==='PATCH'){
      insert=false;const id='candidate:job000a',source=db.data(C.apps+'/candidate:job000');db.put(C.apps+'/'+id,{...source,id});
    }return response;}});
    await f.client.load();await f.client.loadMore();await f.client.loadMore();const before=f.client.snapshot().items.map(x=>x.id);insert=true;await f.client.withdraw('candidate:job010');
    assert.equal(f.client.snapshot().phase,'withdrawn');assert.deepEqual(f.client.snapshot().items.map(x=>x.id),before);assert.equal(f.client.snapshot().items.find(x=>x.id==='candidate:job010').status,'withdrawn');assert.equal(db.data(C.apps+'/candidate:job010').status,'withdrawn');
    assert(!f.client.snapshot().items.some(x=>x.id==='candidate:job000a'));await f.client.load();assert(f.client.snapshot().items.some(x=>x.id==='candidate:job000a'));f.client.dispose();
  });
}
