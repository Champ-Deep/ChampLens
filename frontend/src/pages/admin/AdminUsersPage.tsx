import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ShieldCheck, User, ToggleLeft, ToggleRight, X, AlertCircle } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminUser } from '@/lib/types'

const PLANS = ['free', 'pro', 'business'] as const

interface UserFormData {
  name: string
  email: string
  password: string
  plan: string
}

const emptyForm: UserFormData = { name: '', email: '', password: '', plan: 'free' }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users?limit=100')
      setUsers(data.users)
      setTotal(data.total)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setEditTarget(null)
    setModalMode('create')
  }

  const openEdit = (u: AdminUser) => {
    setForm({ name: u.name, email: u.email, password: '', plan: u.plan })
    setFormError('')
    setEditTarget(u)
    setModalMode('edit')
  }

  const closeModal = () => { setModalMode(null); setEditTarget(null) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (modalMode === 'create') {
        await api.post('/admin/users', form)
      } else if (editTarget) {
        const payload: Record<string, string> = { name: form.name, email: form.email, plan: form.plan }
        if (form.password) payload.password = form.password
        await api.patch(`/admin/users/${editTarget._id}`, payload)
      }
      closeModal()
      fetchUsers()
    } catch (err: any) {
      setFormError(err.response?.data?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: AdminUser) => {
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive })
      setUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, isActive: !u.isActive } : x))
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to update user.')
    }
  }

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Delete "${u.name}"? Their cards will be reassigned to admin.`)) return
    try {
      await api.delete(`/admin/users/${u._id}`)
      setUsers((prev) => prev.filter((x) => x._id !== u._id))
      setTotal((t) => t - 1)
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Delete failed.')
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Users</h1>
          <p className="text-text-secondary text-sm">{total} account{total !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-status-error bg-status-error/10 px-4 py-3 rounded mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
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
              {users.map((u) => (
                <motion.tr
                  key={u._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-border last:border-0 hover:bg-bg-surface/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin'
                        ? <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
                        : <User className="w-4 h-4 text-text-secondary shrink-0" />
                      }
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
                      disabled={u.role === 'admin'}
                      title={u.role === 'admin' ? 'Cannot disable admin' : u.isActive ? 'Disable account' : 'Enable account'}
                      className="disabled:opacity-40 disabled:cursor-not-allowed"
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
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded text-text-secondary hover:text-status-error hover:bg-status-error/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="text-center text-text-secondary py-12 text-sm">No users yet. Create one above.</p>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalMode && (
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
                <h2 className="font-semibold text-lg">{modalMode === 'create' ? 'New User' : 'Edit User'}</h2>
                <button onClick={closeModal} className="text-text-secondary hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Full Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Email *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">
                    Password {modalMode === 'edit' && <span className="text-text-disabled">(leave blank to keep current)</span>}
                  </label>
                  <input
                    required={modalMode === 'create'}
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Plan</label>
                  <select
                    value={form.plan}
                    onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                    className="input-field"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p} className="bg-bg-base capitalize">{p}</option>
                    ))}
                  </select>
                </div>

                {formError && (
                  <p className="text-xs text-status-error bg-status-error/10 px-3 py-2 rounded">{formError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="btn-ghost flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {saving && <Spinner size="sm" />}
                    {modalMode === 'create' ? 'Create' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
