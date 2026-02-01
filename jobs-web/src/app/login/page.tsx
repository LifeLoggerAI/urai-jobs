
'use client';

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    router.push('/jobs');
    return null;
  }

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <button onClick={handleLogin}>Sign in with Google</button>
    </div>
  );
}
