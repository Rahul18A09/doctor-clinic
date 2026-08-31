import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { label, id, error, className = '', ...props },
  ref,
) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error.message}</p>}
    </div>
  )
})
