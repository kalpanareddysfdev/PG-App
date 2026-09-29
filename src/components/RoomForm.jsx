import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import Modal from './Modal'
import { AMENITIES, roomAmenities, sharingLabel } from '../utils'

export default function RoomForm({ room, minCapacity = 1, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: room?.name ?? '',
    floor: room?.floor ?? '',
    capacity: Number(room?.capacity) || 2,
    rent: room?.rent ?? '',
    amenities: room ? roomAmenities(room) : ['Wi-Fi'],
  }))
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  function setCapacity(n) {
    update('capacity', Math.min(12, Math.max(1, n)))
  }

  function toggleAmenity(a) {
    update(
      'amenities',
      form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a],
    )
  }

  function submit(e) {
    e.preventDefault()
    if (!String(form.name).trim()) return setError('Room number is required')
    if (form.capacity < minCapacity) {
      return setError(`${minCapacity} people live here — capacity can't be lower.`)
    }
    onSave({
      name: String(form.name).trim(),
      floor: String(form.floor).trim(),
      capacity: form.capacity,
      rent: Number(form.rent) || 0,
      amenities: form.amenities,
      ac: form.amenities.includes('AC'),
    })
  }

  return (
    <Modal title={room ? `Edit room ${room.name}` : 'Add a room'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label>
            Room number
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. 101"
              autoFocus
            />
          </label>
          <label>
            Floor <span className="optional">optional</span>
            <input
              value={form.floor}
              onChange={(e) => update('floor', e.target.value)}
              placeholder="e.g. 1 or Ground"
            />
          </label>
        </div>

        <div className="form-row">
          <div className="field">
            <span className="field-label">How many people can stay</span>
            <div className="stepper">
              <button type="button" onClick={() => setCapacity(form.capacity - 1)} aria-label="Fewer beds">
                <Minus size={16} />
              </button>
              <div className="stepper-value">
                <strong>{form.capacity}</strong>
                <span>{sharingLabel(form.capacity)}</span>
              </div>
              <button type="button" onClick={() => setCapacity(form.capacity + 1)} aria-label="More beds">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <label>
            Rent per bed / month
            <div className="input-prefix">
              <span>₹</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.rent}
                onChange={(e) => update('rent', e.target.value)}
                placeholder="8000"
              />
            </div>
          </label>
        </div>

        <div className="field">
          <span className="field-label">Amenities</span>
          <div className="chip-picker">
            {AMENITIES.map((a) => {
              const on = form.amenities.includes(a)
              return (
                <button
                  type="button"
                  key={a}
                  className={`chip-toggle ${on ? 'on' : ''}`}
                  onClick={() => toggleAmenity(a)}
                  aria-pressed={on}
                >
                  {on && <Check size={13} />}
                  {a}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {room ? 'Save changes' : 'Add room'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
