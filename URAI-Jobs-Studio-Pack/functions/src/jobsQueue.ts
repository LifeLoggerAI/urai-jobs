import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { registry as handlers } from './handlers/index.js';
const db = admin.firestore();

export async function dispatchNewJob(snap: FirebaseFirestore.DocumentSnapshot) {
  const job = snap.data() as any;
  const ref = snap.ref;
  await ref.update({ status: 'running', startedAt: FieldValue.serverTimestamp(), attempts: (job.attempts||0)+1 });
  try {
    const handler = handlers[job.type];
    if (!handler) throw new Error(`No handler for type ${job.type}`);
    const result = await handler(job.payload||{});
    await Promise.all([
      ref.update({ status: 'done', finishedAt: FieldValue.serverTimestamp(), result }),
      db.collection('executions').add({ jobId: ref.id, type: job.type, result, createdAt: FieldValue.serverTimestamp() })
    ]);
  } catch (e:any) {
    await Promise.all([
      ref.update({ status: 'error', error: e.message, finishedAt: FieldValue.serverTimestamp() }),
      db.collection('logs').add({ level: 'error', jobId: ref.id, message: e.message, createdAt: FieldValue.serverTimestamp() })
    ]);
  }
}

export async function scheduleTick() {
  const now = admin.firestore.Timestamp.now();
  const qs = await db.collection('schedules').where('nextRunAt','<=', now).limit(20).get();
  await Promise.all(qs.docs.map(async d => {
    const s = d.data();
    await db.collection('jobs_queue').add({ type: s.type, payload: s.payload||{}, status: 'queued', createdAt: FieldValue.serverTimestamp() });
    const next = computeNextRun(s.cron||'*/30 * * * *');
    await d.ref.update({ nextRunAt: next, updatedAt: FieldValue.serverTimestamp() });
  }));
}

function computeNextRun(_cron: string) {
  const nowMs = Date.now();
  return admin.firestore.Timestamp.fromMillis(nowMs + 30*60*1000);
}
