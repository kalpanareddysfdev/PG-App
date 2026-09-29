import { Building2, FileSpreadsheet, LogOut, Plus } from 'lucide-react'
import Avatar from './Avatar'
import { computeStats, pgDisplayName } from '../utils'

export default function Sidebar({ data, activePg, onSelect, onAdd, user, demoMode, onSignOut, onExport, open }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <span className="brand-icon">
          <Building2 size={22} />
        </span>
        <div>
          <div className="brand-name">
            PG Manager <span className="brand-tag">PWA</span>
          </div>
          <div className="brand-sub">Multi-property &amp; vacancy</div>
        </div>
      </div>

      <div className="side-section">
        <span>Managed properties</span>
        <button className="side-link" onClick={onAdd}>
          <Plus size={15} /> Add PG
        </button>
      </div>

      <nav className="pg-list">
        {data.properties.map((p, i) => {
          const stats = computeStats(
            data.rooms.filter((r) => r.propertyId === p.id),
            data.members.filter((m) => m.propertyId === p.id),
          )
          const badge = /^\d+$/.test(p.name) ? p.name : p.name[0]?.toUpperCase() || i + 1
          return (
            <button
              key={p.id}
              className={`pg-tab ${p.id === activePg ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
              aria-current={p.id === activePg ? 'page' : undefined}
            >
              <span className="pg-num">{badge}</span>
              <span className="pg-text">
                <strong>{pgDisplayName(p.name)}</strong>
                <span>
                  {stats.totalRooms} rooms · {stats.totalCapacity} beds
                </span>
              </span>
              <span className={`pg-pill ${stats.vacancies ? '' : 'full'}`}>
                {stats.totalCapacity === 0 ? 'Setup' : stats.vacancies ? `${stats.vacancies} vacant` : 'Full'}
              </span>
            </button>
          )
        })}

        <button className="pg-add" onClick={onAdd}>
          <span className="pg-add-icon">
            <Plus size={18} />
          </span>
          <span className="pg-text">
            <strong>Add new PG tab</strong>
            <span>e.g. PG {data.properties.length + 1}</span>
          </span>
        </button>
      </nav>

      <div className="side-footer">
        <button className="side-export" onClick={onExport}>
          <FileSpreadsheet size={16} /> Export all data (Excel)
        </button>
        {demoMode && (
          <p className="demo-note">
            <strong>Demo mode</strong> · data is saved only in this browser.
          </p>
        )}
        <div className="user-chip">
          <Avatar name={user.name} photo={user.photo} size={34} />
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-btn light" onClick={onSignOut} title="Sign out" aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}
