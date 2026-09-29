export function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function currentMonth() {
  return todayISO().slice(0, 7)
}

export function addDaysISO(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function daysUntil(value) {
  const target = parseDate(value)
  if (!target) return null
  const today = parseDate(todayISO())
  return Math.round((target - today) / 86400000)
}

export function isActiveMember(member) {
  const days = daysUntil(member.vacateDate)
  return days === null || days >= 0
}

export function isVacatingSoon(member, window = 30) {
  const days = daysUntil(member.vacateDate)
  return days !== null && days >= 0 && days <= window
}

// Rent is "paid" only for the month it was marked, so it resets to due automatically.
export function isRentPaid(member) {
  return member.rentPaidMonth === currentMonth()
}

export function memberRent(member, room) {
  return Number(member.rentShare) || Number(room?.rent) || 0
}

export function computeStats(rooms, members) {
  const activeMembers = members.filter(isActiveMember)
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]))
  const totalCapacity = rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0)
  const occupied = activeMembers.length
  const vacancies = Math.max(totalCapacity - occupied, 0)
  const vacatingSoon = activeMembers
    .filter((m) => isVacatingSoon(m))
    .sort((a, b) => daysUntil(a.vacateDate) - daysUntil(b.vacateDate))

  let expectedRent = 0
  let collectedRent = 0
  const rentDueList = []
  for (const m of activeMembers) {
    const rent = memberRent(m, roomById[m.roomId])
    expectedRent += rent
    if (isRentPaid(m)) collectedRent += rent
    else rentDueList.push(m)
  }

  return {
    totalRooms: rooms.length,
    totalCapacity,
    occupied,
    vacancies,
    vacatingSoon: vacatingSoon.length,
    vacatingSoonList: vacatingSoon,
    projectedVacancies: vacancies + vacatingSoon.length,
    occupancyRate: totalCapacity ? Math.round((occupied / totalCapacity) * 100) : 0,
    expectedRent,
    collectedRent,
    rentDueList,
  }
}

export const AMENITIES = [
  'AC',
  'Attached Bath',
  'Wi-Fi',
  'Geyser',
  'Balcony',
  'TV',
  'Fridge',
  'Wardrobe',
  'Laundry',
  'Power Backup',
  'Housekeeping',
  'Meals',
]

export function roomAmenities(room) {
  const list = Array.isArray(room.amenities) ? [...room.amenities] : []
  if (room.ac && !list.includes('AC')) list.unshift('AC')
  return list
}

export function sharingLabel(capacity) {
  const n = Number(capacity) || 0
  const names = { 1: 'Single', 2: 'Double', 3: 'Triple', 4: '4', 5: '5', 6: '6' }
  return n === 1 ? 'Single occupancy' : `${names[n] || n} sharing`
}

export function bedLabel(index) {
  return `Bed ${String.fromCharCode(65 + index)}`
}

export function roomOccupancy(room, members) {
  const capacity = Number(room.capacity) || 0
  const occupants = members.filter((m) => m.roomId === room.id && isActiveMember(m))

  // Members keep their chosen bed; anyone without a valid bed fills the next free one.
  const beds = Array.from({ length: capacity }, (_, i) => ({ label: bedLabel(i), member: null }))
  const unplaced = []
  for (const m of occupants) {
    const bed = beds.find((b) => b.label === m.bed && !b.member)
    if (bed) bed.member = m
    else unplaced.push(m)
  }
  for (const m of unplaced) {
    const bed = beds.find((b) => !b.member)
    if (bed) bed.member = m
  }

  return {
    occupants,
    beds,
    capacity,
    free: Math.max(capacity - occupants.length, 0),
    isFull: capacity > 0 && occupants.length >= capacity,
  }
}

export function freeBedLabels(room, members, excludeMemberId) {
  const others = members.filter((m) => m.id !== excludeMemberId)
  return roomOccupancy(room, others)
    .beds.filter((b) => !b.member)
    .map((b) => b.label)
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

const AVATAR_COLORS = [
  ['#e0e7ff', '#3730a3'],
  ['#fce7f3', '#9d174d'],
  ['#dcfce7', '#166534'],
  ['#fef3c7', '#92400e'],
  ['#e0f2fe', '#075985'],
  ['#ede9fe', '#5b21b6'],
  ['#ffe4e6', '#9f1239'],
  ['#ccfbf1', '#115e59'],
]

export function avatarColors(seed = '') {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function formatRupees(value) {
  return `₹${(Number(value) || 0).toLocaleString('en-IN')}`
}

export function pgDisplayName(name) {
  return /^\d+$/.test(String(name).trim()) ? `PG ${name}` : name
}

export function formatDate(value) {
  const d = parseDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysLabel(days) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days}d`
}

export function whatsappLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`
}

export function whatsappShare(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function splitEvenly(total, parts) {
  const n = Math.max(1, parts | 0)
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => base + (i < total % n ? 1 : 0))
}

export function floorLabel(floorNo) {
  return floorNo === 0 ? 'Ground' : String(floorNo)
}

export function roomNumber(floorNo, index) {
  const seq = String(index).padStart(2, '0')
  return floorNo === 0 ? `G${seq}` : `${floorNo}${seq}`
}

// Lays out rooms floor by floor in the order of `types`; flags numbers that already exist.
export function generateRooms({ types, floors, perFloor, groundFloor }, existingRooms = []) {
  const existing = new Set(existingRooms.map((r) => String(r.name).trim().toLowerCase()))
  const queue = types.flatMap((t) =>
    Array.from({ length: Math.max(0, Number(t.count) | 0) }, () => ({
      capacity: Math.max(1, Number(t.capacity) | 0),
      rent: Number(t.rent) || 0,
    })),
  )
  const rooms = []
  let q = 0
  for (let f = 0; f < floors && q < queue.length; f++) {
    const floorNo = groundFloor ? f : f + 1
    const count = Math.min(99, Math.max(0, Number(perFloor[f]) | 0))
    for (let i = 1; i <= count && q < queue.length; i++) {
      const name = roomNumber(floorNo, i)
      rooms.push({
        ...queue[q++],
        name,
        floor: floorLabel(floorNo),
        exists: existing.has(name.toLowerCase()),
      })
    }
  }
  return { rooms, unplaced: queue.length - q }
}

export function bedKey(roomId, bed) {
  return `${roomId}~${bed}`
}

export function parseBedKey(key) {
  const i = key.indexOf('~')
  return { roomId: key.slice(0, i), bed: key.slice(i + 1) }
}

// Free beds (not occupied by an active member) keyed for the tenant join link.
export function freeBedMap(rooms, members) {
  const map = {}
  for (const room of rooms) {
    for (const b of roomOccupancy(room, members).beds) {
      if (!b.member) map[bedKey(room.id, b.label)] = true
    }
  }
  return map
}
