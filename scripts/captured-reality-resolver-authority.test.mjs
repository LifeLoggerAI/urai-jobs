import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createResolver, firestoreReconstructionAuthority, sha } = require(process.env.CR_RESOLVER_SOURCE || '../workers/captured-reality-worker/private-media-resolver.js');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'urai-resolver-authority-'));
  const body = { jobId: 'synthetic_job_01', sourceHandle: 'synthetic_handle_01', callbackTokenHash: 'a'.repeat(64), inputRef: 'synthetic_input_01' };
  const consents = ['memory.storage', 'location.context'].map(purpose => ({ purpose, policyVersion: 'synthetic-v1', decisionReceiptId: 'synthetic-'+purpose }));
  const entry = { jobId: body.jobId, sourceHandle: body.sourceHandle, sourceReceiptRef: 'synthetic_receipt_01', ownerUid: 'synthetic_owner_01',
    sourceRevision: 1, sourceSha256: 'b'.repeat(64), sourceByteLength: 1234, sourceFixityRef: 'private:synthetic/fixity',
    expiresAt: new Date(Date.now()+600000).toISOString(), acceptedInputs: [{ accepted: true, dynamicsPresent: false, maskRequired: false, inputRef: body.inputRef, frameProvenanceRef: 'synthetic_frame_01',
      path: 'input.png', mimeType: 'image/png', byteSize: 131072, sha256: sha(Buffer.alloc(131072, 3)) }] };
  const manifestPath = path.join(root, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ entries: [entry] }), { mode: 0o600 });
  await fs.writeFile(path.join(root,'input.png'), Buffer.alloc(131072,3), { mode: 0o600 });
  const records = new Map([['jobs/'+body.jobId, { type: 'memory.private-source.reconstruct-place', status: 'RUNNING', ownerUid: entry.ownerUid,
    payload: { sourceReceiptRefs: [entry.sourceReceiptRef] }, consents, execution: { callbackTokenHash: body.callbackTokenHash, leaseToken: 'synthetic_lease',
      callbackLeaseToken: 'synthetic_lease', asyncCallbackPending: true, callbackDeadlineAt: { toMillis: () => Date.now()+600000 } } }],
  ['uraiPrivateSourceReceipts/'+sha(Buffer.from(entry.sourceReceiptRef)), { ...entry, schemaVersion: 'urai-private-source-receipt-v2', status: 'ACTIVE', synthetic: false,
    consents, purposes: ['reconstruct-place'] }]]);
  let account = { uid: entry.ownerUid, disabled: false, metadata: { creationTime: 'synthetic-created' } }, afterRead, accountCalls = 0;
  const db = { collection: name => ({ doc: id => ({ path: name+'/'+id }) }), runTransaction: fn => fn({ get: async ref => {
    const value = records.get(ref.path); afterRead?.(ref); return { exists: value !== undefined, data: () => value }; } }) };
  const policy = firestoreReconstructionAuthority(db,manifestPath,{ getOwner: async () => { accountCalls++; return account; } });
  const resolver = createResolver({manifestPath, sourceRoot: root, token: 'synthetic-token', local: true, validateAuthority: policy});
  return { root, body, entry, records, policy, resolver, manifestPath, setAccount: value => { account = value; },
    setAfterRead: fn => { afterRead = fn; }, getAccountCalls: () => accountCalls,
    cleanup: async () => { resolver.server.closeAllConnections(); await new Promise(done=>resolver.server.listening?resolver.server.close(done):done()); await fs.rm(root,{recursive:true,force:true}); } };
}
const request = f => ({ jobId:f.body.jobId, sourceHandles:[f.body.sourceHandle], callbackTokenHash:f.body.callbackTokenHash });

