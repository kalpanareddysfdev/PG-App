import { useState } from ‘react’
import { Building2, BedDouble, CalendarClock, IndianRupee } from ‘lucide-react’
import { useAuth } from ‘../AuthContext’

const FEATURES = [
  [Building2, ‘All your PGs in one place’],
  [BedDouble, ‘Live bed vacancy per room’],
  [CalendarClock, ‘Who leaves in the next 30 days’],
  [IndianRupee, ‘Monthly rent: paid vs due’],
]

export default function Login() {
  const { signUpWithEmail, signInWithEmail, resetPassword, error, demoMode } = useAuth()
  const [mode, setMode] = useState(‘signin’)
  const [email, setEmail] = useState(‘’)
  const [password, setPassword] = useState(‘’)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [localError, setLocalError] = useState(‘’)

  async function handleSignIn(e) {
    e.preventDefault()
    setLocalError(‘’)
    setLoading(true)
    try {
      await signInWithEmail(email, password)
    } catch (err) {
      setLocalError(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setLocalError(‘’)
    setLoading(true)
    try {
      await signUpWithEmail(email, password)
    } catch (err) {
      setLocalError(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setLocalError(‘’)
    setLoading(true)
    try {
      await resetPassword(email)
      setResetSent(true)
      setEmail(‘’)
    } catch (err) {
      setLocalError(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login-hero">
        <div className="brand">
          <span className="brand-icon">
            <Building2 size={22} />
          </span>
          <div className="brand-name">PG Manager</div>
        </div>
        <h1>
          Run every PG
          <br />
          from one dashboard.
        </h1>
        <ul className="feature-list">
          {FEATURES.map(([Icon, text]) => (
            <li key={text}>
              <span>
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="login-panel">
        <div className="login-card">
          {resetSent ? (
            <>
              <h2>Check your email ✓</h2>
              <p className="muted">
                We’ve sent a password reset link to <strong>{email}</strong>. Click the link to set a new password.
              </p>
              <button
                className="form-button"
                onClick={() => {
                  setResetSent(false)
                  setMode(‘signin’)
                  setEmail(‘’)
                }}
              >
                Back to sign in
              </button>
            </>
          ) : mode === ‘reset’ ? (
            <>
              <h2>Reset password</h2>
              <p className="muted">Enter your email and we’ll send a reset link.</p>
              <form onSubmit={handleResetPassword}>
                <div className="form-row">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <button type="submit" className="form-button" disabled={loading}>
                  {loading ? ‘Sending...’ : ‘Send reset link’}
                </button>
              </form>
              <button
                className="link-button"
                onClick={() => {
                  setMode(‘signin’)
                  setLocalError(‘’)
                }}
              >
                Back to sign in
              </button>
            </>
          ) : mode === ‘signin’ ? (
            <>
              <h2>Welcome back 👋</h2>
              <p className="muted">Sign in to manage your properties.</p>
              <form onSubmit={handleSignIn}>
                <div className="form-row">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-row">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <button type="submit" className="form-button" disabled={loading}>
                  {loading ? ‘Signing in...’ : ‘Sign in’}
                </button>
              </form>
              <div className="auth-links">
                <button className="link-button" onClick={() => setMode(‘signup’)}>
                  Don’t have an account? Sign up
                </button>
                <button className="link-button" onClick={() => setMode(‘reset’)}>
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Create account 🚀</h2>
              <p className="muted">Sign up to start managing your PGs.</p>
              <form onSubmit={handleSignUp}>
                <div className="form-row">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-row">
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <button type="submit" className="form-button" disabled={loading}>
                  {loading ? ‘Creating account...’ : ‘Sign up’}
                </button>
              </form>
              <button className="link-button" onClick={() => setMode(‘signin’)}>
                Already have an account? Sign in
              </button>
            </>
          )}

          {localError && <p className="error">{localError}</p>}

          {demoMode && (
            <p className="notice">
              Firebase isn’t connected yet, so data stays in this browser. Add your keys to{‘ ‘}
              <code>.env</code> for real authentication and cloud sync.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
