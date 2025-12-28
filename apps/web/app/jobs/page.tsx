'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '../../lib/firebase';

export default function JobsList() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(()=>{(async()=>{
    const db = getFirestore(app);
    const q = query(collection(db,'jobs'), where('status','==','open'));
    const snap = await getDocs(q);
    setJobs(snap.docs.map(d=>({id:d.id, ...d.data()})));
  })()},[]);
  return (<main className="mx-auto max-w-3xl p-6">
    <h1 className="text-3xl font-semibold mb-4">Open Roles</h1>
    <ul className="grid gap-4">{jobs.map(j=> (<li key={j.id} className="rounded-2xl p-5 border">
      <a className="text-xl font-medium underline" href={`/jobs/${j.id}`}>{j.title}</a>
      <div className="text-sm opacity-70">{j.team} • {j.location}</div>
    </li>))}</ul>
  </main>);
}
