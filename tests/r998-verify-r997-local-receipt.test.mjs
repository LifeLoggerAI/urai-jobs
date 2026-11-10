import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {audit, ReceiptRejected} from '../scripts/r998-verify-r997-local-receipt.mjs';
const SHA='1'.repeat(40), TREE='2'.repeat(40);
function fixture() {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r998-'));
 const d=path.join(root,'receipt');fs.mkdirSync(d);
 const log='MOCK_NATIVE_TEST_RAN\n';
 fs.writeFileSync(path.join(d,'native.log'),log);
 const j={schema:'R997_NATIVE_VERIFY_V1',evidence_class:'LOCAL_SCRIPT_EXECUTION_NOT_PROTECTED_CI',source_sha:SHA,tree_sha:TREE,start_utc:'2026-11-10T07:00:00Z',end_utc:'2026-11-10T07:00:04Z',duration_seconds:4,exit_code:0,status:'PASSED',log_sha256:createHash('sha256').update(log).digest('hex')};
 function save(){fs.writeFileSync(path.join(d,'receipt.json'),JSON.stringify(j)+'\n');}
 fs.writeFileSync(path.join(d,'metadata.log'),`R997_ATTEMPT_CREATED sha=${SHA} tree=${TREE} started=${j.start_utc}\n`);save();
 return {root,d,j,save,dispose(){fs.rmSync(root,{recursive:true,force:true})}};
}
function caseWith(name,fn){test(name,()=>{const f=fixture();try{fn(f)}finally{f.dispose()}})}
caseWith('zero from fake pnpm is integrity-checked but never certified',f=>{
 const a=audit(f.d,SHA,TREE);assert.equal(a.classification,'LOCAL_COMMAND_EXIT_ZERO_UNVERIFIED');
 for(const k of ['verified_provider_identity','protected_ci_certified','authenticated_lifecycle_certified','release_authorized'])assert.equal(a[k],false);
 assert.equal(a.internal_receipt_consistency_verified,true);
});
caseWith('nonzero native command becomes unverified local failure',f=>{f.j.status='FAILED';f.j.exit_code=12;f.save();assert.equal(audit(f.d,SHA,TREE).classification,'LOCAL_COMMAND_FAILED')});
caseWith('tool missing receives distinct classification',f=>{f.j.status='NATIVE_TOOL_MISSING';f.j.exit_code=127;f.save();assert.equal(audit(f.d,SHA,TREE).classification,'LOCAL_TOOL_MISSING')});
caseWith('time out receives distinct classification',f=>{f.j.status='TIMEOUT_OR_KILLED';f.j.exit_code=124;f.save();assert.equal(audit(f.d,SHA,TREE).classification,'LOCAL_COMMAND_TIMED_OUT_OR_KILLED')});
caseWith('reject wrong SHA pin',f=>assert.throws(()=>audit(f.d,'3'.repeat(40),TREE),ReceiptRejected));
caseWith('reject wrong tree pin',f=>assert.throws(()=>audit(f.d,SHA,'3'.repeat(40)),ReceiptRejected));
caseWith('reject truncated or modified native log',f=>{fs.appendFileSync(path.join(f.d,'native.log'),'tamper');assert.throws(()=>audit(f.d,SHA,TREE),/log digest/)});
caseWith('reject forged success with nonzero exit',f=>{f.j.exit_code=12;f.save();assert.throws(()=>audit(f.d,SHA,TREE),/false PASSED/)});
caseWith('reject wrong status for zero exit',f=>{f.j.status='FAILED';f.save();assert.throws(()=>audit(f.d,SHA,TREE),/zero falsely/)});
caseWith('reject malformed receipt JSON',f=>{fs.writeFileSync(path.join(f.d,'receipt.json'),'{');assert.throws(()=>audit(f.d,SHA,TREE),/invalid JSON/)});
caseWith('reject modified metadata source pin',f=>{fs.writeFileSync(path.join(f.d,'metadata.log'),'forged');assert.throws(()=>audit(f.d,SHA,TREE),/metadata/)});
caseWith('reject symlinked log',f=>{fs.unlinkSync(path.join(f.d,'native.log'));fs.symlinkSync('/etc/hosts',path.join(f.d,'native.log'));assert.throws(()=>audit(f.d,SHA,TREE),/symlink/)});
caseWith('reject symlinked directory',f=>{const alias=path.join(f.root,'alias');fs.symlinkSync(f.d,alias);assert.throws(()=>audit(alias,SHA,TREE),/symlink/)});
caseWith('reject inconsistent duration',f=>{f.j.duration_seconds=100;f.save();assert.throws(()=>audit(f.d,SHA,TREE),/duration inconsistent/)});
caseWith('reject malformed evidence class',f=>{f.j.evidence_class='PROTECTED_CI';f.save();assert.throws(()=>audit(f.d,SHA,TREE),/evidence class/)});
caseWith('reject time reversal',f=>{f.j.end_utc='2026-11-10T06:59:59Z';f.save();assert.throws(()=>audit(f.d,SHA,TREE),/time reversal/)});
caseWith('reject missing receipt file',f=>{fs.unlinkSync(path.join(f.d,'receipt.json'));assert.throws(()=>audit(f.d,SHA,TREE),/missing receipt.json/)});
caseWith('reject unsupported exit statuses',f=>{f.j.status='TIMEOUT_OR_KILLED';f.j.exit_code=13;f.save();assert.throws(()=>audit(f.d,SHA,TREE),/time-out code mismatch/)});


