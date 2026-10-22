import test from 'node:test';
import assert from 'node:assert/strict';
import {redactChalkJobDocuments} from '../functions/src/jobs/chalkReadbackAuthority.ts';
const snap = (id, value) => ({id, data:()=>value});
const actor = 'founder-1234';
test('authorized owner engineering job readback contains exactly four safe keys',()=>{
 const docs=[snap('engineering-001',{ownerUid:actor,type:'engineering.verify',status:'RUNNING',
   payload:{privateMedia:'personal secret'},lease:{token:'secret'},logs:['sensitive']}),
 snap('other-job',{ownerUid:actor,type:'memory.private-source.transcribe',status:'RUNNING'})];
 const result=redactChalkJobDocuments(docs,actor);
 assert.deepEqual(result,[{jobId:'engineering-001',ownerUid:actor,type:'engineering.verify',status:'RUNNING'}]);
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(Object.isFrozen(result[0]),true);
});
const blocked = [
 ['different owner',snap('eng-2',{ownerUid:'stranger',type:'engineering.verify',status:'RUNNING'})],
 ['wrong type',snap('eng-2',{ownerUid:actor,type:'personal.memory',status:'SUCCESS'})],
 ['conflicting alias',snap('eng-2',{ownerUid:actor,type:'engineering.verify',jobType:'media.read',status:'SUCCESS'})],
 ['unknown status',snap('eng-2',{ownerUid:actor,type:'engineering.verify',status:'APPROVED'})],
 ['malformed id',snap('../escape',{ownerUid:actor,type:'engineering.verify',status:'RUNNING'})],
 ['nonrecord',snap('eng-2',null)],
 ];
for(const [name,doc]of blocked)test('excluded '+name,()=>assert.deepEqual(redactChalkJobDocuments([doc],actor),[]));
test('denies invalid actor',()=>assert.throws(()=>redactChalkJobDocuments([], '../escape'),/OWNER/));
test('denies oversized snapshot',()=>assert.throws(()=>redactChalkJobDocuments(Array(41).fill(snap('x',{ownerUid:actor,type:'engineering.verify',status:'RUNNING'})),actor),/BOUNDS/));
test('safe terminal statuses remain distinct',()=>{
 const statuses=['PENDING','LEASED','RUNNING','SUCCESS','FAILED','DEAD','CANCELLED'];
 const docs=statuses.map((status,i)=>snap('task-'+i,{ownerUid:actor,type:'engineering.verify',status}));
 assert.deepEqual(redactChalkJobDocuments(docs,actor).map(job=>job.status),statuses);
});
