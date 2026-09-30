import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BedDouble,
  Check,
  CloudOff,
  LayoutDashboard,
  Inbox,
  Link2,
  Loader2,
  Menu,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from './AuthContext'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Rooms from './components/Rooms'
import Members from './components/Members'
import RoomForm from './components/RoomForm'
import MemberForm from './components/MemberForm'
import MemberDetail from './components/MemberDetail'
import ConfirmDialog from './components/ConfirmDialog'
import PgDialog from './components/PgDialog'
import BulkRoomsForm from './components/BulkRoomsForm'
import InviteDialog from './components/InviteDialog'
import RequestsDialog from './components/RequestsDialog'
import { ThumbsContext } from './thumbs'
import { openDataUrl } from './media'
import { exportToExcel } from './exportData'
import {
  copySubmissionFiles,
  discardSubmission,
  emptyData,
  loadData,
  loadMemberPhoto,
  loadMemberProof,
  loadThumbs,
  newId,
  newToken,
  removeMemberFiles,
  removeMemberPhoto,
  removeMemberProof,
  saveData,
  saveMemberPhoto,
  saveMemberProof,
  setLinkActive,
  watchSubmissions,
  writeLinkSnapshot,
} from './store'
import {
  computeStats,
  currentMonth,
  freeBedMap,
  isRentPaid,
  pgDisplayName,
  roomOccupancy,
  todayISO,
} from './utils'

function linkSnapshot(property, rooms, members) {
  const own = rooms.filter((r) => r.propertyId === property.id)
  return {
    pgName: property.name || '',
    terms: property.terms || '',
    rooms: own.map((r) => ({
      id: r.id,
      name: r.name,
      floor: r.floor || '',
      capacity: Number(r.capacity) || 1,
      rent: Number(r.rent) || 0,
    })),
    beds: freeBedMap(
      own,
      members.filter((m) => m.propertyId === property.id),
    ),
  }
}

const TABS = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['rooms', 'Rooms', BedDouble],
  ['members', 'Members', Users],
]

