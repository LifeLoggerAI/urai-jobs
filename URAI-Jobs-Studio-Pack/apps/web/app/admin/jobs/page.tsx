'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '../../lib/firebase';

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  useEffect(()=>{(async()=>{ const db = getFirestore(app); const q = query(collection(db,'jobs'), orderBy('createdAt','desc')); const snap = await getDocs(q); setJobs(snap.docs.map(d=>({id:d.id, ...d.data()}))); })()},[]);
  const createJob = async ()=>{ const db = getFirestore(app); await addDoc(collection(db,'jobs'), { title, status:'open', team:'Engineering', location:'Remote', createdAt: serverTimestamp(), description: 'TBD' }); window.location.reload(); };
  return (<main className="p-6 max-w-3xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold">Admin • Jobs</h1>
    <div className="flex gap-2">
      <input className="border rounded-xl p-2 flex-1" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <button onClick={createJob} className="border rounded-xl px-4">Create</button>
    </div>
    <ul className="grid gap-3">{jobs.map(j=> <li key={j.id} className="border rounded-xl p-4">{j.title}<div className="opacity-60">{j.status}</div></li>)}</ul>
  </main>);
}
