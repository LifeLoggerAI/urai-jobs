'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { app } from '../../lib/firebase';
export default function Campaigns(){
  const db = getFirestore(app);
  const [rows,setRows]=useState<any[]>([]);
  const [subject,setSubject]=useState('URAI is live — your emotional OS');
  const [emails,setEmails]=useState('ally@example.com');
  const [html,setHtml]=useState('<h1>URAI</h1><p>We’re launching worldwide.</p>');
  useEffect(()=>{(async()=>{const s=await getDocs(collection(db,'marketing_campaigns'));setRows(s.docs.map(d=>({id:d.id,...d.data()})));})()},[]);
  const create=async()=>{const doc=await addDoc(collection(db,'marketing_campaigns'),{subject, emails: emails.split(',').map(x=>x.trim()).filter(Boolean), html, createdAt: serverTimestamp()}); alert('Created '+doc.id);};
  const enqueue=async(id:string)=>{await addDoc(collection(db,'jobs_queue'),{type:'marketing-batch-send', status:'queued', payload:{campaignId:id}, createdAt: serverTimestamp()}); alert('Queued');};
  return (<main className="p-6 max-w-4xl mx-auto space-y-4">
    <h1 className="text-2xl font-semibold">Campaigns</h1>
    <div className="grid gap-2">
      <input className="border p-2 rounded-xl" value={subject} onChange={e=>setSubject(e.target.value)} />
      <textarea className="border p-2 rounded-xl min-h-40" value={html} onChange={e=>setHtml(e.target.value)} />
      <input className="border p-2 rounded-xl" value={emails} onChange={e=>setEmails(e.target.value)} placeholder="comma emails"/>
      <button onClick={create} className="border rounded-xl px-4 py-2">Create</button>
    </div>
    <ul className="grid gap-2">{rows.map(r=> <li key={r.id} className="border rounded-xl p-3 flex items-center justify-between"><div><div className="font-medium">{r.subject}</div><div className="text-xs opacity-70">{(r.emails||[]).length} recipients</div></div><div className="flex gap-2"><a className="underline text-sm" href={`/admin/campaigns/${r.id}`}>Stats</a><button onClick={()=>enqueue(r.id)} className="border rounded-xl px-3 py-1">Send</button></div></li>)}
    </ul>
  </main>);
}
