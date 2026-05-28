import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, User, ToggleLeft, ToggleRight, X, Search } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Spinner from '@/components/ui/Spinner'
import ConfirmModal from '@/components/ui/ConfirmModal'
import api from '@/lib/api'
import { toastSuccess, toastError } from '@/lib/toast'
import { formatDate } from '@/lib/utils'
import type { AdminUser } from '@/lib/types'

const PLANS = ['free', 'pro', 'business'] as const

// User identities (email, name, password, roles) live in Clerk. This page only
// edits the local Mongo mirror — `plan` and `isActive`. To create or fully
// remove a user, use the Clerk dashboard at https://dashboard.clerk.com.
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [editPlan, setEditPlan] = useState<typeof PLANS[number]>('free')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filters. Both client-side — admin user lists stay manageable.
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | typeof PLANS[number]>('all')

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (planFilter !== 'all' && u.plan !== planFilter) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, search, planFilter])

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users?limit=100')
      setUsers(data.users)
      setTotal(data.total)
    } catch (err: any) {
      toastError(err.response?.data?.message ?? 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const openEdit = (u: AdminUser) => {
    setEditTarget(u)
    setEditPlan(u.plan)
  }

  const closeModal = () => setEditTarget(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    try {
      await api.patch(`/admin/users/${editTarget._id}`, { plan: editPlan })
      closeModal()
      toastSuccess(`Plan updated for ${editTarget.name}.`)
      fetchUsers()
    } catch (err: any) {
      toastError(err.response?.data?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: AdminUser) => {
    const next = !u.isActive
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: next })
      setUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, isActive: next } : x))
      toastSuccess(`${u.name} ${next ? 'enabled' : 'disabled'}.`)
    } catch (err: any) {
      toastError(err.response?.data?.message ?? 'Failed to update user.')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${deleteTarget._id}`)
      setUsers((prev) => prev.filter((x) => x._id !== deleteTarget._id))
      setTotal((t) => t - 1)
      toastSuccess(`Deleted local record for ${deleteTarget.name}.`)
      setDeleteTarget(null)
    } catch (err: any) {
      toastError(err.response?.data?.message ?? 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Users</h1>
        <p className="text-text-secondary text-sm">
          {total} account{total !== 1 ? 's' : ''} · Manage sign-ups, emails, and passwords in the{' '}
          <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">Clerk dashboard</a>.
        </p>
      </div>

      {/* Filters — hide until there are enough users to bother filtering. */}
      {!loading && users.length > 5 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="input-field pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
            className="input-field sm:w-40"
          >
            <option value="all" className="bg-bg-base">All plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p} className="bg-bg-base capitalize">{p}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs">
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Cards</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <motion.tr
                  key={u._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-border last:border-0 hover:bg-bg-surface/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-text-secondary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name}</p>
                        <p className="text-xs text-text-secondary truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-bg-surface border border-border capitalize">{u.plan}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{u.cardCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      title={u.isActive ? 'Disable account' : 'Enable account'}
                    >
                      {u.isActive
                        ? <ToggleRight className="w-5 h-5 text-status-ready" />
                        : <ToggleLeft className="w-5 h-5 text-text-disabled" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
                        title="Change plan"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="p-1.5 rounded text-text-secondary hover:text-status-error hover:bg-status-error/10 transition-colors"
                        title="Delete local record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 ? (
            <p className="text-center text-text-secondary py-12 text-sm">No users have signed up yet.</p>
          ) : filteredUsers.length === 0 && (
            <p className="text-center text-text-secondary py-12 text-sm">
              No users match {search ? `"${search}"` : ''}
              {search && planFilter !== 'all' ? ' with ' : ''}
              {planFilter !== 'all' ? `plan "${planFilter}"` : ''}.
            </p>
          )}
        </div>
      )}

      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="panel p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-lg">Change plan — {editTarget.name}</h2>
                <button onClick={closeModal} className="text-text-secondary hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Plan</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as typeof PLANS[number])}
                    className="input-field"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p} className="bg-bg-base capitalize">{p}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="btn-ghost flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {saving && <Spinner size="sm" />}
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? `Delete local record for ${deleteTarget.name}?` : ''}
        description="Their cards will be reassigned to the admin account. To remove the Clerk account too, do it in the Clerk dashboard."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardLayout>
  )
}
