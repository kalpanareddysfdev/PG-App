import { BedDouble, CalendarClock, Check, DoorOpen, IndianRupee, Plus, UserPlus } from 'lucide-react'
import Avatar from './Avatar'
import {
  computeStats,
  daysLabel,
  daysUntil,
  formatDate,
  formatRupees,
  memberRent,
  roomOccupancy,
} from '../utils'

function Ring({ value }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <circle cx="28" cy="28" r={r} className="ring-track" />
      <circle
        cx="28"
        cy="28"
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c - (c * Math.min(value, 100)) / 100}
      />
    </svg>
  )
}

function Kpi({ icon: Icon, tone, label, value, sub, extra, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`kpi ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="kpi-main">
        <span className={`kpi-icon ${tone}`}>
          <Icon size={20} />
        </span>
        <div>
          <span className="kpi-label">{label}</span>
          <span className="kpi-value">{value}</span>
          {sub && <span className="kpi-sub">{sub}</span>}
        </div>
      </div>
      {extra}
    </Tag>
  )
}

export default function Dashboard({ property, rooms, members, ui, goTo }) {
  const stats = computeStats(rooms, members)
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))

  if (rooms.length === 0) {
    return (
      <div className="page">
        <div className="onboard">
          <h2>Let’s set up {property}</h2>
          <p className="muted">Two quick steps and your dashboard will fill in.</p>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <div>
                <strong>Add rooms</strong>
                <p className="muted small">Room number, how many people it holds, and rent per bed.</p>
              </div>
              <button className="btn primary" onClick={() => ui.openBulkRooms()}>
                <Plus size={16} /> Add rooms
              </button>
            </li>
            <li className="disabled">
              <span className="step-num">2</span>
              <div>
                <strong>Check in members</strong>
                <p className="muted small">Assign people to beds, and track notice dates and rent.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    )
  }

  const dueTotal = stats.expectedRent - stats.collectedRent

  return (
    <div className="page">
      <section className="kpi-grid">
        <Kpi
          icon={BedDouble}
          tone={stats.vacancies ? 'amber' : 'green'}
          label="Vacant beds"
          value={stats.vacancies}
          sub={`of ${stats.totalCapacity} beds in ${stats.totalRooms} rooms`}
          onClick={() => goTo('rooms')}
        />
        <Kpi
          icon={CalendarClock}
          tone={stats.vacatingSoon ? 'red' : 'gray'}
          label="Vacating in 30 days"
          value={stats.vacatingSoon}
          sub={`${stats.projectedVacancies} beds free by next month`}
        />
        <Kpi
          icon={DoorOpen}
          tone="blue"
          label="Occupancy"
          value={`${stats.occupancyRate}%`}
          sub={`${stats.occupied} people staying`}
          extra={<Ring value={stats.occupancyRate} />}
        />
        <Kpi
          icon={IndianRupee}
          tone="green"
          label="Rent collected"
          value={formatRupees(stats.collectedRent)}
          sub={
            dueTotal > 0
              ? `${formatRupees(dueTotal)} due from ${stats.rentDueList.length}`
              : 'Everyone has paid 🎉'
          }
          extra={
            <div className="mini-progress">
              <span
                style={{
                  width: `${stats.expectedRent ? (stats.collectedRent / stats.expectedRent) * 100 : 0}%`,
                }}
              />
            </div>
          }
        />
      </section>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h3>Vacating in the next 30 days</h3>
            <span className="count">{stats.vacatingSoon}</span>
          </div>
          {stats.vacatingSoonList.length === 0 ? (
            <p className="empty-line">No one has given notice. 👍</p>
          ) : (
            <ul className="list">
              {stats.vacatingSoonList.map((m) => {
                const days = daysUntil(m.vacateDate)
                return (
                  <li key={m.id}>
                    <button className="list-item" onClick={() => ui.openMember(m.id)}>
                      <Avatar name={m.name} memberId={m.id} size={36} />
                      <span className="list-text">
                        <strong>{m.name}</strong>
                        <span>
                          Room {roomById[m.roomId]?.name ?? '—'} · {formatDate(m.vacateDate)}
                        </span>
                      </span>
                      <span className={`badge ${days <= 7 ? 'red' : 'amber'}`}>{daysLabel(days)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Rent due this month</h3>
            <span className="count">{stats.rentDueList.length}</span>
          </div>
          {stats.rentDueList.length === 0 ? (
            <p className="empty-line">
              {stats.occupied ? 'All rent collected for this month. 🎉' : 'No members yet.'}
            </p>
          ) : (
            <ul className="list">
              {stats.rentDueList.map((m) => (
                <li key={m.id} className="list-item static">
                  <button className="list-link" onClick={() => ui.openMember(m.id)}>
                    <Avatar name={m.name} memberId={m.id} size={36} />
                    <span className="list-text">
                      <strong>{m.name}</strong>
                      <span>
                        Room {roomById[m.roomId]?.name ?? '—'} ·{' '}
                        {formatRupees(memberRent(m, roomById[m.roomId]))}
                      </span>
                    </span>
                  </button>
                  <button
                    className="btn small success-soft"
                    onClick={() => ui.actions.toggleRentPaid(m.id)}
                  >
                    <Check size={14} /> Mark paid
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Room availability</h3>
          <button className="link-btn" onClick={() => goTo('rooms')}>
            Manage rooms →
          </button>
        </div>
        <div className="avail-grid">
          {rooms
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }))
            .map((room) => {
              const occ = roomOccupancy(room, members)
              return (
                <button
                  key={room.id}
                  className={`avail ${occ.isFull ? 'full' : 'open'}`}
                  onClick={() =>
                    occ.isFull ? goTo('rooms') : ui.openMemberForm({ roomId: room.id })
                  }
                  title={occ.isFull ? 'View room' : 'Check someone in'}
                >
                  <span className="avail-top">
                    <strong>{room.name}</strong>
                    {!occ.isFull && <UserPlus size={14} />}
                  </span>
                  <span className="avail-beds">
                    {occ.beds.map((b) => (
                      <i key={b.label} className={b.member ? 'on' : ''} />
                    ))}
                  </span>
                  <span className="avail-label">{occ.isFull ? 'Full' : `${occ.free} free`}</span>
                </button>
              )
            })}
        </div>
      </section>
    </div>
  )
}
