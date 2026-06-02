import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Download, Trash2, QrCode,
  Eye, Share2, AlertCircle, RefreshCw, ExternalLink,
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
import type { Campaign, Analytics } from '@/lib/types'

const PIE_COLORS = ['#E8003D', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6']

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const ws = useSocket()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = async () => {
    try {
      const [campRes, analyticsRes] = await Promise.all([
        api.get(`/campaigns/${id}`),
        api.get(`/analytics/campaign/${id}`),
      ])
      setCampaign(campRes.data.campaign)
      setAnalytics(analyticsRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [id])

  useEffect(() => {
    const handler = (payload: { campaignId: string; status: Campaign['status'] }) => {
      if (payload.campaignId === id) setCampaign((c) => c ? { ...c, status: payload.status as Campaign['status'] } : c)
    }
    ws.on('campaign:status', handler)
    return () => { ws.off('campaign:status', handler) }
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Delete this campaign? The QR code will stop working immediately.')) return
    setDeleting(true)
    await api.delete(`/campaigns/${id}`)
    navigate('/dashboard/campaigns')
  }

  const downloadQr = async (type: 'png' | 'svg' | 'print-pack') => {
    const endpoint = type === 'print-pack' ? `/campaigns/${id}/qr/print-pack`
      : type === 'svg' ? `/campaigns/${id}/qr/svg`
      : `/campaigns/${id}/qr`
    const res = await api.get(endpoint, { responseType: 'blob' })
    const ext = type === 'print-pack' ? 'zip' : type
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-qr-${campaign?.slug}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const viewerUrl = `${window.location.origin}/c/${campaign?.slug}`

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-24"><Spinner size="lg" /></div>
    </DashboardLayout>
  )

  if (!campaign) return (
    <DashboardLayout>
      <div className="text-center py-24">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-status-error" />
        <p className="font-medium">Campaign not found.</p>
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
              <h1 className="text-2xl font-bold">{campaign.title}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-text-secondary text-sm">
              {campaign.description ? `${campaign.description} · ` : ''}Created {formatDate(campaign.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {campaign.status === 'ready' && (
              <a href={viewerUrl} target="_blank" rel="noreferrer" className="btn-ghost flex items-center gap-2 text-sm">
                <ExternalLink className="w-4 h-4" />
                Preview
              </a>
            )}
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

              {campaign.status === 'ready' ? (
                <>
                  <div className="bg-white rounded-lg p-3 mb-4 aspect-square flex items-center justify-center">
                    <img src={campaign.qrImageUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => downloadQr('print-pack')}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" /> Download Print Package
                    </button>
                    <button
                      onClick={() => downloadQr('png')}
                      className="btn-ghost w-full flex items-center justify-center gap-2 text-sm"
                    >
                      PNG (300 DPI)
                    </button>
                    <button
                      onClick={() => downloadQr('svg')}
                      className="btn-ghost w-full flex items-center justify-center gap-2 text-sm"
                    >
                      SVG Vector
                    </button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-text-secondary mb-2">Video Viewer URL</p>
                    <div className="flex items-center gap-2 bg-bg-surface rounded px-3 py-2">
                      <code className="text-xs text-text-primary font-mono truncate flex-1">{viewerUrl}</code>
                      <button onClick={() => navigator.clipboard.writeText(viewerUrl)} className="text-text-secondary hover:text-accent">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {campaign.ctaText && campaign.ctaUrl && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-text-secondary mb-2">Call-to-Action</p>
                      <div className="bg-bg-surface rounded px-3 py-2">
                        <p className="text-xs font-medium text-text-primary">{campaign.ctaText}</p>
                        <p className="text-xs text-text-secondary truncate">{campaign.ctaUrl}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : campaign.status === 'processing' ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Spinner size="lg" />
                  <p className="text-sm text-text-secondary mt-4">Generating QR code…</p>
                  <p className="text-xs text-text-disabled mt-1">Usually takes under 30 seconds</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-status-error" />
                  <p className="text-sm text-status-error mb-1">Processing failed</p>
                  <p className="text-xs text-text-secondary mb-4">{campaign.errorMsg ?? 'Unknown error'}</p>
                  <button onClick={fetchAll} className="btn-ghost text-sm flex items-center gap-2 mx-auto">
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              )}
            </div>

            {/* Thumbnail */}
            {campaign.thumbnailUrl && (
              <div className="panel overflow-hidden">
                <div className="relative aspect-video">
                  <img src={campaign.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  {campaign.status === 'ready' && (
                    <a
                      href={viewerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <ExternalLink className="w-6 h-6 text-white" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: analytics */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Total Scans', value: analytics?.totalScans ?? 0 },
                { label: 'Unique Scans', value: analytics?.uniqueScans ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="panel p-5">
                  <div className="flex items-center gap-2 text-text-secondary text-xs mb-2">
                    <Eye className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  <p className="text-3xl font-bold">{formatNumber(value)}</p>
                </div>
              ))}
            </div>

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
