// Single import point for toast helpers across pages — wraps react-hot-toast
// with project-styled defaults so callers don't need to repeat styling.
//
// Usage:
//   import { toastSuccess, toastError } from '@/lib/toast'
//   toastSuccess('Card updated')
//   toastError(err.response?.data?.message ?? 'Save failed')

import toast from 'react-hot-toast'

export function toastSuccess(message: string) {
  toast.success(message, { duration: 3000 })
}

export function toastError(message: string) {
  toast.error(message, { duration: 5000 })
}

export function toastLoading(message: string) {
  return toast.loading(message)
}

/** Replace a loading toast with success/error. Pass the id returned by toastLoading. */
export function toastSettle(id: string, kind: 'success' | 'error', message: string) {
  if (kind === 'success') toast.success(message, { id, duration: 3000 })
  else toast.error(message, { id, duration: 5000 })
}

export { toast }
