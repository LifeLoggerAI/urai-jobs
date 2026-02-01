'use client'

import { useEffect } from 'react'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { firebaseApp } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

const auth = getAuth(firebaseApp)

export default function LoginPage() {
  const router = useRouter()

  const signIn = async () => {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error("Error signing in with Google", error)
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        router.push('/')
      }
    })
    return () => unsubscribe()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <button onClick={signIn} className="px-4 py-2 bg-blue-500 text-white rounded-md">
        Sign in with Google
      </button>
    </div>
  )
}
