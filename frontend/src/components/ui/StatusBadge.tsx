import type { CardStatus } from '@/lib/types'

export default function StatusBadge({ status }: { status: CardStatus }) {
  const map: Record<CardStatus, { label: string; cls: string }> = {
    ready:      { label: 'Ready',      cls: 'badge-ready' },
    processing: { label: 'Processing', cls: 'badge-processing' },
    error:      { label: 'Error',      cls: 'badge-error' },
  }
  const { label, cls } = map[status] ?? map.processing
  return <span className={cls}>{label}</span>
}
