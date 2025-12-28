'use client';
import React, { useState, useEffect } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  User,
  signOut,
} from 'firebase/auth';
import { app } from '../lib/firebase';

const auth = getAuth(app);

export default function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setErr(e.message || 'Failed to sign in');
    }
    setBusy(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (user) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <h1 className="text-2xl font-semibold mb-4">Welcome, {user.email}</h1>
        <button onClick={handleSignOut} className="border rounded-xl px-4 py-2">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin sign in</h1>
      <form onSubmit={handleSignIn} className="grid gap-3">
        <input
          className="border rounded-xl p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border rounded-xl p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err ? <div className="text-red-600 text-sm">{err}</div> : null}
        <button disabled={busy} className="border rounded-xl px-4 py-2">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
