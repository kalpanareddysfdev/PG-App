import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { BedDouble, Building2, CheckCircle2, HelpCircle, Loader2, Lock, LogOut } from 'lucide-react'
import { auth, googleProvider, isFirebaseConfigured } from '../firebase'
import {
  AlreadyAppliedError,
  BedTakenError,
  loadJoinLink,
  loadMyApplication,
  submitJoinRequest,
} from '../store'
import { PhotoPicker, ProofPicker } from './FilePickers'
import { bedKey, formatRupees, parseBedKey, pgDisplayName, sharingLabel } from '../utils'
import { openDataUrl, splitChunks } from '../media'

const blank = { name: '', phone: '', emergencyContact: '', address: '', idType: '', idNumber: '', company: '', email: '' }
const ID_TYPES = ['Voter ID', 'Aadhar', 'Driving License']

const IGNORED_AUTH_ERRORS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

function isGoogleUser(user) {
  return !!user && !user.isAnonymous && user.providerData.some((p) => p.providerId === 'google.com')
}

export default function JoinForm({ token }) {
  // loading → signin → ready | error
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState(null)
  const [user, setUser] = useState(null)
  const [application, setApplication] = useState(null)
  const [signingIn, setSigningIn] = useState(false)
  const [form, setForm] = useState(blank)
  const [floor, setFloor] = useState('')
  const [roomId, setRoomId] = useState('')
  const [bed, setBed] = useState('')
  const [photo, setPhoto] = useState(null)
  const [proof, setProof] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const data = await loadJoinLink(token)
    if (!data) throw Object.assign(new Error('missing'), { code: 'not-found' })
    setLink(data)
    return data
  }, [token])

  useEffect(() => {
    // Demo mode: skip auth, show form directly with mock data
    if (token === 'demo') {
      setStatus('loading')
      setLink({
        pgName: 'Demo PG',
        active: true,
        beds: {
          'room-1:A': true,
          'room-1:B': true,
          'room-2:A': true,
        },
        rooms: [
          { id: 'room-1', name: '101', floor: '1', capacity: 2, rent: 15000 },
          { id: 'room-2', name: '102', floor: '1', capacity: 1, rent: 12000 },
        ],
        claimed: {},
      })
      setUser({ email: 'demo@example.com', displayName: 'Demo User', uid: 'demo' })
      setStatus('ready')
      return
    }
    if (!isFirebaseConfigured) {
      setStatus('error')
      setMessage('This app is not connected to a server yet.')
      return
    }
    let cancelled = false
    const stop = onAuthStateChanged(auth, async (current) => {
      if (!isGoogleUser(current)) {
        if (current) await signOut(auth).catch(() => {})
        if (cancelled) return
        setUser(null)
        setApplication(null)
        setStatus('signin')
        return
      }
      setStatus('loading')
      try {
        const [, mine] = await Promise.all([refresh(), loadMyApplication(token, current.uid)])
        if (cancelled) return
        setUser(current)
        setApplication(mine)
        setForm((f) => (f.name ? f : { ...f, name: current.displayName || '' }))
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        const code = err?.code || ''
        setMessage(
          code === 'not-found' || code === 'permission-denied'
            ? 'This link is invalid or has been turned off. Ask your PG manager for a new one.'
            : 'Could not open the link. Check your internet and try again.',
        )
      }
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [refresh, token])

  async function signInWithGoogle() {
    setError('')
    setSigningIn(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (!IGNORED_AUTH_ERRORS.includes(err?.code)) {
        setError(
          err?.code === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
            : 'Google sign-in failed. Please try again.',
        )
      }
    } finally {
      setSigningIn(false)
    }
  }

  function switchAccount() {
    setForm(blank)
    setRoomId('')
    setBed('')
    setPhoto(null)
    setProof(null)
    setError('')
    signOut(auth).catch(() => {})
  }

  const freeKeys = useMemo(() => {
    if (!link) return []
    return Object.keys(link.beds || {}).filter((k) => !link.claimed?.[k])
  }, [link])

  const rooms = useMemo(() => {
    if (!link) return []
    const byRoom = {}
    for (const key of freeKeys) {
      const { roomId: rid, bed: b } = parseBedKey(key)
      ;(byRoom[rid] ||= []).push(b)
    }
    return (link.rooms || [])
      .filter((r) => byRoom[r.id])
      .map((r) => ({ ...r, freeBeds: byRoom[r.id].sort() }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }))
  }, [link, freeKeys])

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor || '—'))], [rooms])
  const visibleRooms = rooms.filter((r) => !floor || (r.floor || '—') === floor)
  const room = rooms.find((r) => r.id === roomId)

  useEffect(() => {
    if (floors.length === 1) setFloor(floors[0])
  }, [floors])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Please enter your full name')
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Please enter a valid 10-digit phone number')
    if (!form.emergencyContact.trim()) return setError('Please enter emergency contact details')
    if (!form.address.trim()) return setError('Please enter your permanent address')
    if (!photo) return setError('Please upload your profile photo')
    if (!form.idType) return setError('Please select your ID type')
    if (!proof) return setError('Please upload your ID proof')
    if (!form.company.trim()) return setError('Please enter your company or institute name')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Please enter a valid email address')
    if (!room || !bed) return setError('Please choose your room and bed')

    setSubmitting(true)
    const key = bedKey(room.id, bed)
    try {
      const idNote = form.idType ? `${form.idType}${form.idNumber ? ': ' + form.idNumber : ''}` : ''
      await submitJoinRequest(
        token,
        key,
        user,
        {
          name: form.name.trim().slice(0, 80),
          phone: form.phone.trim().slice(0, 20),
          emergencyContact: form.emergencyContact.trim().slice(0, 120),
          address: form.address.trim().slice(0, 300),
          idNote: idNote.slice(0, 120),
          company: form.company,
          email: form.email.trim(),
          roomId: room.id,
          bed,
          hasPhoto: !!photo,
          proofName: (proof?.name || '').slice(0, 120),
          proofType: proof?.type || '',
          proofChunks: proof ? splitChunks(proof.data).length : 0,
        },
        { photo, proof },
      )
      setApplication({ bedKey: key, name: form.name.trim() })
    } catch (err) {
      if (err instanceof AlreadyAppliedError) {
        setApplication(await loadMyApplication(token, user.uid).catch(() => ({})))
      } else if (err instanceof BedTakenError) {
        setError(`Sorry, ${bed} in room ${room.name} was just taken. Please pick another bed.`)
        setBed('')
        await refresh().catch(() => {})
      } else {
        setError(
          err?.code === 'permission-denied'
            ? 'This link was turned off or that bed is no longer available.'
            : err?.message || 'Could not submit. Please try again.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const pgName = link ? pgDisplayName(link.pgName || 'PG') : 'PG'
  const applied = application ? parseBedKey(application.bedKey || '') : null
  const appliedRoom = applied && link?.rooms?.find((r) => r.id === applied.roomId)
  const accountBar = user && (
    <div className="join-account">
      <span>
        Signed in as <strong>{user.email}</strong>
      </span>
      <button type="button" className="link-btn" onClick={switchAccount}>
        <LogOut size={14} /> Switch account
      </button>
    </div>
  )

  return (
    <div className="join">
      <header className="join-head">
        <span className="brand-icon">
          <Building2 size={20} />
        </span>
        <div>
          <strong>{status === 'ready' ? pgName : 'PGMaaya'}</strong>
          <span>Tenant registration</span>
        </div>
      </header>

      <main className="join-body">
        {status === 'loading' && (
          <div className="join-card center-box">
            <Loader2 size={24} className="spin" />
            <p className="muted">Opening your registration form…</p>
          </div>
        )}

        {status === 'signin' && (
          <div className="join-card center-box">
            <span className="empty-icon">
              <Lock size={26} />
            </span>
            <h2>Sign in to register</h2>
            <p className="muted">
              Please continue with your Google account. Each account can send one registration
              request.
            </p>
            <button className="google-btn" onClick={signInWithGoogle} disabled={signingIn}>
              {signingIn ? <Loader2 size={18} className="spin" /> : <GoogleMark />}
              Continue with Google
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        )}

        {status === 'error' && (
          <div className="join-card center-box">
            <span className="empty-icon red">
              <Lock size={26} />
            </span>
            <h2>Link unavailable</h2>
            <p className="muted">{message}</p>
          </div>
        )}

        {status === 'ready' && application && (
          <div className="join-card center-box">
            <span className="empty-icon green">
              <CheckCircle2 size={28} />
            </span>
            <h2>Request sent!</h2>
            <p className="muted">
              {application.name ? `Thanks ${application.name.split(' ')[0]}. ` : ''}Your request
              {appliedRoom ? ` for room ${appliedRoom.name}, ${applied.bed}` : ''} is with the {pgName}{' '}
              manager, who will confirm your bed.
            </p>
            <p className="muted small">Only one request is allowed per Google account.</p>
            {accountBar}
          </div>
        )}

        {status === 'ready' && !application && !link.active && (
          <div className="join-card center-box">
            <span className="empty-icon red">
              <Lock size={26} />
            </span>
            <h2>Registration closed</h2>
            <p className="muted">This link has been turned off. Contact your PG manager.</p>
          </div>
        )}

        {status === 'ready' && !application && link.active && (
          <form className="join-card form" onSubmit={submit}>
            <div>
              <h1>Join {pgName}</h1>
              <p className="muted">Fill in your details and choose your bed. Takes about 2 minutes.</p>
            </div>
            {accountBar}

            <p className="form-section">Your details</p>
            <div className="field">
              <span className="field-label">Profile photo <span style={{color: 'var(--red)'}}>*</span></span>
              <PhotoPicker
                name={form.name}
                preview={photo?.thumb}
                onPick={setPhoto}
                onRemove={() => setPhoto(null)}
                onError={setError}
              />
            </div>
            <label>
              Full name <span style={{color: 'var(--red)'}}>*</span>
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="As on your ID"
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>
            <label>
              Phone number <span style={{color: 'var(--red)'}}>*</span>
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="98765 43210"
                autoComplete="tel"
                maxLength={20}
                required
              />
            </label>
            <label>
              Emergency contact <span style={{color: 'var(--red)'}}>*</span>
              <input
                value={form.emergencyContact}
                onChange={(e) => update('emergencyContact', e.target.value)}
                placeholder="e.g. Father – 98xxxxxx10"
                maxLength={120}
                required
              />
            </label>
            <label>
              Permanent address <span style={{color: 'var(--red)'}}>*</span>
              <textarea
                rows="2"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="House, street, city, PIN"
                maxLength={300}
                required
              />
            </label>
            <div className="form-row">
              <label>
                ID type <span style={{color: 'var(--red)'}}>*</span>
                <select value={form.idType} onChange={(e) => update('idType', e.target.value)} required>
                  <option value="">Select ID type</option>
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem'}}>
                  ID number
                  <HelpCircle size={14} style={{cursor: 'help', flexShrink: 0}} title="Optional - only if you have it" />
                </span>
                <input
                  value={form.idNumber}
                  onChange={(e) => update('idNumber', e.target.value)}
                  placeholder="e.g. 1234-5678-9012"
                  maxLength={60}
                />
              </label>
            </div>
            <div className="field">
              <span className="field-label">ID proof <span style={{color: 'var(--red)'}}>*</span></span>
              <ProofPicker
                fileName={proof?.name}
                onPick={setProof}
                onRemove={() => setProof(null)}
                onView={proof ? () => openDataUrl(proof.data, proof.name) : undefined}
                onError={setError}
              />
            </div>

            <p className="form-section">Additional info</p>
            <label>
              Company/Institute <span style={{color: 'var(--red)'}}>*</span>
              <input
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                placeholder="e.g. Infosys, Mysore University"
                maxLength={120}
                required
              />
            </label>
            <label>
              <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem'}}>
                Email
                <HelpCircle size={14} style={{cursor: 'help', flexShrink: 0}} title="Optional - we'll use this for updates" />
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="your.email@example.com"
                maxLength={120}
                autoComplete="email"
              />
            </label>

            <p className="form-section">Choose your bed</p>
            {rooms.length === 0 ? (
              <p className="notice">No beds are free right now. Please contact your PG manager.</p>
            ) : (
              <>
                {floors.length > 1 && (
                  <div className="chip-picker">
                    {floors.map((f) => (
                      <button
                        type="button"
                        key={f}
                        className={`chip-toggle ${floor === f ? 'on' : ''}`}
                        onClick={() => {
                          setFloor(f)
                          setRoomId('')
                          setBed('')
                        }}
                      >
                        {f === 'Ground' ? 'Ground floor' : f === '—' ? 'Other' : `Floor ${f}`}
                      </button>
                    ))}
                  </div>
                )}
                {floor || floors.length <= 1 ? (
                  <div className="join-rooms">
                    {visibleRooms.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        className={`join-room ${roomId === r.id ? 'on' : ''}`}
                        onClick={() => {
                          setRoomId(r.id)
                          setBed(r.freeBeds.length === 1 ? r.freeBeds[0] : '')
                        }}
                      >
                        <strong>Room {r.name}</strong>
                        <span>{sharingLabel(r.capacity)}</span>
                        {r.rent ? <span>{formatRupees(r.rent)}/bed</span> : null}
                        <span className="free">
                          {r.freeBeds.length} free
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted small">Pick a floor to see rooms.</p>
                )}
                {room && (
                  <div className="field">
                    <span className="field-label">Bed in room {room.name}</span>
                    <div className="chip-picker">
                      {room.freeBeds.map((b) => (
                        <button
                          type="button"
                          key={b}
                          className={`chip-toggle ${bed === b ? 'on' : ''}`}
                          onClick={() => setBed(b)}
                        >
                          <BedDouble size={14} /> {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {error && <p className="error">{error}</p>}

            <button type="submit" className="btn primary block" disabled={submitting || rooms.length === 0}>
              {submitting ? <Loader2 size={16} className="spin" /> : null}
              {submitting ? 'Sending…' : 'Submit registration'}
            </button>
            <p className="muted small center-text">
              Your details are shared only with the {pgName} manager.
            </p>
          </form>
        )}
      </main>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 010-9.3l-7.8-6.1a24 24 0 000 21.5l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
