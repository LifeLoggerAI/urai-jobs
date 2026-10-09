import assert from 'node:assert/strict';
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
}
