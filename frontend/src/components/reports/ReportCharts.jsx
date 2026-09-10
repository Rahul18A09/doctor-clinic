function formatChartDate(iso) {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function niceMax(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

export function LineChart({ data = [], emptyLabel = 'No visit data for this period.' }) {
  const width = 720
  const height = 240
  const pad = { top: 8, right: 12, bottom: 28, left: 30 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const points = Array.isArray(data) ? data : []
  const maxValue = niceMax(Math.max(0, ...points.map((row) => Number(row.visits) || 0)))
  const coords = points.map((row, index) => {
    const x = pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW)
    const y = pad.top + innerH - ((Number(row.visits) || 0) / maxValue) * innerH
    return { x, y, ...row }
  })
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const area = coords.length
    ? `${pad.left},${pad.top + innerH} ${polyline} ${coords[coords.length - 1].x},${pad.top + innerH}`
    : ''
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  const yTicks = [0, 0.5, 1]
  const gradientId = 'visits-trend-fill'

  if (!points.length || points.every((row) => !row.visits)) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted sm:min-h-[13rem] lg:min-h-[14rem]">
        {emptyLabel}
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label="Patient visits trend"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yTicks.map((tick) => {
        const y = pad.top + innerH - tick * innerH
        return (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="fill-slate-400" fontSize="11">
              {Math.round(maxValue * tick)}
            </text>
          </g>
        )
      })}
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((point, index) => (
        <circle
          key={point.date || index}
          cx={point.x}
          cy={point.y}
          r="3.5"
          fill="#2563EB"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      ))}
      {coords.map((point, index) =>
        index % labelEvery === 0 || index === coords.length - 1 ? (
          <text
            key={`label-${point.date || index}`}
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize="11"
          >
            {formatChartDate(point.date)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

const DONUT_COLORS = {
  completed: '#22c55e',
  cancelled: '#ef4444',
  waiting: '#f59e0b',
  in_consultation: '#3b82f6',
}

export function DonutChart({ segments = [], total = 0, centerLabel = 'Total', layout = 'row' }) {
  const size = 200
  const radius = 62
  const stroke = 20
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius
  const safeTotal = total || segments.reduce((sum, item) => sum + (item.value || 0), 0)
  let offset = 0
  const stacked = layout === 'stack'
  const balanced = layout === 'balanced'

  if (!safeTotal) {
    return (
      <div
        className={
          stacked || balanced
            ? 'flex h-40 items-center justify-center text-sm text-muted'
            : 'flex h-44 items-center justify-center text-sm text-muted sm:h-48'
        }
      >
        No consultation data for this period.
      </div>
    )
  }

  return (
    <div
      className={
        stacked
          ? 'flex w-full flex-col items-center gap-4'
          : balanced
            ? 'flex w-full min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8'
            : 'flex h-44 w-full min-w-0 items-center justify-center gap-4 sm:h-48 sm:gap-5'
      }
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={
          stacked || balanced
            ? 'h-36 w-36 shrink-0 sm:h-40 sm:w-40'
            : 'h-28 w-28 shrink-0 sm:h-32 sm:w-32'
        }
        role="img"
        aria-label="Consultation status"
      >
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {segments.map((segment) => {
          if (!segment.value) return null
          const length = (segment.value / safeTotal) * circumference
          const circle = (
            <circle
              key={segment.key}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={DONUT_COLORS[segment.key] || '#64748b'}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )
          offset += length
          return circle
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-900" fontSize="22" fontWeight="700">
          {safeTotal}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-400" fontSize="12">
          {centerLabel}
        </text>
      </svg>
      <ul
        className={
          stacked
            ? 'w-full space-y-2.5'
            : balanced
              ? 'w-full max-w-[16rem] space-y-2.5 sm:w-[16rem] sm:shrink-0'
              : 'min-w-0 max-w-[11rem] flex-1 space-y-2.5 sm:max-w-none'
        }
      >
        {segments.map((segment) => {
          const percent = safeTotal ? ((segment.value / safeTotal) * 100).toFixed(1) : '0.0'
          return (
            <li key={segment.key} className="flex items-center justify-between gap-3 text-sm leading-5">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: DONUT_COLORS[segment.key] || '#64748b' }}
                />
                <span className="truncate text-foreground">{segment.label}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-foreground">
                {segment.value} <span className="font-normal text-muted">({percent}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function GroupedBarChart({ data = [], emptyLabel = 'No comparison data for this period.' }) {
  const width = 640
  const height = 220
  const pad = { top: 12, right: 8, bottom: 36, left: 32 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const rows = Array.isArray(data) ? data : []
  const maxValue = niceMax(
    Math.max(0, ...rows.flatMap((row) => [Number(row.this_period) || 0, Number(row.previous_period) || 0])),
  )
  const groupWidth = rows.length ? innerW / rows.length : innerW
  const barWidth = Math.max(6, Math.min(18, groupWidth * 0.28))

  if (!rows.length) {
    return <div className="flex h-52 items-center justify-center text-sm text-muted lg:h-56">{emptyLabel}</div>
  }

  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full lg:h-56" role="img" aria-label="Daily visit comparison">
        {[0, 0.5, 1].map((tick) => {
          const y = pad.top + innerH - tick * innerH
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
                {Math.round(maxValue * tick)}
              </text>
            </g>
          )
        })}
        {rows.map((row, index) => {
          const groupX = pad.left + index * groupWidth + groupWidth / 2
          const thisH = ((Number(row.this_period) || 0) / maxValue) * innerH
          const prevH = ((Number(row.previous_period) || 0) / maxValue) * innerH
          return (
            <g key={row.date || index}>
              <rect
                x={groupX - barWidth - 2}
                y={pad.top + innerH - prevH}
                width={barWidth}
                height={Math.max(prevH, 0)}
                rx="3"
                fill="#93c5fd"
              />
              <rect
                x={groupX + 2}
                y={pad.top + innerH - thisH}
                width={barWidth}
                height={Math.max(thisH, 0)}
                rx="3"
                fill="#2563EB"
              />
              <text x={groupX} y={height - 10} textAnchor="middle" className="fill-slate-400" fontSize="10">
                {formatChartDate(row.date)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary-600" /> This Period
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-300" /> Previous Period
        </span>
      </div>
    </div>
  )
}

export function ReceptionistBars({ rows = [] }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted">No receptionist activity in this period.</p>
  }

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.patients_registered || 0, row.visits_created || 0]),
  )

  return (
    <ul className="space-y-5">
      {rows.map((row) => (
        <li key={row.id || row.full_name} className="min-w-0">
          <p className="mb-2.5 truncate text-sm font-semibold text-foreground">{row.full_name || 'Unknown'}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${Math.round(((row.patients_registered || 0) / maxValue) * 100)}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                {row.patients_registered || 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-300"
                  style={{ width: `${Math.round(((row.visits_created || 0) / maxValue) * 100)}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                {row.visits_created || 0}
              </span>
            </div>
          </div>
        </li>
      ))}
      <li className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary-600" /> Patients Registered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-300" /> Visits Created
        </span>
      </li>
    </ul>
  )
}
