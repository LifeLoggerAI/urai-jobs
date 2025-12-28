'use client';
import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '../../lib/firebase';
export default function SignIn(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const submit=async(e:React.FormEvent)=>{ e.preventDefault(); setErr(''); setBusy(true); try{ const auth=getAuth(app); await signInWithEmailAndPassword(auth,email,password); window.location.href='/admin'; }catch(e:any){ setErr(e.message||'Failed'); } finally{ setBusy(false); } };
  return (<main className="mx-auto max-w-sm p-6">
    <h1 className="text-2xl font-semibold mb-4">Admin sign in</h1>
    <form onSubmit={submit} className="grid gap-3">
      <input className="border rounded-xl p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border rounded-xl p-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      {err? <div className="text-red-600 text-sm">{err}</div>:null}
      <button disabled={busy} className="border rounded-xl px-4 py-2">{busy? 'Signing in…':'Sign in'}</button>
    </form>
  </main>); }
