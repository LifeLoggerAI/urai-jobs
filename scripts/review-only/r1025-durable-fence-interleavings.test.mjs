/**
 * R1025 REVIEW ONLY: adversarial multi-process tests for the R1022 SQLite reference.
 * Additional to R1022's original 13/13, not production Storage admission, IAM,
 * authenticated owner authority, deletion ACK, or protected CI evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createReviewStore, inspectReviewStore, reserveReviewAttempt,
  beginReviewAttempt, withdrawReviewScope,
  authorizePrivateOutputForReview, acknowledgeDeletionForReview, DENIED
} from './r1022-durable-fence-model.mjs';

const MODEL = fileURLToPath(new URL('./r1022-durable-fence-model.mjs', import.meta.url));
const MODEL_URL = new URL('./r1022-durable-fence-model.mjs', import.meta.url).href;
const scope = () => ({ownerUid:'o1',tenantId:'t1',projectId:'p1',purpose:'life-movie.render',bucket:'b1',epoch:4});
const admission = id => ({...scope(),attemptId:id,objectPath:'tenants/t1/life-movies/p1/attempt-'+id+'/life-movie.mp4'});
const withdrawal = () => ({ownerUid:'o1',tenantId:'t1',projectId:'p1',purpose:'life-movie.render',withdrawalId:'withdraw1'});
const denied = fn => assert.throws(fn,{message:DENIED});

async function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'urai-r1025-'));
  const path=join(dir,'ledger.sqlite');
  try {createReviewStore(path,scope());return await fn(path);}
  finally {rmSync(dir,{recursive:true,force:true});}
}

function proc(kind,db,arg,version) {
  let argv;
  if(kind==='begin') {
    const script='import {beginReviewAttempt,DENIED} from '+JSON.stringify(MODEL_URL)+';'+
      'try{beginReviewAttempt('+JSON.stringify(db)+','+JSON.stringify(arg)+','+version+');process.stdout.write("OK\\n")}' +
      'catch(e){process.stderr.write(e.message);process.exitCode=e.message===DENIED?3:4}';
    argv=['--disable-warning=ExperimentalWarning','--input-type=module','--eval',script];
  } else argv=['--disable-warning=ExperimentalWarning',MODEL,kind,db,JSON.stringify(arg),String(version)];
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,argv,{stdio:['ignore','pipe','pipe']});
    let out='',err='';
    child.on('error',reject);
    child.stdout.on('data',b=>out+=b.toString());
    child.stderr.on('data',b=>err+=b.toString());
    child.on('close',code=>resolve({code,out,err}));
  });
}

test('R1025: distinct reservations at identical CAS version admit exactly one writer intent',async()=>fixture(async p=>{
  const all=await Promise.all(Array.from({length:16},(_,i)=>proc('reserve',p,admission('attempt'+i),1)));
  assert.equal(all.filter(x=>x.code===0).length,1,JSON.stringify(all));
  assert.equal(all.filter(x=>x.code===3).length,15,JSON.stringify(all));
  const s=inspectReviewStore(p);
  assert.equal(s.version,2);
  assert.equal(s.attemptCount,1);
  assert.equal(s.storageWriteAuthorized,false);
  assert.equal(s.deletionAcknowledged,false);
}));

test('R1025: 16 begin contenders against withdrawal linearize at same CAS version',async()=>fixture(async p=>{
  reserveReviewAttempt(p,admission('inflight1'),1);
  const requests=[...Array.from({length:16},()=>proc('begin',p,'inflight1',2)),proc('withdraw',p,withdrawal(),2)];
  const results=await Promise.all(requests);
  assert.equal(results.filter(x=>x.code===0).length,1,JSON.stringify(results));
  assert.equal(results.filter(x=>x.code===3).length,16,JSON.stringify(results));
  let s=inspectReviewStore(p);
  if(s.phase==='OPEN') {
    assert.equal(s.attempts[0].state,'IN_FLIGHT');
    s=withdrawReviewScope(p,withdrawal(),s.version);
  } else assert.equal(s.attempts[0].state,'RESERVED');
  assert.equal(s.phase,'FENCING');
  denied(()=>beginReviewAttempt(p,'inflight1',s.version));
  denied(()=>reserveReviewAttempt(p,admission('late1'),s.version));
  assert.equal(s.deletionAcknowledged,false);
  denied(()=>acknowledgeDeletionForReview());
}));

test('R1025: duplicate withdrawal deliveries across processes remain idempotent',async()=>fixture(async p=>{
  const results=await Promise.all(Array.from({length:12},()=>proc('withdraw',p,withdrawal(),1)));
  assert.equal(results.filter(x=>x.code===0).length,12,JSON.stringify(results));
  const s=inspectReviewStore(p);
  assert.equal(s.phase,'FENCING');
  assert.equal(s.epoch,5);
  assert.equal(s.version,2);
  assert.equal(s.withdrawalId,'withdraw1');
  denied(()=>authorizePrivateOutputForReview());
}));

test('R1025: corrupt persisted phase fails closed for inspections and admissions',async()=>fixture(async p=>{
  const db=new DatabaseSync(p);
  try {db.prepare('UPDATE scope SET phase=? WHERE singleton=1').run('UNKNOWN');}
  finally {db.close();}
  denied(()=>inspectReviewStore(p));
  denied(()=>reserveReviewAttempt(p,admission('new1'),1));
  denied(()=>withdrawReviewScope(p,withdrawal(),1));
  denied(()=>authorizePrivateOutputForReview());
}));

test('R1025: injected mismatched attempt row fails closed before any CAS mutation',async()=>fixture(async p=>{
  const db=new DatabaseSync(p);
  try {db.prepare('INSERT INTO attempts(attempt_id,epoch,object_path,bucket,state) VALUES(?,?,?,?,?)')
    .run('stolen1',4,'tenants/other/life-movies/p1/attempt-stolen1/life-movie.mp4','b1','RESERVED');}
  finally {db.close();}
  denied(()=>inspectReviewStore(p));
  denied(()=>reserveReviewAttempt(p,admission('legitimate1'),1));
  denied(()=>withdrawReviewScope(p,withdrawal(),1));
  denied(()=>acknowledgeDeletionForReview());
}));
