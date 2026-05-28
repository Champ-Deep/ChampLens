import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, CreditCard, Eye } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { toastError } from '@/lib/toast'
import { formatNumber } from '@/lib/utils'

interface Stats {
  totalUsers: number
  totalCards: number
  totalScans: number
  recentScans: { _id: string; count: number }[]
  cardsByStatus: Record<string, number>
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => toastError(err.response?.data?.message ?? 'Failed to load stats.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Platform Stats</h1>
        <p className="text-text-secondary text-sm">Overview of all activity on ChampLens</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : stats && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Top stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users },
              { label: 'Total Cards', value: stats.totalCards, icon: CreditCard },
              { label: 'Total Scans', value: stats.totalScans, icon: Eye },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="panel p-5">
                <div className="flex items-center gap-2 text-text-secondary text-xs mb-2">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <p className="text-3xl font-bold">{formatNumber(value)}</p>
              </div>
            ))}
          </div>

          {/* Card status breakdown */}
          <div className="panel p-5">
            <h3 className="font-semibold text-sm mb-4">Cards by Status</h3>
            <div className="flex gap-6">
              {Object.entries(stats.cardsByStatus).map(([status, count]) => (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-text-secondary capitalize mt-0.5">{status}</p>
                </div>
              ))}
              {Object.keys(stats.cardsByStatus).length === 0 && (
                <p className="text-text-secondary text-sm">No cards yet.</p>
              )}
            </div>
          </div>

          {/* Scans over time */}
          {stats.recentScans.length > 0 && (
            <div className="panel p-5">
              <h3 className="font-semibold text-sm mb-4">Scans — Last 30 Days</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats.recentScans.map((d) => ({ date: d._id, count: d.count }))}>
                  <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#E8003D" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}
    </DashboardLayout>
  )
}
