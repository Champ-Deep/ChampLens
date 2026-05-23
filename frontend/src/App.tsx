import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth, useUser, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
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
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
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
