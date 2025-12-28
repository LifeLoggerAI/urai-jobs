'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFirestore, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../../../lib/firebase';

export default function Apply() {
  const { jobId } = useParams();
  const router = useRouter();
  const [resume, setResume] = useState<File|null>(null);
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', links:'', coverLetter:'' });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    const db = getFirestore(app);
    const storage = getStorage(app);
    let resumePath = '';
    if (resume) {
      const key = `resumes/${Date.now()}_${resume.name}`;
      const r = ref(storage, key);
      await uploadBytes(r, resume);
      resumePath = key;
    }
    await addDoc(collection(db,'applications'), {
      jobId: String(jobId),
      fullName: form.fullName, email: form.email, phone: form.phone,
      links: form.links.split(',').map(s=>s.trim()).filter(Boolean),
      coverLetter: form.coverLetter,
      resumePath, source: 'urai.app', createdAt: serverTimestamp()
    });
    router.push('/jobs');
  };

  return (<main className="mx-auto max-w-2xl p-6">
    <h1 className="text-2xl font-semibold mb-2">Apply</h1>
    <form onSubmit={onSubmit} className="grid gap-4">
      <input className="border p-2 rounded-xl" placeholder="Full name" value={form.fullName} onChange={e=>setForm({...form, fullName:e.target.value})}/>
      <input className="border p-2 rounded-xl" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
      <input className="border p-2 rounded-xl" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
      <input className="border p-2 rounded-xl" placeholder="Links (comma separated)" value={form.links} onChange={e=>setForm({...form, links:e.target.value})}/>
      <textarea className="border p-2 rounded-xl min-h-40" placeholder="Cover letter" value={form.coverLetter} onChange={e=>setForm({...form, coverLetter:e.target.value})}/>
      <input type="file" accept="application/pdf" onChange={e=>setResume(e.target.files?.[0]||null)} />
      <button disabled={busy} className="rounded-xl border px-4 py-2">Submit</button>
    </form>
  </main>);
}
