import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, X, Camera, AlertCircle, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import { computeCoverPlaneSize } from '@/lib/arCoverPlane'
import { withIdealCameraResolution } from '@/lib/arCamera'
import ScanReticle from '@/components/ui/ScanReticle'
import type { PublicCampaign } from '@/lib/types'

type ViewerState =
  | 'loading'
  | 'permission'
  | 'tracking'
  | 'playing'
  | 'denied'
  | 'fallback'
  | 'inactive'
  | 'error'

export default function CampaignViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null)
  const [state, setState] = useState<ViewerState>('loading')
  const [muted, setMuted] = useState(true)
  const [showOverlay, setShowOverlay] = useState(true)
  const [showSoundHint, setShowSoundHint] = useState(false)
  const [noDetectionTimer, setNoDetectionTimer] = useState(false)
  // True once MindAR's own camera video is live. MindAR calibrates its
  // projection to that feed, so from then on it must be the visible one.
  const [arLive, setArLive] = useState(false)

  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const overlayVideoRef = useRef<HTMLVideoElement>(null)
  const mindarInstanceRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const noDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logScan = useCallback(async (s: string) => {
    await api.post('/analytics/campaign-scan', { slug: s }).catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/campaigns/view/${slug}`)
        if (!data.campaign.isActive || data.campaign.status !== 'ready') {
          setState('inactive')
          return
        }
        setCampaign(data.campaign)
        await logScan(slug!)
        setState(checkBrowserSupport() ? 'permission' : 'fallback')
      } catch {
        setState('inactive')
      }
    }
    load()
  }, [slug, logScan])

  useEffect(() => {
    if (state !== 'playing') return
    const t1 = setTimeout(() => setShowOverlay(false), 3000)
    setShowSoundHint(true)
    const t2 = setTimeout(() => setShowSoundHint(false), 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [state])

  function checkBrowserSupport() {
    return !!(navigator.mediaDevices?.getUserMedia)
  }

  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        await cameraVideoRef.current.play()
      }
      setState('tracking')
      startMindAR()
      noDetectTimerRef.current = setTimeout(() => setNoDetectionTimer(true), 10000)
    } catch {
      setState('denied')
    }
  }, [campaign])

  const startMindAR = useCallback(async () => {
    if (!campaign?.targetFileUrl) return
    try {
      const { MindARThree } = await import('mind-ar/dist/mindar-image-three.prod.js' as any)
      const mindarThree = new MindARThree({
        container: document.querySelector('#ar-container') as HTMLElement,
        imageTargetSrc: campaign.targetFileUrl,
        maxTrack: 1,
        filterMinCF: 0.001,
        filterBeta: 1000,
        warmupTolerance: 1,
        missTolerance: 2,
      })
      mindarInstanceRef.current = mindarThree

      const { renderer, scene, camera } = mindarThree
      const THREE = await import('three')

      const anchor = mindarThree.addAnchor(0)

      const videoEl = overlayVideoRef.current!
      videoEl.src = campaign.videoUrl
      videoEl.loop = true
      videoEl.muted = true
      videoEl.playsInline = true
      videoEl.setAttribute('webkit-playsinline', 'true')
      videoEl.load()

      const texture = new THREE.VideoTexture(videoEl)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      const getAspect = (): number => {
        if (videoEl.videoWidth && videoEl.videoHeight) return videoEl.videoWidth / videoEl.videoHeight
        return 16 / 9
      }

      const aspect = await new Promise<number>((res) => {
        if (videoEl.readyState >= 1) return res(getAspect())
        videoEl.addEventListener('loadedmetadata', () => res(getAspect()), { once: true })
        setTimeout(() => res(getAspect()), 3000)
      })

      // The compiled target is the square QR PNG (1×1 in anchor units), so
      // cover-fit the plane to it — full video, no crop, QR fully hidden.
      const { width: planeWidth, height: planeHeight } = computeCoverPlaneSize(aspect)

      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight)
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide })
      const plane = new THREE.Mesh(geometry, material)
      anchor.group.add(plane)

      anchor.onTargetFound = () => {
        if (noDetectTimerRef.current) clearTimeout(noDetectTimerRef.current)
        setNoDetectionTimer(false)
        videoEl.play().catch(() => {})
        setState('playing')
      }

      anchor.onTargetLost = () => {
        videoEl.pause()
        setState('tracking')
        noDetectTimerRef.current = setTimeout(() => setNoDetectionTimer(true), 10000)
      }

      // mind-ar requests the camera with no resolution constraints (browser
      // default, often 640x480 4:3) — the shim makes it ask for the same
      // 1280x720 as our preview so the feed stays sharp.
      await withIdealCameraResolution(() => mindarThree.start())

      // MindAR's own camera video (zIndex -2 inside #ar-container) is now
      // live, and it is the feed the projection matrix is calibrated to.
      // Drop our preview stream so the user sees exactly that feed — keeping
      // our separately-cropped preview on top is what made the overlay sit
      // left/right of the QR.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setArLive(true)

      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera)
      })
    } catch (err) {
      console.error('MindAR init failed:', err)
      setState('fallback')
    }
  }, [campaign])

  const stopAR = useCallback(() => {
    if (mindarInstanceRef.current) {
      try { mindarInstanceRef.current.stop() } catch {}
      mindarInstanceRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (noDetectTimerRef.current) clearTimeout(noDetectTimerRef.current)
  }, [])

  useEffect(() => () => stopAR(), [stopAR])

  const toggleMute = () => {
    const v = overlayVideoRef.current
    if (!v) return
    v.muted = !muted
    setMuted(!muted)
    if (muted) setShowSoundHint(false)
  }

  if (state === 'loading') return <LoadingScreen />

  if (state === 'inactive') return (
    <FullScreen>
      <AlertCircle className="w-12 h-12 text-status-error mb-4" />
      <h2 className="text-xl font-bold mb-2">Not Found</h2>
      <p className="text-text-secondary text-sm text-center max-w-xs">This QR code is no longer active or doesn't exist.</p>
    </FullScreen>
  )

  if (state === 'fallback') return (
    <FullScreen>
      <div className="w-full max-w-sm text-center">
        <AlertCircle className="w-10 h-10 text-status-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">AR Not Supported</h2>
        <p className="text-text-secondary text-sm mb-6">Your browser doesn't support the AR experience. Watching in standard mode.</p>
        {campaign && (
          <video
            src={campaign.videoUrl}
            autoPlay
            loop
            playsInline
            controls
            className="w-full rounded-lg"
          />
        )}
        {campaign?.ctaText && campaign?.ctaUrl && (
          <a
            href={campaign.ctaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 btn-primary text-sm"
          >
            {campaign.ctaText}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </FullScreen>
  )

  if (state === 'denied') return (
    <FullScreen>
      <Camera className="w-12 h-12 text-text-secondary mb-4" />
      <h2 className="text-xl font-bold mb-2">Camera Access Required</h2>
      <p className="text-text-secondary text-sm text-center max-w-xs mb-6">
        Enable camera access to see the AR experience. You can also watch the video below.
      </p>
      {campaign && (
        <video src={campaign.videoUrl} autoPlay loop playsInline controls className="w-full max-w-sm rounded-lg" />
      )}
    </FullScreen>
  )

  if (state === 'permission') return (
    <FullScreen className="bg-bg-base">
      <div className="text-center max-w-sm px-6">
        {campaign?.thumbnailUrl && (
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-5 border-2 border-accent">
            <img src={campaign.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <h2 className="text-2xl font-bold mb-1">{campaign?.title}</h2>
        {campaign?.description && (
          <p className="text-text-secondary text-sm mb-8">{campaign.description}</p>
        )}
        <div className="panel p-5 mb-6 text-left text-sm text-text-secondary space-y-2">
          <p>1. Tap <strong className="text-text-primary">Enable Camera</strong> below</p>
          <p>2. Point your camera at the QR code</p>
          <p>3. Watch the video come to life on the QR</p>
        </div>
        <button onClick={requestCamera} className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3">
          <Camera className="w-5 h-5" />
          Enable Camera
        </button>
      </div>
    </FullScreen>
  )

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" id="ar-container">
      {/* Instant camera preview while MindAR boots. Removed once MindAR's
          own (projection-calibrated) video takes over as the visible feed. */}
      {!arLive && (
        <video
          ref={cameraVideoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          style={{ zIndex: 0 }}
        />
      )}

      {/* Hidden video for MindAR texture (rendered by Three.js) */}
      <video
        ref={overlayVideoRef}
        className="hidden"
        playsInline
        muted={muted}
        loop
        crossOrigin="anonymous"
      />

      {/* Tracking hint */}
      <AnimatePresence>
        {state === 'tracking' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <ScanReticle />
            <div className="mt-6 bg-black/50 backdrop-blur-sm rounded-2xl px-6 py-3 text-center">
              <p className="text-sm font-medium">Point camera at the QR code</p>
              {noDetectionTimer && (
                <p className="text-xs text-text-secondary mt-1">Make sure the QR is well-lit and fully visible</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sound hint */}
      <AnimatePresence>
        {showSoundHint && muted && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ zIndex: 25 }}
          >
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
              <VolumeX className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs text-white/80">Tap 🔊 for sound</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign info overlay — fades after 3s */}
      <AnimatePresence>
        {state === 'playing' && showOverlay && campaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-20 left-4 pointer-events-none"
            style={{ zIndex: 20 }}
          >
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2 max-w-[200px]">
              <p className="text-sm font-semibold truncate">{campaign.title}</p>
              {campaign.description && (
                <p className="text-xs text-text-secondary truncate">{campaign.description}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA button — shown while playing */}
      <AnimatePresence>
        {state === 'playing' && campaign?.ctaText && campaign?.ctaUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
            style={{ zIndex: 25 }}
          >
            <a
              href={campaign.ctaUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg hover:bg-accent/90 transition-colors"
            >
              {campaign.ctaText}
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 30 }}>
        <button
          onClick={toggleMute}
          className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={stopAR}
          className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Watermark */}
      <div className="absolute bottom-4 right-4 pointer-events-none" style={{ zIndex: 20 }}>
        <p className="text-xs text-white/30 font-mono">ChampLens</p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <FullScreen>
      <div className="w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
      <p className="text-text-secondary text-sm">Loading experience…</p>
    </FullScreen>
  )
}

function FullScreen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`fixed inset-0 bg-bg-base flex flex-col items-center justify-center ${className}`}>
      {children}
    </div>
  )
}
