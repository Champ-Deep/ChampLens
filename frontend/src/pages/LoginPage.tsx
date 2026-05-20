import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
// Link kept for logo navigation
import { motion } from 'framer-motion'
import { QrCode } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Spinner from '@/components/ui/Spinner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setUser(data.user)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <QrCode className="w-8 h-8 text-accent" />
            <span className="text-2xl font-bold">ChampLens</span>
          </Link>
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-text-secondary text-sm">Sign in to your account</p>
        </div>

        <div className="panel p-6 shadow-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            {error && (
              <p className="text-xs text-status-error bg-status-error/10 px-3 py-2 rounded">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Spinner size="sm" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          Need access? Contact your administrator.
        </p>
      </motion.div>
    </div>
  )
}
