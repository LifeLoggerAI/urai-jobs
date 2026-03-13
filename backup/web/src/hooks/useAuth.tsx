
import React, { createContext, useContext } from 'react';
import { useAuth as useFirebaseAuth } from './useAuth';

interface AuthContextType {
  user: any;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useFirebaseAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
