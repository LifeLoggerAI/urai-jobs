import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
const db = admin.firestore();

export async function onApplicationCreate(snap: FirebaseFirestore.DocumentSnapshot) {
  const app = snap.data() as any;
  const score = scoreApplication(app);
  await snap.ref.update({ score });

  const payload = { text: `New application for ${app.jobId} — ${app.fullName} (score ${score})` };
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (hook) { try { await fetch(hook, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) }); } catch {} }

  const admins = (process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim()).filter(Boolean);
  await db.collection('logs').add({ level: 'info', kind: 'application', appId: snap.id, score, notified: admins, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

function scoreApplication(app: any): number {
  let s = 50;
  const text = `${app.coverLetter||''} ${(app.links||[]).join(' ')}`.toLowerCase();
  if (/react|next\.js|firebase|flutterflow|rive|typescript/.test(text)) s += 15;
  if (/ai|ml|llm|openai|gpt/.test(text)) s += 10;
  if (/portfolio|github|gitlab/.test(text)) s += 5;
  return Math.max(0, Math.min(100, s));
}
