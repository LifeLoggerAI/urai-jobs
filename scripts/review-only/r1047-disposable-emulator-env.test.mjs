import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDisposableEmulatorEnvironment, R1047_DENIED, SECRET_KEYS} from './r1047-disposable-emulator-env.mjs';
const base=()=>({URAI_EMULATOR_PROJECT:'urai-staging-test',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'});
test('safe disposable scope has no production authority',()=>{
 const x=assertDisposableEmulatorEnvironment(base());
 assert.equal(x.disposableOnly,true);assert.equal(x.productionAuthorized,false);assert.equal(x.releaseApproved,false);
});
test('every enumerated provider credential is rejected without printing its value',()=>{
 for(const key of SECRET_KEYS){
  const marker='SYNTHETIC_R1047_SHOULD_NOT_LOG_'+key;
  assert.throws(()=>assertDisposableEmulatorEnvironment({...base(),[key]:marker}), e=>{
   assert.match(e.message,new RegExp(R1047_DENIED));assert.match(e.message,new RegExp(key));
   assert.equal(e.message.includes(marker),false);return true;
  });
 }
});
test('unknown provider token aliases fail closed',()=>{
 for(const key of ['NEW_VENDOR_API_KEY','CUSTOM_SESSION_TOKEN','WORKER_PRIVATE_KEY','ALT_PASSWORD','EXTERNAL_CREDENTIAL']) {
  const marker='SYNTHETIC_R1047_UNKNOWN_VALUE';
  assert.throws(()=>assertDisposableEmulatorEnvironment({...base(),[key]:marker}),e=>{
   assert.equal(e.message.includes(marker),false);return e.message.startsWith(R1047_DENIED);
  });
 }
});
test('project, host and conflicting cloud identity fail before SDK starts',()=>{
 const bad=[{URAI_EMULATOR_PROJECT:'urai-4dc1d'},{FIRESTORE_EMULATOR_HOST:'evil.example.com:8080'},{FIREBASE_STORAGE_EMULATOR_HOST:'localhost:9199'},{GOOGLE_CLOUD_PROJECT:'urai-4dc1d'},{GCLOUD_PROJECT:'different-project'}];
 for(const variant of bad)assert.throws(()=>assertDisposableEmulatorEnvironment({...base(),...variant}),new RegExp(R1047_DENIED));
});
test('safe emulator project env aliases allowed, but not production project',()=>{
 const x=assertDisposableEmulatorEnvironment({...base(),GCLOUD_PROJECT:'urai-staging-test',GOOGLE_CLOUD_PROJECT:'urai-staging-test'});
 assert.equal(x.releaseApproved,false);
});
test('Node preload and inspection flags are rejected in disposable runner',()=>{
 for(const NODE_OPTIONS of ['--require=evil.js','--import evil.mjs','--inspect=0.0.0.0:9229','--eval console.log(1)','--experimental-loader=evil.mjs'])
  assert.throws(()=>assertDisposableEmulatorEnvironment({...base(),NODE_OPTIONS}),new RegExp(R1047_DENIED));
});
test('non-environment objects and incomplete safety scope fail closed',()=>{
 for(const value of [null,undefined,[],{},'token'])assert.throws(()=>assertDisposableEmulatorEnvironment(value),new RegExp(R1047_DENIED));
});
