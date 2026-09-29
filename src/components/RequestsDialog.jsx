import { useState } from 'react'
import { Check, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react'
import Modal from './Modal'
import Avatar from './Avatar'
import { roomOccupancy } from '../utils'

export default function RequestsDialog({ requests, rooms, members, onImport, onReject, onClose }) {
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))

  function bedTaken(req) {
    const room = roomById[req.roomId]
    if (!room) return true
    const bed = roomOccupancy(room, members).beds.find((b) => b.label === req.bed)
    return !bed || !!bed.member
  }

  async function act(req, kind, fn) {
    setBusy((b) => ({ ...b, [req.key]: kind }))
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy((b) => ({ ...b, [req.key]: '' }))
    }
  }

  const sorted = [...requests].sort(
    (a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0),
  )

  return (
    <Modal
      title="New tenant requests"
      subtitle="Approve to add them as members. You can set rent and dates afterwards."
      onClose={onClose}
      size="lg"
    >
      {sorted.length === 0 ? (
        <p className="empty-line">No pending requests. 🎉</p>
      ) : (
        <ul className="request-list">
          {sorted.map((req) => {
            const room = roomById[req.roomId]
            const taken = bedTaken(req)
            const state = busy[req.key]
            return (
              <li key={req.key} className="request">
                <div className="request-main">
                  <Avatar name={req.name} size={42} />
                  <div className="request-text">
                    <strong>{req.name}</strong>
                    <span className="muted small">
                      {req.phone}
                      {req.email ? ` · ${req.email}` : ''}
                      {req.emergencyContact ? ` · Emergency: ${req.emergencyContact}` : ''}
                    </span>
                    <span className="request-tags">
                      <span className={`badge ${taken ? 'red' : 'blue'}`}>
                        {room ? `Room ${room.name} · ${req.bed}` : 'Room deleted'}
                        {taken && room ? ' · now occupied' : ''}
                      </span>
                      {req.hasPhoto && (
                        <span className="badge gray">
                          <ImageIcon size={12} /> Photo
                        </span>
                      )}
                      {req.proofChunks > 0 && (
                        <span className="badge gray">
                          <FileText size={12} /> ID proof
                        </span>
                      )}
                    </span>
                    {(req.address || req.idNote) && (
                      <span className="muted small request-extra">
                        {[req.idNote, req.address].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="request-actions">
                  <button
                    className="btn small ghost danger"
                    disabled={!!state}
                    onClick={() => act(req, 'reject', () => onReject(req))}
                  >
                    {state === 'reject' ? <Loader2 size={14} className="spin" /> : <X size={14} />}
                    Reject
                  </button>
                  <button
                    className="btn small primary"
                    disabled={!!state}
                    onClick={() => act(req, 'import', () => onImport(req, { chooseBed: taken }))}
                  >
                    {state === 'import' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    {taken ? 'Approve & pick bed' : 'Approve'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  )
}
