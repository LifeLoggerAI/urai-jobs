import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
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

console.log('[PASS] ' + cases + ' synthetic preflight contract cases; no network, credentials, grants or rendering');
