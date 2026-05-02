import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';
// Create the context with a default value
export const AuthContext = createContext({
    user: null,
    role: null,
    tokenResult: null,
    loading: true,
    error: null,
});
// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
// The AuthProvider component that will wrap our application
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [tokenResult, setTokenResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        // Use onIdTokenChanged to get the latest token with custom claims
        const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
            try {
                if (nextUser) {
                    const token = await nextUser.getIdTokenResult();
                    setUser(nextUser);
                    setTokenResult(token);
                    // The role is in the custom claims
                    setRole(token.claims.role);
                }
                else {
                    // User is signed out
                    setUser(null);
                    setTokenResult(null);
                    setRole(null);
                }
            }
            catch (err) {
                console.error('Auth state change error:', err);
                setError(err);
            }
            finally {
                setLoading(false);
            }
        });
        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);
    const value = useMemo(() => ({ user, role, tokenResult, loading, error }), [user, role, tokenResult, loading, error]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
