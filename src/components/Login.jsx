import { BedDouble, Building2, CalendarClock, IndianRupee } from 'lucide-react'
import { useAuth } from '../AuthContext'

const FEATURES = [
  [Building2, 'All your PGs in one place'],
  [BedDouble, 'Live bed vacancy per room'],
  [CalendarClock, 'Who leaves in the next 30 days'],
  [IndianRupee, 'Monthly rent: paid vs due'],
]

export default function Login() {
  const { signIn, error, demoMode } = useAuth()

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
          <h2>Welcome 👋</h2>
          <p className="muted">Sign in to manage your properties.</p>

          <button className="google-btn" onClick={signIn}>
            <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.2z" />
              <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 010-9.3l-7.8-6.1a24 24 0 000 21.5l7.8-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            {demoMode ? 'Continue in demo mode' : 'Continue with Google'}
          </button>

          {error && <p className="error">{error}</p>}

          {demoMode && (
            <p className="notice">
              Firebase isn’t connected yet, so data stays in this browser. Add your keys to{' '}
              <code>.env</code> for real Google sign-in and cloud sync.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
