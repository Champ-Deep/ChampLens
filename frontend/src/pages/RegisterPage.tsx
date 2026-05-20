import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Spinner from '@/components/ui/Spinner'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      setUser(data.user)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

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
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-text-secondary text-sm">Start making AR business cards</p>
        </div>

        <div className="panel p-6 shadow-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Full name</label>
              <input type="text" required value={form.name} onChange={set('name')} placeholder="Jane Smith" className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Password</label>
              <input type="password" required value={form.password} onChange={set('password')} placeholder="Min. 8 characters" className="input-field" />
            </div>

            {error && (
              <p className="text-xs text-status-error bg-status-error/10 px-3 py-2 rounded">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Spinner size="sm" />}
              Create account
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
