import { useState } from 'react'
import { Building2, BedDouble, CalendarClock, IndianRupee, Mail, Lock, Eye, EyeOff, ArrowRight, Home } from 'lucide-react'
import { useAuth } from '../AuthContext'

const FEATURES = [
  [Building2, 'All your PGs in one place'],
  [BedDouble, 'Live bed vacancy per room'],
  [CalendarClock, 'Who leaves in the next 30 days'],
  [IndianRupee, 'Monthly rent: paid vs due'],
]

function Logo({ small }) {
  return (
    <span className={small ? 'pgm-logo small' : 'pgm-logo'}>
      {small ? 'PG' : 'PGMaaya'}
    </span>
  )
}

function Field({ icon: Icon, type = 'text', toggle, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="form-row">
      <div className="field">
        <Icon size={18} className="field-icon" />
        <input type={toggle && show ? 'text' : type} {...props} />
        {toggle && (
          <button
            type="button"
            className="field-toggle"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Login() {
  const { signUpWithEmail, signInWithEmail, resetPassword, error, demoMode } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleSignIn(e) {
    e.preventDefault()
    setLocalError('')
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
    setLocalError('')
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
    setLocalError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setResetSent(true)
      setEmail('')
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
            <Logo small />
          </span>
          <div>
            <Logo />
            <div className="brand-name">PG Manager</div>
          </div>
        </div>
        <h1>
          Run every PG
          <br />
          <em>from one dashboard.</em>
        </h1>
        <p className="hero-tag">Simpler. Smarter. Together.</p>
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
          <div className="card-logo">
            <Logo />
            <p>Your Home Away From Home</p>
          </div>
          {resetSent ? (
            <>
              <h2>Check your email ✓</h2>
              <p className="muted">
                We've sent a password reset link to <strong>{email}</strong>. Click the link to set a new password.
              </p>
              <button
                className="form-button"
                onClick={() => {
                  setResetSent(false)
                  setMode('signin')
                  setEmail('')
                }}
              >
                Back to sign in
              </button>
            </>
          ) : mode === 'reset' ? (
            <>
              <h2>Reset password</h2>
              <p className="muted">Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleResetPassword}>
                <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
                <button type="submit" className="form-button" disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <button
                className="link-button"
                onClick={() => {
                  setMode('signin')
                  setLocalError('')
                }}
              >
                Back to sign in
              </button>
            </>
          ) : mode === 'signin' ? (
            <>
              <h2>Welcome back 👋</h2>
              <p className="muted">Sign in to manage your PG.</p>
              <form onSubmit={handleSignIn}>
                <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
                <Field icon={Lock} type="password" toggle placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
                <button type="submit" className="form-button" disabled={loading}>
                  {loading ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}
                </button>
              </form>
              <div className="auth-links">
                <button className="link-button" onClick={() => setMode('signup')}>
                  Don't have an account? Sign up
                </button>
                <button className="link-button" onClick={() => setMode('reset')}>
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Create account 🚀</h2>
              <p className="muted">Sign up to start managing your PGs.</p>
              <form onSubmit={handleSignUp}>
                <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
                <Field icon={Lock} type="password" toggle placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
                <button type="submit" className="form-button" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign up'}
                </button>
              </form>
              <button className="link-button" onClick={() => setMode('signin')}>
                Already have an account? Sign in
              </button>
            </>
          )}

          {localError && <p className="error">{localError}</p>}

          <div className="card-footer">
            <Home size={14} /> PG Manager
          </div>

          {demoMode && (
            <p className="notice">
              Firebase isn't connected yet, so data stays in this browser. Add your keys to{' '}
              <code>.env</code> for real authentication and cloud sync.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
