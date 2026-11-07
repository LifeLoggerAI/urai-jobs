import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { assertDisposableLegacyWriter, refuseLegacyManualQueueDrain } from './legacy-admin-writer-gate.mjs';

const base = { URAI_LEGACY_WRITER_SCOPE:'DISPOSABLE_FIRESTORE_EMULATOR_ONLY', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080', FIREBASE_PROJECT_ID:'demo-urai-jobs' };
const fail = (env) => assert.throws(() => assertDisposableLegacyWriter(env), /URAI_LEGACY_WRITER_HOLD/);

test('R887 valid isolated demo emulator admits test-only legacy job commands', () => {
  assert.deepEqual(assertDisposableLegacyWriter(base), {projectId:'demo-urai-jobs',firestoreHost:'127.0.0.1:8080'});
});
test('R887 localhost and IPv6 loopback are allowed for disposable emulators', () => {
  for(const host of ['localhost:9090','[::1]:8080']) {
    assert.equal(assertDisposableLegacyWriter({...base,FIRESTORE_EMULATOR_HOST:host}).firestoreHost,host);
  }
});
test('R887 explicit scope required even with emulator configured', () => fail({...base,URAI_LEGACY_WRITER_SCOPE:undefined}));
test('R887 arbitrary opt-in token denied', () => fail({...base,URAI_LEGACY_WRITER_SCOPE:'true'}));
test('R887 no emulator endpoint denied', () => fail({...base,FIRESTORE_EMULATOR_HOST:undefined}));
test('R887 network emulator endpoint denied', () => fail({...base,FIRESTORE_EMULATOR_HOST:'10.2.3.4:8080'}));
test('R887 DNS/host suffix trick denied', () => fail({...base,FIRESTORE_EMULATOR_HOST:'localhost.evil.com:8080'}));
test('R887 loopback URL syntax denied', () => fail({...base,FIRESTORE_EMULATOR_HOST:'http://localhost:8080'}));
test('R887 zero/oversize/invalid emulator port denied', () => {
  for(const port of ['0','65536','abc','999999']) fail({...base,FIRESTORE_EMULATOR_HOST:'localhost:'+port});
});
test('R887 empty or actual production project denied', () => {
  for(const project of [undefined,'urai-4dc1d','urai-jobs','demo-','demo-URAI']) fail({...base,FIREBASE_PROJECT_ID:project});
});
test('R887 conflicting project variables denied', () => fail({...base,GCLOUD_PROJECT:'demo-other'}));
test('R887 identical declared demo project variables pass', () => {
  assert.equal(assertDisposableLegacyWriter({...base,GCLOUD_PROJECT:'demo-urai-jobs',GOOGLE_CLOUD_PROJECT:'demo-urai-jobs'}).projectId,'demo-urai-jobs');
});
test('R887 cloud credential hints rejected', () => {
  for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_CONFIG','GOOGLE_CLOUD_BUCKET','FIREBASE_STORAGE_BUCKET','GOOGLE_CLOUD_QUOTA_PROJECT']) fail({...base,[key]:'some-resource'});
});
test('R887 queue drain is unconditionally blocked, including emulator', () => {
  assert.throws(refuseLegacyManualQueueDrain,/URAI_LEGACY_WRITER_HOLD.*raw Admin SDK/);
});
for(const script of ['queue-job.mjs','requeue-dead.mjs','reclaim-stale-leases.mjs','admin-process-queue-now.mjs','run-worker.mjs']) {
  test('R887 '+script+' refuses default execution before SDK import or cloud writes', () => {
    const result=spawnSync(process.execPath,[new URL(script,import.meta.url).pathname],{
      encoding:'utf8',timeout:3000,
      env:{ PATH:process.env.PATH, HOME:process.env.HOME, FIREBASE_PROJECT_ID:'urai-4dc1d' },
    });
    assert.notEqual(result.status,0,script+' should refuse');
    assert.match(result.stderr,/URAI_LEGACY_WRITER_HOLD/,script+' must deny before loading external SDK');
  });
}
