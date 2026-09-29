import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import { MAX_CHUNKS, splitChunks } from './media'

const LOCAL_KEY = 'pg-app:data'

export function emptyData() {
  return {
    properties: [
      { id: 'pg-1', name: '1' },
      { id: 'pg-2', name: '2' },
      { id: 'pg-3', name: '3' },
    ],
    rooms: [],
    members: [],
  }
}

const MEMBER_DEFAULTS = {
  address: '',
  hasPhoto: false,
  proofName: '',
  proofType: '',
  proofChunks: 0,
}

function normalize(data) {
  const base = emptyData()
  if (!data) return base
  return {
    properties:
      Array.isArray(data.properties) && data.properties.length ? data.properties : base.properties,
    rooms: Array.isArray(data.rooms) ? data.rooms : [],
    members: Array.isArray(data.members)
      ? data.members.map((m) => ({ ...MEMBER_DEFAULTS, ...m }))
      : [],
  }
}

function localKeyFor(uid) {
  return `${LOCAL_KEY}:${uid}`
}

export async function loadData(uid) {
  if (!isFirebaseConfigured) {
    const raw = localStorage.getItem(localKeyFor(uid))
    return normalize(raw ? JSON.parse(raw) : null)
  }
  const snap = await withTimeout(getDoc(doc(db, 'pgManagers', uid)), 15_000)
  return normalize(snap.exists() ? snap.data() : null)
}

// Firestore retries silently forever when the database is missing, so give up after a while.
function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Firestore did not respond'), { code: 'timeout' })), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function saveData(uid, data) {
  if (!isFirebaseConfigured) {
    localStorage.setItem(localKeyFor(uid), JSON.stringify(data))
    return
  }
  await setDoc(doc(db, 'pgManagers', uid), { ...data, updatedAt: Date.now() })
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/* ---------------- Member files (photo, ID proof) ----------------
 * Kept outside the main document, which has a 1 MiB limit.
 *   pgManagers/{uid}/files/{memberId}_photo        { data }
 *   pgManagers/{uid}/files/{memberId}_proof_{n}    { data }  (≤400 KB chunks)
 *   pgManagers/{uid}/files/thumbs_{propertyId}     { [memberId]: dataUrl }
 */

const localFileKey = (uid, id) => `pg-app:file:${uid}:${id}`

function fileRef(uid, id) {
  return doc(db, 'pgManagers', uid, 'files', id)
}

async function putFile(uid, id, data) {
  if (!isFirebaseConfigured) {
    try {
      localStorage.setItem(localFileKey(uid, id), data)
    } catch {
      throw new Error('Browser storage is full. Connect Firebase to store files.')
    }
    return
  }
  await setDoc(fileRef(uid, id), { data })
}

async function getFile(uid, id) {
  if (!isFirebaseConfigured) return localStorage.getItem(localFileKey(uid, id))
  const snap = await getDoc(fileRef(uid, id))
  return snap.exists() ? snap.data().data : null
}

async function removeFile(uid, id) {
  if (!isFirebaseConfigured) {
    localStorage.removeItem(localFileKey(uid, id))
    return
  }
  await deleteDoc(fileRef(uid, id))
}

export async function loadThumbs(uid, propertyId) {
  const id = `thumbs_${propertyId}`
  if (!isFirebaseConfigured) {
    const raw = localStorage.getItem(localFileKey(uid, id))
    return raw ? JSON.parse(raw) : {}
  }
  const snap = await getDoc(fileRef(uid, id))
  return snap.exists() ? snap.data() : {}
}

async function setThumb(uid, propertyId, memberId, thumb) {
  const id = `thumbs_${propertyId}`
  if (!isFirebaseConfigured) {
    const current = await loadThumbs(uid, propertyId)
    if (thumb) current[memberId] = thumb
    else delete current[memberId]
    localStorage.setItem(localFileKey(uid, id), JSON.stringify(current))
    return
  }
  await setDoc(fileRef(uid, id), { [memberId]: thumb ?? deleteField() }, { merge: true })
}

export async function saveMemberPhoto(uid, propertyId, memberId, { photo, thumb }) {
  await putFile(uid, `${memberId}_photo`, photo)
  await setThumb(uid, propertyId, memberId, thumb)
}

export async function removeMemberPhoto(uid, propertyId, memberId) {
  await removeFile(uid, `${memberId}_photo`)
  await setThumb(uid, propertyId, memberId, null)
}

export function loadMemberPhoto(uid, memberId) {
  return getFile(uid, `${memberId}_photo`)
}

export async function saveMemberProof(uid, memberId, dataUrl) {
  const chunks = splitChunks(dataUrl)
  await Promise.all(chunks.map((c, i) => putFile(uid, `${memberId}_proof_${i}`, c)))
  for (let i = chunks.length; i < MAX_CHUNKS; i++) {
    await removeFile(uid, `${memberId}_proof_${i}`).catch(() => {})
  }
  return chunks.length
}

export async function loadMemberProof(uid, memberId, count) {
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => getFile(uid, `${memberId}_proof_${i}`)),
  )
  if (parts.some((p) => p == null)) throw new Error('ID proof file is missing or incomplete')
  return parts.join('')
}

export async function removeMemberProof(uid, memberId) {
  await Promise.all(
    Array.from({ length: MAX_CHUNKS }, (_, i) =>
      removeFile(uid, `${memberId}_proof_${i}`).catch(() => {}),
    ),
  )
}

