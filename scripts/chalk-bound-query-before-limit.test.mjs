import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeChalkBoundReadbackQuery} from '../functions/lib/functions/jobs/chalkReadbackAuthority.js';

const owner='chalkjobs_aaaaaaaaaaaaaaaa';
const spatial='chalkspatial_bbbbbbbbbbbbbbbb';
const mk=(id,delta={})=>({id,ownerUid:owner,chalkOriginSpatialUid:spatial,
 chalkBindingRevision:1,type:'engineering.verify',jobType:'engineering.verify',...delta});
class LocalQuery {
 constructor(rows,steps=[]){this.rows=rows;this.steps=steps;}
 where(field,op,value){assert.equal(op,'==');return new LocalQuery(this.rows.filter(x=>x[field]===value),[...this.steps,['where',field]]);}
 limit(n){return new LocalQuery(this.rows.slice(0,n),[...this.steps,['limit',n]]);}
 get(){return this.rows;}
}
const run=(rows,limit=2,revision=1)=>scopeChalkBoundReadbackQuery(new LocalQuery(rows),owner,spatial,revision,limit);
test('all five server-authority filters occur before limit',()=>{
 const q=run([mk('a')]);
 assert.deepEqual(q.steps.map(x=>x[0]),['where','where','where','where','where','limit']);
 assert.deepEqual(q.steps.slice(0,5).map(x=>x[1]),['ownerUid','chalkOriginSpatialUid','chalkBindingRevision','type','jobType']);
});
test('older and foreign records cannot crowd out current diagnostics',()=>{
 const rows=[...Array.from({length:70},(_,i)=>mk('other-'+i,{chalkOriginSpatialUid:'chalkspatial_cccccccccccccccc'})),
 ...Array.from({length:70},(_,i)=>mk('stale-'+i,{chalkBindingRevision:2})),
 mk('current-a'),mk('current-b')];
 assert.deepEqual(run(rows).get().map(x=>x.id),['current-a','current-b']);
});
test('new grant rejects previous generation',()=>{
 assert.deepEqual(run([mk('old'),mk('new',{chalkBindingRevision:2})],40,2).get().map(x=>x.id),['new']);
});
test('rejects foreign job subtypes',()=>{
 assert.deepEqual(run([mk('foreign',{jobType:'private'}),mk('valid')],1).get().map(x=>x.id),['valid']);
});
for(const [name,params] of [['owner',[null,spatial,1,20]],['spatial',[owner,null,1,20]],
 ['revision',[owner,spatial,0,20]],['limit',[owner,spatial,1,41]]]){
 test('rejects invalid '+name,()=>assert.throws(()=>scopeChalkBoundReadbackQuery(new LocalQuery([]),...params),/CHALK_READBACK_/));
}
