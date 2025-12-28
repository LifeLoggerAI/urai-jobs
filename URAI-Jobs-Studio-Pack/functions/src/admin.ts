import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { sendWeeklySummary } from './cron/weeklySummary.js';
import { rollupEmailEventsDay } from './cron/rollups.js';
import { rollupCampaignWindow } from './cron/rollupsCampaign.js';

async function requireAdmin(req: functions.https.Request){
  const authz = req.get('Authorization')||'';
  const token = authz.startsWith('Bearer ')? authz.slice(7): '';
  if (!token) throw new Error('no_token');
  const decoded = await admin.auth().verifyIdToken(token);
  if (!decoded.admin) throw new Error('not_admin');
  return decoded;
}

export const admin_runWeeklySummary = functions.https.onRequest(async (req, res)=>{
  try { if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type, Authorization'); return res.status(204).end(); } if (req.method !== 'POST') return res.status(405).send('Method Not Allowed'); await requireAdmin(req); const result = await sendWeeklySummary(); res.set('Access-Control-Allow-Origin','*'); return res.status(200).json(result); } catch (e:any){ console.error(e); return res.status(403).json({ ok:false, error: e.message }); }
});

export const admin_runDailyRollup = functions.https.onRequest(async (req, res)=>{
  try { if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type, Authorization'); return res.status(204).end(); } if (req.method !== 'POST') return res.status(405).send('Method Not Allowed'); await requireAdmin(req); const result = await rollupEmailEventsDay(); res.set('Access-Control-Allow-Origin','*'); return res.status(200).json({ ok:true, result }); } catch (e:any){ console.error(e); return res.status(403).json({ ok:false, error: e.message }); }
});

export const admin_runCampaignRollup = functions.https.onRequest(async (req, res)=>{
  try { if (req.method === 'OPTIONS'){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Headers','Content-Type, Authorization'); return res.status(204).end(); } if (req.method !== 'POST') return res.status(405).send('Method Not Allowed'); await requireAdmin(req); const { campaignId, days } = (req.body||{}); if (!campaignId) return res.status(400).json({ ok:false, error:'missing_campaignId' }); const result = await rollupCampaignWindow(String(campaignId), Number(days||7)); res.set('Access-Control-Allow-Origin','*'); return res.status(200).json(result); } catch (e:any){ console.error(e); return res.status(403).json({ ok:false, error: e.message }); }
});
