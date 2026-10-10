import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {createProfileClient,firebaseProfileSession} from '../app/profile-client.mjs';

// Runs within the existing real compiled v2 onRequest loopback harness. Auth,
// consent and versioned Firestore remain its explicitly synthetic interfaces.
export async function runProfileClientScenarios({check,base,db,C,pc,authUsers,tokens,change,revoke,reset,origin}) {
  const gate = () => { let release; const promise = new Promise(r=>release=r); return {promise,release}; };
  const user = uid => ({uid,async getIdToken(force) { assert.equal(force,true); return uid; }});
  function fixture(uid = 'candidate', overrides = {}) {
    let currentUser = user(uid); const callbacks = new Set();
    const auth = {get currentUser() { return currentUser; }};
    const session = firebaseProfileSession(auth,(_auth,callback) => { assert.equal(_auth,auth); callbacks.add(callback); callback(currentUser); return () => callbacks.delete(callback); });
    const requests = [];
    const send = async (path,options) => {
      assert.equal(path,'/api/marketplace/profiles/me'); assert.equal(options.cache,'no-store'); assert.equal(options.credentials,'same-origin');
      requests.push({method:options.method,body:options.body ? JSON.parse(options.body) : null});
      return fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});
    };
    const client = createProfileClient({session,consentAuthority:async context => {
      assert.equal(context.uid,currentUser.uid); assert.equal(context.purpose,'career.profile'); return pc;
    },fetch:send,...overrides});
    return {client,send,requests,setUser(next) { currentUser = next; for (const callback of callbacks) callback(next); },silentUser(next) { currentUser = next; },refresh() { for (const callback of callbacks) callback(currentUser); },user,get currentUser() { return currentUser; },callbacks};
  }
  await check('Career client missing profile creates, reads persisted bytes, and survives new client',async()=>{
    db.erase(C.profiles+'/candidate'); const f = fixture();
    await f.client.load(); assert.equal(f.client.snapshot().phase,'empty');
    f.client.update({displayName:'Actual client synthetic name',location:'Synthetic place',skills:['Testing'],links:['https://example.invalid/profile'],experience:'Synthetic history',uid:'candidate2',tenantId:'other'});
    await f.client.save(true); const s = f.client.snapshot(); assert.equal(s.phase,'saved'); assert.equal(s.revision,1);
    assert.equal(s.profile.displayName,db.data(C.profiles+'/candidate').displayName); assert.equal(db.data(C.profiles+'/candidate2').displayName,'Synthetic candidate2');
    assert.deepEqual(Object.keys(f.requests.find(x=>x.method==='POST').body).sort(),['consent','consentGranted','displayName','expectedRevision','experience','links','location','skills'].sort());
    f.client.dispose(); const fresh = fixture(); await fresh.client.load(); assert.equal(fresh.client.snapshot().profile.displayName,s.profile.displayName); fresh.client.dispose();
  });
  await check('Career client update uses loaded revision and authoritative readback',async()=>{
    const f = fixture(); await f.client.load(); const created = db.data(C.profiles+'/candidate').createdAt;
    f.client.update({displayName:'Changed client name'}); await f.client.save(true);
    assert.equal(f.client.snapshot().revision,2); assert.equal(f.client.snapshot().dirty,false); assert.equal(db.data(C.profiles+'/candidate').createdAt,created); f.client.dispose();
  });
  await check('Career client loading/saving visible while actual response waits',async()=>{
    const wait = gate(); let f; f = fixture('candidate',{fetch:async(path,options) => { const response = await f.send(path,options); await wait.promise; return response; }});
    const pending = f.client.load(); assert.equal(f.client.snapshot().phase,'loading'); wait.release(); await pending; assert.equal(f.client.snapshot().phase,'ready');
    f.client.update({displayName:'Loading fixture'}); const save = f.client.save(true); assert.equal(f.client.snapshot().phase,'saving'); await save; assert.equal(f.client.snapshot().phase,'saved'); f.client.dispose();
  });
  await check('Career client supplied consent choice required; no invented positive grant',async()=>{
    const f = fixture('candidate',{consentAuthority:async()=>null}); await f.client.load(); const writes = db.writes.length;
    await f.client.save(false); assert.equal(f.client.snapshot().code,'CONSENT_REQUIRED'); assert.equal(db.writes.length,writes);
    await f.client.save(true); assert.equal(f.client.snapshot().code,'CONSENT_AUTHORITY_UNAVAILABLE'); assert.equal(f.client.snapshot().profile,null); assert.equal(db.writes.length,writes); f.client.dispose();
  });
  await check('Career client current-account/tenant/token/consent denials clear private fields',async()=>{
    for (const deny of [()=>{authUsers.get('candidate').disabled=true;},()=>change(C.profiles+'/candidate',{tenantId:'other'}),()=>{tokens.get('candidate').revoked=true;},()=>revoke('candidate','career.profile')]) {
      reset(); const f = fixture(); await f.client.load(); assert(f.client.snapshot().profile); deny(); await f.client.load();
      assert.equal(f.client.snapshot().phase,'denied'); assert.equal(f.client.snapshot().profile,null); assert.equal(f.client.snapshot().draft.displayName,''); f.client.dispose();
    }
  });
  await check('Career client preserves draft on revision conflict and reloads explicitly',async()=>{
    const f = fixture(); await f.client.load(); f.client.update({displayName:'Unsent draft'});
    change(C.profiles+'/candidate',{revision:2,displayName:'Concurrent saved name'}); const writes = db.writes.length;
    await f.client.save(true); assert.equal(f.client.snapshot().phase,'conflict'); assert.equal(f.client.snapshot().draft.displayName,'Unsent draft');
    await f.client.save(true); assert.equal(db.writes.length,writes); await f.client.load(); assert.equal(f.client.snapshot().draft.displayName,'Concurrent saved name'); assert.equal(f.client.snapshot().revision,2); f.client.dispose();
  });
  await check('Career client launch hold is unavailable, never synthetic success',async()=>{
    process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='false';
    try { const f=fixture(); await f.client.load(); assert.equal(f.client.snapshot().phase,'error'); assert.equal(f.client.snapshot().code,'MARKETPLACE_LAUNCH_BLOCKED'); assert.equal(f.client.snapshot().profile,null); f.client.dispose(); }
    finally { process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='true'; }
  });
  await check('Career client network failure is safe, recoverable and does not report saved',async()=>{
    let fail=true,f; f=fixture('candidate',{fetch:(path,options)=>{if(fail)throw Error('private-fixture-detail');return f.send(path,options);}});
    await f.client.load(); assert.equal(f.client.snapshot().phase,'error'); assert.equal(f.client.snapshot().code,'PROFILE_CONNECTION_FAILED'); assert(!JSON.stringify(f.client.snapshot()).includes('private-fixture-detail'));
    fail=false; await f.client.load(); assert.equal(f.client.snapshot().phase,'ready'); f.client.dispose();
  });
  await check('Career client acknowledged write/readback failure cannot repeat save',async()=>{
    let fail=false,f; f=fixture('candidate',{fetch:(path,options)=>{if(fail&&options.method==='GET')throw Error('fixture-offline');return f.send(path,options);}});
    await f.client.load(); f.client.update({displayName:'Persisted before interruption'}); fail=true; await f.client.save(true);
    assert.equal(f.client.snapshot().phase,'saved-unverified'); assert.equal(db.data(C.profiles+'/candidate').revision,2); const writes=db.writes.length;
    await f.client.save(true); assert.equal(db.writes.length,writes); fail=false; await f.client.load(); assert.equal(f.client.snapshot().revision,2); assert.equal(f.client.snapshot().profile.displayName,'Persisted before interruption'); f.client.dispose();
  });
  await check('Career client account switch clears private data and rejects late old response',async()=>{
    const waiting=gate(),arrived=gate(); let delay=false,f;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(delay){arrived.release();await waiting.promise;}return response;}});
    await f.client.load(); f.client.update({displayName:'Private unsaved draft'}); delay=true; const old=f.client.load(); await arrived.promise;
    f.setUser(f.user('candidate2')); assert.equal(f.client.snapshot().profile,null); assert.equal(f.client.snapshot().draft.displayName,''); assert.equal(f.client.snapshot().phase,'idle');
    waiting.release(); await old; assert.equal(f.client.snapshot().uid,'candidate2'); assert.equal(f.client.snapshot().profile,null);
    delay=false; await f.client.load(); assert.equal(f.client.snapshot().profile.uid,'candidate2'); f.setUser(null); assert.equal(f.client.snapshot().phase,'signed-out'); assert.equal(f.client.snapshot().profile,null); f.client.dispose();
  });
  await check('Career client account switch during token await never sends old draft',async()=>{
    const f=fixture(),waiting=gate(); await f.client.load(); f.client.update({displayName:'Private draft'});
    f.currentUser.getIdToken=async()=>{await waiting.promise;return 'candidate';}; const writes=db.writes.length,requests=f.requests.length;
    const pending=f.client.save(true); f.setUser(f.user('candidate2')); waiting.release(); await pending;
    assert.equal(f.requests.length,requests); assert.equal(db.writes.length,writes); assert.equal(f.client.snapshot().draft.displayName,''); f.client.dispose();
  });
  await check('Career client silent account switch rejects old private intent before binding new account',async()=>{
    const f=fixture();await f.client.load();f.client.update({displayName:'Old account private draft'});const count=f.requests.length,writes=db.writes.length;
    f.silentUser(f.user('candidate2'));await f.client.save(true);assert.equal(f.requests.length,count);assert.equal(db.writes.length,writes);
    assert.equal(f.client.snapshot().phase,'idle');assert.equal(f.client.snapshot().draft.displayName,'');assert.equal(f.client.snapshot().uid,'candidate2');f.client.dispose();
  });
  await check('Career Firebase adapter same-user refresh during token await does not cancel valid request',async()=>{
    const f=fixture();f.currentUser.getIdToken=async force=>{assert.equal(force,true);f.refresh();return 'candidate';};
    await f.client.load();assert.equal(f.client.snapshot().phase,'ready');f.client.update({displayName:'Legitimate refreshed-token save'});await f.client.save(true);
    assert.equal(f.client.snapshot().phase,'saved');assert.equal(f.client.snapshot().revision,2);f.setUser(null);assert.equal(f.client.snapshot().profile,null);f.client.dispose();
  });
  await check('Career Firebase SDK auth rejection clears previously loaded private profile/draft',async()=>{
    for(const code of ['auth/user-disabled','auth/user-token-expired','auth/invalid-user-token']) {
      reset();const f=fixture();await f.client.load();f.client.update({displayName:'Private unsaved profile'});
      f.currentUser.getIdToken=async()=>{const error=new Error('private fixture Firebase detail');error.code=code;throw error;};
      await f.client.save(true);assert.equal(f.client.snapshot().phase,'denied');assert.equal(f.client.snapshot().code,code);
      assert.equal(f.client.snapshot().profile,null);assert.equal(f.client.snapshot().draft.displayName,'');assert.equal(f.client.snapshot().dirty,false);f.client.dispose();
    }
  });
  await check('Career client divergent higher-revision readback never claims its own save checked',async()=>{
    let mutate=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(mutate&&options.method==='POST')change(C.profiles+'/candidate',{revision:3,displayName:'Concurrent second writer'});return response;}});
    await f.client.load();f.client.update({displayName:'Our submitted name'});mutate=true;await f.client.save(true);assert.equal(f.client.snapshot().phase,'saved-unverified');assert.equal(f.client.snapshot().code,'PROFILE_READBACK_CHANGED');
    assert.equal(f.client.snapshot().draft.displayName,'Our submitted name');const writes=db.writes.length;await f.client.save(true);assert.equal(db.writes.length,writes);
    mutate=false;await f.client.load();assert.equal(f.client.snapshot().revision,3);assert.equal(f.client.snapshot().draft.displayName,'Concurrent second writer');f.client.dispose();
  });
  await check('Career client same-revision altered content never claims readback acceptance',async()=>{
    let alter=false,f;f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(alter&&options.method==='GET'){const body=await response.json();body.profile.displayName='Synthetic divergent response';return new Response(JSON.stringify(body),{status:200});}return response;}});
    await f.client.load();f.client.update({displayName:'Our submitted name'});alter=true;await f.client.save(true);assert.equal(f.client.snapshot().phase,'saved-unverified');assert.equal(f.client.snapshot().code,'PROFILE_READBACK_CHANGED');f.client.dispose();
  });
  await check('Career client disposal stops listeners and rejects late private result',async()=>{
    const waiting=gate(),arrived=gate();let f;f=fixture('candidate',{fetch:async(path,options)=>{const r=await f.send(path,options);arrived.release();await waiting.promise;return r;}});
    const pending=f.client.load();await arrived.promise;f.client.dispose();assert.equal(f.callbacks.size,0);waiting.release();await pending;assert.equal(f.client.snapshot().profile,null);
  });
  await check('Career client malformed foreign profile response cannot disclose identity',async()=>{
    const f=fixture('candidate',{fetch:async()=>new Response(JSON.stringify({ok:true,profile:{uid:'candidate2',displayName:'Foreign fixture',revision:1}}),{status:200})});
    await f.client.load();assert.equal(f.client.snapshot().code,'PROFILE_RESPONSE_INVALID');assert.equal(f.client.snapshot().profile,null);f.client.dispose();
  });
  const turns=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
  const observed=promise=>{let done=false;const result=Promise.resolve(promise).finally(()=>{done=true;});return{result,done:()=>done};};
  const assertSettled=async pending=>{await turns();assert.equal(pending.done(),true,'profile operation must settle without waiting for the underlying provider');};
  // Only the owned Node22 test clock changes. The client has no public deadline
  // extension option and production remains fixed at20 seconds.
  for(const boundary of ['token','consent','fetch','body'])await check('Career profile wait fixed deadline settles hung '+boundary+' without late adoption',async()=>{
    const waiting=gate(),arrived=gate();let hold=false,f,pending;
    f=fixture('candidate',{consentAuthority:async()=>{if(hold&&boundary==='consent'){arrived.release();await waiting.promise;}return pc;},fetch:async(path,options)=>{
      const response=await f.send(path,options);if(hold&&boundary==='fetch'){arrived.release();await waiting.promise;}
      if(hold&&boundary==='body')return{ok:response.ok,json:async()=>{arrived.release();await waiting.promise;return response.json();}};return response;
    }});
    try{
      await f.client.load();f.client.update({displayName:'Bounded synthetic draft'});hold=true;
      if(boundary==='token')f.currentUser.getIdToken=async()=>{arrived.release();await waiting.promise;return'candidate';};
      mock.timers.enable({apis:['setTimeout']});pending=observed(boundary==='consent'?f.client.save(true):f.client.load());await arrived.promise;mock.timers.tick(20000);await assertSettled(pending);
      assert.equal(f.client.snapshot().phase,'timed-out');assert.equal(f.client.snapshot().code,'PROFILE_REQUEST_TIMEOUT');const state=f.client.snapshot();waiting.release();await pending.result;await turns();assert.deepEqual(f.client.snapshot(),state);
    }finally{mock.timers.reset();f.client.dispose();waiting.release();if(pending)await pending.result;}
  });
  await check('Career profile wait shares one fixed deadline across SDK and transport boundaries',async()=>{
    const first=gate(),second=gate(),tokenArrived=gate(),fetchArrived=gate();let f,pending;
    // Pure owned transport double isolates the clock boundary from HTTP's own
    // timers; separate cases below exercise actual loopback writes/readback.
    f=fixture('candidate',{fetch:async()=>{fetchArrived.release();await second.promise;return new Response(JSON.stringify({ok:true,profile:db.data(C.profiles+'/candidate')}),{status:200});}});
    f.currentUser.getIdToken=async()=>{tokenArrived.release();await first.promise;return'candidate';};
    try{mock.timers.enable({apis:['setTimeout']});pending=observed(f.client.load());await tokenArrived.promise;mock.timers.tick(10000);first.release();await fetchArrived.promise;mock.timers.tick(10000);await assertSettled(pending);assert.equal(f.client.snapshot().phase,'timed-out');}
    finally{mock.timers.reset();f.client.dispose();first.release();second.release();if(pending)await pending.result;}
  });
  await check('Career profile wait caller options cannot extend production deadline',async()=>{
    const waiting=gate(),arrived=gate(),f=fixture('candidate',{waitTimeoutMs:999999});let pending;
    f.currentUser.getIdToken=async()=>{arrived.release();await waiting.promise;return'candidate';};
    try{mock.timers.enable({apis:['setTimeout']});pending=observed(f.client.load());await arrived.promise;mock.timers.tick(20000);await assertSettled(pending);assert.equal(f.client.snapshot().code,'PROFILE_REQUEST_TIMEOUT');}
    finally{mock.timers.reset();f.client.dispose();waiting.release();if(pending)await pending.result;}
  });
  await check('Career profile wait current-account cancellation settles before SDK and observes late rejection',async()=>{
    const arrived=gate(),f=fixture();let pending,rejectToken;const errors=[],onUnhandled=error=>errors.push(error);process.on('unhandledRejection',onUnhandled);
    try{await f.client.load();f.currentUser.getIdToken=()=>{arrived.release();return new Promise((_,reject)=>{rejectToken=reject;});};pending=observed(f.client.load());await arrived.promise;f.setUser(f.user('candidate2'));await assertSettled(pending);assert.equal(f.client.snapshot().uid,'candidate2');assert.equal(f.client.snapshot().profile,null);rejectToken(Error('owned late token rejection'));await turns();assert.deepEqual(errors,[]);assert.equal(f.client.snapshot().phase,'idle');}
    finally{f.client.dispose();rejectToken?.(Error('owned cleanup rejection'));if(pending)await pending.result;process.off('unhandledRejection',onUnhandled);}
  });
  await check('Career profile wait disposal settles hung body and cannot start later private work',async()=>{
    const arrived=gate();let rejectBody,pending,hold=false,f;const errors=[],onUnhandled=error=>errors.push(error);process.on('unhandledRejection',onUnhandled);
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(hold)return{ok:response.ok,json:()=>{arrived.release();return new Promise((_,reject)=>{rejectBody=reject;});}};return response;}});
    try{await f.client.load();hold=true;pending=observed(f.client.load());await arrived.promise;f.client.dispose();await assertSettled(pending);assert.equal(f.callbacks.size,0);assert.equal(f.client.snapshot().profile,null);const count=f.requests.length;rejectBody(Error('owned late body rejection'));await turns();assert.deepEqual(errors,[]);assert.equal(f.requests.length,count);assert.equal(f.client.snapshot().profile,null);}
    finally{f.client.dispose();rejectBody?.(Error('owned cleanup rejection'));if(pending)await pending.result;process.off('unhandledRejection',onUnhandled);}
  });
  await check('Career profile wait silent account change during hung token clears old private state at deadline',async()=>{
    const waiting=gate(),arrived=gate(),f=fixture();let pending;
    try{await f.client.load();f.client.update({displayName:'Private old actor draft'});f.currentUser.getIdToken=async()=>{arrived.release();await waiting.promise;return'candidate';};mock.timers.enable({apis:['setTimeout']});pending=observed(f.client.load());await arrived.promise;f.silentUser(f.user('candidate2'));mock.timers.tick(20000);await assertSettled(pending);assert.equal(f.client.snapshot().uid,'candidate2');assert.equal(f.client.snapshot().profile,null);assert.equal(f.client.snapshot().draft.displayName,'');}
    finally{mock.timers.reset();f.client.dispose();waiting.release();if(pending)await pending.result;}
  });
  await check('Career profile wait stale-before-factory starts no old token or consent work',async()=>{
    const f=fixture();let tokensStarted=0,consentStarted=0;f.currentUser.getIdToken=async()=>{tokensStarted++;return'candidate';};
    const off=f.client.subscribe(s=>{if(s.phase==='loading')f.silentUser(f.user('candidate2'));});await f.client.load();assert.equal(tokensStarted,0);assert.equal(f.requests.length,0);assert.equal(f.client.snapshot().uid,'candidate2');off();f.client.dispose();
    const g=fixture('candidate',{consentAuthority:async()=>{consentStarted++;return pc;}});await g.client.load();g.client.update({displayName:'Old actor intent'});const offSave=g.client.subscribe(s=>{if(s.phase==='saving')g.silentUser(g.user('candidate2'));});await g.client.save(true);assert.equal(consentStarted,0);assert.equal(g.client.snapshot().uid,'candidate2');assert.equal(g.client.snapshot().draft.displayName,'');offSave();g.client.dispose();
  });
  for(const boundary of ['token','consent','fetch','body'])await check('Career profile wait timeout observes late '+boundary+' rejection without changing recovery state',async()=>{
    const arrived=gate();let rejectWork,pending,hold=false,f;const errors=[],onUnhandled=error=>errors.push(error);process.on('unhandledRejection',onUnhandled);const hung=()=>{arrived.release();return new Promise((_,reject)=>{rejectWork=reject;});};
    f=fixture('candidate',{consentAuthority:()=>hold&&boundary==='consent'?hung():Promise.resolve(pc),fetch:async(path,options)=>{if(hold&&boundary==='fetch')return hung();const response=await f.send(path,options);return hold&&boundary==='body'?{ok:response.ok,json:hung}:response;}});
    try{await f.client.load();f.client.update({displayName:'Pending bounded fixture'});hold=true;if(boundary==='token')f.currentUser.getIdToken=hung;mock.timers.enable({apis:['setTimeout']});pending=observed(boundary==='consent'?f.client.save(true):f.client.load());await arrived.promise;mock.timers.tick(20000);await assertSettled(pending);const state=f.client.snapshot();rejectWork(Error('owned late '+boundary+' rejection'));await turns();assert.deepEqual(errors,[]);assert.deepEqual(f.client.snapshot(),state);}
    finally{mock.timers.reset();f.client.dispose();rejectWork?.(Error('owned cleanup rejection'));if(pending)await pending.result;process.off('unhandledRejection',onUnhandled);}
  });
  for(const boundary of ['fetch','body'])await check('Career profile wait attempted write '+boundary+' timeout is uncertain and requires actual saved reload',async()=>{
    const waiting=gate(),arrived=gate();let hold=false,f,pending;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(hold&&options.method==='POST'){
      if(boundary==='fetch'){arrived.release();await waiting.promise;}
      else return{ok:response.ok,json:async()=>{arrived.release();await waiting.promise;return response.json();}};
    }return response;}});
    try{await f.client.load();f.client.update({displayName:'Actual uncertain stored name'});hold=true;mock.timers.enable({apis:['setTimeout']});pending=observed(f.client.save(true));await arrived.promise;mock.timers.tick(20000);await assertSettled(pending);assert.equal(db.data(C.profiles+'/candidate').revision,2);assert.equal(f.client.snapshot().phase,'save-uncertain');const count=f.requests.length;await f.client.save(true);assert.equal(f.requests.length,count);mock.timers.reset();waiting.release();hold=false;await f.client.load();assert.equal(f.client.snapshot().draft.displayName,'Actual uncertain stored name');assert.equal(f.client.snapshot().revision,2);}
    finally{mock.timers.reset();f.client.dispose();waiting.release();if(pending)await pending.result;}
  });
  await check('Career profile wait acknowledged write timeout remains saved-unverified until explicit authoritative recovery',async()=>{
    const waiting=gate(),arrived=gate();let hold=false,posted=false,f,pending;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(hold&&posted&&options.method==='GET'){arrived.release();await waiting.promise;}if(options.method==='POST')posted=true;return response;}});
    try{await f.client.load();f.client.update({displayName:'Actual acknowledged name'});hold=true;mock.timers.enable({apis:['setTimeout']});pending=observed(f.client.save(true));await arrived.promise;mock.timers.tick(20000);await assertSettled(pending);assert.equal(f.client.snapshot().phase,'saved-unverified');assert.equal(f.client.snapshot().code,'PROFILE_REQUEST_TIMEOUT');const count=f.requests.length;await f.client.save(true);assert.equal(f.requests.length,count);mock.timers.reset();waiting.release();hold=false;await f.client.load();assert.equal(f.client.snapshot().draft.displayName,'Actual acknowledged name');}
    finally{mock.timers.reset();f.client.dispose();waiting.release();if(pending)await pending.result;}
  });
  await check('Career profile wait persisted POST numeric DOMException is uncertain and requires saved reload',async()=>{
    let fail=false,f;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(fail&&options.method==='POST')throw new DOMException('Owned aborted transport','AbortError');return response;}});
    try{await f.client.load();f.client.update({displayName:'Actual aborted transport stored name'});fail=true;await f.client.save(true);
      assert.equal(db.data(C.profiles+'/candidate').revision,2);assert.equal(f.client.snapshot().phase,'save-uncertain');assert.equal(f.client.snapshot().code,'PROFILE_CONNECTION_FAILED');
      const count=f.requests.length;await f.client.save(true);assert.equal(f.requests.length,count);fail=false;await f.client.load();assert.equal(f.client.snapshot().draft.displayName,'Actual aborted transport stored name');assert.equal(f.client.snapshot().revision,2);
    }finally{f.client.dispose();}
  });
  for(const [boundary,code] of [['fetch','ECONNRESET'],['body','ERR_NETWORK']])await check('Career profile wait persisted POST unconfirmed '+boundary+' '+code+' blocks blind retry',async()=>{
    let fail=false,f;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(fail&&options.method==='POST'){
      const reject=()=>{throw Object.assign(Error('Owned failed transport'),{code,authoritative:true});};if(boundary==='fetch')return reject();return{ok:response.ok,json:reject};
    }return response;}});
    try{await f.client.load();f.client.update({displayName:'Actual '+code+' stored name'});fail=true;await f.client.save(true);assert.equal(db.data(C.profiles+'/candidate').revision,2);assert.equal(f.client.snapshot().phase,'save-uncertain');assert.equal(f.client.snapshot().code,code);
      const count=f.requests.length;await f.client.save(true);assert.equal(f.requests.length,count);fail=false;await f.client.load();assert.equal(f.client.snapshot().draft.displayName,'Actual '+code+' stored name');assert.equal(f.client.snapshot().revision,2);
    }finally{f.client.dispose();}
  });
  await check('Career profile wait parsed server input launch revision and consent rejection retain truthful states',async()=>{
    for(const rejection of ['input','launch','revision','consent']){
      reset();let alter=false,f;
      f=fixture('candidate',{fetch:(path,options)=>{if(alter&&options.method==='POST'&&rejection==='input'){const body=JSON.parse(options.body);body.displayName='';options={...options,body:JSON.stringify(body)};}return f.send(path,options);}});
      try{await f.client.load();f.client.update({displayName:'Rejected unsent draft'});alter=true;
        if(rejection==='launch')process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='false';
        if(rejection==='revision')change(C.profiles+'/candidate',{revision:2});
        if(rejection==='consent')revoke('candidate','career.profile');
        const writes=db.writes.length;await f.client.save(true);assert.equal(db.writes.length,writes);assert.equal(f.client.snapshot().phase,rejection==='revision'?'conflict':rejection==='consent'?'denied':'error');assert.notEqual(f.client.snapshot().phase,'save-uncertain');
      }finally{process.env.URAI_JOBS_MARKETPLACE_LAUNCH_APPROVED='true';f.client.dispose();}
    }
  });
  await check('Career profile wait superseding load settles old work and rejects old same-UID completion',async()=>{
    const waiting=gate(),arrived=gate();let hold=true,f,pending;
    f=fixture('candidate',{fetch:async(path,options)=>{const response=await f.send(path,options);if(hold){arrived.release();await waiting.promise;}return response;}});
    try{pending=observed(f.client.load());await arrived.promise;hold=false;change(C.profiles+'/candidate',{displayName:'Current superseding profile'});await f.client.load();await assertSettled(pending);const state=f.client.snapshot();assert.equal(state.draft.displayName,'Current superseding profile');waiting.release();await turns();assert.deepEqual(f.client.snapshot(),state);}
    finally{f.client.dispose();waiting.release();if(pending)await pending.result;}
  });
}