export default function App() {
  const { user, loading, signOut, demoMode } = useAuth()
  const [data, setData] = useState(emptyData)
  const [ready, setReady] = useState(false)
  const [activePg, setActivePg] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [thumbs, setThumbs] = useState({})
  const [requests, setRequests] = useState({})
  const skipSave = useRef(true)
  const toastTimer = useRef(null)
  const pendingCleanup = useRef(null)
  const lastSnapshots = useRef({})
  const mainRef = useRef(null)
  const uid = user?.uid

  useEffect(() => {
    if (!user) return
    let cancelled = false
    skipSave.current = true
    setLoadError('')
    loadData(user.uid)
      .then((loaded) => {
        if (cancelled) return
        setData(loaded)
        setActivePg(loaded.properties[0]?.id ?? null)
        setReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        const code = err?.code || ''
        setLoadError(
          code === 'permission-denied'
            ? 'Firestore blocked access. Publish the security rules from firestore.rules in Firebase Console → Firestore → Rules.'
            : code === 'not-found' || /database .* does not exist/i.test(err?.message || '')
              ? 'Firestore database is not created yet. In Firebase Console open Firestore Database → Create database.'
              : code === 'unavailable' || code === 'timeout'
                ? 'Could not reach your Firestore database. If you have not created it yet: Firebase Console → Firestore Database → Create database, then publish the rules from firestore.rules. Otherwise check your internet and retry.'
                : `Could not load your data (${code || err?.message || 'unknown error'}).`,
        )
      })
    return () => {
      cancelled = true
      setReady(false)
    }
  }, [user, reloadKey])

  useEffect(() => {
    if (!user || !ready) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    setSaveState('saving')
    const t = setTimeout(() => {
      saveData(user.uid, data)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 500)
    return () => clearTimeout(t)
  }, [data, user, ready])

  // Files of deleted members are removed only once the undo window has passed.
  const flushCleanup = useCallback(() => {
    const fn = pendingCleanup.current
    pendingCleanup.current = null
    if (fn) fn()
  }, [])

  const showToast = useCallback(
    (message, onUndo, onExpire) => {
      clearTimeout(toastTimer.current)
      flushCleanup()
      pendingCleanup.current = onExpire || null
      setToast({ message, onUndo, id: Date.now() })
      toastTimer.current = setTimeout(() => {
        setToast(null)
        flushCleanup()
      }, 6000)
    },
    [flushCleanup],
  )

  useEffect(() => {
    window.addEventListener('pagehide', flushCleanup)
    return () => window.removeEventListener('pagehide', flushCleanup)
  }, [flushCleanup])

  const rooms = useMemo(() => data.rooms.filter((r) => r.propertyId === activePg), [data.rooms, activePg])
  const members = useMemo(
    () => data.members.filter((m) => m.propertyId === activePg),
    [data.members, activePg],
  )

  // Avatar thumbnails of the visible PG.
  useEffect(() => {
    if (!uid || !ready || !activePg) return
    let cancelled = false
    loadThumbs(uid, activePg)
      .then((t) => !cancelled && setThumbs(t || {}))
      .catch(() => !cancelled && setThumbs({}))
    return () => {
      cancelled = true
    }
  }, [uid, ready, activePg])

  // Keep each active invite link's list of free beds in sync with the rooms/members.
  useEffect(() => {
    if (!uid || !ready || demoMode) return
    const t = setTimeout(() => {
      for (const p of data.properties) {
        if (!p.invite?.token || !p.invite.active) continue
        const snapshot = linkSnapshot(p, data.rooms, data.members)
        const json = JSON.stringify(snapshot)
        if (lastSnapshots.current[p.invite.token] === json) continue
        lastSnapshots.current[p.invite.token] = json
        writeLinkSnapshot(p.invite.token, uid, p.id, snapshot).catch(() => {
          delete lastSnapshots.current[p.invite.token]
        })
      }
    }, 800)
    return () => clearTimeout(t)
  }, [data, uid, ready, demoMode])

  // Live inbox of tenant registrations, per PG with an active link.
  const activeTokens = data.properties
    .filter((p) => p.invite?.token && p.invite.active)
    .map((p) => `${p.id}|${p.invite.token}`)
    .join(',')
  useEffect(() => {
    if (!uid || !ready || demoMode || !activeTokens) {
      setRequests({})
      return
    }
    const unsubs = activeTokens.split(',').map((entry) => {
      const [propertyId, token] = entry.split('|')
      return watchSubmissions(
        token,
        (list) => setRequests((r) => ({ ...r, [propertyId]: list.map((x) => ({ ...x, token })) })),
        () => setRequests((r) => ({ ...r, [propertyId]: [] })),
      )
    })
    return () => unsubs.forEach((u) => u())
  }, [uid, ready, demoMode, activeTokens])

  const saveFiles = useCallback(
    async (memberId, propertyId, { photo, proof } = {}) => {
      const flags = {}
      if (photo) {
        await saveMemberPhoto(uid, propertyId, memberId, photo)
        setThumbs((t) => ({ ...t, [memberId]: photo.thumb }))
        flags.hasPhoto = true
      } else if (photo === null) {
        await removeMemberPhoto(uid, propertyId, memberId)
        setThumbs((t) => {
          const next = { ...t }
          delete next[memberId]
          return next
        })
        flags.hasPhoto = false
      }
      if (proof) {
        flags.proofChunks = await saveMemberProof(uid, memberId, proof.data)
        flags.proofName = proof.name
        flags.proofType = proof.type
      } else if (proof === null) {
        await removeMemberProof(uid, memberId)
        Object.assign(flags, { proofChunks: 0, proofName: '', proofType: '' })
      }
      return flags
    },
    [uid],
  )

  const actions = useMemo(() => {
    const update = (key, id, values) =>
      setData((d) => ({ ...d, [key]: d[key].map((x) => (x.id === id ? { ...x, ...values } : x)) }))
    const cleanupMembers = (list) => () =>
      list.forEach((m) => removeMemberFiles(uid, m.propertyId, m.id).catch(() => {}))

    return {
      addRoom: (values) =>
        setData((d) => ({ ...d, rooms: [...d.rooms, { ...values, id: newId('room'), propertyId: activePg }] })),
      bulkAddRooms: (list) => {
        const created = list.map((r) => ({ ...r, id: newId('room'), propertyId: activePg }))
        const ids = new Set(created.map((r) => r.id))
        setData((d) => ({ ...d, rooms: [...d.rooms, ...created] }))
        showToast(`${created.length} rooms added`, () =>
          setData((d) => ({ ...d, rooms: d.rooms.filter((r) => !ids.has(r.id)) })),
        )
      },
      updateRoom: (id, values) => update('rooms', id, values),
      deleteRoom: (id) => {
        const room = data.rooms.find((r) => r.id === id)
        const removed = data.members.filter((m) => m.roomId === id)
        setData((d) => ({
          ...d,
          rooms: d.rooms.filter((r) => r.id !== id),
          members: d.members.filter((m) => m.roomId !== id),
        }))
        showToast(
          `Room ${room?.name} deleted`,
          () => setData((d) => ({ ...d, rooms: [...d.rooms, room], members: [...d.members, ...removed] })),
          cleanupMembers(removed),
        )
      },
      addMember: (values, id = newId('mem')) => {
        setData((d) => ({
          ...d,
          members: [...d.members, { ...values, id, propertyId: activePg }],
        }))
        return id
      },
      updateMember: (id, values) => update('members', id, values),
      deleteMember: (id) => {
        const member = data.members.find((m) => m.id === id)
        setData((d) => ({ ...d, members: d.members.filter((m) => m.id !== id) }))
        showToast(
          `${member?.name} removed`,
          () => setData((d) => ({ ...d, members: [...d.members, member] })),
          cleanupMembers([member]),
        )
      },
      toggleRentPaid: (id) => {
        const member = data.members.find((m) => m.id === id)
        const paid = member && isRentPaid(member)
        update('members', id, { rentPaidMonth: paid ? '' : currentMonth() })
        if (!paid) showToast(`Rent marked paid for ${member?.name}`)
      },
    }
  }, [activePg, data.rooms, data.members, showToast, uid])

  const pendingRequests = requests[activePg] || []

  const ui = useMemo(
    () => ({
      actions,
      openRoomForm: (room) => setDialog({ type: 'room', room }),
      openBulkRooms: () => setDialog({ type: 'bulk' }),
      openMemberForm: ({ member, roomId, bed } = {}) => setDialog({ type: 'memberForm', member, roomId, bed }),
      openMember: (id) => setDialog({ type: 'member', id }),
      openInvite: () => setDialog({ type: 'invite' }),
      openRequests: () => setDialog({ type: 'requests' }),
      confirm: (opts) => setDialog({ type: 'confirm', ...opts }),
      requestCount: pendingRequests.length,
    }),
    [actions, pendingRequests.length],
  )

  async function saveMemberForm(values, files) {
    const { member, request } = dialog
    const id = member?.id ?? newId('mem')
    if (member) actions.updateMember(id, values)
    else actions.addMember(values, id)
    setDialog(member ? { type: 'member', id } : null)
    if (!member) showToast(`${values.name} checked in`)
    try {
      const flags = await saveFiles(id, activePg, files)
      if (request) {
        const copied = await copySubmissionFiles(
          request.token, request.key, uid, activePg, id, request.proofChunks,
        )
        if (copied.hasPhoto && !files.photo) {
          flags.hasPhoto = true
          loadThumbs(uid, activePg).then(setThumbs).catch(() => {})
        }
        if (copied.proofChunks && !files.proof) {
          Object.assign(flags, {
            proofChunks: copied.proofChunks,
            proofName: request.proofName,
            proofType: request.proofType,
          })
        }
        await discardSubmission(request.token, request.key, { occupied: true })
      }
      if (Object.keys(flags).length) actions.updateMember(id, flags)
    } catch (err) {
      showToast(`Saved ${values.name}, but files failed: ${err?.message || 'upload error'}`)
    }
  }

  async function viewProof(member) {
    try {
      const url = await loadMemberProof(uid, member.id, member.proofChunks)
      openDataUrl(url, member.proofName || 'id-proof')
    } catch (err) {
      showToast(err?.message || 'Could not open ID proof')
    }
  }

  function requestToMember(req) {
    const room = rooms.find((r) => r.id === req.roomId)
    return {
      name: req.name || '',
      phone: req.phone || '',
      roomId: room ? req.roomId : '',
      bed: req.bed || '',
      joinDate: todayISO(),
      vacateDate: '',
      rentShare: '',
      deposit: '',
      rentPaidMonth: '',
      emergencyContact: req.emergencyContact || '',
      address: req.address || '',
      notes: [req.idNote && `ID: ${req.idNote}`, req.email && `Google: ${req.email}`].filter(Boolean).join('\n'),
    }
  }

  async function importRequest(req, { chooseBed }) {
    const values = requestToMember(req)
    if (chooseBed) {
      setDialog({ type: 'memberForm', prefill: values, request: req })
      return
    }
    const id = actions.addMember(values)
    const copied = await copySubmissionFiles(req.token, req.key, uid, activePg, id, req.proofChunks)
    const flags = { hasPhoto: copied.hasPhoto }
    if (copied.proofChunks) {
      Object.assign(flags, { proofChunks: copied.proofChunks, proofName: req.proofName, proofType: req.proofType })
    }
    actions.updateMember(id, flags)
    if (copied.hasPhoto) loadThumbs(uid, activePg).then(setThumbs).catch(() => {})
    await discardSubmission(req.token, req.key, { occupied: true })
    showToast(`${values.name} added to Room ${rooms.find((r) => r.id === req.roomId)?.name ?? ''}`)
  }

  async function rejectRequest(req) {
    await discardSubmission(req.token, req.key)
    showToast(`Request from ${req.name} rejected`)
  }

  const setInvite = (propertyId, invite) =>
    setData((d) => ({
      ...d,
      properties: d.properties.map((p) => (p.id === propertyId ? { ...p, invite } : p)),
    }))

  async function createInvite(property) {
    const token = newToken()
    const snapshot = linkSnapshot(property, data.rooms, data.members)
    await writeLinkSnapshot(token, uid, property.id, snapshot, { create: true })
    lastSnapshots.current[token] = JSON.stringify(snapshot)
    setInvite(property.id, { token, active: true })
  }

  async function toggleInvite(property, active) {
    await setLinkActive(property.invite.token, active)
    if (active) delete lastSnapshots.current[property.invite.token]
    setInvite(property.id, { ...property.invite, active })
  }

  async function regenerateInvite(property) {
    if (property.invite?.token) await setLinkActive(property.invite.token, false).catch(() => {})
    await createInvite(property)
  }

  function selectPg(id) {
    setActivePg(id)
    setSidebarOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
  }

  function savePg(values) {
    if (dialog.property) {
      setData((d) => ({
        ...d,
        properties: d.properties.map((p) => (p.id === dialog.property.id ? { ...p, ...values } : p)),
      }))
    } else {
      const property = { id: newId('pg'), ...values }
      setData((d) => ({ ...d, properties: [...d.properties, property] }))
      selectPg(property.id)
      setTab('dashboard')
    }
    setDialog(null)
  }

  function deletePg(property) {
    const index = data.properties.findIndex((p) => p.id === property.id)
    const removedRooms = data.rooms.filter((r) => r.propertyId === property.id)
    const removedMembers = data.members.filter((m) => m.propertyId === property.id)
    const remaining = data.properties.filter((p) => p.id !== property.id)
    setData((d) => ({
      ...d,
      properties: d.properties.filter((p) => p.id !== property.id),
      rooms: d.rooms.filter((r) => r.propertyId !== property.id),
      members: d.members.filter((m) => m.propertyId !== property.id),
    }))
    setActivePg(remaining[0]?.id ?? null)
    showToast(
      `${pgDisplayName(property.name)} deleted`,
      () => {
        setData((d) => {
          const properties = [...d.properties]
          properties.splice(index, 0, property)
          return {
            ...d,
            properties,
            rooms: [...d.rooms, ...removedRooms],
            members: [...d.members, ...removedMembers],
          }
        })
        setActivePg(property.id)
      },
      () => {
        removedMembers.forEach((m) => removeMemberFiles(uid, m.propertyId, m.id).catch(() => {}))
        if (property.invite?.token && !demoMode) setLinkActive(property.invite.token, false).catch(() => {})
      },
    )
  }

  if (loading) return <Splash text="Loading…" />
  if (!user) return <Login />
  if (loadError)
    return (
      <div className="splash column">
        <CloudOff size={28} />
        <p className="load-error">{loadError}</p>
        <div className="foot-right">
          <button className="btn primary" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  if (!ready) return <Splash text="Loading your PGs…" />

  const activeProperty = data.properties.find((p) => p.id === activePg)
  const stats = computeStats(rooms, members)
  const detailMember = dialog?.type === 'member' ? data.members.find((m) => m.id === dialog.id) : null

  return (
    <ThumbsContext.Provider value={thumbs}>
    <div className="app">
      <Sidebar
        data={data}
        activePg={activePg}
        onSelect={selectPg}
        onAdd={() => {
          setSidebarOpen(false)
          setDialog({ type: 'pg' })
        }}
        user={user}
        demoMode={demoMode}
        onSignOut={signOut}
        onExport={async () => {
          try {
            await exportToExcel(data)
            showToast('Excel backup downloaded')
          } catch (err) {
            console.error(err)
            showToast('Export failed. Please try again.')
          }
        }}
        open={sidebarOpen}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="main" ref={mainRef}>
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open PG list">
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <h1>{activeProperty ? pgDisplayName(activeProperty.name) : 'PG'}</h1>
            <p>
              {activeProperty?.address ? `${activeProperty.address} · ` : ''}
              {stats.totalRooms} rooms · {stats.occupied}/{stats.totalCapacity} beds filled
            </p>
          </div>

          <SaveBadge state={saveState} />

          <nav className="tabs" role="tablist">
            {TABS.map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'active' : ''}
                onClick={() => {
                  setMenuOpen(false)
                  setTab(key)
                }}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>

          <div className="menu-wrap">
            <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="PG options">
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <>
                <div className="menu-catcher" onClick={() => setMenuOpen(false)} />
                <div className="menu">
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setDialog({ type: 'pg', property: activeProperty })
                    }}
                  >
                    <Pencil size={15} /> Rename / edit PG
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setDialog({ type: 'invite' })
                    }}
                  >
                    <Link2 size={15} /> Invite tenants (link)
                  </button>
                  <button
                    className="danger"
                    disabled={data.properties.length === 1}
                    onClick={() => {
                      setMenuOpen(false)
                      setDialog({
                        type: 'confirm',
                        title: `Delete ${pgDisplayName(activeProperty.name)}?`,
                        message: `All ${rooms.length} rooms and ${members.length} members in this PG will be removed. You can undo right after.`,
                        confirmLabel: 'Delete PG',
                        onConfirm: () => deletePg(activeProperty),
                      })
                    }}
                  >
                    <Trash2 size={15} /> Delete PG
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="content" key={`${activePg}-${tab}`}>
          {pendingRequests.length > 0 && tab !== 'rooms' && (
            <button className="inbox-banner" onClick={() => setDialog({ type: 'requests' })}>
              <span className="inbox-icon">
                <Inbox size={18} />
              </span>
              <span className="inbox-text">
                <strong>
                  {pendingRequests.length} new tenant {pendingRequests.length === 1 ? 'request' : 'requests'}
                </strong>
                <span>Registered through your invite link — review and approve</span>
              </span>
              <span className="inbox-cta">Review</span>
            </button>
          )}
          {tab === 'dashboard' && (
            <Dashboard
              property={pgDisplayName(activeProperty?.name ?? '')}
              rooms={rooms}
              members={members}
              ui={ui}
              goTo={setTab}
            />
          )}
          {tab === 'rooms' && <Rooms rooms={rooms} members={members} ui={ui} />}
          {tab === 'members' && <Members rooms={rooms} members={members} ui={ui} />}
        </div>
      </main>

      <nav className="bottom-nav">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {dialog?.type === 'room' && (
        <RoomForm
          room={dialog.room}
          minCapacity={dialog.room ? roomOccupancy(dialog.room, members).occupants.length || 1 : 1}
          onClose={() => setDialog(null)}
          onSave={(values) => {
            if (dialog.room) actions.updateRoom(dialog.room.id, values)
            else actions.addRoom(values)
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'memberForm' && (
        <MemberForm
          member={dialog.member}
          prefill={dialog.prefill}
          title={dialog.request ? `Approve ${dialog.request.name}` : undefined}
          defaultRoomId={dialog.roomId}
          defaultBed={dialog.bed}
          rooms={rooms}
          members={members}
          onClose={() => setDialog(dialog.request ? { type: 'requests' } : null)}
          onViewProof={viewProof}
          onSave={saveMemberForm}
        />
      )}
      {detailMember && (
        <MemberDetail
          member={detailMember}
          rooms={rooms}
          members={members}
          actions={actions}
          onEdit={() => setDialog({ type: 'memberForm', member: detailMember })}
          onClose={() => setDialog(null)}
          loadPhoto={(id) => loadMemberPhoto(uid, id)}
          onViewProof={viewProof}
        />
      )}
      {dialog?.type === 'bulk' && (
        <BulkRoomsForm
          existingRooms={rooms}
          onClose={() => setDialog(null)}
          onCreate={(list) => {
            actions.bulkAddRooms(list)
            setDialog(null)
            setTab('rooms')
          }}
        />
      )}
      {dialog?.type === 'invite' && activeProperty && (
        <InviteDialog
          property={activeProperty}
          freeBeds={stats.vacancies}
          demoMode={demoMode}
          onEnable={() => createInvite(activeProperty)}
          onToggle={(active) => toggleInvite(activeProperty, active)}
          onRegenerate={() => regenerateInvite(activeProperty)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'requests' && (
        <RequestsDialog
          requests={pendingRequests}
          rooms={rooms}
          members={members}
          onImport={importRequest}
          onReject={rejectRequest}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'confirm' && (
        <ConfirmDialog {...dialog} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'pg' && (
        <PgDialog
          property={dialog.property}
          suggestedName={String(data.properties.length + 1)}
          onSave={savePg}
          onClose={() => setDialog(null)}
        />
      )}

      {toast && (
        <div className="toast" key={toast.id} role="status">
          <Check size={16} />
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={() => {
                toast.onUndo()
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
    </ThumbsContext.Provider>
  )
}

function SaveBadge({ state }) {
  if (state === 'saving')
    return (
      <span className="save-badge">
        <Loader2 size={14} className="spin" /> Saving
      </span>
    )
  if (state === 'error')
    return (
      <span className="save-badge error">
        <CloudOff size={14} /> Not saved
      </span>
    )
  return (
    <span className="save-badge ok">
      <Check size={14} /> Saved
    </span>
  )
}

function Splash({ text }) {
  return (
    <div className="splash">
      <Loader2 size={22} className="spin" />
      {text}
    </div>
  )
}
