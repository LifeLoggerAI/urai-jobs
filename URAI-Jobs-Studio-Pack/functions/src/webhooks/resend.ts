import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { markSuppressed } from '../lib/recipients.js';
const db = admin.firestore();

export const resendEmailWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type, x-resend-signature'); return res.status(204).end(); }
    if (req.method !== 'POST'){ return res.status(405).send('Method Not Allowed'); }
    const payload = req.body || {};
    await db.collection('email_events').add({ provider:'resend', payload, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    const type = payload?.type || payload?.event;
    const email = payload?.data?.email || payload?.email || payload?.to || '';
    if (email && (String(type).includes('bounce') || String(type).includes('complaint'))) {
      await markSuppressed(email, `resend:${type}`);
      await db.collection('logs').add({ level:'warn', kind:'email.suppressed', email, reason: `resend:${type}`, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return res.status(200).json({ ok:true });
  } catch (e:any){ console.error(e); return res.status(500).json({ error: e.message }); }
});
