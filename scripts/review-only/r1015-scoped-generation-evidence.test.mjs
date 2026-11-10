import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPrivateWriteRequest, DENIED } from './r1001-private-output-broker-contract.mjs';
import { inspectScopedGenerationEvidence } from './r1015-scoped-generation-evidence.mjs';
const H = 'a'.repeat(64), J = 'b'.repeat(64);
const path = 'tenants/tenant1/life-movies/project1/attempt-attempt1/life-movie.mp4';
const request = () => ({ ownerUid:'owner1',tenantId:'tenant1',projectId:'project1',purpose:'life-movie.render',epoch:4,
  attemptId:'attempt1',bucket:'owner-private-bucket',objectPath:path,fileKind:'life-movie.mp4',sourceSetDigest:H,renderPlanDigest:J });
const policy = () => ({ ownerUid:'owner1',tenantId:'tenant1',projectId:'project1',purpose:'life-movie.render',epoch:4,
  phase:'OPEN',bucket:'owner-private-bucket',acceptedSourceSetDigest:H,acceptedRenderPlanDigest:J });
const evidence = () => ({ attemptId:'attempt1',epoch:4,objectPath:path,generation:'123',bytesCommitted:true,writerDrained:true });
function expectDeny(mutate) {
  const p = policy(), a = { ...inspectPrivateWriteRequest(request(), p) }, e = evidence();
  mutate(p,a,e);
  assert.throws(() => inspectScopedGenerationEvidence(e,p,a),{message:DENIED});
}
test('canonical evidence is scoped but cannot grant cloud, write, deletion or release authority', () => {
  const p=policy(), a=inspectPrivateWriteRequest(request(),p);
  const result=inspectScopedGenerationEvidence(evidence(),p,a);
  assert.equal(result.objectPath,path);
  assert.equal(result.ownerUid,'owner1');
  assert.equal(result.verifiedByCloud,false);
  assert.equal(result.storageWriteAuthorized,false);
  assert.equal(result.deletionAcknowledged,false);
  assert.equal(result.reviewOnly,true);
  assert.ok(Object.isFrozen(result));
});
test('FENCING allows same-epoch review only, not historical upload drain certification', () => {
  const p=policy(),a=inspectPrivateWriteRequest(request(),p);
  p.phase='FENCING';
  assert.equal(inspectScopedGenerationEvidence(evidence(),p,a).storageWriteAuthorized,false);
});
test('REVOKED cannot be treated as a fresh reconciliation input',()=>expectDeny(p=>p.phase='REVOKED'));
test('missing policy denied',()=>assert.throws(()=>inspectScopedGenerationEvidence(evidence(),null,{}),{message:DENIED}));
test('different tenant denied',()=>expectDeny(p=>p.tenantId='tenant2'));
test('different project denied',()=>expectDeny(p=>p.projectId='project2'));
test('different owner denied',()=>expectDeny(p=>p.ownerUid='owner2'));
test('different bucket denied',()=>expectDeny(p=>p.bucket='alternate-bucket'));
test('different policy purpose denied',()=>expectDeny(p=>p.purpose='admin'));
test('different source digest denied',()=>expectDeny(p=>p.acceptedSourceSetDigest=J));
test('different render plan digest denied',()=>expectDeny(p=>p.acceptedRenderPlanDigest=H));
test('different policy epoch denied',()=>expectDeny(p=>p.epoch=5));
test('stale evidence epoch denied',()=>expectDeny((p,a,e)=>e.epoch=3));
test('future evidence epoch denied',()=>expectDeny((p,a,e)=>e.epoch=5));
test('other attempt denied',()=>expectDeny((p,a,e)=>e.attemptId='attempt2'));
test('other canonical tenant path denied',()=>expectDeny((p,a,e)=>e.objectPath=e.objectPath.replace('tenant1','tenant2')));
test('other canonical project path denied',()=>expectDeny((p,a,e)=>e.objectPath=e.objectPath.replace('project1','project2')));
test('other canonical attempt path denied',()=>expectDeny((p,a,e)=>e.objectPath=e.objectPath.replace('attempt-attempt1','attempt-attempt2')));
test('unknown output kind denied',()=>expectDeny((p,a,e)=>e.objectPath=e.objectPath.replace('life-movie.mp4','secrets.json')));
test('unrecognized admission field denied',()=>expectDeny((p,a)=>a.cloudVerified=true));
test('unrecognized policy field denied',()=>expectDeny(p=>p.cloudApproved=true));
test('forged admission flags denied',()=>expectDeny((p,a)=>a.storageWriteAuthorized=true));
test('forged deletion claim denied',()=>expectDeny((p,a)=>a.deletionAcknowledged=true));
test('unsettled stream denied',()=>expectDeny((p,a,e)=>e.writerDrained=false));
test('uncommitted bytes denied',()=>expectDeny((p,a,e)=>e.bytesCommitted=false));
test('unexpected generation field denied',()=>expectDeny((p,a,e)=>e.verifiedByCloud=true));
test('missing admission field denied',()=>expectDeny((p,a)=>delete a.bucket));
test('invalid generation denied',()=>expectDeny((p,a,e)=>e.generation='0'));
test('unknown path outside prefix denied',()=>expectDeny((p,a,e)=>e.objectPath='other/path/life-movie.mp4'));

test('historical attempt requires separate durable drain path, never silently accepted', () => {
  const p=policy(), a=inspectPrivateWriteRequest(request(),p), e=evidence();
  p.phase='FENCING'; p.epoch=5;
  assert.throws(()=>inspectScopedGenerationEvidence(e,p,a),{message:DENIED});
});
test('all three canonical output kinds support matching scoped review evidence', () => {
  for (const kind of ['life-movie.mp4','life-movie.srt','life-movie.render-manifest.json']) {
    const p=policy(), req=request(), e=evidence();
    req.fileKind=kind; req.objectPath=path.replace('life-movie.mp4',kind); e.objectPath=req.objectPath;
    const a=inspectPrivateWriteRequest(req,p);
    const result=inspectScopedGenerationEvidence(e,p,a);
    assert.equal(result.storageWriteAuthorized,false);
    assert.equal(result.objectPath,req.objectPath);
  }
});
