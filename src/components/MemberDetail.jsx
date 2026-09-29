import { useEffect, useState } from 'react'
import {
  CalendarClock,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  UserMinus,
} from 'lucide-react'
import Modal from './Modal'
import Avatar from './Avatar'
import {
  addDaysISO,
  daysLabel,
  daysUntil,
  formatDate,
  formatRupees,
  isActiveMember,
  isRentPaid,
  isVacatingSoon,
  memberRent,
  roomOccupancy,
  todayISO,
  whatsappLink,
} from '../utils'

function Row({ label, children }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

export default function MemberDetail({
  member,
  rooms,
  members,
  actions,
  onEdit,
  onClose,
  loadPhoto,
  onViewProof,
}) {
  const [photo, setPhoto] = useState(null)
  const [proofBusy, setProofBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (member.hasPhoto && loadPhoto) {
      loadPhoto(member.id)
        .then((p) => !cancelled && setPhoto(p))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [member.id, member.hasPhoto, loadPhoto])

  const room = rooms.find((r) => r.id === member.roomId)
  const bed = room
    ? roomOccupancy(room, members).beds.find((b) => b.member?.id === member.id)?.label
    : null
  const paid = isRentPaid(member)
  const days = daysUntil(member.vacateDate)
  const active = isActiveMember(member)
  const wa = whatsappLink(member.phone)

  return (
    <Modal title="Member details" onClose={onClose}>
      <div className="profile">
        <Avatar name={member.name} memberId={member.id} photo={photo} size={64} />
        <div className="profile-text">
          <h2>{member.name}</h2>
          <p className="muted">
            {room ? `Room ${room.name}` : 'No room'}
            {bed ? ` · ${bed}` : ''}
          </p>
          <div className="badge-row">
            {!active ? (
              <span className="badge gray">Moved out</span>
            ) : isVacatingSoon(member) ? (
              <span className="badge amber">Vacates {daysLabel(days)}</span>
            ) : (
              <span className="badge green">Staying</span>
            )}
            {active && <span className={`badge ${paid ? 'green' : 'red'}`}>{paid ? 'Rent paid' : 'Rent due'}</span>}
          </div>
        </div>
      </div>

      {member.phone && (
        <div className="contact-actions">
          <a className="btn" href={`tel:${member.phone}`}>
            <Phone size={16} /> Call
          </a>
          {wa && (
            <a className="btn" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="detail-list">
        <Row label="Phone">{member.phone || '—'}</Row>
        <Row label="Joined">{formatDate(member.joinDate)}</Row>
        <Row label="Vacating">{member.vacateDate ? formatDate(member.vacateDate) : 'No notice'}</Row>
        <Row label="Monthly rent">{formatRupees(memberRent(member, room))}</Row>
        {member.deposit ? <Row label="Deposit">{formatRupees(member.deposit)}</Row> : null}
        {member.emergencyContact && <Row label="Emergency">{member.emergencyContact}</Row>}
        {member.address && <Row label="Address">{member.address}</Row>}
        {member.notes && <Row label="Notes">{member.notes}</Row>}
      </div>

      {member.proofChunks > 0 && onViewProof && (
        <button
          className="file-chip as-button"
          disabled={proofBusy}
          onClick={async () => {
            setProofBusy(true)
            try {
              await onViewProof(member)
            } finally {
              setProofBusy(false)
            }
          }}
        >
          {proofBusy ? <Loader2 size={18} className="spin" /> : <FileText size={18} />}
          <span className="file-name">
            ID proof · <strong>{member.proofName || 'document'}</strong>
          </span>
          <span className="link-btn">View</span>
        </button>
      )}

      {active && (
        <div className="quick-actions">
          <button
            className={`btn ${paid ? 'ghost' : 'success'}`}
            onClick={() => actions.toggleRentPaid(member.id)}
          >
            {paid ? 'Mark rent as due' : 'Mark rent paid'}
          </button>
          {!member.vacateDate && (
            <button
              className="btn ghost"
              onClick={() => actions.updateMember(member.id, { vacateDate: addDaysISO(30) })}
            >
              <CalendarClock size={16} /> Give 30-day notice
            </button>
          )}
        </div>
      )}

      <div className="modal-foot split">
        <button
          className="btn ghost danger"
          onClick={() => {
            actions.deleteMember(member.id)
            onClose()
          }}
        >
          <Trash2 size={16} /> Remove
        </button>
        <div className="foot-right">
          {active && (
            <button
              className="btn ghost"
              onClick={() => {
                actions.updateMember(member.id, { vacateDate: todayISO() })
                onClose()
              }}
              title="Sets vacate date to today; the bed frees up tomorrow"
            >
              <UserMinus size={16} /> Check out today
            </button>
          )}
          <button className="btn primary" onClick={onEdit}>
            <Pencil size={16} /> Edit
          </button>
        </div>
      </div>
    </Modal>
  )
}
