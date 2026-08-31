import { Button } from '@/components/ui/Button'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function ListStatus({
  loading = false,
  error = '',
  empty = false,
  emptyLabel = 'No records found.',
  onRetry,
  className = '',
}) {
  const online = useOnlineStatus()

  if (loading) {
    return (
      <div className={`px-4 py-16 text-center ${className}`}>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="mt-3 text-sm text-muted">Loading...</p>
      </div>
    )
  }

  if (!online) {
    return (
      <div className={`px-4 py-16 text-center ${className}`}>
        <p className="text-sm font-medium text-foreground">You are offline</p>
        <p className="mt-1 text-sm text-muted">Reconnect to load the latest clinic data.</p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`px-4 py-16 text-center ${className}`}>
        <p className="text-sm font-medium text-foreground">Could not load data.</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <div className={`px-4 py-16 text-center text-sm text-muted ${className}`}>
        {emptyLabel}
      </div>
    )
  }

  return null
}
