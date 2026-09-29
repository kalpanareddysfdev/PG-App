import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebase'

const AuthContext = createContext(null)

const DEMO_KEY = 'pg-app:demo-user'

const AUTH_ERRORS = {
  'auth/configuration-not-found':
    'Google sign-in is not enabled yet. In Firebase Console open Authentication → Sign-in method and enable Google.',
  'auth/operation-not-allowed':
    'Google sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.',
  'auth/unauthorized-domain':
    'This website is not allowed to sign in. Add it under Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/popup-blocked': 'The browser blocked the sign-in popup. Allow popups for this site and try again.',
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

  async function signIn() {
    setError('')
    if (!isFirebaseConfigured) {
      const demoUser = {
        uid: 'demo-user',
        name: 'Demo Manager',
        email: 'demo@pgapp.local',
        photo: null,
        demo: true,
      }
      localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser))
      setUser(demoUser)
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (!IGNORED_ERRORS.includes(err?.code)) setError(friendlyAuthError(err))
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
      value={{ user, loading, error, signIn, signOut, demoMode: !isFirebaseConfigured }}
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
