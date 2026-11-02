import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/privacy/lifeMovieAdmissionPreflight.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const time=Date.parse('2026-11-01T13:00:00Z');
const scope={projectId:'movie-1',renderPlanDigest:'a'.repeat(64),sourceSetDigest:'b'.repeat(64)};
const selection={projectId:scope.projectId,renderPlanDigest:scope.renderPlanDigest,sources:[{id:'a',generation:'1793378565000001',ownerOrRightsRef:'rights-1'}]};
const input={ownerUid:'owner-1',tenantId:'tenant-1',consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'c'.repeat(64)},selection};
const functions={};
const module={exports:{}};
vm.runInNewContext(js,{module,exports:module.exports,require(name){if(name==='node:crypto') return {randomUUID:()=> 'corr-12345678'};if(name==='../jobs/studioLifeMovieContract.js') return {deriveStudioLifeMovieRenderScope(payload){assert.equal(payload,selection);return scope;}};throw Error(name)},Date,Number,Array,Reflect,Object,Error}, {filename:'lifeMovieAdmissionPreflight.js'});
const create=module.exports.createLifeMovieAdmissionPreflight;
let cases=0;
assert.throws(()=>create({}),/life_movie_admission_authority_unavailable/);cases++;
let consulted=0;let decisions=0;let expectedSeen;
const rights={ownerUid:input.ownerUid,tenantId:input.tenantId,renderScope:scope,verifiedAt:new Date(time-1000).toISOString(),rightsEventId:'rights-event-1'};
function configured(options={}){return create({nowMs:()=>time,verifySourceRights:async(req)=>{consulted++;assert.equal(req.ownerUid,input.ownerUid);assert.equal(req.tenantId,input.tenantId);return options.rights??rights;},getCurrentPrivacyDecision:async(expected)=>{decisions++;expectedSeen=expected;if(options.rejectDecision)throw Error('transport timeout');return options.decision??{decisionEventId:'decision-event-1',evaluatedAt:new Date(time-500).toISOString()};}});}
const result=await configured()(input);assert.equal(result.rightsEventId,rights.rightsEventId);assert.equal(result.renderScope,scope);assert.equal(expectedSeen.correlationId,'corr-12345678');assert.equal(expectedSeen.decisionReceiptId,input.consent.decisionReceiptId);assert.equal(decisions,1);cases++;
for(const request of [{...input,ownerUid:''},{...input,ownerUid:undefined},{...input,tenantId:undefined},{...input,tenantId:'bad/tenant'},{...input,consent:{...input.consent,purpose:'memory.storage'}},{...input,consent:{...input.consent,policyVersion:'1.0.0'}},{...input,consent:{...input.consent,decisionReceiptId:'bad'}},{...input,selection:{...selection,sources:[]}}]){const prev=consulted;await assert.rejects(configured()(request),/life_movie_admission_authority_unavailable/);assert.equal(consulted,prev);cases++;}
for(const wrong of [{...rights,ownerUid:'other'},{...rights,tenantId:'other'},{...rights,renderScope:{...scope,sourceSetDigest:'d'.repeat(64)}},{...rights,renderScope:{...scope,extra:'secret'}},{...rights,rightsEventId:''},{...rights,verifiedAt:new Date(time-60000).toISOString()},{...rights,verifiedAt:new Date(time+1000).toISOString()}]){const prev=decisions;await assert.rejects(configured({rights:wrong})(input),/life_movie_source_rights_unverified/);assert.equal(decisions,prev);cases++;}
for(const wrong of [{decisionEventId:'',evaluatedAt:new Date(time-1000).toISOString()},{decisionEventId:'decision-1',evaluatedAt:new Date(time-60000).toISOString()},{decisionEventId:'decision-1',evaluatedAt:new Date(time+1000).toISOString()}]){await assert.rejects(configured({decision:wrong})(input),/life_movie_admission_authority_unavailable/);cases++;}
await assert.rejects(configured({rejectDecision:true})(input),/life_movie_admission_authority_unavailable/);cases++;
// A revoked source may change while Privacy completes its own remote check.
// Admission must consult the server-owned rights authority again afterwards.
{
  const events=[];
  let revoked=false;
  const race=create({nowMs:()=>time,
    verifySourceRights:async()=>{events.push('rights');return revoked?{...rights,ownerUid:'revoked-owner'}:rights;},
    getCurrentPrivacyDecision:async()=>{events.push('privacy');revoked=true;return {decisionEventId:'decision-event-1',evaluatedAt:new Date(time-500).toISOString()};},
  });
  await assert.rejects(race(input), /life_movie_source_rights_unverified/);
  assert.deepEqual(events,['rights','privacy','rights']);cases++;
}
{
  const events=[];
  let finished=false;
  const race=create({nowMs:()=>time,
    verifySourceRights:async()=>{events.push('rights');return {...rights,rightsEventId:finished?'rights-event-final':'rights-event-first'};},
    getCurrentPrivacyDecision:async()=>{events.push('privacy');finished=true;return {decisionEventId:'decision-event-1',evaluatedAt:new Date(time-500).toISOString()};},
  });
  const result=await race(input);
  assert.equal(result.rightsEventId,'rights-event-final');
  assert.deepEqual(events,['rights','privacy','rights']);cases++;
}

