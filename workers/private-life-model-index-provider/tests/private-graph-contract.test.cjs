const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../dist/index.js'), 'utf8');
const app = { use() {}, get() {}, post() {}, listen() {} };
const express = () => app; express.json = () => () => {};
const loaded = { 'node:crypto': crypto, express,
  'express-rate-limit': { rateLimit: () => (_req, _res, next) => next() },
  './protected-source-provider': { registerProtectedSourceRoutes() {} }, './contracts.js': require(path.join(__dirname, '../dist/contracts.js')),
  'firebase-admin/app': { getApps: () => [1], initializeApp() {}, applicationDefault() {} },
  'firebase-admin/firestore': { FieldValue: {}, getFirestore() { throw new Error('unexpected Firestore call'); } } };
const exportsObject = {};
vm.runInNewContext(source + '\nObject.assign(exports,{ validateExtraction });', {
  exports: exportsObject, require(name) { assert.ok(Object.hasOwn(loaded,name), 'unexpected module'); return loaded[name]; },
  process: { env: {} }, Buffer, URL, AbortSignal, setTimeout, clearTimeout,
  fetch() { throw new Error('unexpected provider call'); }, console: { log() {}, error() {} },
});
const validate = value => exportsObject.validateExtraction(value, 'DIRECT_SUBJECT_TESTIMONY', 64);
const fixture = () => ({
  entities: [{ entityId: 'person.01', type: 'person', label: 'Synthetic person', aliases: [] }],
  claims: [{ claimId: 'claim.01', subject: 'person.01', predicate: 'testimony', object: 'Synthetic assertion', evidenceClass: 'DIRECT_SUBJECT_TESTIMONY', confidence: 0.7, sourceSpan: { startChar: 0, endChar: 9 } }],
  relationships: [], temporalStates: [], places: [], conflicts: [], negativeConstraints: [], sceneTruth: { decision: 'READY', reasons: [] },
});
test('compatible partial dates and dot IDs retain current authority shape', () => { const x=fixture();x.claims[0].time={start:'2024',end:'2026-10',uncertainty:'month uncertain'};assert.equal(validate(x).claims[0].claimId,'claim.01'); });
for (const [name, mutate] of [
  ['unknown extraction authority field', x=>{x.ownerUid='forged-owner';}],
  ['dangling contradicted claim', x=>{x.claims[0].contradictedBy=['missing-claim'];}],
  ['self contradiction reference', x=>{x.claims[0].contradictedBy=['claim.01'];}],
  ['reversed source time', x=>{x.claims[0].time={start:'2026-10',end:'2024'};}],
  ['impossible calendar date', x=>{x.claims[0].time={start:'2026-02-30'};}],
  ['unsupported place precision', x=>{x.claims[0].place={label:'Synthetic place',precision:'street-address'};}],
  ['duplicate place IDs', x=>{x.places=[{placeId:'place.01',label:'One',precision:'city'},{placeId:'place.01',label:'Two',precision:'city'}];}],
  ['duplicate conflict claim references', x=>{x.conflicts=[{conflictId:'conflict.01',claimIds:['claim.01','claim.01'],reason:'Synthetic'}];}],
  ['negative constraint lacks supporting claims', x=>{x.negativeConstraints=[{constraintId:'constraint.01',text:'Synthetic',sourceClaimIds:[]}];}],
  ['unsafe attribute prototype key', x=>{x.temporalStates=[{entityId:'person.01',attributes:JSON.parse('{"__proto__":{"synthetic":true}}')}];}],
  ['unbounded attribute nesting', x=>{let value={};for(let i=0;i<8;i++)value={next:value};x.temporalStates=[{entityId:'person.01',attributes:value}];}],
  ['empty relationship kind', x=>{x.relationships=[{from:'person.01',to:'person.01',type:'',confidence:0.5}];}],
  ['unknown private place locator field', x=>{x.places=[{placeId:'place.01',label:'Synthetic',precision:'city',privateLocator:'private:synthetic/media'}];}],
  ['occlusion scene missing required occlusions', x=>{x.sceneTruth={decision:'READY_WITH_OCCLUSION',reasons:[]};}],
]) test('reject ' + name, () => { const x=fixture();mutate(x);assert.throws(()=>validate(x)); });
test('unresolved source contradictions force proposed SceneTruth blocked', () => {const x=fixture();x.claims.push({...x.claims[0],claimId:'claim.02'});x.claims[0].contradictedBy=['claim.02'];assert.equal(validate(x).sceneTruth.decision,'BLOCKED');});
test('empty claim set cannot propose a ready source scene', () => {const x=fixture();x.claims=[];assert.equal(validate(x).sceneTruth.decision,'BLOCKED');});
