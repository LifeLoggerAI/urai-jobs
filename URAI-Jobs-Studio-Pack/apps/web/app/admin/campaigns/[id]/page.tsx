'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '../../../lib/firebase';

export default function CampaignDetail(){
  const { id } = useParams();
  const [opens, setOpens] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [uniqueOpens, setUniqueOpens] = useState(0);
  const [uniqueClicks, setUniqueClicks] = useState(0);

  useEffect(()=>{(async()=>{
    const db = getFirestore(app);
    const qOpen = query(collection(db,'email_events'), where('campaignId','==', String(id)), where('event','==','open'));
    const qClick = query(collection(db,'email_events'), where('campaignId','==', String(id)), where('event','==','click'));
    const [sO, sC] = await Promise.all([getDocs(qOpen), getDocs(qClick)]);
    setOpens(sO.size); setClicks(sC.size);
    const openSet = new Set<string>(); sO.forEach(d=>{ const e=(d.data() as any).email; if (e) openSet.add(e); });
    const clickSet = new Set<string>(); sC.forEach(d=>{ const e=(d.data() as any).email; if (e) clickSet.add(e); });
    setUniqueOpens(openSet.size); setUniqueClicks(clickSet.size);
  })()},[id]);

  return (<main className="p-6 max-w-4xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold">Campaign • {String(id)}</h1>
    <div className="grid grid-cols-2 gap-4">
      <div className="border rounded-2xl p-4"><div className="text-sm opacity-70">Opens</div><div className="text-3xl font-semibold">{opens}</div><div className="text-xs">Unique: {uniqueOpens}</div></div>
      <div className="border rounded-2xl p-4"><div className="text-sm opacity-70">Clicks</div><div className="text-3xl font-semibold">{clicks}</div><div className="text-xs">Unique: {uniqueClicks}</div></div>
    </div>
    <div className="text-xs opacity-70">UTM tags auto‑appended (source=urai, medium=email, campaign={String(id)}).</div>
    <a className="underline text-sm" href={`/admin/campaigns/${String(id)}/charts`}>View charts</a>
  </main>);
}
