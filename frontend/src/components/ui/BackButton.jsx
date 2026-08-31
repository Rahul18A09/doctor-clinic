import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

export function BackButton({ to, children, className = '' }) {
  return (
    <Link to={to} className={`inline-flex w-fit ${className}`}>
      <Button type="button" variant="primary" className="rounded-lg shadow-none hover:bg-primary-700">
        <ChevronLeftIcon />
        {children}
      </Button>
    </Link>
  )
}
