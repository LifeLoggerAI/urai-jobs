'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../../lib/firebase';

export default function JobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState<any>(null);
  useEffect(()=>{(async()=>{
    const db = getFirestore(app);
    const snap = await getDoc(doc(db,'jobs', String(jobId)));
    setJob(snap.exists()? {id: snap.id, ...snap.data()} : null);
  })()},[jobId]);
  if (!job) return <main className="p-6">Loading…</main>;
  return (<main className="mx-auto max-w-3xl p-6 space-y-6">
    <a className="text-sm underline" href="/jobs">← Back</a>
    <h1 className="text-3xl font-semibold">{job.title}</h1>
    <div className="opacity-70">{job.team} • {job.location} • {job.compensation}</div>
    <article className="prose">{job.description}</article>
    <a className="inline-flex rounded-xl px-4 py-2 border" href={`/apply/${job.id}`}>Apply</a>
  </main>);
}
