import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { Button } from '@/components/ui'

export function Header() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to={ROUTES.HOME} className="text-xl font-bold text-primary-600">
          Doctor
        </Link>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          ) : (
            <Link
              to={ROUTES.LOGIN}
              className="text-sm font-medium text-gray-700 hover:text-primary-600"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
