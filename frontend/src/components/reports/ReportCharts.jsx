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
  const width = 640
  const height = 220
  const pad = { top: 12, right: 8, bottom: 32, left: 32 }
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
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))
  const yTicks = [0, 0.5, 1]

  if (!points.length || points.every((row) => !row.visits)) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted lg:h-56">{emptyLabel}</div>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full lg:h-56" role="img" aria-label="Patient visits trend">
      {yTicks.map((tick) => {
        const y = pad.top + innerH - tick * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
              {Math.round(maxValue * tick)}
            </text>
          </g>
        )
      })}
      <polygon points={area} fill="#2563EB" opacity="0.08" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((point, index) => (
        <circle key={point.date || index} cx={point.x} cy={point.y} r="3.5" fill="#2563EB" />
      ))}
      {coords.map((point, index) =>
        index % labelEvery === 0 || index === coords.length - 1 ? (
          <text
            key={`label-${point.date || index}`}
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize="10"
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
      <div className="flex h-40 items-center justify-center text-sm text-muted">
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
            ? 'flex w-full min-w-0 flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10'
            : 'flex w-full min-w-0 items-center gap-3 sm:gap-4'
      }
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={
          stacked || balanced
            ? 'h-40 w-40 shrink-0 sm:h-44 sm:w-44'
            : 'h-32 w-32 shrink-0 sm:h-36 sm:w-36 lg:h-40 lg:w-40'
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
              : 'min-w-0 flex-1 space-y-2'
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
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
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
                fill="#cbd5e1"
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
          <span className="h-2.5 w-2.5 rounded-sm bg-primary-600" /> This Period
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Previous Period
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
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.id || row.full_name} className="min-w-0">
          <p className="mb-2 truncate text-sm font-medium text-foreground">{row.full_name || 'Unknown'}</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${Math.round(((row.patients_registered || 0) / maxValue) * 100)}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-foreground">
                {row.patients_registered || 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary-200"
                  style={{ width: `${Math.round(((row.visits_created || 0) / maxValue) * 100)}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-muted">
                {row.visits_created || 0}
              </span>
            </div>
          </div>
        </li>
      ))}
      <li className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary-600" /> Patients Registered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary-200" /> Visits Created
        </span>
      </li>
    </ul>
  )
}
