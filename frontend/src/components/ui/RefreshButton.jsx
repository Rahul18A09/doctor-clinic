import { useRef } from 'react'
import { Button } from '@/components/ui/Button'

/** Map the live search box to the query we should fetch on Refresh. */
export function getAppliedSearchFromInput(searchInput, appliedSearch, page) {
  const nextSearch = String(searchInput ?? '').trim()
  const searchChanged = nextSearch !== String(appliedSearch ?? '')
  return {
    nextSearch,
    searchChanged,
    nextPage: searchChanged ? 1 : page,
  }
}

export function RefreshButton({ onClick, loading = false, label = 'Refresh', className = '' }) {
  const inFlight = useRef(false)

  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      disabled={loading}
      onClick={async (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (loading || inFlight.current) return
        inFlight.current = true
        try {
          await onClick?.(event)
        } finally {
          inFlight.current = false
        }
      }}
    >
      <svg
        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {loading ? 'Refreshing...' : label}
    </Button>
  )
}
