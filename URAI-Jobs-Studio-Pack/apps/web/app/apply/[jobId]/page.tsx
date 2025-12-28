'use client';
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function Apply(){
  const { jobId } = useParams();
  const router = useRouter();
  const [resume, setResume] = useState<File|null>(null);
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', links:'', coverLetter:'' });
  const [busy, setBusy] = useState(false);

  async function recaptcha(){ return (window as any).grecaptcha?.execute?.(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'apply' }) || ''; }

  async function getSignedUploadUrl(file: File, token: string){
    const r = await fetch('/resumes_createUploadUrl', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ recaptchaToken: token }) });
    if (!r.ok) throw new Error('upload url');
    const j = await r.json();
    await fetch(j.uploadUrl, { method:'PUT', headers:{ 'Content-Type': j.contentType }, body: file });
    return j.resumePath as string;
  }

  const submit = async (e: React.FormEvent)=>{
    e.preventDefault(); if (busy) return; setBusy(true);
    const token = await recaptcha();
    let resumePath = '';
    if (resume) resumePath = await getSignedUploadUrl(resume, token);
    const r = await fetch('/ats_secureApply', { method:'POST', headers:{ 'Content-Type': 'application/json' }, body: JSON.stringify({
      recaptchaToken: token, jobId: String(jobId),
      fullName: form.fullName, email: form.email, phone: form.phone,
      links: form.links.split(',').map(s=>s.trim()).filter(Boolean),
      coverLetter: form.coverLetter, resumePath
    }) });
    if (!r.ok) { alert('Failed to submit'); setBusy(false); return; }
    router.push('/jobs');
  };

  return (<main className="mx-auto max-w-2xl p-6">
    <h1 className="text-2xl font-semibold mb-2">Apply</h1>
    <form onSubmit={submit} className="grid gap-4">
      <input className="border p-2 rounded-xl" placeholder="Full name" value={form.fullName} onChange={e=>setForm({...form, fullName:e.target.value})}/>
      <input className="border p-2 rounded-xl" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
      <input className="border p-2 rounded-xl" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
      <input className="border p-2 rounded-xl" placeholder="Links (comma separated)" value={form.links} onChange={e=>setForm({...form, links:e.target.value})}/>
      <textarea className="border p-2 rounded-xl min-h-40" placeholder="Cover letter" value={form.coverLetter} onChange={e=>setForm({...form, coverLetter:e.target.value})}/>
      <input type="file" accept="application/pdf" onChange={e=>setResume(e.target.files?.[0]||null)} />
      <button disabled={busy} className="rounded-xl border px-4 py-2">{busy? 'Submitting…':'Submit'}</button>
    </form>
  </main>);
}
