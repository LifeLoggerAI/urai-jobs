'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { app } from '../../lib/firebase';

export default function Recipients(){
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{(async()=>{
    const db=getFirestore(app);
    const qy=query(collection(db,'marketing_recipients'), orderBy('email','asc'), limit(500));
    const s=await getDocs(qy);
    setRows(s.docs.map(d=>({id:d.id,...d.data()})));
  })()},[]);
  const toggle = async (id:string, suppressed:boolean)=>{
    const db=getFirestore(app);
    await updateDoc(doc(db,'marketing_recipients', id), { suppressed: !suppressed });
    setRows(rows.map(r=> r.id===id? {...r, suppressed: !suppressed}: r));
  };
  return (<main className="p-6 max-w-5xl mx-auto">
    <h1 className="text-2xl font-semibold mb-4">Recipients</h1>
    <table className="w-full text-sm"><thead><tr className="text-left"><th className="py-2">Email</th><th>Suppressed</th><th>Reason</th><th>Action</th></tr></thead><tbody>
      {rows.map(r=> <tr key={r.id} className="border-t"><td className="py-2">{r.email||r.id}</td><td>{r.suppressed? 'yes':'no'}</td><td className="truncate max-w-[24ch]">{r.suppressedReason||''}</td><td><button className="border rounded-xl px-3 py-1" onClick={()=>toggle(r.id, !!r.suppressed)}>{r.suppressed? 'Unsuppress':'Suppress'}</button></td></tr>)}
    </tbody></table>
  </main>);
}
