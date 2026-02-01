
import { useState, useEffect, useContext, createContext } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const authContext = createContext({ user: null });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  return <authContext.Provider value={{ user }}>{children}</authContext.Provider>;
};

export const useAuth = () => {
  return useContext(authContext);
};
