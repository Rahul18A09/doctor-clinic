import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Button } from '@/components/ui'
import { ROUTES } from '@/utils/constants'

export function HomePage() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/health/')
      .then((response) => setHealth(response.data))
      .catch(() => setError('Unable to reach the API. Is the backend running?'))
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Welcome to Doctor
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Full-stack starter with React 19 and Django REST Framework.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to={ROUTES.LOGIN}>
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>

      <div className="mt-12 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">API Status</h2>
        {health && (
          <p className="mt-2 text-sm text-green-600">
            API {health.status} — database {health.database}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {!health && !error && (
          <p className="mt-2 text-sm text-gray-500">Checking connection...</p>
        )}
      </div>
    </div>
  )
}
