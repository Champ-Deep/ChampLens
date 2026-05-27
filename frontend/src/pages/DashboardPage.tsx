import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CardGrid from '@/components/dashboard/CardGrid'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { useUser } from '@clerk/react'
import { useSocket } from '@/hooks/useSocket'
import type { Card } from '@/lib/types'

export default function DashboardPage() {
  const { user } = useUser()
  const displayName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0]
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const ws = useSocket()

  const fetchCards = async () => {
    try {
      const { data } = await api.get('/cards')
      setCards(data.cards)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCards() }, [])

  useEffect(() => {
    const handler = (payload: { cardId: string; status: Card['status'] }) => {
      setCards((prev) => {
        // If the message references a card we don't have (e.g. created in
        // another tab), pull a fresh list rather than silently dropping it.
        if (!prev.some((c) => c._id === payload.cardId)) {
          fetchCards()
          return prev
        }
        return prev.map((c) => c._id === payload.cardId ? { ...c, status: payload.status as Card['status'] } : c)
      })
    }
    ws.on('card:status', handler)
    return () => { ws.off('card:status', handler) }
  }, [])

  // Polling fallback: WS pub/sub is at-most-once, so if the `ready` event drops
  // (browser WS reconnect window, ioredis reconnect, idle proxy, etc.) the row
  // would stay on 'processing' until a manual reload. While any card is still
  // processing, refetch every 5s — stops automatically once everything settles.
  const anyProcessing = cards.some((c) => c.status === 'processing')
  useEffect(() => {
    if (!anyProcessing) return
    const id = setInterval(fetchCards, 5000)
    return () => clearInterval(id)
  }, [anyProcessing])

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">My Cards</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {cards.length} card{cards.length !== 1 ? 's' : ''} · Welcome back, {displayName ?? 'there'}
          </p>
        </div>
        <Link to="/dashboard/create" className="btn-primary flex items-center justify-center gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Card
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : (
        <CardGrid cards={cards} />
      )}
    </DashboardLayout>
  )
}
