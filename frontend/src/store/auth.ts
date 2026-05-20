import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  setUser: (user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      setUser: (user) => set({ user, isAuthenticated: true, isAdmin: user.role === 'admin' }),
      clearAuth: () => set({ user: null, isAuthenticated: false, isAdmin: false }),
    }),
    { name: 'champlens-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated, isAdmin: s.isAdmin }) }
  )
)
