'use client';
import React, { useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '../../../lib/firebase';
export default function QueueAdmin(){
  const [type, setType] = useState('weekly-scroll-generate');
  const [payload, setPayload] = useState('{\n  \"userId\": \"demo\"\n}');
  const add = async ()=>{
    const db = getFirestore(app);
    await addDoc(collection(db,'jobs_queue'), { type, status:'queued', payload: JSON.parse(payload), createdAt: serverTimestamp() });
    alert('Queued!');
  };
  return (<main className="p-6 max-w-2xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold">Admin • Queue</h1>
    <input className="border p-2 rounded-xl w-full" value={type} onChange={e=>setType(e.target.value)} />
    <textarea className="border p-2 rounded-xl w-full min-h-48 font-mono" value={payload} onChange={e=>setPayload(e.target.value)} />
    <button className="border rounded-xl px-4 py-2" onClick={add}>Add Job</button>
  </main>);
}
