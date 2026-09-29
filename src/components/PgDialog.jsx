import { useState } from 'react'
import Modal from './Modal'

export default function PgDialog({ property, suggestedName, onSave, onClose }) {
  const [name, setName] = useState(property?.name ?? suggestedName ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Give this PG a name or number')
    onSave({ name: name.trim(), address: address.trim() })
  }

  return (
    <Modal
      title={property ? 'Edit PG' : 'Add a new PG'}
      subtitle={property ? null : 'Each PG gets its own tab, rooms and members.'}
      onClose={onClose}
      size="sm"
    >
      <form className="form" onSubmit={submit}>
        <label>
          PG name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 4 or Green Nest"
            autoFocus
          />
          <span className="hint">Numbers show as “PG 4” in the sidebar.</span>
        </label>
        <label>
          Area / address <span className="optional">optional</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. HSR Layout, Bengaluru"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {property ? 'Save' : 'Create PG'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
