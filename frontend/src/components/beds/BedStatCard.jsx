const TONE = {
  blue: {
    icon: 'bg-blue-50 text-blue-600',
    active: 'border-blue-300 ring-2 ring-blue-100',
  },
  purple: {
    icon: 'bg-purple-50 text-purple-600',
    active: 'border-purple-300 ring-2 ring-purple-100',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-600',
    active: 'border-emerald-300 ring-2 ring-emerald-100',
  },
  sky: {
    icon: 'bg-sky-50 text-sky-600',
    active: 'border-sky-300 ring-2 ring-sky-100',
  },
  orange: {
    icon: 'bg-amber-50 text-amber-600',
    active: 'border-amber-300 ring-2 ring-amber-100',
  },
  red: {
    icon: 'bg-red-50 text-red-600',
    active: 'border-red-300 ring-2 ring-red-100',
  },
}

export function BedStatCard({
  title,
  value,
  hint,
  icon,
  tone = 'blue',
  active = false,
  onClick,
}) {
  const colors = TONE[tone] || TONE.blue

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full min-h-[5.5rem] w-full min-w-0 items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:p-4 ${
        active ? colors.active : 'border-border'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${colors.icon}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-muted sm:text-sm">{title}</span>
        <span className="mt-0.5 block text-2xl font-bold leading-none text-foreground sm:text-3xl">
          {value}
        </span>
        {hint ? (
          <span className="mt-1 block truncate text-[11px] text-muted sm:text-xs">{hint}</span>
        ) : null}
      </span>
    </button>
  )
}
