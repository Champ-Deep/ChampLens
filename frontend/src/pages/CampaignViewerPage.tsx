import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, ExternalLink, AlertCircle, Play, Pause } from 'lucide-react'
import api from '@/lib/api'
import type { PublicCampaign } from '@/lib/types'

type ViewerState = 'loading' | 'ready' | 'playing' | 'paused' | 'inactive' | 'error'

export default function CampaignViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null)
  const [state, setState] = useState<ViewerState>('loading')
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/campaigns/view/${slug}`)
        if (!data.campaign.isActive || data.campaign.status !== 'ready') {
          setState('inactive')
          return
        }
        setCampaign(data.campaign)
        // Log scan (fire-and-forget)
        api.post('/analytics/campaign-scan', { slug }).catch(() => {})
        setState('ready')
      } catch {
        setState('inactive')
      }
    }
    load()
  }, [slug])

  const handlePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.play()
    setState('playing')
  }, [])

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      setState('playing')
    } else {
      v.pause()
      setState('paused')
    }
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !muted
    setMuted(!muted)
  }, [muted])

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress((v.currentTime / v.duration) * 100)
  }, [])

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (v) setDuration(v.duration)
  }, [])

  const onEnded = useCallback(() => {
    setState('paused')
    setProgress(0)
    const v = videoRef.current
    if (v) v.currentTime = 0
  }, [])

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    v.currentTime = pct * v.duration
  }, [])

  if (state === 'loading') return <FullScreen><LoadingSpinner /></FullScreen>

  if (state === 'inactive') return (
    <FullScreen>
      <AlertCircle className="w-12 h-12 text-status-error mb-4" />
      <h2 className="text-xl font-bold mb-2">Not Found</h2>
      <p className="text-text-secondary text-sm text-center max-w-xs">This QR code is no longer active or doesn't exist.</p>
    </FullScreen>
  )

  if (!campaign) return null

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={campaign.videoUrl}
          className="w-full h-full object-contain"
          playsInline
          muted={muted}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onClick={togglePlayPause}
        />

        {/* Play button overlay when ready/paused */}
        <AnimatePresence>
          {(state === 'ready' || state === 'paused') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 cursor-pointer"
              onClick={handlePlay}
            >
              {state === 'ready' && campaign.thumbnailUrl && (
                <img
                  src={campaign.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                {state === 'ready' && (
                  <>
                    <h1 className="text-2xl font-bold text-white drop-shadow">{campaign.title}</h1>
                    {campaign.description && (
                      <p className="text-white/70 text-sm max-w-sm">{campaign.description}</p>
                    )}
                  </>
                )}
                <button
                  onClick={handlePlay}
                  className="w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-lg hover:bg-accent/90 transition-colors"
                >
                  <Play className="w-7 h-7 text-white ml-1" fill="white" />
                </button>
                {state === 'ready' && <p className="text-white/50 text-xs">Tap to play</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="bg-black/90 px-4 pt-2 pb-safe-4 pb-4">
        {/* Progress bar */}
        <div
          className="h-1 bg-white/20 rounded-full mb-3 cursor-pointer"
          onClick={seekTo}
        >
          <div
            className="h-full bg-accent rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={togglePlayPause} className="text-white/80 hover:text-white">
              {state === 'playing'
                ? <Pause className="w-5 h-5" />
                : <Play className="w-5 h-5" />
              }
            </button>
            <button onClick={toggleMute} className="text-white/80 hover:text-white">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate max-w-[160px]">{campaign.title}</p>
              {duration > 0 && (
                <p className="text-xs text-white/40">{formatTime(Math.round((progress / 100) * duration))} / {formatTime(Math.round(duration))}</p>
              )}
            </div>
          </div>

          {campaign.ctaText && campaign.ctaUrl && (
            <a
              href={campaign.ctaUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-accent/90 transition-colors shrink-0"
            >
              {campaign.ctaText}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* ChampQR watermark */}
      <div className="absolute top-3 right-3 pointer-events-none">
        <p className="text-xs text-white/20 font-mono">ChampQR</p>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function LoadingSpinner() {
  return (
    <>
      <div className="w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
      <p className="text-text-secondary text-sm">Loading…</p>
    </>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-bg-base flex flex-col items-center justify-center">
      {children}
    </div>
  )
}
