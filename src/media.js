export const MAX_PROOF_BYTES = 1024 * 1024
export const PROOF_TARGET_BYTES = 290 * 1024
export const PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export const CHUNK_SIZE = 400_000
export const MAX_CHUNKS = 4

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image'))
    }
    img.src = url
  })
}

function draw(img, maxSize, quality, square = false) {
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (square) {
    const side = Math.min(sw, sh)
    sx = (sw - side) / 2
    sy = (sh - side) / 2
    sw = sh = side
  }
  const scale = Math.min(1, maxSize / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export function dataUrlBytes(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((b64.length * 3) / 4)
}

export async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for the photo')
  const img = await loadImage(file)
  return {
    photo: draw(img, 256, 0.8, true),
    thumb: draw(img, 64, 0.7, true),
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

export async function prepareProof(file) {
  if (!PROOF_TYPES.includes(file.type)) {
    throw new Error('ID proof must be a PDF, JPG, PNG or WebP file')
  }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PROOF_BYTES) throw new Error('PDF is larger than 1 MB. Please compress it first.')
    return { data: await readAsDataUrl(file), name: file.name, type: file.type }
  }
  const img = await loadImage(file)
  // Aim for ≤290 KB (fits one 400 KB base64 storage chunk, still readable); accept up to 1 MB for very detailed scans.
  let smallest = null
  for (const [size, quality] of [
    [1600, 0.75],
    [1400, 0.7],
    [1280, 0.65],
    [1100, 0.6],
    [960, 0.55],
  ]) {
    const data = draw(img, size, quality)
    if (dataUrlBytes(data) <= PROOF_TARGET_BYTES) return proofResult(file, data)
    smallest = data
  }
  if (dataUrlBytes(smallest) <= MAX_PROOF_BYTES) return proofResult(file, smallest)
  throw new Error('Image is too large even after compression. Try a smaller photo.')
}

function proofResult(file, data) {
  return { data, name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg' }
}

export function splitChunks(dataUrl) {
  const chunks = []
  for (let i = 0; i < dataUrl.length; i += CHUNK_SIZE) chunks.push(dataUrl.slice(i, i + CHUNK_SIZE))
  if (chunks.length > MAX_CHUNKS) throw new Error('File is too large')
  return chunks
}

export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const type = head.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export function openDataUrl(dataUrl, filename) {
  const url = URL.createObjectURL(dataUrlToBlob(dataUrl))
  const win = window.open(url, '_blank', 'noopener')
  if (!win) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'document'
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
