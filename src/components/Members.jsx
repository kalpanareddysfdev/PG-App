import { useMemo, useState } from 'react'
import { ChevronRight, Link2, Search, UserPlus, Users } from 'lucide-react'
import Avatar from './Avatar'
import {
  daysLabel,
  daysUntil,
  formatDate,
  formatRupees,
  isActiveMember,
  isRentPaid,
  isVacatingSoon,
  memberRent,
  roomOccupancy,
} from '../utils'

const FILTERS = [
  ['active', 'Staying', isActiveMember],
  ['leaving', 'Leaving soon', (m) => isVacatingSoon(m)],
  ['due', 'Rent due', (m) => isActiveMember(m) && !isRentPaid(m)],
  ['past', 'Moved out', (m) => !isActiveMember(m)],
  ['all', 'All', () => true],
]

export default function Members({ rooms, members, ui }) {
  const [filter, setFilter] = useState('active')
  const [query, setQuery] = useState('')

  const roomById = useMemo(() => Object.fromEntries(rooms.map((r) => [r.id, r])), [rooms])
  const bedById = useMemo(() => {
    const map = {}
    for (const r of rooms) {
      for (const b of roomOccupancy(r, members).beds) if (b.member) map[b.member.id] = b.label
    }
    return map
  }, [rooms, members])

  const counts = Object.fromEntries(FILTERS.map(([k, , fn]) => [k, members.filter(fn).length]))
  const test = FILTERS.find(([k]) => k === filter)[2]
  const q = query.trim().toLowerCase()

  const visible = members
    .filter(test)
    .filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        String(roomById[m.roomId]?.name ?? '').toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  if (members.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon">
            <Users size={28} />
          </span>
          <h3>No members yet</h3>
          <p className="muted">
            {rooms.length ? 'Check someone into a free bed to get started.' : 'Add a room first, then check members in.'}
          </p>
          <button
            className="btn primary"
            onClick={() => (rooms.length ? ui.openMemberForm({}) : ui.openRoomForm())}
          >
            {rooms.length ? (
              <>
                <UserPlus size={16} /> Check in member
              </>
            ) : (
              'Add a room'
            )}
          </button>
          {rooms.length > 0 && (
            <button className="btn ghost" onClick={() => ui.openInvite()}>
              <Link2 size={16} /> Share registration link
            </button>
          )}
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
            placeholder="Search name, phone or room…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn ghost push-right" onClick={() => ui.openInvite()}>
          <Link2 size={16} /> Invite link
        </button>
        <button className="btn primary" onClick={() => ui.openMemberForm({})}>
          <UserPlus size={16} /> Check in
        </button>
      </div>

      <div className="filter-tabs" role="tablist">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="tab-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="muted center">No members match.</p>
      ) : (
        <div className="member-table">
          <div className="member-row head">
            <span>Member</span>
            <span>Room</span>
            <span>Joined</span>
            <span>Vacating</span>
            <span>Rent</span>
            <span />
          </div>
          {visible.map((m) => {
            const room = roomById[m.roomId]
            const active = isActiveMember(m)
            const leaving = isVacatingSoon(m)
            const paid = isRentPaid(m)
            return (
              <button key={m.id} className="member-row" onClick={() => ui.openMember(m.id)}>
                <span className="cell-member">
                  <Avatar name={m.name} memberId={m.id} size={38} />
                  <span>
                    <strong>{m.name}</strong>
                    <span className="muted small">{m.phone || 'No phone'}</span>
                  </span>
                </span>
                <span className="cell" data-label="Room">
                  {room ? `Room ${room.name}` : '—'}
                  {bedById[m.id] && <span className="muted small"> · {bedById[m.id]}</span>}
                </span>
                <span className="cell" data-label="Joined">
                  {formatDate(m.joinDate)}
                </span>
                <span className="cell" data-label="Vacating">
                  {m.vacateDate ? (
                    <>
                      {formatDate(m.vacateDate)}
                      {leaving && (
                        <span className="badge amber inline">{daysLabel(daysUntil(m.vacateDate))}</span>
                      )}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
                <span className="cell" data-label="Rent">
                  {formatRupees(memberRent(m, room))}
                  {active && (
                    <span className={`badge ${paid ? 'green' : 'red'} inline`}>{paid ? 'Paid' : 'Due'}</span>
                  )}
                  {!active && <span className="badge gray inline">Moved out</span>}
                </span>
                <span className="chev">
                  <ChevronRight size={18} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