function modern(f) {
 f.j.schema='R1000_NATIVE_VERIFY_V1';
 for(const [file,key] of [['install.log','install_log_sha256'],['toolchain.log','toolchain_log_sha256']]) {
  fs.writeFileSync(path.join(f.d,file),'mock '+file+'\n');
  f.j[key]=createHash('sha256').update(fs.readFileSync(path.join(f.d,file))).digest('hex');
 }
 f.save();
}
caseWith('R1000 success verifies all three logs without certification',f=>{modern(f); const a=audit(f.d,SHA,TREE);assert.equal(a.classification,'LOCAL_COMMAND_EXIT_ZERO_UNVERIFIED');assert.equal(a.release_authorized,false)});
for(const file of ['install.log','toolchain.log']) {
 caseWith('R1000 rejects altered '+file,f=>{modern(f);fs.appendFileSync(path.join(f.d,file),'tamper');assert.throws(()=>audit(f.d,SHA,TREE),/digest/)});
 caseWith('R1000 rejects missing '+file,f=>{modern(f);fs.unlinkSync(path.join(f.d,file));assert.throws(()=>audit(f.d,SHA,TREE),/missing/)});
 caseWith('R1000 rejects symlink '+file,f=>{modern(f);fs.unlinkSync(path.join(f.d,file));fs.symlinkSync('/etc/hosts',path.join(f.d,file));assert.throws(()=>audit(f.d,SHA,TREE),/symlink/)});
}
for(const [status,code] of [['PRECHECK_FAILED',125],['INSTALL_FAILED',17],['INSTALL_TIMEOUT_OR_KILLED',124],['SOURCE_MUTATED_AFTER_INSTALL',126]]) {
 caseWith('R1000 classifies '+status,f=>{modern(f);f.j.status=status;f.j.exit_code=code;f.save();assert.equal(audit(f.d,SHA,TREE).original_local_status,status)});
 caseWith('R1000 refuses wrong code for '+status,f=>{modern(f);f.j.status=status;f.j.exit_code=43; if(status==='INSTALL_FAILED')f.j.exit_code=124;f.save();assert.throws(()=>audit(f.d,SHA,TREE),/code mismatch/)});
}
caseWith('legacy schema cannot smuggle R1000 statuses',f=>{f.j.status='PRECHECK_FAILED';f.j.exit_code=125;f.save();assert.throws(()=>audit(f.d,SHA,TREE),/unknown local status/)});
