import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Download, Trash2, ExternalLink, QrCode,
  Eye, Share2, AlertCircle, RefreshCw,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import DashboardLayout from '@/components/layout/DashboardLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import { formatDate, formatNumber } from '@/lib/utils'
import type { Card, Analytics } from '@/lib/types'

const PIE_COLORS = ['#E8003D', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6']

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const ws = useSocket()
  const [card, setCard] = useState<Card | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = async () => {
    try {
      const [cardRes, analyticsRes] = await Promise.all([
        api.get(`/cards/${id}`),
        api.get(`/analytics/${id}`),
      ])
      setCard(cardRes.data.card)
      setAnalytics(analyticsRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [id])

  useEffect(() => {
    const handler = (payload: { cardId: string; status: Card['status'] }) => {
      if (payload.cardId === id) setCard((c) => c ? { ...c, status: payload.status as Card['status'] } : c)
    }
    ws.on('card:status', handler)
    return () => { ws.off('card:status', handler) }
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Delete this card? The QR code will stop working immediately.')) return
    setDeleting(true)
    await api.delete(`/cards/${id}`)
    navigate('/dashboard')
  }

  const previewUrl = `${window.location.origin}/preview/${card?.slug}`
  const viewerUrl = `${window.location.origin}/v/${card?.slug}`

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-24"><Spinner size="lg" /></div>
    </DashboardLayout>
  )

  if (!card) return (
    <DashboardLayout>
      <div className="text-center py-24">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-status-error" />
        <p className="font-medium">Card not found.</p>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{card.ownerName}</h1>
              <StatusBadge status={card.status} />
            </div>
            <p className="text-text-secondary text-sm">
              {card.ownerTitle}{card.company ? ` · ${card.company}` : ''} · Created {formatDate(card.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-ghost flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4" />
              Preview
            </a>
            <button onClick={handleDelete} disabled={deleting} className="btn-ghost flex items-center gap-2 text-sm text-status-error border-status-error/30 hover:border-status-error">
              {deleting ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: QR + downloads */}
          <div className="space-y-4">
            <div className="panel p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-accent" /> QR Code
              </h3>

              {card.status === 'ready' ? (
                <>
                  <div className="bg-white rounded-lg p-3 mb-4 aspect-square flex items-center justify-center">
                    <img src={card.qrImageUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-2">
                    <a href={`/api/cards/${id}/qr/print-pack`} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                      <Download className="w-4 h-4" /> Download Print Package
                    </a>
                    <a href={`/api/cards/${id}/qr`} className="btn-ghost w-full flex items-center justify-center gap-2 text-sm">
                      PNG (300 DPI)
                    </a>
                    <a href={`/api/cards/${id}/qr/svg`} className="btn-ghost w-full flex items-center justify-center gap-2 text-sm">
                      SVG Vector
                    </a>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-text-secondary mb-2">AR Viewer URL</p>
                    <div className="flex items-center gap-2 bg-bg-surface rounded px-3 py-2">
                      <code className="text-xs text-text-primary font-mono truncate flex-1">{viewerUrl}</code>
                      <button onClick={() => navigator.clipboard.writeText(viewerUrl)} className="text-text-secondary hover:text-accent">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : card.status === 'processing' ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Spinner size="lg" />
                  <p className="text-sm text-text-secondary mt-4">Generating QR &amp; AR target…</p>
                  <p className="text-xs text-text-disabled mt-1">Usually takes under 60 seconds</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-status-error" />
                  <p className="text-sm text-status-error mb-1">Processing failed</p>
                  <p className="text-xs text-text-secondary mb-4">{card.errorMsg ?? 'Unknown error'}</p>
                  <button onClick={fetchAll} className="btn-ghost text-sm flex items-center gap-2 mx-auto">
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              )}
            </div>

            {/* Thumbnail */}
            {card.thumbnailUrl && (
              <div className="panel overflow-hidden">
                <div className="relative aspect-video">
                  <img src={card.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <ExternalLink className="w-6 h-6 text-white" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right: analytics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Total Scans', value: analytics?.totalScans ?? 0, icon: Eye },
                { label: 'Unique Scans', value: analytics?.uniqueScans ?? 0, icon: Eye },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="panel p-5">
                  <div className="flex items-center gap-2 text-text-secondary text-xs mb-2">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  <p className="text-3xl font-bold">{formatNumber(value)}</p>
                </div>
              ))}
            </div>

            {/* Scans over time */}
            {analytics && analytics.scansByDay.length > 0 && (
              <div className="panel p-5">
                <h3 className="font-semibold text-sm mb-4">Scans Over Time</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={analytics.scansByDay}>
                    <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 6, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="#E8003D" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Device + country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analytics && analytics.deviceBreakdown.length > 0 && (
                <div className="panel p-5">
                  <h3 className="font-semibold text-sm mb-4">Devices</h3>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={analytics.deviceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50}>
                        {analytics.deviceBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 6, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {analytics && analytics.topCountries.length > 0 && (
                <div className="panel p-5">
                  <h3 className="font-semibold text-sm mb-4">Top Countries</h3>
                  <div className="space-y-2">
                    {analytics.topCountries.slice(0, 5).map(({ country, count }) => (
                      <div key={country} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">{country || 'Unknown'}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
