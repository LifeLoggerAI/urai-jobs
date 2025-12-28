'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { app } from '../../lib/firebase';
export default function Schedules(){
  const db = getFirestore(app);
  const [rows,setRows]=useState<any[]>([]);
  const [type,setType]=useState('weekly-scroll-generate');
  const [payload,setPayload]=useState('{\n  \"userId\": \"demo\"\n}');
  useEffect(()=>{(async()=>{const s=await getDocs(collection(db,'schedules'));setRows(s.docs.map(d=>({id:d.id,...d.data()})));})()},[]);
  const add=async()=>{await addDoc(collection(db,'schedules'),{type, payload: JSON.parse(payload), nextRunAt: serverTimestamp(), cron:'*/30 * * * *'}); window.location.reload();};
  return (<main className="p-6 max-w-3xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold">Schedules</h1>
    <input className="border p-2 rounded-xl w-full" value={type} onChange={e=>setType(e.target.value)} />
    <textarea className="border p-2 rounded-xl w-full min-h-48 font-mono" value={payload} onChange={e=>setPayload(e.target.value)} />
    <button onClick={add} className="border rounded-xl px-4 py-2">Add</button>
    <ul className="grid gap-2">{rows.map(r=> <li key={r.id} className="border rounded-xl p-3">{r.type} • next: {r.nextRunAt?.toDate?.().toLocaleString?.()||'-'}</li>)}</ul>
  </main>);
}
