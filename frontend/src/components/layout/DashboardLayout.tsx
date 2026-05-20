import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutGrid, Plus, LogOut, QrCode, Users, BarChart3, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'

interface Props { children: React.ReactNode }

export default function DashboardLayout({ children }: Props) {
  const { user, isAdmin, clearAuth } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {})
    clearAuth()
    navigate('/login')
  }

  const navLinks = [
    { to: '/dashboard', icon: LayoutGrid, label: 'My Cards' },
    { to: '/dashboard/create', icon: Plus, label: 'New Card' },
    ...(isAdmin ? [
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/stats', icon: BarChart3, label: 'Platform Stats' },
    ] : []),
  ]

  return (
    <div className="min-h-screen bg-bg-base flex">
      {/* Sidebar */}
      <aside className="w-56 bg-bg-surface border-r border-border flex flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-accent" />
            <span className="font-bold text-lg tracking-tight">ChampLens</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-xs font-medium text-text-primary truncate">{user?.name}</p>
              {isAdmin && <ShieldCheck className="w-3 h-3 text-accent shrink-0" aria-label="Admin" />}
            </div>
            <p className="text-xs text-text-secondary truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-panel transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-5xl mx-auto p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
