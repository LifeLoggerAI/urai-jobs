import test from 'node:test';
import assert from 'node:assert/strict';
import {redactChalkBoundJobDocuments} from '../functions/lib/functions/jobs/chalkReadbackAuthority.js';
const jobs='chalkjobs_aaaaaaaaaaaaaaaa', spatial='chalkspatial_bbbbbbbbbbbbbbbb';
const doc=(id,changes={})=>({id,data:()=>({ownerUid:jobs,type:'engineering.verify',jobType:'engineering.verify',chalkOriginSpatialUid:spatial,chalkBindingRevision:1,...changes})});
const filter=(docs)=>redactChalkBoundJobDocuments(docs,jobs,spatial,1);
test('matches exact owner origin and revision',()=>assert.deepEqual(filter([doc('a')]).map(x=>x.id),['a']));
for(const [name,changes] of [
 ['other owner',{ownerUid:'chalkjobs_cccccccccccccccc'}],
 ['other spatial identity',{chalkOriginSpatialUid:'chalkspatial_cccccccccccccccc'}],
 ['old generation',{chalkBindingRevision:0}],
 ['missing generation',{chalkBindingRevision:undefined}],
 ['missing spatial origin',{chalkOriginSpatialUid:undefined}],
 ['other job kind',{type:'personal.memory'}],
 ['conflicting job alias',{jobType:'personal.memory'}]
]) test('denies '+name,()=>assert.deepEqual(filter([doc('x',changes)]),[]));
test('retains only current scope from mixed rows',()=>assert.deepEqual(filter([doc('good'),doc('bad',{chalkBindingRevision:2})]).map(x=>x.id),['good']));
test('denies invalid approval revision',()=>assert.throws(()=>redactChalkBoundJobDocuments([],jobs,spatial,0),/SCOPE/));
test('denies oversized query',()=>assert.throws(()=>filter(Array.from({length:41},(_,i)=>doc('id'+i))),/BOUNDS/));
