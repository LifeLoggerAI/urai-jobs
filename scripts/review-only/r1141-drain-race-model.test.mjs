import test from 'node:test';
import assert from 'node:assert/strict';
import {HOLD,createModel,reserve,startUpload,observeGeneration,withdraw,confirmSessionCancelled,confirmGenerationAbsent,observeExhaustiveProviderInventory,observeExternalFence,readiness,acknowledgeSynthetic,weakInventoryRaceWitness} from './r1141-drain-race-model.mjs';
const denied=fn=>assert.throws(fn,e=>e.message===HOLD);
const cancel={deleteStatus:499,statusAfter:410,resumeAfter:410};
const inv={sessionInventoryComplete:true,generationInventoryComplete:true};
const fence={brokerOnlyEffectiveIam:true,providerIdentitiesAuthenticated:true,retiredWriterHttp403:true,alternateWriterHttp403:true};
test('legacy point-in-time inventory has a concrete late-write counterexample',()=>{
  assert.deepEqual(weakInventoryRaceWitness(),{deletionAck:true,objectPresent:true,violatesProperty:true});
});
test('no session reservation allowed after withdrawal, including new names',()=>{
  const m=createModel();withdraw(m);denied(()=>reserve(m,'late'));
});
test('stale epoch cannot start after withdrawal',()=>{
  const m=createModel(),e=reserve(m,'one');withdraw(m);denied(()=>startUpload(m,'one',e));
});
test('a pre-withdrawal active session blocks readiness despite empty object inventory',()=>{
  const m=createModel(),e=reserve(m,'one');startUpload(m,'one',e);withdraw(m);
  observeExhaustiveProviderInventory(m,inv);observeExternalFence(m,fence);
  assert.equal(readiness(m),HOLD);
});
test('a canceled session without a reconciled generation cannot imply object absence',()=>{
  const m=createModel();reserve(m,'one');withdraw(m);confirmSessionCancelled(m,'one',cancel);
  observeGeneration(m,'one','123');observeExhaustiveProviderInventory(m,inv);observeExternalFence(m,fence);
  assert.equal(readiness(m),HOLD);
});
test('provider cancellation failure does not certify session drain',()=>{
  const m=createModel();reserve(m,'one');withdraw(m);
  for(const p of [{...cancel,deleteStatus:204},{...cancel,statusAfter:308},{...cancel,resumeAfter:200}]) denied(()=>confirmSessionCancelled(m,'one',p));
  assert.equal(readiness(m),HOLD);
});
test('generation verification must match exact session+generation and HTTP 404',()=>{
  const m=createModel();reserve(m,'one');reserve(m,'two');observeGeneration(m,'one','123');withdraw(m);
  denied(()=>confirmGenerationAbsent(m,'two','123',{httpStatus:404}));
  denied(()=>confirmGenerationAbsent(m,'one','123',{httpStatus:403}));
  confirmGenerationAbsent(m,'one','123',{httpStatus:404});
});
test('missing/partial provider inventory cannot pass',()=>{
  const m=createModel();withdraw(m);observeExternalFence(m,fence);
  denied(()=>observeExhaustiveProviderInventory(m,{sessionInventoryComplete:true,generationInventoryComplete:false}));
  assert.equal(readiness(m),HOLD);
});
test('external retired and alternate identities must both be denied',()=>{
  const m=createModel();withdraw(m);observeExhaustiveProviderInventory(m,inv);
  denied(()=>observeExternalFence(m,{...fence,alternateWriterHttp403:false}));
  assert.equal(readiness(m),HOLD);
});
test('synthetic completed drain is never a production release receipt',()=>{
  const m=createModel();reserve(m,'one');observeGeneration(m,'one','123');withdraw(m);
  confirmSessionCancelled(m,'one',cancel);confirmGenerationAbsent(m,'one','123',{httpStatus:404});
  observeExhaustiveProviderInventory(m,inv);observeExternalFence(m,fence);
  assert.equal(readiness(m),'SYNTHETIC_READY_NOT_PROVIDER_CERTIFIED');
  assert.equal(acknowledgeSynthetic(m),'SYNTHETIC_ONLY_NOT_DELETION_ACK');
  denied(()=>reserve(m,'new'));
  assert.equal(JSON.stringify({result:readiness(m)}).includes('PRODUCTION_PASS'),false);
});
test('synthetic attempts with duplicate IDs or generations fail closed',()=>{
  const m=createModel();reserve(m,'one');denied(()=>reserve(m,'one'));
  denied(()=>reserve(m,'../../bad'));observeGeneration(m,'one','123');
  reserve(m,'two');denied(()=>observeGeneration(m,'two','123'));
});
test('bounded schedule exploration: no synthetic ACK possible before an old session is canceled and object is absent',()=>{
  let examined=0, deniedPremature=0, eligible=0;
  const permutations=(a,p=[])=>{if(a.length===0){run(p);return;}for(let i=0;i<a.length;i++)permutations([...a.slice(0,i),...a.slice(i+1)],[...p,a[i]]);};
  function run(events){
    const m=createModel();let epoch=null;
    for(const evt of events){
      if(evt==='reserve'){try{epoch=reserve(m,'one');}catch{}}
      else if(evt==='start'){try{startUpload(m,'one',epoch);}catch{}}
      else if(evt==='write'){if(m.sessions.has('one')&&!m.generations.has('123')){try{observeGeneration(m,'one','123');}catch{}}}
      else if(evt==='revoke'){withdraw(m)}
      else if(evt==='cancel'){try{confirmSessionCancelled(m,'one',cancel)}catch{}}
      else if(evt==='absent'){if(m.generations.has('123')){try{confirmGenerationAbsent(m,'one','123',{httpStatus:404})}catch{}}}
      else if(evt==='inventory'){if(m.revoked){try{observeExhaustiveProviderInventory(m,inv);observeExternalFence(m,fence)}catch{}}}
      else if(evt==='try-ack'){
        examined++;
        const noSession=m.sessions.size===0 || [...m.sessions.values()].every(s=>s.cancelConfirmed);
        const noGen=[...m.generations.values()].every(g=>g.absent);
        const r=readiness(m);
        if(r==='SYNTHETIC_READY_NOT_PROVIDER_CERTIFIED'){
          eligible++;
          assert.equal(noSession&&noGen&&m.revoked&&m.reservationsClosed,true);
        }else deniedPremature++;
      }
    }
  }
  permutations(['reserve','start','write','revoke','cancel','absent','inventory','try-ack']);
  assert.equal(examined,40320);
  assert.ok(deniedPremature>0);
  assert.ok(eligible>0);
  console.log('R1141_BOUNDED_INTERLEAVINGS='+examined+' ELIGIBLE='+eligible+' PREMATURE_DENIED='+deniedPremature+' SYNTHETIC_ONLY');
});