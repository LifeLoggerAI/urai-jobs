import { createContext, useEffect, useMemo, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "../firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signOutUser: () => signOut(auth),
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
