import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Film, X, Music, AlertCircle, Link2, Type } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'

interface FormState {
  title: string
  description: string
  ctaText: string
  ctaUrl: string
}

const emptyForm: FormState = {
  title: '', description: '', ctaText: '', ctaUrl: '',
}

export default function CreateCampaignPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [video, setVideo] = useState<File | null>(null)
  const [videoError, setVideoError] = useState('')
  const [audio, setAudio] = useState<File | null>(null)
  const [audioError, setAudioError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')

  const onDropVideo = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setVideoError('')
    if (file.size > 200 * 1024 * 1024) {
      setVideoError('File is too large. Maximum size is 200 MB.')
      return
    }
    setVideo(file)
  }, [])

  const onDropAudio = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setAudioError('')
    if (file.size > 50 * 1024 * 1024) {
      setAudioError('Audio file is too large. Maximum size is 50 MB.')
      return
    }
    setAudio(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropVideo,
    accept: { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/webm': ['.webm'] },
    maxFiles: 1,
  })

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onDropAudio,
    accept: { 'audio/mpeg': ['.mp3'], 'audio/wav': ['.wav'], 'audio/mp4': ['.m4a'], 'audio/aac': ['.aac'] },
    maxFiles: 1,
  })

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!video) { setVideoError('Please select a video file.'); return }
    if (!form.title.trim()) {
      setError('Campaign title is required.')
      return
    }
    setError('')
    setUploading(true)

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
    fd.append('video', video)
    if (audio) fd.append('audio', audio)

    try {
      const { data } = await api.post('/campaigns', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded / (e.total ?? 1)) * 100))
        },
      })
      navigate(`/dashboard/campaigns/${data.campaignId}`)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Upload failed. Please try again.')
      setUploading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Create Video QR Campaign</h1>
          <p className="text-text-secondary text-sm">
            Link any video to a QR code — for ads, menus, product demos, events, and more.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign details */}
          <div className="panel p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Type className="w-4 h-4 text-accent" /> Campaign Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Campaign Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. Summer Sale 2025, Restaurant Menu, Product Demo"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Description <span className="text-text-disabled">(optional — shown on viewer page)</span></label>
                <textarea
                  value={form.description}
                  onChange={set('description')}
                  placeholder="A short description about this video…"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>
          </div>

          {/* Call-to-action */}
          <div className="panel p-6">
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" /> Call-to-Action <span className="text-text-secondary font-normal text-sm">(optional)</span>
            </h2>
            <p className="text-xs text-text-secondary mb-4">Add a button on the viewer page that links to a product, website, or booking page.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Button Text</label>
                <input value={form.ctaText} onChange={set('ctaText')} placeholder="Shop Now, Book a Table…" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Button URL</label>
                <input value={form.ctaUrl} onChange={set('ctaUrl')} placeholder="https://yoursite.com" className="input-field" />
              </div>
            </div>
          </div>

          {/* Video upload */}
          <div className="panel p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Film className="w-4 h-4 text-accent" /> Campaign Video *
            </h2>

            {video ? (
              <div className="flex items-center gap-3 p-4 bg-bg-surface rounded border border-accent/30">
                <Film className="w-5 h-5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{video.name}</p>
                  <p className="text-xs text-text-secondary">{(video.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button type="button" onClick={() => setVideo(null)} className="text-text-secondary hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto mb-3 text-text-secondary" />
                <p className="text-sm font-medium mb-1">
                  {isDragActive ? 'Drop it here' : 'Drag & drop your video'}
                </p>
                <p className="text-xs text-text-secondary">MP4, MOV, WebM · Max 200 MB</p>
              </div>
            )}
            {videoError && <p className="text-xs text-status-error mt-2">{videoError}</p>}
          </div>

          {/* Audio track (optional) */}
          <div className="panel p-6">
            <h2 className="font-semibold mb-1">Background Audio <span className="text-text-secondary font-normal text-sm">(optional)</span></h2>
            <p className="text-xs text-text-secondary mb-4">Upload a music track to replace or add audio to your video. MP3, WAV, M4A · Max 50 MB</p>

            {audio ? (
              <div className="flex items-center gap-3 p-4 bg-bg-surface rounded border border-accent/30">
                <Music className="w-5 h-5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{audio.name}</p>
                  <p className="text-xs text-text-secondary">{(audio.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button type="button" onClick={() => setAudio(null)} className="text-text-secondary hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                {...getAudioRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isAudioDragActive ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover'
                }`}
              >
                <input {...getAudioInputProps()} />
                <Music className="w-7 h-7 mx-auto mb-2 text-text-secondary" />
                <p className="text-sm font-medium mb-1">
                  {isAudioDragActive ? 'Drop audio here' : 'Drag & drop an audio file'}
                </p>
                <p className="text-xs text-text-secondary">or click to browse</p>
              </div>
            )}
            {audioError && <p className="text-xs text-status-error mt-2">{audioError}</p>}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-status-error bg-status-error/10 px-4 py-3 rounded">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <AnimatePresence>
            {uploading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Spinner size="sm" />
                  <span className="text-sm font-medium">
                    {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Processing your campaign…'}
                  </span>
                </div>
                <div className="h-1 bg-bg-surface rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={uploading} className="btn-primary w-full flex items-center justify-center gap-2">
            {uploading ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Creating…' : 'Create Campaign QR'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}