// A caller's consent or source selection must not be able to change during an
// await. Both the final rights recheck and Privacy decision bind the original
// immutable selection, even when the caller mutates its original objects.
{
  const mutation = {...input, consent:{...input.consent},selection};
  const initialReceipt = mutation.consent.decisionReceiptId;
  const initialGeneration = selection.sources[0].generation;
  const seen = [];
  try {
    const check = create({nowMs:()=>time,
      verifySourceRights:async(req)=>{
        seen.push(['rights',req.ownerUid,req.selection.sources[0].generation]);
        if(seen.length===1){
          mutation.consent.decisionReceiptId = 'f'.repeat(64);
          selection.sources[0].generation = '1793378565000002';
          mutation.ownerUid = 'other-owner';
        }
        return rights;
      },
      getCurrentPrivacyDecision:async(expected)=>{
        seen.push(['privacy',expected.subjectUid,expected.decisionReceiptId]);
        assert.equal(expected.subjectUid,input.ownerUid);
        assert.equal(expected.decisionReceiptId,initialReceipt);
        return {decisionEventId:'decision-event-1',evaluatedAt:new Date(time-500).toISOString()};
      },
    });
    const granted=await check(mutation);
    assert.equal(granted.renderScope,scope);
    assert.deepEqual(seen,[
      ['rights','owner-1',initialGeneration],
      ['privacy','owner-1',initialReceipt],
      ['rights','owner-1',initialGeneration],
    ]);
    cases++;
  } finally {selection.sources[0].generation=initialGeneration;}
}
{
  const mutation = {...input,consent:{...input.consent},selection};
  const initialGeneration=selection.sources[0].generation;
  const seen=[];
  try {
    const check=create({nowMs:()=>time,
      verifySourceRights:async(req)=>{
        seen.push(['rights',req.selection.sources[0].generation]);
        return rights;
      },
      getCurrentPrivacyDecision:async(expected)=>{
        mutation.consent.decisionReceiptId='e'.repeat(64);
        selection.sources[0].generation='1793378565000003';
        seen.push(['privacy',expected.decisionReceiptId]);
        return {decisionEventId:'decision-event-1',evaluatedAt:new Date(time-500).toISOString()};
      },
    });
    await check(mutation);
    assert.deepEqual(seen,[
      ['rights',initialGeneration],
      ['privacy',input.consent.decisionReceiptId],
      ['rights',initialGeneration],
    ]);
    cases++;
  } finally {selection.sources[0].generation=initialGeneration;}
}
// Accessor-backed authority and source attributes are invalid. Never call
// getters, ask for source rights, or initiate a Privacy request.
for(const field of ['ownerUid','tenantId','consent','selection']){
  let reads=0,rightsReads=0,privacyReads=0;
  const bad={...input};
  Object.defineProperty(bad,field,{enumerable:true,get(){reads++;return input[field]}});
  const check=create({nowMs:()=>time,
    verifySourceRights:async()=>{rightsReads++;return rights},
    getCurrentPrivacyDecision:async()=>{privacyReads++;return {decisionEventId:'x',evaluatedAt:new Date(time).toISOString()}}
  });
  await assert.rejects(check(bad),/life_movie_admission_authority_unavailable/);
  assert.equal(reads,0);assert.equal(rightsReads,0);assert.equal(privacyReads,0);
  cases++;
}
for(const field of ['decisionReceiptId','policyVersion']){
  let reads=0;
  const badConsent={...input.consent};
  Object.defineProperty(badConsent,field,{enumerable:true,get(){reads++;return input.consent[field]}});
  await assert.rejects(configured()({...input,consent:badConsent}),/life_movie_admission_authority_unavailable/);
  assert.equal(reads,0);cases++;
}
for(const field of ['generation','ownerOrRightsRef']){
  let reads=0;
  const source={...selection.sources[0]};
  Object.defineProperty(source,field,{enumerable:true,get(){reads++;return selection.sources[0][field]}});
  await assert.rejects(configured()({...input,selection:{...selection,sources:[source]}}),/life_movie_admission_authority_unavailable/);
  assert.equal(reads,0);cases++;
}
{
  const sparse=Array(1);
  await assert.rejects(configured()({...input,selection:{...selection,sources:sparse}}),/life_movie_admission_authority_unavailable/);
  cases++;
}
{
  const tooMany=Array.from({length:13},()=>selection.sources[0]);
  await assert.rejects(configured()({...input,selection:{...selection,sources:tooMany}}),/life_movie_admission_authority_unavailable/);
  cases++;
}

console.log('[PASS] ' + cases + ' synthetic preflight contract cases; no network, credentials, grants or rendering');
