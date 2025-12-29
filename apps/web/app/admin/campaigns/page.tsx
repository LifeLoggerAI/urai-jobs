'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { app } from '../../../lib/firebase';
export default function Campaigns(){
  const db = getFirestore(app);
  const [rows,setRows]=useState<any[]>([]);
  const [subject,setSubject]=useState('');
  const [html,setHtml]=useState('<h1>Title</h1><p>Body</p>');
  useEffect(()=>{(async()=>{const s=await getDocs(collection(db,'marketing_campaigns'));setRows(s.docs.map(d=>({id:d.id,...d.data()})));})()},[]);
  const add=async()=>{await addDoc(collection(db,'marketing_campaigns'),{subject,html,createdAt:serverTimestamp()}); window.location.reload();};
  const send=async(id:string)=>{await addDoc(collection(db,'jobs_queue'), { type: 'marketing-batch-send', payload: {campaignId: id} }); alert('Queued!'); };
  const update=async(id:string)=>{await updateDoc(doc(db,'marketing_campaigns',id),{subject,html,updatedAt:serverTimestamp()}); window.location.reload(); };
  return (<main className="p-6 max-w-3xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold">Campaigns</h1>
    <input className="border p-2 rounded-xl w-full" value={subject} onChange={e=>setSubject(e.target.value)} />
    <textarea className="border p-2 rounded-xl w-full min-h-48 font-mono" value={html} onChange={e=>setHtml(e.target.value)} />
    <button onClick={add} className="border rounded-xl px-4 py-2">Add</button>
    <ul className="grid gap-2">{rows.map(r=> <li key={r.id} className="border rounded-xl p-3 space-x-2">
      <span>{r.subject}</span>
      <button onClick={()=>send(r.id)} className="border rounded-xl px-2 text-sm">Send</button>
      <button onClick={()=>update(r.id)} className="border rounded-xl px-2 text-sm">Update</button>
    </li>)}</ul>
  </main>);
}
