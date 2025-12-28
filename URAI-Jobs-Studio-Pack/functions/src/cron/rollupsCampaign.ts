import * as admin from 'firebase-admin';
const db = admin.firestore();

export async function rollupCampaignWindow(campaignId: string, days: number = 7){
  if (!campaignId) throw new Error('missing_campaignId');
  const since = new Date(Date.now() - Math.max(1, days)*24*60*60*1000);
  const q = await db.collection('email_events')
    .where('campaignId','==', campaignId)
    .where('createdAt','>=', admin.firestore.Timestamp.fromDate(since))
    .get();

  const byDay = new Map<string, { opens:number; clicks:number; uo:Set<string>; uc:Set<string> }>();
  const ymd = (d: admin.firestore.Timestamp)=>{ const t=d.toDate(); const y=t.getUTCFullYear(); const m=(t.getUTCMonth()+1+ '').padStart(2,'0'); const dd=(t.getUTCDate()+ '').padStart(2,'0'); return `${y}-${m}-${dd}`; };

  q.forEach(doc=>{
    const d = doc.data() as any;
    const day = d.createdAt ? ymd(d.createdAt) : ymd(admin.firestore.Timestamp.now());
    if (!byDay.has(day)) byDay.set(day, { opens:0, clicks:0, uo:new Set(), uc:new Set() });
    const row = byDay.get(day)!;
    const ev = d.event||d.payload?.event||d.payload?.type;
    const email = (d.email||d.payload?.data?.email||'').toLowerCase();
    if (ev==='open'){ row.opens++; if (email) row.uo.add(email); }
    if (ev==='click'){ row.clicks++; if (email) row.uc.add(email); }
  });

  const batch = db.batch();
  byDay.forEach((v,day)=>{
    const ref = db.collection('campaign_stats').doc(campaignId).collection('daily').doc(day);
    batch.set(ref, { day, opens: v.opens, clicks: v.clicks, uniqueOpens: v.uo.size, uniqueClicks: v.uc.size, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  await batch.commit();
  return { ok:true, days, daysTouched: byDay.size };
}
