import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
export const AuthContext = createContext({ user: null, loading: true });
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        return onAuthStateChanged(auth, (next) => {
            setUser(next);
            setLoading(false);
        });
    }, []);
    const value = useMemo(() => ({ user, loading }), [user, loading]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
