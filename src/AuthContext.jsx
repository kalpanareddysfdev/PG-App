import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from './firebase'

const AuthContext = createContext(null)

const DEMO_KEY = 'pg-app:demo-user'

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'This email is already registered. Sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/network-request-failed': 'No internet connection. Check your network and try again.',
}

function friendlyAuthError(err) {
  return AUTH_ERRORS[err?.code] || err?.message || 'Sign-in failed. Please try again.'
}

const IGNORED_ERRORS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const saved = localStorage.getItem(DEMO_KEY)
      if (saved) setUser(JSON.parse(saved))
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (fbUser) => {
      // Anonymous sessions belong to tenants using a join link, never to managers.
      setUser(
        fbUser && !fbUser.isAnonymous
          ? {
              uid: fbUser.uid,
              name: fbUser.displayName || fbUser.email,
              email: fbUser.email,
              photo: fbUser.photoURL,
              demo: false,
            }
          : null,
      )
      setLoading(false)
    })
  }, [])


  async function signUpWithEmail(email, password) {
    setError('')
    if (!isFirebaseConfigured) {
      const demoUser = {
        uid: 'demo-user',
        name: email,
        email,
        photo: null,
        demo: true,
      }
      localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser))
      setUser(demoUser)
      return
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(friendlyAuthError(err))
      throw err
    }
  }

  async function signInWithEmail(email, password) {
    setError('')
    if (!isFirebaseConfigured) {
      const demoUser = {
        uid: 'demo-user',
        name: email,
        email,
        photo: null,
        demo: true,
      }
      localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser))
      setUser(demoUser)
      return
    }
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(friendlyAuthError(err))
      throw err
    }
  }

  async function resetPassword(email) {
    setError('')
    if (!isFirebaseConfigured) {
      setError('Password reset is not available in demo mode.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (err) {
      setError(friendlyAuthError(err))
      throw err
    }
  }

  async function signOut() {
    if (!isFirebaseConfigured) {
      localStorage.removeItem(DEMO_KEY)
      setUser(null)
      return
    }
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        signOut,
        demoMode: !isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
