/**
 * R521 REVIEW-ONLY, EXECUTABLE REFERENCE MODEL -- NOT A STORAGE BROKER.
 * No Firebase, IAM, media, credentials, network or production integration.
 * These assertions describe required race semantics; passing does NOT
 * establish that deployed workers, GCS or real identities enforce them.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const valid = (s) => typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(s);
const error = (code) => { throw new Error(code); };
const objectKey = (bucket, path) => `${bucket}\n${path}`;

class ReferenceBroker {
  #scopes = new Map();
  #attempts = new Map();
  #objects = new Map();
  #serial = 0;
  #projectOwner = new Map();
  #trustedPrincipal = Symbol('test-only trusted broker identity');
  constructor({ buckets = ['private-one', 'private-two'], exclusiveWriter = true } = {}) {
    this.buckets = new Set(buckets);
    this.exclusiveWriter = exclusiveWriter;
    this.inventoryReadable = true;
  }
  get simulatedBrokerIdentity() { return this.#trustedPrincipal; }
  scope(owner, tenant, project) {
    if (![owner, tenant, project].every(valid)) error('bad_scope');
    const tenantProject = `${tenant}\n${project}`;
    const ownerOfProject = this.#projectOwner.get(tenantProject);
    if (ownerOfProject && ownerOfProject !== owner) error('owner_project_collision');
    this.#projectOwner.set(tenantProject, owner);
    const key = `${owner}\n${tenant}\n${project}\nlife-movie.render`;
    if (!this.#scopes.has(key)) this.#scopes.set(key, {
      owner, tenant, project, epoch: 7, phase: 'OPEN', attempts: new Set(),
    });
    return key;
  }
  #state(scope) { const s = this.#scopes.get(scope); if (!s) error('unknown_scope'); return s; }
  #attempt(id) { const a = this.#attempts.get(id); if (!a) error('unknown_attempt'); return a; }
  reserve({ scope, principal, bucket, path, expectedEpoch }) {
    const s = this.#state(scope);
    if (principal !== this.#trustedPrincipal) error('unsigned_or_wrong_service_identity');
    if (!this.exclusiveWriter) error('storage_exclusivity_unproved');
    if (s.phase !== 'OPEN' || s.epoch !== expectedEpoch) error('fenced_or_stale_epoch');
    const segments = typeof path === 'string' ? path.split('/') : [];
    if (!this.buckets.has(bucket) || typeof path !== 'string' ||
        !path.startsWith(`tenants/${s.tenant}/life-movies/${s.project}/`) ||
        segments.some((seg) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(seg) || seg === '.' || seg === '..')) {
      error('out_of_scope_storage_target');
    }
    if ([...s.attempts].some((id) => {
      const a = this.#attempts.get(id);
      return a.bucket === bucket && a.path === path &&
        !['ABORTED_WITH_STREAM_CLOSED', 'DELETED_GENERATION_PROVED'].includes(a.status);
    })) error('duplicate_live_object_path');
    const id = `attempt-${++this.#serial}`;
    this.#attempts.set(id, { id, scope, epoch: s.epoch, bucket, path, status: 'RESERVED', generation: null });
    s.attempts.add(id);
    return id;
  }
  begin(id) {
    const a = this.#attempt(id), s = this.#state(a.scope);
    if (a.status !== 'RESERVED' || s.phase !== 'OPEN' || a.epoch !== s.epoch) error('cannot_begin');
    a.status = 'STREAMING';
  }
  // Simulates bytes completing an already-admitted stream. It deliberately
  // allows a raced upload to appear during FENCING, so ACK must drain it.
  completeBytes(id, generation) {
    const a = this.#attempt(id);
    if (a.status !== 'STREAMING' || typeof generation !== 'string' ||
        !/^[1-9][0-9]{0,19}$/.test(generation) ||
        !Number.isSafeInteger(Number(generation))) error('invalid_upload');
    this.#objects.set(objectKey(a.bucket, a.path), { generation, attempt: id });
    a.generation = generation;
    a.status = 'STORED_UNPUBLISHED';
  }
  publish(id) {
    const a = this.#attempt(id), s = this.#state(a.scope);
    const stored = this.#objects.get(objectKey(a.bucket, a.path));
    if (s.phase !== 'OPEN' || s.epoch !== a.epoch ||
        a.status !== 'STORED_UNPUBLISHED' || stored?.generation !== a.generation) {
      error('output_finalization_fenced');
    }
    a.status = 'PUBLISHED';
  }
  withdraw(scope) {
    const s = this.#state(scope);
    if (s.phase === 'OPEN') { s.phase = 'FENCING'; s.epoch += 1; }
    return { phase: s.phase, epoch: s.epoch };
  }
  closeWithoutBytes(id) {
    const a = this.#attempt(id);
    if (!['RESERVED', 'STREAMING'].includes(a.status)) error('requires_generation_reconciliation');
    a.status = 'ABORTED_WITH_STREAM_CLOSED';
  }
  reconcileGeneration(id) {
    const a = this.#attempt(id), s = this.#state(a.scope);
    if (s.phase !== 'FENCING' || !['STORED_UNPUBLISHED', 'PUBLISHED'].includes(a.status)) error('bad_reconcile');
    const key = objectKey(a.bucket, a.path), current = this.#objects.get(key);
    if (!a.generation || !current || current.generation !== a.generation) error('generation_changed_or_absence_unproved');
    this.#objects.delete(key); // reference model for exact-generation delete
    a.status = 'DELETED_GENERATION_PROVED';
  }
  injectUnattributed(scope, bucket, path, generation) {
    const s = this.#state(scope);
    if (!this.buckets.has(bucket) || !path.startsWith(`tenants/${s.tenant}/life-movies/${s.project}/`)) error('invalid_orphan');
    this.#objects.set(objectKey(bucket, path), { generation, attempt: null });
  }
  replaceForRace(id, generation) {
    const a = this.#attempt(id);
    this.#objects.set(objectKey(a.bucket, a.path), { generation, attempt: 'foreign' });
  }
  reconcileKnownOrphan(scope, bucket, path, generation) {
    const s = this.#state(scope), key = objectKey(bucket, path), current = this.#objects.get(key);
    if (s.phase !== 'FENCING' || !this.buckets.has(bucket) ||
        !path.startsWith(`tenants/${s.tenant}/life-movies/${s.project}/`) ||
        !current || current.generation !== generation) error('orphan_not_reconciled');
    this.#objects.delete(key);
  }
  acknowledge(scope) {
    const s = this.#state(scope);
    if (s.phase !== 'FENCING' || !this.exclusiveWriter || !this.inventoryReadable) error('revocation_ack_unavailable');
    for (const id of s.attempts) {
      if (!['ABORTED_WITH_STREAM_CLOSED', 'DELETED_GENERATION_PROVED'].includes(this.#attempt(id).status)) {
        error('active_or_unattributed_upload');
      }
    }
    for (const bucket of this.buckets) {
      for (const key of this.#objects.keys()) {
        if (key.startsWith(`${bucket}\ntenants/${s.tenant}/life-movies/${s.project}/`)) error('private_object_still_present');
      }
    }
    s.phase = 'REVOKED';
    return { revoked: true, epoch: s.epoch };
  }
  replayAllowed(scope, id) {
    const s = this.#state(scope), a = this.#attempt(id);
    return s.phase === 'OPEN' && s.epoch === a.epoch && a.status === 'PUBLISHED';
  }
  // A provider IAM denial must separately establish this in protected cloud;
  // this model intentionally cannot enforce credentials or real GCS requests.
  simulateDirectLegacyWriter() {
    if (this.exclusiveWriter) error('storage_iam_denies_legacy_writer_model_only');
  }
}
const setup = (params) => {
  const broker = new ReferenceBroker(params);
  const scope = broker.scope('ownerA', 'tenantA', 'movieA');
  const path = 'tenants/tenantA/life-movies/movieA/render/attempt.mp4';
  const reserve = (overrides={}) => broker.reserve({
    scope, principal: broker.simulatedBrokerIdentity, bucket:'private-one', path,
    expectedEpoch:7, ...overrides,
  });
  return { broker, scope, path, reserve };
};

test('R521: canonical scope and bucket path require exact tenant/project binding', () => {
  const { reserve, scope, broker, path }=setup();
  assert.throws(()=>reserve({path:path.replace('tenantA','tenantB')}),/out_of_scope_storage_target/);
  assert.throws(()=>reserve({bucket:'unlisted'}),/out_of_scope_storage_target/);
  assert.throws(()=>reserve({path:'tenants/tenantA/life-movies/movieA/../other.mp4'}),/out_of_scope_storage_target/);
  assert.throws(()=>broker.scope('bad/owner','tenantA','movieA'),/bad_scope/);
  assert.ok(scope);
});
test('R521: same tenant/project cannot silently bind a second owner', () => {
  const { broker }=setup();
  assert.throws(()=>broker.scope('ownerB','tenantA','movieA'),/owner_project_collision/);
});
test('R521: duplicate live destination cannot create colliding reservations', () => {
  const { reserve }=setup();reserve();
  assert.throws(()=>reserve(),/duplicate_live_object_path/);
});
test('R521: malformed generation cannot become a durable reservation result', () => {
  const { broker, reserve }=setup();const id=reserve();broker.begin(id);
  for(const generation of ['0','not-a-generation','9007199254740992']) {
    assert.throws(()=>broker.completeBytes(id,generation),/invalid_upload/);
  }
});
test('R521: forged principal and unproved storage exclusivity reject admission', () => {
  const { reserve }=setup();
  assert.throws(()=>reserve({principal:'broker'}),/unsigned_or_wrong_service_identity/);
  assert.throws(()=>setup({exclusiveWriter:false}).reserve(),/storage_exclusivity_unproved/);
});
test('R521: stale epoch denied even while open', () => {
  assert.throws(()=>setup().reserve({expectedEpoch:6}),/fenced_or_stale_epoch/);
});
test('R521: revoke blocks new reservations and preflight-only starts', () => {
  const { broker, scope, reserve }=setup();
  const id=reserve();
  assert.deepEqual(broker.withdraw(scope),{phase:'FENCING',epoch:8});
  assert.throws(()=>reserve(),/fenced_or_stale_epoch/);
  assert.throws(()=>broker.begin(id),/cannot_begin/);
  broker.closeWithoutBytes(id);
  assert.deepEqual(broker.acknowledge(scope),{revoked:true,epoch:8});
});
test('R521: preexisting stream may finish bytes, but cannot finalize after fencing', () => {
  const { broker, scope, reserve }=setup();const id=reserve();
  broker.begin(id);broker.withdraw(scope);
  broker.completeBytes(id,'101');
  assert.throws(()=>broker.publish(id),/output_finalization_fenced/);
  assert.throws(()=>broker.acknowledge(scope),/active_or_unattributed_upload/);
  broker.reconcileGeneration(id);
  assert.deepEqual(broker.acknowledge(scope),{revoked:true,epoch:8});
});
test('R521: local lease expiration cannot substitute for storage closure or generation deletion', () => {
  const { broker, scope, reserve }=setup();const id=reserve();broker.begin(id);broker.withdraw(scope);
  assert.throws(()=>broker.acknowledge(scope),/active_or_unattributed_upload/);
  assert.throws(()=>broker.reconcileGeneration(id),/bad_reconcile/);
  broker.closeWithoutBytes(id);
  assert.equal(broker.acknowledge(scope).revoked,true);
});
test('R521: generation replacement forbids ACK of recorded output', () => {
  const { broker, scope, reserve }=setup();const id=reserve();
  broker.begin(id);broker.completeBytes(id,'101');broker.withdraw(scope);
  broker.replaceForRace(id,'102');
  assert.throws(()=>broker.reconcileGeneration(id),/generation_changed_or_absence_unproved/);
  assert.throws(()=>broker.acknowledge(scope),/active_or_unattributed_upload/);
});
test('R521: orphan in second approved bucket prevents ACK after a completed inventory', () => {
  const { broker, scope }=setup();broker.withdraw(scope);
  const unknown='tenants/tenantA/life-movies/movieA/attempt-unrecorded/unknown.mp4';
  broker.injectUnattributed(scope,'private-two',unknown,'150');
  assert.throws(()=>broker.acknowledge(scope),/private_object_still_present/);
  broker.reconcileKnownOrphan(scope,'private-two',unknown,'150');
  assert.equal(broker.acknowledge(scope).revoked,true);
});
test('R521: unreadable Storage inventory fails closed', () => {
  const { broker, scope }=setup();broker.withdraw(scope);broker.inventoryReadable=false;
  assert.throws(()=>broker.acknowledge(scope),/revocation_ack_unavailable/);
});
test('R521: idempotent withdraw keeps monotonic epoch', () => {
  const { broker, scope }=setup();
  assert.equal(broker.withdraw(scope).epoch,8);
  assert.equal(broker.withdraw(scope).epoch,8);
  assert.equal(broker.acknowledge(scope).epoch,8);
  assert.equal(broker.withdraw(scope).epoch,8);
});
test('R521: signed-out replay and old lease cannot resurrect after revoke ACK', () => {
  const { broker, scope, reserve }=setup();const id=reserve();
  broker.begin(id);broker.completeBytes(id,'101');broker.publish(id);
  assert.equal(broker.replayAllowed(scope,id),true);
  broker.withdraw(scope);
  assert.equal(broker.replayAllowed(scope,id),false);
  broker.reconcileGeneration(id);broker.acknowledge(scope);
  assert.throws(()=>reserve({expectedEpoch:8}),/fenced_or_stale_epoch/);
  assert.throws(()=>broker.begin(id),/cannot_begin/);
  assert.equal(broker.replayAllowed(scope,id),false);
});
test('R521: owner/project isolation; revoking one does not revoke another', () => {
  const { broker, scope }=setup();const other=broker.scope('ownerB','tenantB','movieB');
  broker.withdraw(scope);broker.acknowledge(scope);
  const id=broker.reserve({scope:other,principal:broker.simulatedBrokerIdentity,bucket:'private-two',path:'tenants/tenantB/life-movies/movieB/render/one.mp4',expectedEpoch:7});
  assert.ok(id);
});
test('R521: legacy direct writes require real IAM denial, not this model', () => {
  const { broker }=setup();
  assert.throws(()=>broker.simulateDirectLegacyWriter(),/storage_iam_denies_legacy_writer_model_only/);
  const unlocked=setup({exclusiveWriter:false});
  assert.throws(()=>unlocked.broker.acknowledge(unlocked.scope),/revocation_ack_unavailable/);
});
test('R521: untrusted reconciliation cannot delete unknown generation', () => {
  const { broker, scope }=setup();broker.withdraw(scope);
  const p='tenants/tenantA/life-movies/movieA/reconcile/unknown.mp4';
  broker.injectUnattributed(scope,'private-one',p,'155');
  assert.throws(()=>broker.reconcileKnownOrphan(scope,'private-one',p,'154'),/orphan_not_reconciled/);
  assert.throws(()=>broker.acknowledge(scope),/private_object_still_present/);
});
console.log('R521_BROKER_REFERENCE_MODEL_ONLY; no IAM, real Storage, cloud principal, owner C6 grant, production broker or release authority');
