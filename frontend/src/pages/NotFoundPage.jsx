import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ROUTES } from '@/utils/constants'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-32 text-center sm:px-6 lg:px-8">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-4 text-lg text-gray-600">Page not found.</p>
      <Link to={ROUTES.HOME} className="mt-8 inline-block">
        <Button>Go Home</Button>
      </Link>
    </div>
  )
}
