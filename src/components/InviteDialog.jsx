import { useState } from 'react'
import { Check, Copy, Link2, Loader2, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import Modal from './Modal'
import { pgDisplayName, whatsappShare } from '../utils'

export function joinUrl(token) {
  return `${window.location.origin}/?join=${token}`
}

export default function InviteDialog({ property, freeBeds, demoMode, onEnable, onToggle, onRegenerate, onClose }) {
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const invite = property.invite
  const url = invite?.token ? joinUrl(invite.token) : ''
  const pg = pgDisplayName(property.name)
  const message = `Hi! Please register for ${pg}. Fill in your details and choose your room and bed here:\n${url}`

  async function run(kind, fn) {
    setBusy(kind)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(
        err?.code === 'permission-denied'
          ? 'Firestore blocked this. Publish the latest firestore.rules in Firebase Console → Firestore → Rules.'
          : err?.message || 'Something went wrong',
      )
    } finally {
      setBusy('')
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Modal title="Invite tenants" subtitle={`One link for everyone in ${pg}`} onClose={onClose}>
      {demoMode ? (
        <div className="notice">
          Invite links need Firebase. You are in demo mode, so tenants on other phones cannot reach
          your data. Add your Firebase keys to <code>.env</code> to use this feature.
        </div>
      ) : !invite?.token ? (
        <div className="invite-empty">
          <span className="empty-icon">
            <Link2 size={26} />
          </span>
          <p>
            Share one link in your tenants’ WhatsApp group. Each tenant fills in their own details,
            photo and ID, and picks a free bed. Requests come to you to approve.
          </p>
          <ul className="check-list">
            <li>
              <Check size={15} /> Each bed can be claimed only once
            </li>
            <li>
              <Check size={15} /> You approve or reject every request
            </li>
            <li>
              <Check size={15} /> Turn the link off any time
            </li>
          </ul>
          <button className="btn primary" disabled={!!busy} onClick={() => run('enable', onEnable)}>
            {busy === 'enable' ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
            Create invite link
          </button>
        </div>
      ) : (
        <div className="invite">
          <div className={`invite-status ${invite.active ? 'on' : 'off'}`}>
            <span>
              <strong>{invite.active ? 'Link is active' : 'Link is turned off'}</strong>
              <span className="muted small">
                {invite.active
                  ? `${freeBeds} free bed${freeBeds === 1 ? '' : 's'} offered · updates automatically`
                  : 'Tenants who open it will see “link inactive”.'}
              </span>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={!!invite.active}
              disabled={!!busy}
              onChange={(e) => run('toggle', () => onToggle(e.target.checked))}
              aria-label="Link active"
            />
          </div>

          <div className={`link-box ${invite.active ? '' : 'disabled'}`}>
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <button className="btn small" onClick={copy} disabled={!invite.active}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <a
            className={`btn whatsapp ${invite.active ? '' : 'disabled-link'}`}
            href={invite.active ? whatsappShare(message) : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!invite.active}
          >
            <MessageCircle size={17} /> Share on WhatsApp
          </a>

          <div className="invite-foot">
            <span className="muted small">
              <ShieldCheck size={14} /> Link leaked? Make a new one — the old link stops working.
            </span>
            <button
              className="btn small ghost"
              disabled={!!busy}
              onClick={() => run('regen', onRegenerate)}
            >
              {busy === 'regen' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              New link
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  )
}
