'use client';
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { app } from '../../lib/firebase';
export default function Applications(){
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{(async()=>{const db=getFirestore(app);const q=query(collection(db,'applications'), orderBy('createdAt','desc'));const s=await getDocs(q);setRows(s.docs.map(d=>({id:d.id,...d.data()})));})()},[]);
  return (<main className="p-6 max-w-5xl mx-auto">
    <h1 className="text-2xl font-semibold mb-4">Applications</h1>
    <table className="w-full text-sm"><thead><tr className="text-left"><th className="py-2">Name</th><th>Email</th><th>Job</th><th>Score</th><th>Date</th></tr></thead><tbody>
      {rows.map(r=> <tr key={r.id} className="border-t"><td className="py-2">{r.fullName}</td><td>{r.email}</td><td>{r.jobId}</td><td>{r.score|| '-'}</td><td>{r.createdAt?.toDate?.().toLocaleString?.()||''}</td></tr>)}
    </tbody></table>
  </main>);
}
