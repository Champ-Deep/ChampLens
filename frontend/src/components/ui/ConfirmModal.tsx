import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** When true, styles the confirm button red and shows a warning icon. */
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Reusable confirmation modal — replaces native window.confirm() so the UX
// matches the rest of the dark panel design system and so we can show a
// loading spinner during the async action.
export default function ConfirmModal({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, busy = false, onConfirm, onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="panel p-6 w-full max-w-md"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3 min-w-0">
                {destructive && (
                  <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-status-error/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-status-error" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold text-base leading-snug">{title}</h2>
                  {description && (
                    <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">{description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onCancel}
                disabled={busy}
                className="text-text-secondary hover:text-text-primary shrink-0 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost flex-1">
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium text-sm transition-colors ${
                  destructive
                    ? 'bg-status-error/15 text-status-error border border-status-error/30 hover:bg-status-error/25'
                    : 'btn-primary'
                }`}
              >
                {busy && <Spinner size="sm" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
