import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { verifyRecaptcha } from './recaptcha.js';
const db = admin.firestore();

export const secureApply = functions.https.onRequest(async (req, res)=>{
  try {
    if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type'); return res.status(204).end(); }
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { recaptchaToken, jobId, fullName, email, phone, links, coverLetter, resumePath, source } = req.body || {};
    const verdict = await verifyRecaptcha(recaptchaToken||'');
    if (!verdict.ok) return res.status(403).json({ error: 'recaptcha_failed' });
    const doc = { jobId, fullName, email, phone, links, coverLetter, resumePath, source: source||'urai.app', createdAt: admin.firestore.FieldValue.serverTimestamp() };
    const ref = await db.collection('applications').add(doc);
    res.set('Access-Control-Allow-Origin','*');
    return res.status(200).json({ ok:true, id: ref.id });
  } catch (e:any) { console.error(e); res.status(500).json({ error: e.message }); }
});
