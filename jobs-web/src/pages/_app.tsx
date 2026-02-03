import { AppProps } from 'next/app';
import '../app/globals.css';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { auth } from '../lib/firebase';

function MyApp({ Component, pageProps }: AppProps) {
  const { setUser } = useAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setUser(user);
    });

    return () => unsubscribe();
  }, [setUser]);

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;
