'use client';
import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '../lib/firebase';

export default function AdminGate({ children }: { children: React.ReactNode }){
  const [ready,setReady]=useState(false);
  const [ok,setOk]=useState(false);
  useEffect(()=>{
    const auth=getAuth(app);
    const unsub=onAuthStateChanged(auth, async (u)=>{
      if (!u){ setOk(false); setReady(true); return; }
      const tok= await u.getIdTokenResult(true);
      setOk(!!(tok as any).claims?.admin);
      setReady(true);
    });
    return unsub;
  },[]);
  if (!ready) return <main className="p-6">Loading…</main>;
  if (!ok) return <main className="p-6">
    <h1 className="text-xl font-semibold mb-2">Admins only</h1>
    <p className="mb-4">Sign in with an admin account.</p>
    <a href="/signin" className="underline">Go to sign in</a>
  </main>;
  return <>{children}</>;
}