export async function removeMemberFiles(uid, propertyId, memberId) {
  await Promise.all([
    removeMemberPhoto(uid, propertyId, memberId).catch(() => {}),
    removeMemberProof(uid, memberId),
  ])
}

/* ---------------- Tenant join links ----------------
 *   tenantLinks/{token}                              link snapshot (public get while active)
 *   tenantLinks/{token}/submissions/{bedKey}         one request per bed
 *   tenantLinks/{token}/applicants/{tenantUid}       one request per Google account
 *   tenantLinks/{token}/submissions/{bedKey}/files/{photo|thumb|proof_n}
 */

const linkRef = (token) => doc(db, 'tenantLinks', token)
const submissionsCol = (token) => collection(db, 'tenantLinks', token, 'submissions')
const applicantRef = (token, uid) => doc(db, 'tenantLinks', token, 'applicants', uid)

export async function writeLinkSnapshot(token, uid, propertyId, snapshot, { create = false } = {}) {
  if (create) {
    await setDoc(linkRef(token), {
      uid,
      propertyId,
      active: true,
      claimed: {},
      lastClaim: '',
      ...snapshot,
      updatedAt: serverTimestamp(),
    })
  } else {
    await updateDoc(linkRef(token), { ...snapshot, updatedAt: serverTimestamp() })
  }
}

export function setLinkActive(token, active) {
  return updateDoc(linkRef(token), { active, updatedAt: serverTimestamp() })
}

export function watchSubmissions(token, onChange, onError) {
  return onSnapshot(
    submissionsCol(token),
    (snap) => onChange(snap.docs.map((d) => ({ key: d.id, ...d.data() }))),
    onError,
  )
}

async function submissionFiles(token, key) {
  const snap = await getDocs(collection(db, 'tenantLinks', token, 'submissions', key, 'files'))
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data().data]))
}

export async function copySubmissionFiles(token, key, uid, propertyId, memberId, proofChunks) {
  const files = await submissionFiles(token, key)
  const result = { hasPhoto: false, proofChunks: 0 }
  if (files.photo && files.thumb) {
    await saveMemberPhoto(uid, propertyId, memberId, { photo: files.photo, thumb: files.thumb })
    result.hasPhoto = true
  }
  const parts = Array.from({ length: proofChunks || 0 }, (_, i) => files[`proof_${i}`])
  if (parts.length && parts.every(Boolean)) {
    result.proofChunks = await saveMemberProof(uid, memberId, parts.join(''))
  }
  return result
}

// Removes the request and its claim. When `occupied` (approved), the bed is also
// taken off the link and the tenant's account stays marked as registered; otherwise
// (rejected) the bed becomes selectable again and the tenant may submit a fresh request.
export async function discardSubmission(token, key, { occupied = false } = {}) {
  const submissionRef = doc(db, 'tenantLinks', token, 'submissions', key)
  const [filesSnap, submission] = await Promise.all([
    getDocs(collection(submissionRef, 'files')),
    getDoc(submissionRef),
  ])
  const batch = writeBatch(db)
  filesSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(submissionRef)
  const by = submission.data()?.by
  if (!occupied && by) batch.delete(applicantRef(token, by))
  if (occupied) {
    batch.update(
      linkRef(token),
      new FieldPath('claimed', key),
      deleteField(),
      new FieldPath('beds', key),
      deleteField(),
    )
  } else {
    batch.update(linkRef(token), new FieldPath('claimed', key), deleteField())
  }
  await batch.commit()
}

/* ---------------- Tenant side (Google sign-in) ---------------- */

export async function loadJoinLink(token) {
  const snap = await getDoc(linkRef(token))
  return snap.exists() ? snap.data() : null
}

// Returns the tenant's earlier request on this link ({ bedKey, ... }) or null.
export async function loadMyApplication(token, uid) {
  const snap = await getDoc(applicantRef(token, uid))
  return snap.exists() ? snap.data() : null
}

export class BedTakenError extends Error {}
export class AlreadyAppliedError extends Error {}

export async function submitJoinRequest(token, key, user, details, files) {
  await runTransaction(db, async (tx) => {
    const link = await tx.get(linkRef(token))
    if (!link.exists() || !link.data().active) throw new Error('This link is no longer active')
    if ((await tx.get(applicantRef(token, user.uid))).exists()) throw new AlreadyAppliedError('already applied')
    const data = link.data()
    if (!data.beds?.[key] || data.claimed?.[key]) throw new BedTakenError('bed taken')
    tx.set(doc(submissionsCol(token), key), {
      ...details,
      by: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
    })
    tx.set(applicantRef(token, user.uid), {
      bedKey: key,
      email: user.email,
      createdAt: serverTimestamp(),
    })
    tx.update(linkRef(token), new FieldPath('claimed', key), true, 'lastClaim', key)
  })

  const uploads = []
  const fileDoc = (id) => doc(db, 'tenantLinks', token, 'submissions', key, 'files', id)
  if (files.photo) {
    uploads.push(setDoc(fileDoc('photo'), { data: files.photo.photo }))
    uploads.push(setDoc(fileDoc('thumb'), { data: files.photo.thumb }))
  }
  if (files.proof) {
    splitChunks(files.proof.data).forEach((chunk, i) =>
      uploads.push(setDoc(fileDoc(`proof_${i}`), { data: chunk })),
    )
  }
  await Promise.all(uploads)
}
