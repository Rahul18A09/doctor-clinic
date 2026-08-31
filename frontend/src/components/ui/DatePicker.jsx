import { useEffect, useMemo, useRef, useState } from 'react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function pad(value) {
  return String(value).padStart(2, '0')
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseISODate(value) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatDisplay(value) {
  const date = parseISODate(value)
  if (!date) return ''
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function buildCells(year, month) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const cells = []

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevDays - i
    const date = new Date(year, month - 1, day)
    cells.push({ date, day, outside: true, iso: toISODate(date) })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    cells.push({ date, day, outside: false, iso: toISODate(date) })
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const day = cells.length - (startPad + daysInMonth) + 1
    const date = new Date(year, month + 1, day)
    cells.push({ date, day, outside: true, iso: toISODate(date) })
  }

  return cells
}

export function DatePicker({
  value = '',
  onChange,
  className = '',
  placeholder = 'Select date',
  compact = false,
  'aria-label': ariaLabel,
}) {
  const rootRef = useRef(null)
  const selected = parseISODate(value)
  const today = useMemo(() => toISODate(new Date()), [])
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const base = selected || new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })

  useEffect(() => {
    const next = parseISODate(value)
    if (!next) return
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }, [value])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const cells = buildCells(view.year, view.month)

  const shiftMonth = (delta) => {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const pick = (iso) => {
    onChange?.(iso)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel || 'Filter by date'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-primary-200 bg-card px-3 py-2.5 text-left text-sm shadow-sm transition-all hover:border-primary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25 ${
          compact ? '' : 'sm:min-w-[11.5rem]'
        } ${open ? 'border-primary-500 ring-2 ring-primary-500/25' : ''}`}
      >
        <span className={value ? 'text-foreground' : 'text-muted'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg className="h-4 w-4 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-[min(18.5rem,calc(100vw-2rem))] rounded-xl border border-primary-100 bg-card p-3 shadow-lg sm:left-auto sm:right-0">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{monthLabel(view.year, view.month)}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg p-1 text-primary-600 hover:bg-primary-50"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                className="rounded-lg p-1 text-primary-600 hover:bg-primary-50"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isSelected = cell.iso === value
              const isToday = cell.iso === today
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pick(cell.iso)}
                  className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white'
                      : isToday
                        ? 'text-primary-700 ring-1 ring-primary-300'
                        : cell.outside
                          ? 'text-slate-300 hover:bg-primary-50'
                          : 'text-foreground hover:bg-primary-50 hover:text-primary-700'
                  }`}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-primary-50 pt-2">
            <button
              type="button"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
              onClick={() => {
                onChange?.('')
                setOpen(false)
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
              onClick={() => pick(today)}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
