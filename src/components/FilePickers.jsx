import { useRef, useState } from 'react'
import { Camera, FileText, Loader2, RefreshCw, X } from 'lucide-react'
import { preparePhoto, prepareProof } from '../media'
import { avatarColors, initials } from '../utils'

export function PhotoPicker({ name, preview, onPick, onRemove, onError }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [bg, fg] = avatarColors(name || '?')

  async function handle(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      onPick(await preparePhoto(file))
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="photo-picker">
      <button type="button" className="photo-circle" onClick={() => input.current?.click()} aria-label="Choose photo">
        {busy ? (
          <Loader2 size={20} className="spin" />
        ) : preview ? (
          <img src={preview} alt="" />
        ) : (
          <span style={{ background: bg, color: fg }}>{name ? initials(name) : <Camera size={22} />}</span>
        )}
        <i className="photo-badge">
          <Camera size={13} />
        </i>
      </button>
      <div className="photo-actions">
        <strong>Profile photo</strong>
        <span className="muted small">Optional · JPG or PNG</span>
        <div className="photo-btns">
          <button type="button" className="link-btn" onClick={() => input.current?.click()}>
            {preview ? 'Change' : 'Upload'}
          </button>
          {preview && onRemove && (
            <button type="button" className="link-btn danger" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={handle} />
    </div>
  )
}

export function ProofPicker({ fileName, onPick, onRemove, onView, onError }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handle(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      onPick(await prepareProof(file))
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <span className="field-label">
        ID proof <span className="optional">PDF or image · max 1 MB</span>
      </span>
      {fileName ? (
        <div className="file-chip">
          <FileText size={18} />
          <button type="button" className="file-name" onClick={onView} disabled={!onView}>
            {fileName}
          </button>
          <button type="button" className="icon-btn" onClick={() => input.current?.click()} title="Replace">
            {busy ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          </button>
          <button type="button" className="icon-btn danger" onClick={onRemove} title="Remove">
            <X size={15} />
          </button>
        </div>
      ) : (
        <button type="button" className="upload-box" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <FileText size={18} />}
          <span>
            <strong>{busy ? 'Preparing…' : 'Upload Aadhaar, PAN, college/office ID'}</strong>
            <span className="muted small">Photos are compressed automatically</span>
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hidden
        onChange={handle}
      />
    </div>
  )
}
