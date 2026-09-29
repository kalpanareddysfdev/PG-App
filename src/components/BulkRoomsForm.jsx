import { useMemo, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import Modal from './Modal'
import { formatRupees, generateRooms, sharingLabel, splitEvenly } from '../utils'

function Stepper({ value, onChange, min = 0, max = 99, label }) {
  return (
    <div className="stepper compact">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Less ${label}`}>
        <Minus size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label}`}>
        <Plus size={14} />
      </button>
    </div>
  )
}

export default function BulkRoomsForm({ existingRooms, onCreate, onClose }) {
  const [types, setTypes] = useState([
    { capacity: 2, count: 10, rent: '' },
    { capacity: 3, count: 5, rent: '' },
  ])
  const [floors, setFloors] = useState(3)
  const [groundFloor, setGroundFloor] = useState(false)
  const [customPerFloor, setCustomPerFloor] = useState(null)
  const [edits, setEdits] = useState({})
  const [error, setError] = useState('')

  const total = types.reduce((s, t) => s + (Number(t.count) || 0), 0)
  const perFloor = customPerFloor && customPerFloor.length === floors
    ? customPerFloor
    : splitEvenly(total, floors)
  const capacityTotal = perFloor.reduce((s, n) => s + n, 0)

  const { rooms: generated, unplaced } = useMemo(
    () => generateRooms({ types, floors, perFloor, groundFloor }, existingRooms),
    [types, floors, perFloor, groundFloor, existingRooms],
  )
  const preview = generated.map((r) => ({ ...r, ...edits[r.name] }))
  const toCreate = preview.filter((r) => !r.exists && !r.skip)
  const newBeds = toCreate.reduce((s, r) => s + r.capacity, 0)

  function updateType(i, field, value) {
    setTypes((list) => list.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
    setCustomPerFloor(null)
  }

  function editRow(name, field, value) {
    setEdits((e) => ({ ...e, [name]: { ...e[name], [field]: value } }))
  }

  function submit() {
    if (total === 0) return setError('Add at least one room')
    if (unplaced > 0) return setError(`${unplaced} room(s) don't fit. Increase rooms per floor or floors.`)
    if (toCreate.length === 0) return setError('Nothing new to create — all these room numbers already exist')
    onCreate(
      toCreate.map((r) => ({
        name: r.name,
        floor: r.floor,
        capacity: Number(r.capacity),
        rent: Number(r.rent) || 0,
        amenities: ['Wi-Fi'],
        ac: false,
      })),
    )
  }

  return (
    <Modal
      title="Bulk add rooms"
      subtitle="Describe the building once and create every room in one go."
      onClose={onClose}
      size="xl"
      footer={
        <>
          <span className="muted small foot-note">
            {toCreate.length} rooms · {newBeds} beds
          </span>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={toCreate.length === 0}>
            Create {toCreate.length} rooms
          </button>
        </>
      }
    >
      <div className="form">
        <p className="form-section">1 · Room types</p>
        <div className="type-rows">
          <div className="type-row head">
            <span>Sharing</span>
            <span>How many rooms</span>
            <span>Rent per bed</span>
            <span />
          </div>
          {types.map((t, i) => (
            <div className="type-row" key={i}>
              <select
                value={t.capacity}
                onChange={(e) => updateType(i, 'capacity', Number(e.target.value))}
                aria-label="Sharing"
              >
                {Array.from({ length: 8 }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {sharingLabel(n)}
                  </option>
                ))}
              </select>
              <Stepper
                label="rooms"
                value={Number(t.count) || 0}
                onChange={(v) => updateType(i, 'count', v)}
                max={500}
              />
              <div className="input-prefix">
                <span>₹</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={t.rent}
                  placeholder="8000"
                  onChange={(e) => updateType(i, 'rent', e.target.value)}
                  aria-label="Rent per bed"
                />
              </div>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => setTypes((l) => l.filter((_, idx) => idx !== i))}
                disabled={types.length === 1}
                aria-label="Remove type"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn small ghost add-type"
            onClick={() => {
              const used = new Set(types.map((t) => t.capacity))
              const next = [1, 2, 3, 4, 5, 6].find((n) => !used.has(n)) || 2
              setTypes((l) => [...l, { capacity: next, count: 1, rent: '' }])
              setCustomPerFloor(null)
            }}
          >
            <Plus size={15} /> Add room type
          </button>
        </div>

        <p className="form-section">2 · Floors</p>
        <div className="floor-setup">
          <div className="field">
            <span className="field-label">Number of floors</span>
            <Stepper
              label="floors"
              value={floors}
              min={1}
              max={30}
              onChange={(v) => {
                setFloors(v)
                setCustomPerFloor(null)
              }}
            />
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={groundFloor}
              onChange={(e) => setGroundFloor(e.target.checked)}
            />
            First floor is ground floor (G01, G02…)
          </label>
        </div>
        <div className="floor-grid">
          {perFloor.map((n, f) => (
            <div key={f} className="floor-cell">
              <span>{groundFloor ? (f === 0 ? 'Ground' : `Floor ${f}`) : `Floor ${f + 1}`}</span>
              <Stepper
                label={`rooms on floor ${f + 1}`}
                value={n}
                onChange={(v) => setCustomPerFloor(perFloor.map((x, i) => (i === f ? v : x)))}
              />
            </div>
          ))}
        </div>
        <p className={`hint ${capacityTotal < total ? 'warn' : ''}`}>
          {capacityTotal} slots for {total} rooms
          {capacityTotal < total ? ` — ${total - capacityTotal} won't fit` : ''}
          {customPerFloor && (
            <button type="button" className="link-btn" onClick={() => setCustomPerFloor(null)}>
              Split evenly
            </button>
          )}
        </p>

        <p className="form-section">3 · Preview</p>
        {preview.length === 0 ? (
          <p className="muted small">Add room types to see the preview.</p>
        ) : (
          <div className="preview-table">
            <div className="preview-row head">
              <span>Room</span>
              <span>Floor</span>
              <span>Sharing</span>
              <span>Rent / bed</span>
              <span>Create</span>
            </div>
            {preview.map((r) => (
              <div key={r.name} className={`preview-row ${r.exists || r.skip ? 'off' : ''}`}>
                <strong>{r.name}</strong>
                <span>{r.floor}</span>
                <select
                  value={r.capacity}
                  disabled={r.exists}
                  onChange={(e) => editRow(r.name, 'capacity', Number(e.target.value))}
                  aria-label={`Sharing for ${r.name}`}
                >
                  {Array.from({ length: 8 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} bed{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={r.rent || ''}
                  placeholder={formatRupees(0)}
                  disabled={r.exists}
                  onChange={(e) => editRow(r.name, 'rent', e.target.value)}
                  aria-label={`Rent for ${r.name}`}
                />
                {r.exists ? (
                  <span className="badge gray">Exists</span>
                ) : (
                  <input
                    type="checkbox"
                    checked={!r.skip}
                    onChange={(e) => editRow(r.name, 'skip', !e.target.checked)}
                    aria-label={`Create room ${r.name}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </Modal>
  )
}
