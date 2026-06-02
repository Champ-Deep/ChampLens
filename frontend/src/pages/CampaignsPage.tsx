import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Eye, Download, QrCode } from 'lucide-react'
import { motion } from 'framer-motion'
import DashboardLayout from '@/components/layout/DashboardLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import { formatDate, formatNumber } from '@/lib/utils'
import type { Campaign } from '@/lib/types'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const ws = useSocket()

  const fetchCampaigns = async () => {
    try {
      const { data } = await api.get('/campaigns')
      setCampaigns(data.campaigns)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCampaigns() }, [])

  useEffect(() => {
    const handler = (payload: { campaignId: string; status: Campaign['status'] }) => {
      setCampaigns((prev) =>
        prev.map((c) => c._id === payload.campaignId ? { ...c, status: payload.status as Campaign['status'] } : c)
      )
    }
    ws.on('campaign:status', handler)
    return () => { ws.off('campaign:status', handler) }
  }, [])

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Video QR Campaigns</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} · Link any video to a QR code
          </p>
        </div>
        <Link to="/dashboard/campaigns/create" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-24 text-text-secondary">
          <QrCode className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-text-primary mb-1">No campaigns yet</p>
          <p className="text-sm mb-6">Create a Video QR for ads, menus, product demos, events, and more.</p>
          <Link to="/dashboard/campaigns/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create First Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign, i) => (
            <motion.div
              key={campaign._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.01 }}
              className="panel overflow-hidden group cursor-pointer"
            >
              <Link to={`/dashboard/campaigns/${campaign._id}`} className="block">
                <div className="relative aspect-video bg-bg-surface overflow-hidden">
                  {campaign.thumbnailUrl ? (
                    <img src={campaign.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <QrCode className="w-8 h-8 text-text-disabled" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {/* Campaign badge */}
                  <div className="absolute top-2 left-2">
                    <span className="bg-accent/90 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      Campaign
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{campaign.title}</p>
                      {campaign.description && (
                        <p className="text-xs text-text-secondary truncate">{campaign.description}</p>
                      )}
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(campaign.scanCount ?? 0)} scans
                    </span>
                    <span>{formatDate(campaign.createdAt)}</span>
                  </div>
                </div>
              </Link>

              {campaign.status === 'ready' && campaign.printPackUrl && (
                <div className="px-4 pb-4">
                  <a
                    href={campaign.printPackUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download print package
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
