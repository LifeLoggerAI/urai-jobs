import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const db = admin.firestore();

export const trackRedirect = functions.https.onRequest(async (req, res) => {
  try {
    const { c, r, u } = req.query as any;
    const campaignId = String(c||'');
    const email = decodeURIComponent(String(r||''));
    const url = decodeURIComponent(String(u||''));
    if (campaignId && email && url){
      await db.collection('email_events').add({ provider:'pixel', event:'click', campaignId, email, url, ua: req.get('user-agent')||'', ip: req.ip, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    if (url && /^https?:\/\//i.test(url)) return res.redirect(302, url);
    return res.status(400).send('Bad URL');
  } catch (e:any){ console.error(e); return res.status(500).send('Error'); }
});
