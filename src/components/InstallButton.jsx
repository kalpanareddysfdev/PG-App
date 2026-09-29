import { useState } from 'react'
import { Download, MoreVertical, PlusSquare, Share } from 'lucide-react'
import Modal from './Modal'
import { detectPlatform, useInstall } from '../install'

const STEPS = {
  'ios-safari': [
    [Share, 'Tap the Share button at the bottom of Safari'],
    [PlusSquare, 'Scroll down and tap “Add to Home Screen”'],
    [null, 'Tap “Add” — PG Manager appears on your home screen'],
  ],
  'ios-other': [
    [Share, 'Tap the Share button (next to the address bar)'],
    [PlusSquare, 'Tap “Add to Home Screen”'],
    [null, 'If you don’t see it, open this page in Safari and try again'],
  ],
  android: [
    [MoreVertical, 'Tap the ⋮ menu at the top-right of Chrome'],
    [Download, 'Tap “Install app” or “Add to Home screen”'],
    [null, 'Tap “Install” — PG Manager appears with your apps'],
  ],
  'in-app': [
    [MoreVertical, 'You opened this inside another app (e.g. WhatsApp)'],
    [null, 'Tap ⋮ or ··· and choose “Open in browser” (Chrome or Safari)'],
    [null, 'Then tap “Install app” again'],
  ],
  desktop: [
    [Download, 'Click the install icon at the right end of the address bar'],
    [MoreVertical, 'Or open the browser ⋮ menu → “Install PG Manager…”'],
  ],
}

export default function InstallButton({ className = '' }) {
  const { installed, canPrompt, prompt } = useInstall()
  const [help, setHelp] = useState(false)
  if (installed) return null

  const platform = detectPlatform()

  return (
    <>
      <button
        type="button"
        className={`install-btn ${className}`}
        onClick={async () => {
          if (canPrompt) await prompt()
          else setHelp(true)
        }}
      >
        <Download size={16} /> Install app
      </button>
      {help && (
        <Modal
          title="Install PG Manager"
          subtitle="Opens full-screen from your home screen, like a normal app."
          onClose={() => setHelp(false)}
          size="sm"
          footer={
            <button className="btn primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          }
        >
          <ol className="install-steps">
            {STEPS[platform].map(([Icon, text], i) => (
              <li key={i}>
                <span className="install-num">{i + 1}</span>
                <span>{text}</span>
                {Icon && <Icon size={18} className="install-icon" />}
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  )
}
