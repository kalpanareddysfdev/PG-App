import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import JoinForm from './components/JoinForm.jsx'
import { AuthProvider } from './AuthContext.jsx'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker not available or registration failed (expected in dev sometimes)
    })
  })
}

// Tenant registration links (?join=<token>) skip the manager login entirely.
const joinToken = new URLSearchParams(window.location.search).get('join')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {joinToken ? (
      <JoinForm token={joinToken} />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
)
