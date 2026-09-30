import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { BedDouble, Building2, CheckCircle2, Home, Loader2, Lock, LogOut, MapPin, Phone, User } from 'lucide-react'
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
  const [agreed, setAgreed] = useState(false)
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
        terms:
          '1. Rent is due by the 5th of every month.\n2. One month notice is required before vacating.\n3. No smoking or alcohol inside the premises.\n4. Visitors are allowed only until 9 PM.',
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

    if (link.terms && !agreed) return setError('Please agree to the Terms & Conditions')

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
      <JoinBackdrop />
      <header className="join-head">
        <div className="join-logo">
          <span className="join-logo-pg">PG</span>
          <span className="join-logo-name">Maaya</span>
        </div>
        <p className="join-tagline">Your Home Away From Home</p>
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
            <div className="join-welcome">
              <span className="join-eyebrow">Welcome to</span>
              <h1>{pgName}</h1>
              <p className="muted">Fill in your details and become a part of your PG community.</p>
              <span className="join-accent" />
            </div>
            <div className="join-banner">
              <span className="join-banner-icon">
                <Home size={24} />
              </span>
              <div>
                <span className="join-eyebrow small">You are joining</span>
                <strong>{pgName}</strong>
              </div>
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
              <span className="input-icon">
                <User size={18} />
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </span>
            </label>
            <label>
              Phone number <span style={{color: 'var(--red)'}}>*</span>
              <span className="input-icon">
                <Phone size={18} />
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
              </span>
            </label>
            <label>
              Emergency contact <span style={{color: 'var(--red)'}}>*</span>
              <span className="input-icon">
                <Phone size={18} />
                <input
                  value={form.emergencyContact}
                  onChange={(e) => update('emergencyContact', e.target.value)}
                  placeholder="Enter emergency contact number"
                  maxLength={120}
                  required
                />
              </span>
            </label>
            <label>
              Permanent address <span style={{color: 'var(--red)'}}>*</span>
              <span className="input-icon">
                <MapPin size={18} />
                <textarea
                  rows="2"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="House, street, city, PIN"
                  maxLength={300}
                  required
                />
              </span>
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
                <span title="Optional - only if you have it">ID number</span>
                <input
                  value={form.idNumber}
                  onChange={(e) => update('idNumber', e.target.value)}
                  placeholder="e.g. 1234-5678-9012"
                  maxLength={60}
                />
              </label>
            </div>
            <div className="field">
              <ProofPicker
                required
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
              <span className="input-icon">
                <Building2 size={18} />
                <input
                  value={form.company}
                  onChange={(e) => update('company', e.target.value)}
                  placeholder="e.g. Infosys, Mysore University"
                  maxLength={120}
                  required
                />
              </span>
            </label>
            <label>
              <span title="Optional - we'll use this for updates">Email</span>
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

            {link.terms && (
              <div className="field terms-box">
                <span className="field-label">Terms &amp; Conditions</span>
                <div className="terms-text" tabIndex={0}>{link.terms}</div>
                <label className="terms-agree">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
                  <span>I have read and agree to the Terms &amp; Conditions</span>
                </label>
              </div>
            )}

            {error && <p className="error">{error}</p>}

            <button type="submit" className="btn primary block" disabled={submitting || rooms.length === 0}>
              {submitting ? <Loader2 size={16} className="spin" /> : null}
              {submitting ? 'Sending…' : 'Submit registration'}
            </button>
            <p className="muted small center-text">
              Your details are shared only with the {pgName} manager.
            </p>
            <div className="join-foot">
              <strong>PGMaaya</strong>
              <span>Safe Stays · Better Tomorrows</span>
            </div>
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

function JoinBackdrop() {
  return (
    <>
      <svg className="join-art top" viewBox="0 0 430 220" aria-hidden="true">
        <g transform="translate(0 -52)">
        <circle cx="268" cy="104" r="22" fill="#f9dca0" opacity=".85" />
        <g fill="none" stroke="#a79bd6" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
          <path d="M296 150 350 100 404 150M308 140V168" />
        </g>
        <g fill="#a79bd6" opacity=".8">
          <rect x="336" y="116" width="9" height="9" rx="1.5" />
          <rect x="349" y="116" width="9" height="9" rx="1.5" />
          <rect x="336" y="129" width="9" height="9" rx="1.5" />
          <rect x="349" y="129" width="9" height="9" rx="1.5" />
        </g>
        <g fill="#7b9a62">
          <path d="M400 150C388 130 392 100 412 82 420 104 414 132 400 150Z" />
          <path d="M398 168C382 156 376 132 382 112 398 122 406 146 398 168Z" />
          <path d="M402 180C420 170 428 150 426 130 408 138 398 158 402 180Z" />
        </g>
        <path d="M300 172C340 184 392 184 430 158" fill="none" stroke="#f0b64a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
      <svg className="join-art bottom" viewBox="0 0 430 160" aria-hidden="true">
        <g fill="#9a90d0" opacity=".7">
          <path d="M410 150C398 130 402 100 420 82 428 104 424 132 410 150Z" />
          <path d="M424 160C410 150 404 132 408 116 424 122 432 142 424 160Z" />
          <path d="M392 160C380 150 376 134 380 120 394 128 400 144 392 160Z" />
        </g>
      </svg>
    </>
  )
}
