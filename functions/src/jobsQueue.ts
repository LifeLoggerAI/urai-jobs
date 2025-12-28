import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type JobDoc = { type: string; status: 'queued'|'running'|'done'|'error'; payload?: any; scheduledAt?: FirebaseFirestore.Timestamp; attempts?: number; createdAt?: FirebaseFirestore.Timestamp; };

const db = admin.firestore();

const handlers: Record<string,(payload:any)=>Promise<any>> = {
  'weekly-scroll-generate': async (payload) => {
    // TODO: call your generator; here we just simulate
    await new Promise(r=>setTimeout(r, 200));
    return { ok: true, note: 'weekly scroll generated', userId: payload?.userId };
  },
  'marketing-batch-send': async (payload) => {
    await new Promise(r=>setTimeout(r, 200));
    return { ok: true, count: (payload?.emails||[]).length };
  }
};

export async function dispatchNewJob(snap: FirebaseFirestore.DocumentSnapshot) {
  const job = snap.data() as JobDoc;
  const ref = snap.ref;
  await ref.update({ status: 'running', startedAt: FieldValue.serverTimestamp(), attempts: (job.attempts||0)+1 });
  try {
    const handler = handlers[job.type];
    if (!handler) throw new Error(`No handler for type ${job.type}`);
    const result = await handler(job.payload);
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
  // simple +30m; replace with real cron parser later
  const nowMs = Date.now();
  return admin.firestore.Timestamp.fromMillis(nowMs + 30*60*1000);
}
