import * as admin from 'firebase-admin';
const db = admin.firestore();

export async function weeklyScrollGenerate(payload: any){
  const userId = String(payload?.userId||'demo');
  const doc = { userId, kind:'weekly_scroll', status:'generated', createdAt: admin.firestore.FieldValue.serverTimestamp() };
  const ref = await db.collection('weekly_scrolls').add(doc);
  return { ok:true, weeklyScrollId: ref.id };
}

export async function forecastTrain(payload: any){
  const horizonDays = Number(payload?.horizonDays||14);
  const ref = await db.collection('forecasts').add({ horizonDays, status:'training', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  // TODO: invoke training job; simulate for now
  await new Promise(r=>setTimeout(r, 250));
  await ref.update({ status:'ready', readyAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok:true, forecastId: ref.id };
}

export async function marketingBatchSend(payload: any){
  // Either use payload.emails or load from a campaign
  let emails: string[] = [];
  if (Array.isArray(payload?.emails)) { emails = payload.emails; }
  else if (payload?.campaignId){
    const c = await db.collection('marketing_campaigns').doc(payload.campaignId).get();
    if (c.exists){ emails = (c.data()?.emails)||[]; payload.subject = payload.subject||c.data()?.subject; payload.html = payload.html||c.data()?.html; }
  }
  // TODO: integrate provider (e.g., Resend, SendGrid). For now, write logs per email.
  await Promise.all(emails.map(e => db.collection('logs').add({ level:'info', kind:'email.simulated', to:e, subject: payload?.subject||'URAI', createdAt: admin.firestore.FieldValue.serverTimestamp() })) );
  return { ok:true, count: emails.length };
}

export async function grantBatchCheck(payload: any){
  // Placeholder for grant scraping/checking; write a log entry.
  await db.collection('logs').add({ level:'info', kind:'grants.check', note:'stub run', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok:true };
}

export const registry: Record<string,(payload:any)=>Promise<any>> = {
  'weekly-scroll-generate': weeklyScrollGenerate,
  'forecast-train': forecastTrain,
  'marketing-batch-send': marketingBatchSend,
  'grant-batch-check': grantBatchCheck
};
