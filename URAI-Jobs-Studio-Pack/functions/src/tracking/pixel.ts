import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const db = admin.firestore();
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y1m1tUAAAAASUVORK5CYII=','base64');

export const openPixel = functions.https.onRequest(async (req, res) => {
  try {
    const { c, r } = req.query as any;
    const email = decodeURIComponent(String(r||''));
    const campaignId = String(c||'');
    if (campaignId && email){
      await db.collection('email_events').add({ provider:'pixel', event:'open', campaignId, email, ua: req.get('user-agent')||'', ip: req.ip, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    res.set('Content-Type','image/png');
    res.set('Cache-Control','no-cache, no-store, must-revalidate');
    return res.status(200).send(PNG_1x1);
  } catch (e:any){ console.error(e); return res.status(500).send(PNG_1x1); }
});
