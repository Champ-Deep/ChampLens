import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth, useUser, Show, RedirectToSignIn } from '@clerk/react'
import { Toaster } from 'react-hot-toast'
import { setTokenGetter } from '@/lib/api'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CreateCardPage from '@/pages/CreateCardPage'
import CardDetailPage from '@/pages/CardDetailPage'
import ARViewerPage from '@/pages/ARViewerPage'
import PreviewPage from '@/pages/PreviewPage'
import RegisterPage from '@/pages/RegisterPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminStatsPage from '@/pages/admin/AdminStatsPage'

// Wire Clerk's getToken into axios so every API call carries a fresh Bearer token.
function ApiAuthBinder() {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(() => getToken())
  }, [getToken])
  return null
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><RedirectToSignIn /></Show>
    </>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser()
  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/login" replace />
  const role = (user.publicMetadata as { role?: string })?.role
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ApiAuthBinder />
      {/* Toast styling matches our dark panel design tokens. Toasts live at the
          top of the app tree so they appear above modals (z-index >= 60). */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: '',
          style: {
            background: '#0F0F10',
            color: '#F5F5F5',
            border: '1px solid #2A2A2C',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '13px',
            maxWidth: '380px',
          },
          success: { iconTheme: { primary: '#22C55E', secondary: '#0F0F10' } },
          error:   { iconTheme: { primary: '#E8003D', secondary: '#0F0F10' } },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* Clerk's SignIn/SignUp need wildcard children for their internal routing. */}
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/register/*" element={<RegisterPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/dashboard/create" element={<PrivateRoute><CreateCardPage /></PrivateRoute>} />
        <Route path="/dashboard/cards/:id" element={<PrivateRoute><CardDetailPage /></PrivateRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/stats" element={<AdminRoute><AdminStatsPage /></AdminRoute>} />
        <Route path="/v/:slug" element={<ARViewerPage />} />
        <Route path="/preview/:slug" element={<PreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
