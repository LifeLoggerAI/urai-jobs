import * as admin from 'firebase-admin';
const db = admin.firestore();

function ymd(ts: admin.firestore.Timestamp){
  const d = ts.toDate();
  const y = d.getUTCFullYear(); const m=(d.getUTCMonth()+1).toString().padStart(2,'0'); const day=d.getUTCDate().toString().padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export async function rollupEmailEventsDay(){
  const since = new Date(Date.now() - 24*60*60*1000);
  const q = await db.collection('email_events').where('createdAt','>=', admin.firestore.Timestamp.fromDate(since)).get();
  const map = new Map<string, { opens:number; clicks:number; byEmail: Record<string, {open:number; click:number}> }>();
  q.forEach(doc=>{
    const d = doc.data() as any;
    const c = d.campaignId||'adhoc';
    const day = d.createdAt? ymd(d.createdAt): ymd(admin.firestore.Timestamp.now());
    const key = `${c}__${day}`;
    if (!map.has(key)) map.set(key, { opens:0, clicks:0, byEmail:{} });
    const agg = map.get(key)!;
    if ((d.event||d.payload?.event||d.payload?.type) === 'open') { agg.opens++; }
    if ((d.event||d.payload?.event||d.payload?.type) === 'click') { agg.clicks++; }
    const email = (d.email||d.payload?.data?.email||'').toLowerCase();
    if (email){
      agg.byEmail[email] = agg.byEmail[email]||{open:0, click:0};
      if ((d.event||d.payload?.event||d.payload?.type) === 'open') agg.byEmail[email].open++;
      if ((d.event||d.payload?.event||d.payload?.type) === 'click') agg.byEmail[email].click++;
    }
  });
  const batch = db.batch();
  for (const [key, val] of map.entries()){
    const [campaignId, day] = key.split('__');
    const docRef = db.collection('campaign_stats').doc(campaignId).collection('daily').doc(day);
    batch.set(docRef, { day, opens: val.opens, clicks: val.clicks, uniqueOpens: Object.values(val.byEmail).filter(x=>x.open>0).length, uniqueClicks: Object.values(val.byEmail).filter(x=>x.click>0).length, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
}
