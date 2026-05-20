import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, Download, QrCode } from 'lucide-react'
import type { Card } from '@/lib/types'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate, formatNumber } from '@/lib/utils'

interface Props { cards: Card[] }

export default function CardGrid({ cards }: Props) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-24 text-text-secondary">
        <QrCode className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium text-text-primary mb-1">No cards yet</p>
        <p className="text-sm">Create your first AR business card to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card._id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          whileHover={{ scale: 1.01 }}
          className="panel overflow-hidden group cursor-pointer"
        >
          <Link to={`/dashboard/cards/${card._id}`} className="block">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-bg-surface overflow-hidden">
              {card.thumbnailUrl ? (
                <img src={card.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-text-disabled" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Info */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{card.ownerName}</p>
                  <p className="text-xs text-text-secondary truncate">{card.ownerTitle}{card.company ? ` · ${card.company}` : ''}</p>
                </div>
                <StatusBadge status={card.status} />
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {formatNumber(card.scanCount ?? 0)} scans
                </span>
                <span>{formatDate(card.createdAt)}</span>
              </div>
            </div>
          </Link>

          {card.status === 'ready' && card.printPackUrl && (
            <div className="px-4 pb-4">
              <a
                href={card.printPackUrl}
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
  )
}
