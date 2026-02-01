'use client'

import { ReactNode, useEffect, useState } from 'react'
import { getAuth } from 'firebase/auth'
import { firebaseApp } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

const auth = getAuth(firebaseApp)

export default function AuthedLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) {
        router.push('/login')
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return <div>Loading...</div>
  }

  return <div>{children}</div>
}
