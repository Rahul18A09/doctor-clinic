const ICON_BUTTON_CLASS =
  'rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50'

export function ViewIconButton({ onClick, className = '', disabled = false }) {
  return (
    <button
      type="button"
      aria-label="View"
      disabled={disabled}
      onClick={onClick}
      className={`${ICON_BUTTON_CLASS} ${className}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z"
        />
      </svg>
    </button>
  )
}

export function EditIconButton({ onClick, className = '', disabled = false }) {
  return (
    <button
      type="button"
      aria-label="Edit"
      disabled={disabled}
      onClick={onClick}
      className={`${ICON_BUTTON_CLASS} ${className}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </button>
  )
}

export function DeleteIconButton({ onClick, className = '', disabled = false }) {
  return (
    <button
      type="button"
      aria-label="Delete"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  )
}

