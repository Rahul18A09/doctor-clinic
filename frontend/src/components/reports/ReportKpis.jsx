function Icon({ children }) {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  visits: (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
      <Icon>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icon>
    </span>
  ),
  patients: (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
      <Icon>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </Icon>
    </span>
  ),
  consultations: (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
      </Icon>
    </span>
  ),
  cancelled: (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
      <Icon>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </Icon>
    </span>
  ),
}

function Trend({ percent }) {
  if (percent == null || Number.isNaN(Number(percent))) {
    return <span className="text-xs text-muted">No prior period</span>
  }
  const value = Number(percent)
  if (value === 0) {
    return <span className="text-xs font-medium text-muted">No change</span>
  }
  const up = value > 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function ReportKpiCard({ title, metric, icon, periodLabel, loading }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {loading ? '—' : Number(metric?.value || 0).toLocaleString('en-IN')}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {!loading && <Trend percent={metric?.change_percent} />}
            <span className="text-xs text-muted">{periodLabel}</span>
          </div>
        </div>
        {ICONS[icon]}
      </div>
    </div>
  )
}

export function ReportKpiRow({ kpis, dayCount, loading }) {
  const periodLabel = `vs previous ${dayCount || 30} days`
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ReportKpiCard title="Total Visits" metric={kpis?.total_visits} icon="visits" periodLabel={periodLabel} loading={loading} />
      <ReportKpiCard
        title="Unique Patients"
        metric={kpis?.unique_patients}
        icon="patients"
        periodLabel={periodLabel}
        loading={loading}
      />
      <ReportKpiCard
        title="Consultations"
        metric={kpis?.consultations}
        icon="consultations"
        periodLabel={periodLabel}
        loading={loading}
      />
      <ReportKpiCard
        title="Cancelled Visits"
        metric={kpis?.cancelled_visits}
        icon="cancelled"
        periodLabel={periodLabel}
        loading={loading}
      />
    </div>
  )
}
