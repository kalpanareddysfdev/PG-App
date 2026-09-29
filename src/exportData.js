import {
  computeStats,
  daysUntil,
  isActiveMember,
  isRentPaid,
  isVacatingSoon,
  memberRent,
  pgDisplayName,
  roomAmenities,
  roomOccupancy,
  sharingLabel,
  todayISO,
} from './utils'

const HEADER = { fontWeight: 'bold', backgroundColor: '#E8EEF9' }

// Excel stores dates without a timezone, so build them in UTC to avoid off-by-one days.
function excelDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
}

function cell(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return { value, type: Date, format: 'dd-mmm-yyyy' }
  if (typeof value === 'number') return { value, type: Number }
  return { value: String(value), type: String }
}

function sheet(name, columns, rows) {
  return {
    sheet: name,
    stickyRowsCount: 1,
    columns: columns.map(([, width]) => ({ width })),
    data: [columns.map(([title]) => ({ value: title, ...HEADER })), ...rows.map((r) => r.map(cell))],
  }
}

const MEMBER_COLUMNS = [
  ['PG', 12],
  ['Name', 22],
  ['Phone', 15],
  ['Room', 8],
  ['Bed', 6],
  ['Joined', 13],
  ['Vacate date', 13],
  ['Rent (₹)', 10],
  ['Deposit (₹)', 11],
  ['Rent paid this month', 12],
  ['Emergency contact', 18],
  ['Address', 34],
  ['Notes', 28],
  ['Photo on file', 8],
  ['ID proof on file', 22],
]

export function buildWorkbook(data) {
  const pgName = Object.fromEntries(data.properties.map((p) => [p.id, pgDisplayName(p.name)]))
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const pgOrder = Object.fromEntries(data.properties.map((p, i) => [p.id, i]))
  const byPgThen = (key) => (a, b) =>
    (pgOrder[a.propertyId] ?? 0) - (pgOrder[b.propertyId] ?? 0) ||
    String(key(a)).localeCompare(String(key(b)), undefined, { numeric: true })

  const summary = data.properties.map((p) => {
    const s = computeStats(
      data.rooms.filter((r) => r.propertyId === p.id),
      data.members.filter((m) => m.propertyId === p.id),
    )
    return [
      pgDisplayName(p.name),
      p.address,
      s.totalRooms,
      s.totalCapacity,
      s.occupied,
      s.vacancies,
      s.vacatingSoon,
      s.expectedRent,
      s.collectedRent,
      s.expectedRent - s.collectedRent,
    ]
  })

  const rooms = [...data.rooms].sort(byPgThen((r) => r.name)).map((r) => {
    const occ = roomOccupancy(r, data.members)
    return [
      pgName[r.propertyId],
      r.name,
      r.floor,
      sharingLabel(r.capacity),
      occ.capacity,
      occ.occupants.length,
      occ.free,
      Number(r.rent) || 0,
      roomAmenities(r).join(', '),
    ]
  })

  const memberRow = (m) => {
    const room = roomById[m.roomId]
    return [
      pgName[m.propertyId],
      m.name,
      m.phone,
      room?.name ?? '(deleted room)',
      m.bed,
      excelDate(m.joinDate),
      excelDate(m.vacateDate),
      memberRent(m, room),
      Number(m.deposit) || null,
      isRentPaid(m) ? 'Yes' : 'No',
      m.emergencyContact,
      m.address,
      m.notes,
      m.hasPhoto ? 'Yes' : 'No',
      m.proofChunks ? m.proofName || 'Yes' : 'No',
    ]
  }

  const sortedMembers = [...data.members].sort(byPgThen((m) => m.name))
  const current = sortedMembers.filter(isActiveMember)
  const past = sortedMembers.filter((m) => !isActiveMember(m))
  const vacating = current
    .filter((m) => isVacatingSoon(m))
    .sort((a, b) => daysUntil(a.vacateDate) - daysUntil(b.vacateDate))

  return [
    sheet(
      'Summary',
      [
        ['PG', 14],
        ['Address', 30],
        ['Rooms', 8],
        ['Beds', 8],
        ['Occupied', 10],
        ['Vacant', 8],
        ['Vacating in 30 days', 12],
        ['Expected rent (₹)', 14],
        ['Collected (₹)', 13],
        ['Pending (₹)', 12],
      ],
      summary,
    ),
    sheet(
      'Rooms',
      [
        ['PG', 12],
        ['Room', 8],
        ['Floor', 8],
        ['Type', 16],
        ['Beds', 7],
        ['Occupied', 10],
        ['Free', 7],
        ['Rent (₹)', 10],
        ['Amenities', 40],
      ],
      rooms,
    ),
    sheet('Current members', MEMBER_COLUMNS, current.map(memberRow)),
    sheet(
      'Vacating in 30 days',
      [...MEMBER_COLUMNS.slice(0, 7), ['Days left', 9]],
      vacating.map((m) => [...memberRow(m).slice(0, 7), daysUntil(m.vacateDate)]),
    ),
    sheet('Past members', MEMBER_COLUMNS, past.map(memberRow)),
  ]
}

export async function exportToExcel(data) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(buildWorkbook(data), { fontFamily: 'Calibri', fontSize: 11 }).toFile(
    `PG-Manager-backup-${todayISO()}.xlsx`,
  )
}
