import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CardGrid from '@/components/dashboard/CardGrid'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useSocket } from '@/hooks/useSocket'
import type { Card } from '@/lib/types'

export default function DashboardPage() {
  const { user } = useAuthStore()
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
      setCards((prev) =>
        prev.map((c) => c._id === payload.cardId ? { ...c, status: payload.status as Card['status'] } : c)
      )
    }
    ws.on('card:status', handler)
    return () => { ws.off('card:status', handler) }
  }, [])

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Cards</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {cards.length} card{cards.length !== 1 ? 's' : ''} · Welcome back, {user?.name?.split(' ')[0]}
          </p>
        </div>
        <Link to="/dashboard/create" className="btn-primary flex items-center gap-2">
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
