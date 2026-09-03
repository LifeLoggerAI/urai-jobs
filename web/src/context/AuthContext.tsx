
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { IdTokenResult } from 'firebase/auth';

// Define a more detailed type for our auth context
export interface AuthContextType {
  user: User | null;
  role: 'admin' | 'user' | null;
  tokenResult: IdTokenResult | null;
  loading: boolean;
  error: Error | null;
}

// Create the context with a default value
export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  tokenResult: null,
  loading: true,
  error: null,
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// The AuthProvider component that will wrap our application
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [tokenResult, setTokenResult] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Use onIdTokenChanged to get the latest token with custom claims
    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
      try {
        if (nextUser) {
          const token = await nextUser.getIdTokenResult();
          setUser(nextUser);
          setTokenResult(token);
          // The role is in the custom claims
          setRole(token.claims.role as 'admin' | 'user' | null);
        } else {
          // User is signed out
          setUser(null);
          setTokenResult(null);
          setRole(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ user, role, tokenResult, loading, error }),
    [user, role, tokenResult, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
