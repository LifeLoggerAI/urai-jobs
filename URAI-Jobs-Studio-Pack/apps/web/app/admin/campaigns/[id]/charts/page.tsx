'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../../../lib/firebase';

export default function CampaignCharts(){
  const { id } = useParams();
  const [rows,setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(7);

  const load = async ()=>{
    const db = getFirestore(app);
    const qy = query(collection(db, 'campaign_stats/'+String(id)+'/daily'), orderBy('day','asc'));
    const snap = await getDocs(qy);
    setRows(snap.docs.map(d=>({ id:d.id, ...d.data() })));
  };
  useEffect(()=>{ load(); },[id]);

  const rerunCampaign = async ()=>{
    try { setBusy(true); const auth = getAuth(); const idToken = await auth.currentUser?.getIdToken?.(); if (!idToken){ alert('Sign in as admin first'); setBusy(false); return; } const r = await fetch('/admin_runCampaignRollup', { method:'POST', headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type':'application/json' }, body: JSON.stringify({ campaignId: String(id), days }) }); const j = await r.json(); if (!r.ok) throw new Error(j?.error||'failed'); await load(); alert('Campaign rollup re-run'); } catch (e:any){ alert(e.message); } finally { setBusy(false); }
  };

  return (<main className="p-6 max-w-5xl mx-auto space-y-6">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Campaign Charts • {String(id)}</h1>
      <div className="flex items-center gap-2">
        <input className="border rounded-xl px-2 py-1 w-20" type="number" min="1" max="90" value={days} onChange={e=>setDays(parseInt(e.target.value||'7',10))} />
        <button onClick={rerunCampaign} disabled={busy} className="border rounded-xl px-4 py-2">{busy? 'Running…':'Re-run (campaign only)'}
        </button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="border rounded-2xl p-4">
        <div className="text-sm opacity-70">Opens (daily)</div>
        <ul className="text-sm mt-2 space-y-1">{rows.map(r=> <li key={r.id}>{r.day}: {r.opens} (unique {r.uniqueOpens})</li>)}</ul>
      </div>
      <div className="border rounded-2xl p-4">
        <div className="text-sm opacity-70">Clicks (daily)</div>
        <ul className="text-sm mt-2 space-y-1">{rows.map(r=> <li key={r.id}>{r.day}: {r.clicks} (unique {r.uniqueClicks})</li>)}</ul>
      </div>
    </div>
  </main>);
}
