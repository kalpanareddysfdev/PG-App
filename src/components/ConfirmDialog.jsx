import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn danger-solid"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            autoFocus
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm">
        <span className="confirm-icon">
          <AlertTriangle size={20} />
        </span>
        <p>{message}</p>
      </div>
    </Modal>
  )
}
