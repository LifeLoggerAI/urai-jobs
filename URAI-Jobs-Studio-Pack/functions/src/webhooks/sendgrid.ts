import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { markSuppressed } from '../lib/recipients.js';
const db = admin.firestore();

export const sendgridEmailWebhook = functions.https.onRequest( async (req, res) => {
  try {
    if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type, X-Twilio-Email-Event-Webhook-Signature, X-Twilio-Email-Event-Webhook-Timestamp'); return res.status(204).end(); }
    if (req.method !== 'POST'){ return res.status(405).send('Method Not Allowed'); }
    const events = Array.isArray(req.body) ? req.body : [];
    const batch = db.batch();
    for (const ev of events){
      const ref = db.collection('email_events').doc();
      batch.set(ref, { provider:'sendgrid', event: ev.event, email: ev.email, sg_event_id: ev.sg_event_id, sg_message_id: ev.sg_message_id, timestamp: ev.timestamp, payload: ev, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      if (['bounce','dropped','spamreport'].includes(String(ev.event))) {
        await markSuppressed(ev.email, `sendgrid:${ev.event}`);
        await db.collection('logs').add({ level:'warn', kind:'email.suppressed', email: ev.email, reason: `sendgrid:${ev.event}`, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
    await batch.commit();
    return res.status(200).json({ ok:true, count: events.length });
  } catch (e:any){ console.error(e); return res.status(500).json({ error: e.message }); }
});
