import { createContext, useEffect, useMemo, useState } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

export const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
  }, [])

  const value = useMemo(() => ({ user, loading }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
