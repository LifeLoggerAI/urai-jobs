import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Real Auth/Firestore/Functions/PubSub emulators, manually delivered scheduler
// HTTP requests (v2) and topic messages (v1), plus a synthetic authenticated HTTP worker. No provider,
// private source, Cloud Scheduler calendar, deployed worker or cloud proof.
const project = process.env.GCLOUD_PROJECT;
assert.equal(process.versions.node.split('.')[0], '22', 'The adopted Functions runtime requires Node 22.');
assert.equal(project, 'demo-urai-jobs', 'This destructive synthetic harness requires the demo project.');
assert.ok(['local', 'test'].includes(process.env.URAI_ENV), 'Only a local/test runtime is allowed.');
function loopbackOrigin(value, label) {
  const url = new URL(value?.startsWith('http') ? value : `http://${value}`);
  assert.equal(url.protocol, 'http:', `${label} must use a local emulator.`);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), `${label} must be loopback.`);
  return url.origin;
}
const firestoreOrigin = loopbackOrigin(process.env.FIRESTORE_EMULATOR_HOST, 'Firestore');
const authOrigin = loopbackOrigin(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Auth');
const pubsubOrigin = loopbackOrigin(process.env.PUBSUB_EMULATOR_HOST, 'PubSub');
const functionsOrigin = loopbackOrigin(process.env.FUNCTIONS_EMULATOR_ORIGIN || 'http://127.0.0.1:5001', 'Functions');
const workerOrigin = loopbackOrigin(process.env.NARRATOR_WORKER_URL, 'Synthetic worker');
const workerToken = 'jobs-background-emulator-only-token';
assert.equal(process.env.URAI_JOBS_WORKER_TOKEN, workerToken);
assert.equal(process.env.URAI_JOBS_ALLOW_INLINE_FALLBACK, 'false');
assert.ok(!process.env.GOOGLE_APPLICATION_CREDENTIALS, 'This harness does not accept cloud credentials.');
for (const key of ['ELEVENLABS_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
  assert.ok(!process.env[key], `${key} must be absent from this synthetic process.`);
}
const runId = `background-${Date.now()}`;
const app = initializeApp({ projectId: project });
const db = getFirestore(app);
const auth = getAuth(app);
const receipts = [];
let passes = 0;
function pass(name) { passes++; console.log(`[PASS] ${name}`); }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(name, check, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = await check();
    if (value) return value;
    await delay(150);
  }
  throw new Error(`Timed out: ${name}`);
}
async function request(origin, path, method = 'POST', body, expected = 200) {
  const response = await fetch(`${origin}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function callable(name, token, data, expected = 200) {
  const response = await fetch(`${functionsOrigin}/${project}/us-central1/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }), signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  assert.equal(response.status, expected, `${name}: ${JSON.stringify(body)}`);
  if (expected === 200) assert.ok(!body.error, `${name} must succeed.`);
  return body.result ?? body.data ?? body;
}
async function user(suffix) {
  const uid = `${runId}-${suffix}`;
  const email = `${uid}@test.local`;
  const password = `Emulator-${runId}!`;
  await auth.createUser({ uid, email, password });
  await db.doc(`users/${uid}`).set({ uid, role: 'user', disabled: false, permissions: ['jobs:create'] });
  const login = await request(authOrigin, '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', 'POST', { email, password, returnSecureToken: true });
  return { uid, token: login.idToken };
}
const topicPath = name => `/v1/projects/${project}/topics/${name}`;
async function publish(name, json) {
  return request(pubsubOrigin, `${topicPath(name)}:publish`, 'POST', { messages: [{ data: Buffer.from(JSON.stringify(json)).toString('base64') }] });
}
async function schedule(name) {
  // The adopted CLI registers v2 schedules as topics, but its Pub/Sub delivery
  // only supports event/cloudevent signatures. Invoke their actual HTTP wrapper,
  // as v2 Cloud Scheduler does, without importing handlers or changing the CLI.
  if (name === 'systemReconcile') return publish(`firebase-schedule-${name}`, {});
  assert.ok(['processQueueTick', 'retryExpiredLeases', 'publishJobTerminalEvents'].includes(name));
  const registration = readFileSync('firebase-debug.log', 'utf8');
  const bindings = [...registration.matchAll(new RegExp(`addTrigger\\(firebase-schedule-${name}, (us-central1-${name}-[0-9]+), http\\)`, 'g'))];
  assert.equal(bindings.length, 1, `${name} requires one actual registered HTTP scheduler binding.`);
  const response = await fetch(`${functionsOrigin}/functions/projects/${project}/triggers/${bindings[0][1]}`, {
    method: 'POST', headers: {
      'X-CloudScheduler-JobName': `projects/${project}/locations/us-central1/jobs/synthetic-${name}`,
      'X-CloudScheduler-ScheduleTime': new Date().toISOString(),
    }, signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${name} scheduler HTTP delivery must succeed.`);
}
const jobRef = id => db.doc(`jobs/${id}`);
const queueRef = id => db.doc(`jobQueue/${id}`);
const readJob = async id => (await jobRef(id).get()).data();
const readQueue = async id => (await queueRef(id).get()).data();
const logs = async id => (await jobRef(id).collection('logs').get()).docs.map(doc => doc.data());
async function waitStatus(id, status) {
  return poll(`${id} ${status}`, async () => {
    const job = await readJob(id); return job?.status === status ? job : null;
  });
}
async function waitLog(id, predicate) {
  return poll(`${id} execution log`, async () => (await logs(id)).find(predicate));
}
async function waitCleanup(id) {
  await poll(`${id} terminal queue cleanup`, async () => !(await queueRef(id).get()).exists);
}
async function outbox(id) {
  return poll(`${id} outbox`, async () => {
    const items = await db.collection('jobTerminalEventOutbox').where('jobId', '==', id).get();
    assert.ok(items.size <= 1, `${id} must retain one outbox for this terminal transition.`);
    return items.docs[0];
  });
}
async function create(actor, fixtureCase, consent) {
  const input = {
    jobType: 'narrator.tts', payload: { text: 'Synthetic queue lifecycle input.', fixtureCase },
    idempotencyKey: `${runId}-${fixtureCase}`, ...(consent ? { consent } : {}),
  };
  const result = await callable('createJob', actor.token, input);
  assert.equal(result.deduplicated, false);
  receipts.push({ jobId: result.jobId, fixtureCase, ownerUid: actor.uid });
  return { id: result.jobId, input };
}
const calls = [];
const held = new Map();
function release(id) { held.get(id)?.(); held.delete(id); }
const worker = createServer(async (req, res) => {
  try {
    if (req.method !== 'POST' || req.url !== '/execute-job') { res.writeHead(404).end(); return; }
    if (req.headers.authorization !== `Bearer ${workerToken}`) { res.writeHead(401).end(); return; }
    let raw = '';
    for await (const chunk of req) {
      raw += chunk; assert.ok(Buffer.byteLength(raw) <= 64 * 1024, 'Synthetic request is bounded.');
    }
    const body = JSON.parse(raw);
    assert.equal(body.jobType, 'narrator.tts');
    assert.equal(body.type, 'narrator.tts');
    const current = await readJob(body.jobId);
    assert.equal(current?.status, 'RUNNING');
    assert.equal(current?.lease?.leaseToken, body.leaseToken);
    assert.equal(current?.execution?.leaseToken, body.leaseToken);
    const n = calls.filter(call => call.jobId === body.jobId).length + 1;
    calls.push({ jobId: body.jobId, leaseToken: body.leaseToken, fixtureCase: body.payload.fixtureCase, attempt: n });
    if (body.payload.fixtureCase.startsWith('hold') && n === 1) {
      await new Promise(resolve => held.set(body.jobId, resolve));
    }
    const fail = body.payload.fixtureCase === 'always-fail' || (body.payload.fixtureCase === 'fail-once' && n === 1);
    res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fail ? { fixture: 'deliberate-local-transport-failure' } : {
      ok: true, mode: 'synthetic-loopback-worker', jobId: body.jobId, transportAttempt: n,
      inputSha256: createHash('sha256').update(body.payload.text).digest('hex'),
    }));
  } catch (error) {
    console.error('[FIXTURE ERROR]', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message }));
  }
});
async function waitCalls(id, count) {
  return poll(`${id} ${count} authenticated worker calls`, () => calls.filter(call => call.jobId === id).length === count);
}
async function due(id) { await queueRef(id).update({ availableAt: Timestamp.fromMillis(Date.now() - 1000) }); }
async function seedLease(id, { status = 'LEASED', masterToken = `${runId}-${id}`, queueToken = masterToken, attempts = 0, maxAttempts = 3, callback = false } = {}) {
  const lease = { leaseId: `${runId}-lease`, leaseToken: masterToken, workerId: 'synthetic-fixture', expiresAt: Timestamp.fromMillis(Date.now() - 1000), heartbeatAt: Timestamp.fromMillis(Date.now() - 20 * 60_000) };
  await db.runTransaction(async transaction => {
    transaction.update(jobRef(id), {
      status, lease, execution: {
        attemptCount: attempts, maxAttempts,
        ...(status === 'RUNNING' ? { leaseToken: masterToken } : {}),
        ...(callback ? { asyncCallbackPending: true, callbackLeaseToken: masterToken, callbackDeadlineAt: Timestamp.fromMillis(Date.now() + 60_000) } : {}),
      },
    });
    transaction.update(queueRef(id), { status, lease: { ...lease, leaseToken: queueToken } });
  });
  return masterToken;
}
const terminalTopic = 'job-terminal-events';
const subscription = `projects/${project}/subscriptions/${runId}-terminal`;
async function pull() {
  const result = await request(pubsubOrigin, `/v1/${subscription}:pull`, 'POST', { maxMessages: 100, returnImmediately: true });
  const messages = result.receivedMessages || [];
  if (messages.length) await request(pubsubOrigin, `/v1/${subscription}:acknowledge`, 'POST', { ackIds: messages.map(message => message.ackId) });
  return messages.map(({ message }) => ({ ...message, json: JSON.parse(Buffer.from(message.data, 'base64').toString('utf8')) }));
}
try {
  await new Promise((resolve, reject) => worker.once('error', reject).listen(Number(new URL(workerOrigin).port), new URL(workerOrigin).hostname, resolve));
  assert.equal((await fetch(`${workerOrigin}/execute-job`, { method: 'POST', body: '{}' })).status, 401);
  pass('Synthetic worker rejects a missing bearer; actual dispatch must authenticate.');
  for (const name of ['processQueueTick', 'retryExpiredLeases', 'systemReconcile', 'publishJobTerminalEvents']) {
    await request(pubsubOrigin, topicPath(`firebase-schedule-${name}`), 'GET');
  }
  await request(pubsubOrigin, topicPath('job-execution'), 'GET');
  pass('All five previously omitted background exports register their real emulator topics.');
  console.log('[SCOPE] Scheduler deliveries are manual v2 HTTP requests and v1 Pub/Sub messages; no cloud calendar or IAM proof.');
  await request(pubsubOrigin, topicPath(terminalTopic), 'PUT', {});
  await request(pubsubOrigin, `/v1/${subscription}`, 'PUT', { topic: `projects/${project}/topics/${terminalTopic}`, ackDeadlineSeconds: 10 });
  const [actor, other] = await Promise.all([user('owner'), user('second-owner')]);

  const first = await create(actor, 'hold-cancel');
  const duplicates = await Promise.all(Array.from({ length: 3 }, () => callable('createJob', actor.token, first.input)));
  assert.ok(duplicates.every(value => value.deduplicated && value.jobId === first.id));
  assert.equal((await db.collection('jobs').where('ownerUid', '==', actor.uid).get()).size, 1);
  pass('Concurrent authorized request retries persist one job, queue and idempotency identity.');
  await Promise.all([schedule('processQueueTick'), schedule('processQueueTick')]);
  await waitCalls(first.id, 1);
  const running = await waitStatus(first.id, 'RUNNING');
  assert.equal(running.execution.attemptCount, 1);
  assert.equal((await readQueue(first.id)).lease.leaseToken, running.lease.leaseToken);
  pass('Concurrent scheduler deliveries lease once and dispatch once through real Pub/Sub.');
  await publish('job-execution', { jobId: first.id, leaseToken: 'synthetic-stale-lease' });
  await publish('job-execution', { jobId: first.id, leaseToken: running.lease.leaseToken });
  await publish('job-execution', { bad: 'synthetic-invalid-message' });
  await waitLog(first.id, log => log.metadata?.reason === 'stale-lease');
  await waitLog(first.id, log => log.metadata?.reason === 'duplicate-running');
  assert.equal(calls.filter(call => call.jobId === first.id).length, 1);
  pass('Stale and duplicate execution deliveries never redispatch a running lease.');
  await callable('cancelJob', other.token, { jobId: first.id }, 403);
  assert.equal((await readJob(first.id)).status, 'RUNNING');
  pass('A foreign Auth-emulator bearer cannot cancel the running owner job.');
  assert.equal((await callable('cancelJob', actor.token, { jobId: first.id })).status, 'CANCELLED');
  await waitCleanup(first.id);
  release(first.id);
  await waitLog(first.id, log => log.message?.includes('Worker result was not applied'));
  assert.equal((await readJob(first.id)).status, 'CANCELLED');
  assert.equal((await outbox(first.id)).data().payload.ownerUid, actor.uid);
  pass('Cancellation removes the queue, binds one terminal event and fences late worker output.');

  const success = await create(actor, 'success');
  await schedule('processQueueTick');
  const completed = await waitStatus(success.id, 'SUCCESS');
  assert.equal(completed.result.mode, 'synthetic-loopback-worker');
  assert.equal(completed.execution.attemptCount, 1);
  await waitCleanup(success.id);
  const successOutbox = await outbox(success.id);
  assert.equal(successOutbox.data().payload.status, 'SUCCESS');
  pass('Callable → scheduler HTTP wrapper → queue → Pub/Sub → HTTP transport → durable result → cleanup executes.');
  await publish('job-execution', { jobId: success.id, leaseToken: calls.find(call => call.jobId === success.id).leaseToken });
  await waitLog(success.id, log => log.metadata?.reason === 'terminal');
  assert.equal(calls.filter(call => call.jobId === success.id).length, 1);
  pass('Duplicate delivery after SUCCESS preserves the completed result and one execution.');

  const retry = await create(actor, 'fail-once');
  await schedule('processQueueTick');
  const retryPending = await poll('HTTP failure retry', async () => {
    const job = await readJob(retry.id); return job?.status === 'PENDING' && job.execution.attemptCount === 1 ? job : null;
  });
  assert.equal(retryPending.retryCount, 1);
  assert.ok((await readQueue(retry.id)).availableAt.toMillis() > Date.now());
  assert.equal(retryPending.lease, undefined);
  pass('Actual HTTP 503 requeues both records with a bounded retry and cleared lease.');
  const dueControl = await create(other, 'backoff-control');
  await queueRef(retry.id).update({ availableAt: Timestamp.fromMillis(Date.now() + 30_000) });
  await schedule('processQueueTick');
  await waitStatus(dueControl.id, 'SUCCESS'); await waitCleanup(dueControl.id);
  assert.equal(calls.filter(call => call.jobId === retry.id).length, 1);
  pass('Scheduled leasing preserves future availableAt while completing a due positive control.');
  await due(retry.id);
  await schedule('processQueueTick');
  assert.equal((await waitStatus(retry.id, 'SUCCESS')).execution.attemptCount, 2);
  await waitCleanup(retry.id);
  pass('A due retry receives a new lease and succeeds on its second actual transport attempt.');

  const dead = await create(actor, 'always-fail');
  for (let attempt = 1; attempt <= 3; attempt++) {
    await due(dead.id); await schedule('processQueueTick');
    await poll(`failure attempt ${attempt}`, async () => {
      const job = await readJob(dead.id);
      return job.execution.attemptCount === attempt && job.status === (attempt === 3 ? 'DEAD' : 'PENDING');
    });
  }
  assert.equal(calls.filter(call => call.jobId === dead.id).length, 3);
  await waitCleanup(dead.id); assert.equal((await outbox(dead.id)).data().payload.status, 'DEAD');
  await publish('job-execution', { jobId: dead.id, leaseToken: calls.filter(call => call.jobId === dead.id).at(-1).leaseToken });
  await waitLog(dead.id, log => log.metadata?.reason === 'terminal');
  assert.equal(calls.filter(call => call.jobId === dead.id).length, 3);
  pass('Three actual failures consume exactly the admitted attempt budget and end DEAD without redispatch.');

  const mismatch = await create(actor, 'mismatched-lease');
  const mismatchToken = await seedLease(mismatch.id, { queueToken: 'synthetic-other-queue-token' });
  const expired = await create(actor, 'expired-lease');
  const oldToken = await seedLease(expired.id);
  await Promise.all([schedule('retryExpiredLeases'), schedule('retryExpiredLeases')]);
  const recovered = await waitStatus(expired.id, 'PENDING');
  assert.equal(recovered.retryCount, 1); assert.equal(recovered.execution.attemptCount, 0);
  assert.equal(recovered.lease, undefined); assert.equal((await readQueue(expired.id)).status, 'PENDING');
  await publish('job-execution', { jobId: expired.id, leaseToken: oldToken });
  await waitLog(expired.id, log => log.metadata?.reason === 'stale-lease');
  assert.equal(calls.filter(call => call.jobId === expired.id).length, 0);
  pass('Concurrent expired-lease schedules recover once without spending a started attempt; old delivery is fenced.');
  await due(expired.id); await schedule('processQueueTick');
  await waitStatus(expired.id, 'SUCCESS'); await waitCleanup(expired.id);
  assert.notEqual(calls.find(call => call.jobId === expired.id).leaseToken, oldToken);
  pass('Recovered unstarted work completes with a new lease and one started execution.');

  assert.equal((await readJob(mismatch.id)).status, 'LEASED');
  assert.equal((await readJob(mismatch.id)).lease.leaseToken, mismatchToken);
  assert.equal((await readQueue(mismatch.id)).lease.leaseToken, 'synthetic-other-queue-token');
  pass('Expired-lease recovery preserves mismatched master/queue authority.');
  await callable('cancelJob', actor.token, { jobId: mismatch.id }); await waitCleanup(mismatch.id);

  const callback = await create(other, 'callback-deadline-fixture');
  await seedLease(callback.id, { status: 'RUNNING', attempts: 1, callback: true });
  const stale = await create(other, 'hold-stale-runner');
  await schedule('processQueueTick'); await waitCalls(stale.id, 1);
  const staleToken = (await readJob(stale.id)).lease.leaseToken;
  const staleAt = Timestamp.fromMillis(Date.now() - 20 * 60_000);
  await jobRef(stale.id).update({ 'lease.heartbeatAt': staleAt });
  await queueRef(stale.id).update({ 'lease.heartbeatAt': staleAt });
  await schedule('systemReconcile');
  const staleRecovered = await waitStatus(stale.id, 'PENDING');
  assert.equal(staleRecovered.execution.attemptCount, 1); assert.equal(staleRecovered.retryCount, 1);
  assert.equal((await readJob(callback.id)).status, 'RUNNING');
  assert.equal((await readJob(callback.id)).execution.asyncCallbackPending, true);
  pass('An unexpired lease-bound callback survives the same reconciliation that recovers a stale positive control.');
  await schedule('processQueueTick'); await waitStatus(stale.id, 'SUCCESS');
  assert.equal((await readJob(stale.id)).execution.attemptCount, 2);
  assert.notEqual(calls.filter(call => call.jobId === stale.id)[1].leaseToken, staleToken);
  release(stale.id); await waitLog(stale.id, log => log.message?.includes('Worker result was not applied'));
  assert.equal((await readJob(stale.id)).result.transportAttempt, 2); await waitCleanup(stale.id);
  pass('Stale-running reconciliation retries with a new lease and excludes a late superseded worker result.');

  await jobRef(callback.id).update({ 'execution.callbackDeadlineAt': Timestamp.fromMillis(Date.now() - 1000) });
  await schedule('systemReconcile'); await waitStatus(callback.id, 'PENDING');
  assert.equal((await readJob(callback.id)).execution.asyncCallbackPending, false);
  await callable('cancelJob', other.token, { jobId: callback.id }); await waitCleanup(callback.id);
  pass('Expired callback authority is cleared when the stale runner is recovered.');

  const consent = { purpose: `${runId}-synthetic-voice`, policyVersion: 'synthetic-policy-v1', decisionReceiptId: 'synthetic-consent-receipt' };
  const revoked = await create(other, 'consent-before-lease', consent);
  const block = createHash('sha256').update(`${other.uid}\n${consent.purpose}`).digest('hex');
  await db.doc(`jobConsentBlocks/${block}`).set({ ownerUid: other.uid, purpose: consent.purpose, active: true });
  await schedule('processQueueTick'); await waitStatus(revoked.id, 'CANCELLED'); await waitCleanup(revoked.id);
  assert.equal(calls.filter(call => call.jobId === revoked.id).length, 0);
  pass('Current consent withdrawal before leasing cancels without Pub/Sub worker dispatch.');

  const changed = await create(other, 'hold-authority-change');
  await schedule('processQueueTick'); await waitCalls(changed.id, 1);
  await jobRef(changed.id).update({ payload: { text: 'Changed synthetic input.', fixtureCase: 'hold-authority-change' } });
  release(changed.id); await waitStatus(changed.id, 'CANCELLED'); await waitCleanup(changed.id);
  assert.equal((await readJob(changed.id)).error.code, 'execution_authority_changed');
  pass('A changed admitted input cancels the attempt before late worker output can finalize.');

  for (const { jobId } of receipts) await outbox(jobId);
  await Promise.all([schedule('publishJobTerminalEvents'), schedule('publishJobTerminalEvents')]);
  await poll('all terminal outboxes DELIVERED', async () => {
    const items = await db.collection('jobTerminalEventOutbox').get();
    return items.size === receipts.length && items.docs.every(doc => doc.data().status === 'DELIVERED');
  });
  const received = await pull();
  assert.equal(received.length, receipts.length);
  assert.equal(new Set(received.map(message => message.json.eventId)).size, receipts.length);
  for (const item of received) {
    const record = (await db.doc(`jobTerminalEventOutbox/${item.json.eventId}`).get()).data();
    assert.equal(record.attemptCount, 1);
    assert.equal(item.attributes.eventId, record.eventId);
    assert.equal(item.json.ownerUid, receipts.find(receipt => receipt.jobId === item.json.jobId).ownerUid);
    assert.ok(!JSON.stringify(item.json.analytics).includes('Synthetic queue lifecycle input'));
  }
  pass('Concurrent terminal schedules publish one authenticated-owner event per transition to real Pub/Sub.');
  pass('Terminal publication persists its real message ID and privacy-minimized analytics projection.');

  await successOutbox.ref.update({ status: 'PUBLISHING', leaseToken: 'synthetic-crashed-publisher', leaseExpiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  await schedule('publishJobTerminalEvents');
  await poll('expired publication lease delivery', async () => (await successOutbox.ref.get()).data().status === 'DELIVERED');
  const replay = await poll('retry terminal message', async () => { const items = await pull(); return items.length ? items : null; });
  assert.equal(replay.length, 1); assert.equal(replay[0].json.eventId, successOutbox.id);
  assert.equal((await successOutbox.ref.get()).data().attemptCount, 2);
  pass('An expired publisher lease retries the stable event identity for downstream idempotency.');

  await request(pubsubOrigin, topicPath(terminalTopic), 'DELETE');
  await successOutbox.ref.update({ status: 'PENDING', nextAttemptAt: Timestamp.now() });
  await schedule('publishJobTerminalEvents');
  const failedPublish = await poll('real missing-topic retry', async () => {
    const record = (await successOutbox.ref.get()).data(); return record.status === 'PENDING' && record.attemptCount === 3 && record.lastError ? record : null;
  });
  assert.ok(failedPublish.nextAttemptAt.toMillis() > Date.now());
  assert.equal(failedPublish.leaseToken, undefined); assert.equal(failedPublish.leaseExpiresAt, undefined);
  pass('An actual missing Pub/Sub topic preserves the durable event, records failure and schedules bounded backoff.');
  await successOutbox.ref.update({ status: 'PENDING', attemptCount: 7, nextAttemptAt: Timestamp.now() });
  await schedule('publishJobTerminalEvents');
  await poll('terminal publisher attempt budget', async () => (await successOutbox.ref.get()).data().status === 'DEAD');
  assert.equal((await successOutbox.ref.get()).data().attemptCount, 8);
  pass('Actual terminal publication failure at the admitted eighth attempt becomes DEAD.');

  console.log(`[RECEIPT] ${JSON.stringify({ project, sourceSha: process.env.URAI_SOURCE_SHA || null, firestoreOrigin, authOrigin, pubsubOrigin, functionsOrigin, passes, jobs: receipts, workerTransportCalls: calls.length, proof: 'real-emulator-background-lifecycle', worker: 'synthetic-authenticated-loopback', scheduler: 'manual-v2-http-wrapper-and-v1-pubsub', providerCalls: 0, privateSources: 0, deployed: false, calendarDelivery: false, downstreamConsumerAcceptance: false })}`);
  console.log(`[RESULT] JOBS_BACKGROUND_LIFECYCLE_EMULATOR: ${passes} PASS / 0 FAIL`);
} catch (error) {
  const states = await Promise.all(receipts.map(async receipt => {
    const [job, queue] = await Promise.all([readJob(receipt.jobId), readQueue(receipt.jobId)]);
    return { ...receipt, status: job?.status, attemptCount: job?.execution?.attemptCount, retryCount: job?.retryCount, queueStatus: queue?.status, workerCalls: calls.filter(call => call.jobId === receipt.jobId).length };
  }));
  console.error(`[FAILURE_RECEIPT] ${JSON.stringify({ sourceSha: process.env.URAI_SOURCE_SHA || null, passes, error: error.message, jobs: states, calendarDelivery: false, deployed: false })}`);
  throw error;
} finally {
  for (const id of held.keys()) release(id);
  worker.closeAllConnections();
  await new Promise(resolve => worker.close(resolve));
  await db.terminate();
  await deleteApp(app);
}
