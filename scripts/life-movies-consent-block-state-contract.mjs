import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// Exercise the actual, committed worker guard in an isolated VM without
// importing Express, Firebase, reading private data or enabling rendering.
const worker = readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
const marker = 'function checkedStudioConsentBlockState(snapshot) {';
const beginning = worker.indexOf(marker);
const end = worker.indexOf('\nfunction createRenderControl(', beginning);
assert.ok(beginning >= 0 && end > beginning, 'committed worker consent guard missing');
const snippet = worker.slice(beginning, end);
const context = { module: { exports: {} }, Object };
vm.runInNewContext(`${snippet}\nmodule.exports = checkedStudioConsentBlockState;`, context);
const guard = context.module.exports;
let total = 0;
const eq = (snapshot, result) => { assert.equal(guard(snapshot), result); total++; };

// Firestore's missing document is a verified absence, not a revocation.
let dataCalls=0;
eq({ exists: false, data: () => {dataCalls++; throw Error('must not call data');}},'clear');
assert.equal(dataCalls,0);
eq({exists:true,data:()=>({active:false})},'clear');
eq({exists:true,data:()=>({active:true})},'revoked');
for (const value of [null,undefined,[],{}, {active:'false'}, {active:0}, {active:null},
  Object.create({active:false})]) eq({exists:true,data:()=>value},'unverified');
let getterCalls=0;
const getter=Object.defineProperty({},'active',{get(){getterCalls++;return false;}});
eq({exists:true,data:()=>getter},'unverified');
assert.equal(getterCalls,0,'must never invoke a user-controlled consent getter');
for (const bad of [null,undefined,{},[],{exists:'false',data:()=>({active:false})},
  {exists:true,data:null},{exists:true,data:()=>{throw Error('provider unavailable');}}]) eq(bad,'unverified');
const proxy=new Proxy({active:false},{getOwnPropertyDescriptor(){throw Error('corrupt proxy')}});
eq({exists:true,data:()=>proxy},'unverified');
// At the caller's actual revocation check, only 'clear' may continue;
// both positive revocation and unknown evidence must abort.
assert.match(worker, /const consentBlockState = checkedStudioConsentBlockState\(block\);/);
assert.match(worker, /if \(consentBlockState !== 'clear'\) \{/);
assert.match(worker, /consentBlockState === 'revoked' \? 'render_consent_revoked' : 'render_authority_unavailable'/);
assert.doesNotMatch(worker, /if \(block\.exists && block\.data\(\)\?\.active === true\)/);
console.log(`[PASS] ${total} worker consent-block states + original-worker revocation wiring; no provider access`);

// R373: exercise the exact committed Jobs TS helper using the Functions-owning
// TypeScript dependency, and verify both bridge call sites fail closed.
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const consentSource = readFileSync(new URL('../functions/src/privacy/consentBlocks.ts', import.meta.url), 'utf8');
const at = consentSource.indexOf('export type JobConsentBlockState =');
assert.ok(at >= 0, 'shared Life Movie consent-block state helper missing');
const transpiled = ts.transpileModule(consentSource.slice(at), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const isolatedModule = { exports: {} };
vm.runInNewContext(transpiled, { module: isolatedModule, exports: isolatedModule.exports, Object, Array, Error });
const { checkedJobConsentBlockState: checkJobs, assertJobConsentBlockClear: assertJobsClear } = isolatedModule.exports;
assert.equal(typeof checkJobs, 'function');
const present = active => ({ exists: true, data: () => active });
const cases = [
  [{exists:false,data:()=>{throw Error('do not read absent data')}},'clear'],
  [present({active:false}),'clear'],[present({active:true}),'revoked'],
  [undefined,'unverified'],[null,'unverified'],[[],'unverified'],[{},'unverified'],
  [{exists:'false',data:()=>({active:false})},'unverified'],
  [{exists:true,data:null},'unverified'],
  [present(null),'unverified'],[present([]),'unverified'],[present({}),'unverified'],
  [present({active:'false'}),'unverified'],[present({active:0}),'unverified'],[present({active:null}),'unverified'],
  [present(Object.create({active:false})),'unverified'],
  [present(Object.create({active:true})),'unverified'],
  [{exists:true,data:()=>{throw Error('Firestore unavailable')}},'unverified'],
  [Object.defineProperty({},'exists',{get(){throw Error('unreadable')}}),'unverified'],
  [present(Object.defineProperty({},'active',{get(){throw Error('trap')}})),'unverified'],
  [present(new Proxy({active:false},{getOwnPropertyDescriptor(){throw Error('trap')}})),'unverified'],
];
for (const [snapshot,state] of cases) {
  assert.equal(checkJobs(snapshot),state);
  if (state==='clear') assert.doesNotThrow(()=>assertJobsClear(snapshot,'life_movie_test_revoked'));
  else assert.throws(()=>assertJobsClear(snapshot,'life_movie_test_revoked'),
    new RegExp(state==='revoked'?'life_movie_test_revoked':'life_movie_consent_block_unverified'));
}
const shortBridge=readFileSync(new URL('../functions/src/jobs/studioLifeMovieBridge.ts',import.meta.url),'utf8');
const longBridge=readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformBridge.ts',import.meta.url),'utf8');
assert.equal((shortBridge.match(/assertJobConsentBlockClear\(consentSnapshot, 'life_movie_consent_revoked'\)/g)||[]).length,2);
assert.equal((longBridge.match(/assertJobConsentBlockClear\((?:snapshot|consentSnapshot), 'life_movie_longform_consent_revoked'\)/g)||[]).length,2);
assert.match(longBridge,/if \(consentState === 'unverified'\) throw new Error\('life_movie_consent_block_unverified'\)/);
for(const bridge of [shortBridge,longBridge]){
  assert.doesNotMatch(bridge,/(?:snapshot|consentSnapshot)\.exists && (?:snapshot|consentSnapshot)\.data\(\)\?\.active === true/);
}
console.log('[PASS] 21 Jobs consent-block scenarios and strict bridge preflight/status wiring. Life Movie remains unavailable.');