test('current source owner, revision, fixity and exact dual consent are admitted', async () => {
  const f=await fixture(); try { assert.equal((await f.policy(request(f))).authorized,true); assert.equal((await f.resolver.redeem(f.body)).bytes.length,131072); } finally { await f.cleanup(); }
});
for (const [label, mutate, code] of [
  ['deleted owner', f=>f.records.set('uraiPrivateLifeModelOwnerFences/'+sha(Buffer.from(f.entry.ownerUid)),{ ownerHash:sha(Buffer.from(f.entry.ownerUid)),deleted:true,deletionEpoch:1 }), /DELETED/],
  ['malformed owner fence', f=>f.records.set('uraiPrivateLifeModelOwnerFences/'+sha(Buffer.from(f.entry.ownerUid)),{deleted:false}), /DELETED/],
  ['canonical deletion in progress', f=>f.records.set('privacyDeletionTombstones/'+f.entry.ownerUid,{uid:f.entry.ownerUid,active:true}), /DELETED/],
  ['deletion planning lease', f=>f.records.set('privacyDeletionTombstones/'+f.entry.ownerUid,{uid:f.entry.ownerUid,active:false,deletionPlanningLeaseToken:'synthetic'}), /DELETED/],
  ['removed source', f=>f.records.delete('uraiPrivateSourceReceipts/'+sha(Buffer.from(f.entry.sourceReceiptRef))), /REVISION_OR_GRANT/],
  ['changed source revision', f=>f.records.get('uraiPrivateSourceReceipts/'+sha(Buffer.from(f.entry.sourceReceiptRef))).sourceRevision++, /REVISION_OR_GRANT/],
  ['changed source bytes', f=>f.records.get('uraiPrivateSourceReceipts/'+sha(Buffer.from(f.entry.sourceReceiptRef))).sourceSha256='f'.repeat(64), /REVISION_OR_GRANT/],
  ['withdrawn source', f=>f.records.get('uraiPrivateSourceReceipts/'+sha(Buffer.from(f.entry.sourceReceiptRef))).status='WITHDRAWN', /REVISION_OR_GRANT/],
  ['foreign source owner', f=>f.records.get('uraiPrivateSourceReceipts/'+sha(Buffer.from(f.entry.sourceReceiptRef))).ownerUid='synthetic_foreign', /REVISION_OR_GRANT/],
  ['mismatched consent decision', f=>f.records.get('uraiPrivateSourceReceipts/'+sha(Buffer.from(f.entry.sourceReceiptRef))).consents=[{purpose:'memory.storage',policyVersion:'old',decisionReceiptId:'old'}], /REVISION_OR_GRANT/],
  ['malformed consent block', f=>f.records.set('jobConsentBlocks/'+sha(Buffer.from(f.entry.ownerUid+'\nmemory.storage')),{active:false}), /REVOKED/],
  ['revoked accepted derivative', f=>f.records.get('jobs/'+f.body.jobId).derivativeAccessState='REVOKED_CONSENT', /OWNER_OR_JOB/],
  ['disabled account', f=>f.setAccount({uid:f.entry.ownerUid,disabled:true,metadata:{creationTime:'synthetic-created'}}), /ACCOUNT/],
  ['foreign current account', f=>f.setAccount({uid:'synthetic_foreign',disabled:false,metadata:{creationTime:'synthetic-created'}}), /ACCOUNT/],
]) test(label+' denies actual resolver redemption before bytes',async()=>{const f=await fixture();try{mutate(f);await assert.rejects(f.resolver.redeem(f.body),code);}finally{await f.cleanup();}});

