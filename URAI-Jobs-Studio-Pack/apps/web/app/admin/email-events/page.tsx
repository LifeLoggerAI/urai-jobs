'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { app } from '../../lib/firebase';

export default function EmailEvents(){
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{(async()=>{
    const db = getFirestore(app);
    const qy = query(collection(db,'email_events'), orderBy('createdAt','desc'), limit(200));
    const snap = await getDocs(qy);
    setRows(snap.docs.map(d=>({ id: d.id, ...d.data() })));
  })()},[]);
  return (<main className="p-6 max-w-5xl mx-auto">
    <h1 className="text-2xl font-semibold mb-4">Email Events</h1>
    <table className="w-full text-sm"><thead><tr className="text-left"><th className="py-2">Provider</th><th>Event</th><th>Email</th><th>When</th></tr></thead><tbody>
      {rows.map((r)=>{
        const when = r.createdAt?.toDate?.().toLocaleString?.() || '';
        const ev = r.provider==='sendgrid' ? (r.event||'') : (r.payload?.type||r.payload?.event||'');
        const email = r.provider==='sendgrid' ? (r.email||'') : (r.payload?.data?.email||r.payload?.email||'');
        return (<tr key={r.id} className="border-t">
          <td className="py-2">{r.provider}</td><td>{ev}</td><td>{email}</td><td>{when}</td>
        </tr>);
      })}
    </tbody></table>
  </main>);
}
