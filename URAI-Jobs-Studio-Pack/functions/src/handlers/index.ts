import * as admin from 'firebase-admin';
import { sendEmail } from '../providers/email.js';
import { filterSuppressed } from '../lib/recipients.js';
import { injectOpenPixel, rewriteHtmlForTracking } from './rewriter.js';
const db = admin.firestore();

function baseUrl(){
  return process.env.TRACKING_BASE_URL || `https://${process.env.FUNCTIONS_REGION||'us-central1'}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net`;
}

export async function weeklyScrollGenerate(payload: any){
  const userId = String(payload?.userId||'demo');
  const doc = { userId, kind:'weekly_scroll', status:'generated', createdAt: admin.firestore.FieldValue.serverTimestamp() };
  const ref = await db.collection('weekly_scrolls').add(doc);
  return { ok:true, weeklyScrollId: ref.id };
}

export async function forecastTrain(payload: any){
  const horizonDays = Number(payload?.horizonDays||14);
  const ref = await db.collection('forecasts').add({ horizonDays, status:'training', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await new Promise(r=>setTimeout(r, 250));
  await ref.update({ status:'ready', readyAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok:true, forecastId: ref.id };
}

export async function marketingBatchSend(payload: any){
  let emails: string[] = [];
  let subject = payload?.subject || 'URAI';
  let html = payload?.html || '<p>Hello from URAI</p>';
  const campaignId = payload?.campaignId || 'adhoc_'+Date.now();

  if (Array.isArray(payload?.emails)) { emails = payload.emails; }
  else if (payload?.campaignId){
    const c = await db.collection('marketing_campaigns').doc(payload.campaignId).get();
    if (c.exists){ emails = (c.data()?.emails)||[]; subject = c.data()?.subject || subject; html = c.data()?.html || html; }
  }
  const { allowed, blocked } = await filterSuppressed(emails);
  if (blocked.length){ await db.collection('logs').add({ level:'info', kind:'email.skipped.suppressed', count: blocked.length, emails: blocked, createdAt: admin.firestore.FieldValue.serverTimestamp() }); }

  const base = baseUrl();
  const results: any[] = [];
  for (const to of allowed){
    try {
      let perHtml = rewriteHtmlForTracking(html, base, campaignId, to);
      perHtml = injectOpenPixel(perHtml, base, campaignId, to);
      const r = await sendEmail(to, subject, perHtml);
      results.push({ to, ...r });
    } catch (e:any){ results.push({ to, error:e.message }); }
  }
  await db.collection('logs').add({ level:'info', kind:'email.batch', provider: process.env.EMAIL_PROVIDER||'resend', count: results.length, blocked: blocked.length, campaignId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok:true, count: results.length, blocked: blocked.length, campaignId, results };
}

export async function grantBatchCheck(payload: any){
  await db.collection('logs').add({ level:'info', kind:'grants.check', note:'stub run', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok:true };
}

export const registry: Record<string,(payload:any)=>Promise<any)> = {
  'weekly-scroll-generate': weeklyScrollGenerate,
  'forecast-train': forecastTrain,
  'marketing-batch-send': marketingBatchSend,
  'grant-batch-check': grantBatchCheck
};
