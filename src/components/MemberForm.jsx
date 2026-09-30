import { useContext, useMemo, useState } from 'react'
import Modal from './Modal'
import { PhotoPicker, ProofPicker } from './FilePickers'
import { ThumbsContext } from '../thumbs'
import { openDataUrl } from '../media'
import {
  currentMonth,
  formatRupees,
  freeBedLabels,
  isRentPaid,
  roomOccupancy,
  todayISO,
} from '../utils'

export default function MemberForm({
  member,
  rooms,
  members,
  defaultRoomId,
  defaultBed,
  onSave,
  onClose,
  onViewProof,
  prefill,
  title,
}) {
  const thumbs = useContext(ThumbsContext)
  // undefined = unchanged, null = remove, object = new file
  const [photo, setPhoto] = useState(undefined)
  const [proof, setProof] = useState(undefined)
  const seed = member ?? prefill
  const [form, setForm] = useState(() => ({
    name: seed?.name ?? '',
    phone: seed?.phone ?? '',
    roomId: seed?.roomId ?? defaultRoomId ?? '',
    bed: seed?.bed ?? defaultBed ?? '',
    joinDate: seed?.joinDate ?? todayISO(),
    vacateDate: seed?.vacateDate ?? '',
    rentShare: seed?.rentShare ?? '',
    deposit: seed?.deposit ?? '',
    paid: member ? isRentPaid(member) : false,
    emergencyContact: seed?.emergencyContact ?? '',
    address: seed?.address ?? '',
    company: seed?.company ?? '',
    email: seed?.email ?? '',
    idType: seed?.idType ?? '',
    idNumber: seed?.idNumber ?? '',
    notes: seed?.notes ?? '',
  }))
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const room = rooms.find((r) => r.id === form.roomId)

  const bedOptions = useMemo(() => {
    if (!room) return []
    const free = freeBedLabels(room, members, member?.id)
    // Keep the member's current bed visible even when editing.
    if (member?.roomId === room.id) {
      const current = roomOccupancy(room, members).beds.find((b) => b.member?.id === member.id)
      if (current && !free.includes(current.label)) free.unshift(current.label)
    }
    return free.sort()
  }, [room, members, member])

  function pickRoom(roomId) {
    const next = rooms.find((r) => r.id === roomId)
    const free = next ? freeBedLabels(next, members, member?.id) : []
    setForm((f) => ({ ...f, roomId, bed: free[0] || '' }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required')
    if (!room) return setError('Choose a room')
    if (bedOptions.length === 0) return setError(`Room ${room.name} is full`)
    if (form.vacateDate && form.joinDate && form.vacateDate < form.joinDate) {
      return setError('Vacate date cannot be before the join date')
    }
    const { paid, ...rest } = form
    let rentPaidMonth = member?.rentPaidMonth ?? ''
    if (paid) rentPaidMonth = currentMonth()
    else if (rentPaidMonth === currentMonth()) rentPaidMonth = ''
    onSave(
      {
        ...rest,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        bed: bedOptions.includes(form.bed) ? form.bed : bedOptions[0],
        rentPaidMonth,
      },
      { photo, proof },
    )
  }

  const effectiveRent = Number(form.rentShare) || Number(room?.rent) || 0

  return (
    <Modal
      title={title || (member ? `Edit ${member.name}` : 'Check in a member')}
      subtitle={member ? null : 'Add a tenant to a free bed.'}
      onClose={onClose}
      size="lg"
    >
      <form className="form" onSubmit={submit}>
        <p className="form-section">Personal details</p>
        <PhotoPicker
          name={form.name}
          preview={photo === null ? null : photo?.thumb || (member && thumbs[member.id])}
          onPick={setPhoto}
          onRemove={() => setPhoto(null)}
          onError={setError}
        />
        <div className="form-row">
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Anita Sharma"
              autoFocus
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="98765 43210"
            />
          </label>
        </div>

        <p className="form-section">Stay</p>
        <div className="form-row">
          <label>
            Room
            <select value={form.roomId} onChange={(e) => pickRoom(e.target.value)}>
              <option value="">Select a room</option>
              {rooms.map((r) => {
                const free = freeBedLabels(r, members, member?.id).length
                return (
                  <option key={r.id} value={r.id} disabled={free === 0 && r.id !== member?.roomId}>
                    Room {r.name} · {free === 0 ? 'Full' : `${free} bed${free > 1 ? 's' : ''} free`}
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            Bed
            <select
              value={form.bed}
              onChange={(e) => update('bed', e.target.value)}
              disabled={!room}
            >
              {bedOptions.length === 0 && <option value="">No free bed</option>}
              {bedOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Joined on
            <input
              type="date"
              value={form.joinDate}
              onChange={(e) => update('joinDate', e.target.value)}
            />
          </label>
          <label>
            Vacating on
            <input
              type="date"
              value={form.vacateDate}
              min={form.joinDate || undefined}
              onChange={(e) => update('vacateDate', e.target.value)}
            />
          </label>
        </div>

        <p className="form-section">Payment</p>
        <div className="form-row">
          <label>
            Monthly rent
            <div className="input-prefix">
              <span>₹</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.rentShare}
                onChange={(e) => update('rentShare', e.target.value)}
                placeholder={room?.rent ? String(room.rent) : 'Room rent'}
              />
            </div>
            <span className="hint">Leave blank to use the room rate.</span>
          </label>
          <label>
            Security deposit
            <div className="input-prefix">
              <span>₹</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.deposit}
                onChange={(e) => update('deposit', e.target.value)}
                placeholder="0"
              />
            </div>
          </label>
        </div>
        <label className="switch-row">
          <span>
            <strong>Rent paid for this month</strong>
            <span className="muted small">
              {formatRupees(effectiveRent)} · resets automatically next month
            </span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={form.paid}
            onChange={(e) => update('paid', e.target.checked)}
          />
        </label>

        <p className="form-section">Address &amp; ID</p>
        <label>
          Permanent address
          <textarea
            rows="2"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="House, street, city, PIN"
          />
        </label>
        <ProofPicker
          fileName={proof === null ? '' : proof?.name || (member?.proofChunks ? member.proofName : '')}
          onPick={setProof}
          onRemove={() => setProof(null)}
          onView={
            proof
              ? () => openDataUrl(proof.data, proof.name)
              : member?.proofChunks && onViewProof
                ? () => onViewProof(member)
                : undefined
          }
          onError={setError}
        />

        <p className="form-section">Other</p>
        <label>
          Emergency contact
          <input
            value={form.emergencyContact}
            onChange={(e) => update('emergencyContact', e.target.value)}
            placeholder="Name and phone"
          />
        </label>
        <label>
          Company/Institute
          <input
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            placeholder="e.g. Infosys, Mysore University"
            maxLength={120}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="email@example.com"
            maxLength={120}
          />
        </label>
        <div className="form-row">
          <label>
            ID type
            <select value={form.idType} onChange={(e) => update('idType', e.target.value)}>
              <option value="">Select ID type</option>
              {['Voter ID', 'Aadhar', 'Driving License'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            ID number
            <input
              value={form.idNumber}
              onChange={(e) => update('idNumber', e.target.value)}
              placeholder="e.g. 1234-5678-9012"
              maxLength={60}
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            rows="2"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Food preference, special notes…"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {member ? 'Save changes' : 'Check in'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
