import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Plus, LogOut, QrCode, Users, BarChart3, ShieldCheck, Menu, X, Film } from 'lucide-react'
import { useUser, useClerk } from '@clerk/react'

interface Props { children: React.ReactNode }

export default function DashboardLayout({ children }: Props) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Auto-close the mobile drawer when the route changes.
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const role = (user?.publicMetadata as { role?: string })?.role
  const isAdmin = role === 'admin'

  const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || ''
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinks = [
    { to: '/dashboard', icon: LayoutGrid, label: 'AR Cards' },
    { to: '/dashboard/create', icon: Plus, label: 'New Card' },
    { to: '/dashboard/campaigns', icon: Film, label: 'Campaigns' },
    { to: '/dashboard/campaigns/create', icon: Plus, label: 'New Campaign' },
    ...(isAdmin ? [
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/stats', icon: BarChart3, label: 'Platform Stats' },
    ] : []),
  ]

  const SidebarContent = (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <QrCode className="w-6 h-6 text-accent" />
          <span className="font-bold text-lg tracking-tight">ChampLens</span>
        </Link>
        {/* Close button (mobile drawer only) */}
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden inline-flex items-center justify-center w-9 h-9 -mr-2 rounded text-text-primary hover:bg-bg-panel transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
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
            <p className="text-xs font-medium text-text-primary truncate">{name}</p>
            {isAdmin && <ShieldCheck className="w-3 h-3 text-accent shrink-0" aria-label="Admin" />}
          </div>
          <p className="text-xs text-text-secondary truncate">{email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-panel transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-bg-base md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-bg-base/90 backdrop-blur-md border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-accent" />
          <span className="font-bold tracking-tight">ChampLens</span>
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 -mr-2 rounded text-text-primary hover:bg-bg-surface transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-bg-surface border-r border-border flex-col shrink-0">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDrawerOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-64 max-w-[80vw] bg-bg-surface border-r border-border flex flex-col"
              role="dialog"
              aria-label="Navigation"
            >
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-auto min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
