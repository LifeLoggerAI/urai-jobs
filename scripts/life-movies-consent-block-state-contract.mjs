import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

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
