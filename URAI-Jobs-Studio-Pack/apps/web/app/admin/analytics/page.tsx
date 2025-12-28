'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../lib/firebase';

export default function Analytics(){
  const [opens,setOpens]=useState(0);
  const [clicks,setClicks]=useState(0);
  const [last,setLast]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{(async()=>{
    const db = getFirestore(app);
    const q1 = query(collection(db,'email_events'), where('event','==','open'));
    const q2 = query(collection(db,'email_events'), where('event','==','click'));
    const [s1,s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    setOpens(s1.size); setClicks(s2.size);
    const recent = query(collection(db,'email_events'), orderBy('createdAt','desc'), limit(25));
    const s3 = await getDocs(recent);
    setLast(s3.docs.map(d=>({id:d.id,...d.data()})));
  })()},[]);

  const sendNow = async ()=>{
    try {
      setBusy(true);
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken?.();
      if (!idToken) { alert('Sign in as admin first'); setBusy(false); return; }
      const r = await fetch('/admin_runWeeklySummary', { method:'POST', headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' } });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error||'failed');
      alert('Summary sent');
    } catch (e:any){ alert(e.message); } finally { setBusy(false); }
  };

  return (<main className="p-6 max-w-5xl mx-auto space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">Campaign Analytics</h1>
      <button onClick={sendNow} disabled={busy} className="border rounded-xl px-4 py-2">{busy? 'Sending…':'Send summary now'}</button>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="border rounded-2xl p-4"><div className="text-sm opacity-70">Total opens</div><div className="text-3xl font-semibold">{opens}</div></div>
      <div className="border rounded-2xl p-4"><div className="text-sm opacity-70">Total clicks</div><div className="text-3xl font-semibold">{clicks}</div></div>
    </div>
    <div>
      <h2 className="text-lg font-medium mb-2">Recent events</h2>
      <table className="w-full text-sm"><thead><tr className="text-left"><th className="py-2">Event</th><th>Email</th><th>Campaign</th><th>URL</th><th>When</th></tr></thead><tbody>
        {last.map((r)=>{
          const when = r.createdAt?.toDate?.().toLocaleString?.()||'';
          return (<tr key={r.id} className="border-t">
            <td className="py-2">{r.event||r.payload?.event||r.payload?.type}</td>
            <td>{r.email||r.payload?.data?.email||''}</td>
            <td>{r.campaignId||''}</td>
            <td className="truncate max-w-[30ch]">{r.url||''}</td>
            <td>{when}</td>
          </tr>);
        })}
      </tbody></table>
    </div>
  </main>);
}
