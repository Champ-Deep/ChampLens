import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QrCode, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import type { PublicCard } from '@/lib/types'
import Spinner from '@/components/ui/Spinner'

export default function PreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [card, setCard] = useState<PublicCard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/cards/view/${slug}`)
      .then(({ data }) => setCard(data.card))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )

  if (!card || !card.isActive) return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center text-center p-6">
      <QrCode className="w-12 h-12 text-text-disabled mb-4" />
      <h2 className="text-xl font-bold mb-2">Card Not Found</h2>
      <p className="text-text-secondary text-sm">This card is no longer active.</p>
    </div>
  )

  const arUrl = `${window.location.origin}/v/${slug}`

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <QrCode className="w-5 h-5 text-accent" />
            <span className="font-bold">ChampLens</span>
          </Link>
        </div>

        <div className="panel overflow-hidden shadow-glow">
          {card.thumbnailUrl && (
            <div className="w-full bg-black flex items-center justify-center">
              <video
                src={card.videoUrl}
                poster={card.thumbnailUrl}
                controls
                playsInline
                className="w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
          <div className="p-5">
            <h1 className="text-xl font-bold mb-0.5">{card.ownerName}</h1>
            <p className="text-text-secondary text-sm mb-4">{card.ownerTitle}</p>

            <a
              href={arUrl}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open AR Experience
            </a>
            <p className="text-xs text-text-secondary text-center mt-3">
              Point your phone camera at the QR code for the full experience
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
