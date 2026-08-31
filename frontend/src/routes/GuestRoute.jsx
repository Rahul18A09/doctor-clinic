import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_DASHBOARD, ROUTES } from '@/utils/constants'

export function GuestRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (isAuthenticated && user?.role) {
    return <Navigate to={ROLE_DASHBOARD[user.role]} replace />
  }

  return children
}

export function RootRedirect() {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (isAuthenticated && user?.role) {
    return <Navigate to={ROLE_DASHBOARD[user.role]} replace />
  }

  return <Navigate to={ROUTES.LOGIN} replace />
}
