import { useState } from 'react'
import { BedDouble, DoorOpen, Layers, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import Avatar from './Avatar'
import {
  daysLabel,
  daysUntil,
  formatRupees,
  isRentPaid,
  isVacatingSoon,
  roomAmenities,
  roomOccupancy,
  sharingLabel,
} from '../utils'

function MemberBadge({ member }) {
  if (isVacatingSoon(member)) {
    return <span className="badge amber">Vacates {daysLabel(daysUntil(member.vacateDate))}</span>
  }
  return isRentPaid(member) ? (
    <span className="badge green">Paid</span>
  ) : (
    <span className="badge red">Due</span>
  )
}

function RoomCard({ room, members, ui }) {
  const occ = roomOccupancy(room, members)
  const amenities = roomAmenities(room)
  const shown = amenities.slice(0, 3)
  const hidden = amenities.slice(3)
  const status = occ.capacity === 0
    ? { cls: 'gray', text: 'No beds' }
    : occ.isFull
      ? { cls: 'red', text: 'Fully occupied' }
      : occ.occupants.length === 0
        ? { cls: 'blue', text: 'Empty' }
        : { cls: 'green', text: `${occ.free} bed${occ.free > 1 ? 's' : ''} vacant` }

  return (
    <article className="room-card">
      <header className="room-card-head">
        <div className="room-title">
          <h3>Room {room.name}</h3>
          {room.floor && <span className="tag">Floor {room.floor}</span>}
        </div>
        <span className={`status ${status.cls}`}>{status.text}</span>
      </header>
      <p className="room-sub">
        {sharingLabel(occ.capacity)}
        {room.rent ? <> · <strong>{formatRupees(room.rent)}</strong>/bed</> : null}
      </p>

      <div className="capacity">
        <div className="capacity-text">
          <span>
            Accommodates <strong>{occ.capacity} {occ.capacity === 1 ? 'person' : 'people'}</strong>
          </span>
          <span className="muted">
            {occ.occupants.length}/{occ.capacity} beds
          </span>
        </div>
        <div className="bed-bar">
          {occ.beds.map((b) => (
            <span
              key={b.label}
              className={`seg ${b.member ? (isVacatingSoon(b.member) ? 'leaving' : 'taken') : 'free'}`}
              title={`${b.label}: ${b.member?.name || 'Vacant'}`}
            />
          ))}
        </div>
      </div>

      <div className="bed-list">
        <p className="section-label">Members ({occ.occupants.length})</p>
        {occ.beds.map((b) =>
          b.member ? (
            <button
              key={b.label}
              className={`bed-item ${isVacatingSoon(b.member) ? 'leaving' : ''}`}
              onClick={() => ui.openMember(b.member.id)}
            >
              <Avatar name={b.member.name} memberId={b.member.id} size={36} />
              <span className="bed-item-text">
                <strong>{b.member.name}</strong>
                <span>
                  {b.label}
                  {b.member.phone ? ` · ${b.member.phone}` : ''}
                </span>
              </span>
              <MemberBadge member={b.member} />
            </button>
          ) : (
            <button
              key={b.label}
              className="bed-item vacant"
              onClick={() => ui.openMemberForm({ roomId: room.id, bed: b.label })}
            >
              <span className="bed-icon">
                <BedDouble size={17} />
              </span>
              <span className="bed-item-text">
                <strong>{b.label}</strong>
                <span>Vacant</span>
              </span>
              <span className="add-link">
                <UserPlus size={15} /> Check in
              </span>
            </button>
          ),
        )}
      </div>

      {amenities.length > 0 && (
        <div className="amenities">
          {shown.map((a) => (
            <span key={a} className="amenity">
              ✓ {a}
            </span>
          ))}
          {hidden.length > 0 && (
            <span className="amenity more" title={hidden.join(', ')}>
              +{hidden.length} more
            </span>
          )}
        </div>
      )}

      <footer className="room-card-foot">
        <button className="icon-btn" title="Edit room" onClick={() => ui.openRoomForm(room)}>
          <Pencil size={16} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete room"
          onClick={() =>
            ui.confirm({
              title: `Delete room ${room.name}?`,
              message:
                occ.occupants.length > 0
                  ? `${occ.occupants.length} member(s) in this room will also be removed. You can undo right after.`
                  : 'This room will be removed. You can undo right after.',
              confirmLabel: 'Delete room',
              onConfirm: () => ui.actions.deleteRoom(room.id),
            })
          }
        >
          <Trash2 size={16} />
        </button>
        {!occ.isFull && occ.capacity > 0 && (
          <button
            className="btn small outline"
            onClick={() => ui.openMemberForm({ roomId: room.id })}
          >
            <UserPlus size={15} /> Check in
          </button>
        )}
      </footer>
    </article>
  )
}

const FILTERS = [
  ['all', 'All'],
  ['vacant', 'Has vacancy'],
  ['full', 'Full'],
]

export default function Rooms({ rooms, members, ui }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const visible = rooms
    .filter((r) => {
      if (filter === 'all') return true
      const occ = roomOccupancy(r, members)
      return filter === 'full' ? occ.isFull : !occ.isFull
    })
    .filter((r) => String(r.name).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }))

  if (rooms.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon">
            <DoorOpen size={28} />
          </span>
          <h3>Add your rooms</h3>
          <p className="muted">
            Have many rooms? Create them all at once — e.g. 19 two-sharing and 16 three-sharing across 4 floors.
          </p>
          <div className="empty-actions">
            <button className="btn primary" onClick={() => ui.openBulkRooms()}>
              <Layers size={16} /> Bulk add rooms
            </button>
            <button className="btn ghost" onClick={() => ui.openRoomForm()}>
              <Plus size={16} /> Add one room
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Find room…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="segmented">
          {FILTERS.map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn ghost push-right" onClick={() => ui.openBulkRooms()}>
          <Layers size={16} /> Bulk add
        </button>
        <button className="btn primary" onClick={() => ui.openRoomForm()}>
          <Plus size={16} /> Add room
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="muted center">No rooms match this filter.</p>
      ) : (
        <div className="room-grid">
          {visible.map((room) => (
            <RoomCard key={room.id} room={room} members={members} ui={ui} />
          ))}
        </div>
      )}
    </div>
  )
}
