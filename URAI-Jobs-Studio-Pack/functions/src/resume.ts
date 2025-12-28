import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { v4 as uuid } from 'uuid';
import { verifyRecaptcha } from './recaptcha.js';

export const createResumeUploadUrl = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type'); return res.status(204).end(); }
    if (req.method !== 'POST') { return res.status(405).send('Method Not Allowed'); }
    const { recaptchaToken } = req.body || {};
    const verdict = await verifyRecaptcha(recaptchaToken||'');
    if (!verdict.ok) return res.status(403).json({ error: 'recaptcha_failed' });

    const contentType = 'application/pdf';
    const id = uuid();
    const resumePath = `resumes/${id}.pdf`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(resumePath);
    const [url] = await file.getSignedUrl({ version:'v4', action:'write', expires: Date.now() + 10*60*1000, contentType });
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).json({ uploadUrl: url, resumePath, contentType });
  } catch (e:any) { console.error(e); res.status(500).json({ error: e.message }); }
});