test('account disabled after transactional reads is denied',async()=>{const f=await fixture();try{f.setAfterRead(()=>f.setAccount({uid:f.entry.ownerUid,disabled:true,metadata:{creationTime:'synthetic-created'}}));await assert.rejects(f.policy(request(f)),/ACCOUNT_CHANGED/);}finally{await f.cleanup();}});
test('source manifest changed during admission is denied',async()=>{const f=await fixture();try{
  let altered=false; const service=createResolver({manifestPath:f.manifestPath,sourceRoot:f.root,validateAuthority:async body=>{const out=await f.policy(body);if(!altered){altered=true;f.entry.acceptedInputs[0].frameProvenanceRef='synthetic_foreign_frame';await fs.writeFile(f.manifestPath,JSON.stringify({entries:[f.entry]}));}return out;}});
  await assert.rejects(service.redeem(f.body),/MANIFEST_CHANGED/);
}finally{await f.cleanup();}});
test('HTTP source delivery stops when deletion begins after its first 64 KiB',async()=>{const f=await fixture();try{
  let checks=0; const service=createResolver({manifestPath:f.manifestPath,sourceRoot:f.root,token:'synthetic-token',local:true,validateAuthority:async body=>{
    checks++;if(checks===4)f.records.set('privacyDeletionTombstones/'+f.entry.ownerUid,{uid:f.entry.ownerUid,active:true});return f.policy(body);}});
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
  try{const response=await fetch(`http://127.0.0.1:${service.server.address().port}/redeem`,{method:'POST',headers:{authorization:'Bearer synthetic-token'},body:JSON.stringify(f.body)});
    assert.equal(response.status,200); const reader=response.body.getReader();let length=0,interrupted=false;try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;}}catch{interrupted=true;}assert.equal(interrupted,true);assert.ok(length<=65536);
  }finally{service.server.closeAllConnections();await new Promise(done=>service.server.close(done));}
}finally{await f.cleanup();}});
test('HTTP anonymous source access is denied',async()=>{const f=await fixture();try{f.resolver.server.listen(0,'127.0.0.1');await once(f.resolver.server,'listening');const response=await fetch(`http://127.0.0.1:${f.resolver.server.address().port}/redeem`,{method:'POST',body:JSON.stringify(f.body)});assert.equal(response.status,401);}finally{await f.cleanup();}});

async function bindMask(f) {
  const bytes=Buffer.alloc(64,7), input=f.entry.acceptedInputs[0];
  input.dynamicsPresent=true;input.maskRequired=true;
  input.mask={accepted:true,inputRef:'synthetic_mask_01',frameSha256:input.sha256,frameProvenanceRef:input.frameProvenanceRef,
    maskProvenanceRef:'synthetic_mask_provenance_01',path:'mask.png',sha256:sha(bytes),byteSize:bytes.length,mimeType:'image/png'};
  await fs.writeFile(path.join(f.root,'mask.png'),bytes,{mode:0o600});
  await fs.writeFile(f.manifestPath,JSON.stringify({entries:[f.entry]}));
  return bytes;
}
test('source-bound masks preserve private-path redaction and exact byte redemption',async()=>{const f=await fixture();try{
  const expected=await bindMask(f),envelope=await f.resolver.resolve(f.body), mask=envelope.acceptedInputs[0].mask;
  assert.equal(envelope.acceptedInputs[0].dynamicsPresent,true);assert.equal(mask.path,undefined);assert.equal(mask.accepted,true);
  const out=await f.resolver.redeem({...f.body,maskInputRef:mask.inputRef},true);assert.deepEqual(out.bytes,expected);
}finally{await f.cleanup();}});
for(const [label,mutate] of [['UNKNOWN dynamic classification',input=>delete input.dynamicsPresent],['required missing mask',input=>{input.dynamicsPresent=true}],['mask frame hash mismatch',input=>{input.mask.frameSha256='f'.repeat(64)}],['mask frame provenance mismatch',input=>{input.mask.frameProvenanceRef='synthetic_foreign_provenance'}]])
  test(label+' fails before source or mask delivery',async()=>{const f=await fixture();try{if(label.startsWith('mask'))await bindMask(f);mutate(f.entry.acceptedInputs[0]);await fs.writeFile(f.manifestPath,JSON.stringify({entries:[f.entry]}));await assert.rejects(f.resolver.resolve(f.body));}finally{await f.cleanup();}});
test('mask redemption honors the same current source revision and owner deletion fence',async()=>{const f=await fixture();try{await bindMask(f);f.records.set('privacyDeletionTombstones/'+f.entry.ownerUid,{uid:f.entry.ownerUid,active:true});await assert.rejects(f.resolver.redeem({...f.body,maskInputRef:'synthetic_mask_01'},true),/DELETED/);}finally{await f.cleanup();}});
