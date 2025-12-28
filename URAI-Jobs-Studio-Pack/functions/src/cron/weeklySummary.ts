import * as admin from 'firebase-admin';
import { sendEmail } from '../providers/email.js';

const db = admin.firestore();

function startOfUTCWeek(d = new Date()){
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0,0,0,0);
  return date;
}

export async function sendWeeklySummary(){
  const now = new Date();
  const thisMon = startOfUTCWeek(now);
  const lastMon = new Date(thisMon); lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const fromTs = admin.firestore.Timestamp.fromDate(lastMon);
  const toTs = admin.firestore.Timestamp.fromDate(thisMon);

  const snap = await db.collection('email_events').where('createdAt','>=', fromTs).where('createdAt','<', toTs).get();
  type Row = { opens:number; clicks:number; uniqueOpens:Set<string>; uniqueClicks:Set<string> };
  const byCampaign = new Map<string, Row>();
  snap.forEach(doc=>{
    const d = doc.data() as any;
    const c = String(d.campaignId || 'adhoc');
    if (!byCampaign.has(c)) byCampaign.set(c, { opens:0, clicks:0, uniqueOpens:new Set(), uniqueClicks:new Set() });
    const row = byCampaign.get(c)!;
    const email = (d.email||d.payload?.data?.email||'').toLowerCase();
    const ev = d.event||d.payload?.event||d.payload?.type;
    if (ev === 'open'){ row.opens++; if (email) row.uniqueOpens.add(email); }
    if (ev === 'click'){ row.clicks++; if (email) row.uniqueClicks.add(email); }
  });

  const fmt = (n:number)=> Intl.NumberFormat('en-US').format(n);
  let rows = '';
  byCampaign.forEach((v,k)=>{ rows += `<tr><td style="padding:8px;border:1px solid #eee">${k}</td><td style="padding:8px;border:1px solid #eee;text-align:right">${fmt(v.opens)}</td><td style="padding:8px;border:1px solid #eee;text-align:right">${fmt(v.uniqueOpens.size)}</td><td style="padding:8px;border:1px solid #eee;text-align:right">${fmt(v.clicks)}</td><td style="padding:8px;border:1px solid #eee;text-align:right">${fmt(v.uniqueClicks.size)}</td></tr>`; });
  if (!rows) rows = `<tr><td colspan="5" style="padding:12px;border:1px solid #eee">No email activity last week.</td></tr>`;

  const table = `<table cellspacing=0 cellpadding=0 style="border-collapse:collapse;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial"><thead><tr><th style="padding:8px;border:1px solid #eee;text-align:left">Campaign</th><th style="padding:8px;border:1px solid #eee">Opens</th><th style="padding:8px;border:1px solid #eee">Unique opens</th><th style="padding:8px;border:1px solid #eee">Clicks</th><th style="padding:8px;border:1px solid #eee">Unique clicks</th></tr></thead><tbody>${rows}</tbody></table>`;

  const title = `URAI weekly email summary — ${lastMon.toISOString().slice(0,10)} → ${thisMon.toISOString().slice(0,10)}`;
  const admins = (process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if (!admins.length) return { ok:false, reason:'no_admins' };

  const body = `<h2 style="font-weight:600">${title}</h2><p style="color:#666;">Times in UTC. Window includes events with createdAt ∈ [${lastMon.toISOString()} , ${thisMon.toISOString()}).</p>${table}`;
  const results = [];
  for (const to of admins){ results.push(await sendEmail(to, title, body)); }
  await db.collection('logs').add({ level:'info', kind:'email.weekly.summary', sentTo: admins, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok:true, to: admins, campaigns: byCampaign.size };
}
