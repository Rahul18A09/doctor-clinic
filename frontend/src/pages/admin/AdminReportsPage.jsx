import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuChartColumn,
  LuChartPie,
  LuClipboardList,
  LuUser,
} from 'react-icons/lu'
import { bedService } from '@/api/beds'
import { reportsService } from '@/api/reports'
import { DonutChart, GroupedBarChart, LineChart, ReceptionistBars } from '@/components/reports/ReportCharts'
import { ReportKpiRow, ReportSimpleKpiRow } from '@/components/reports/ReportKpis'
import {
  BedAvailabilityCard,
  QueuePerformanceCard,
  ReceptionistTable,
  ReportVisitsTable,
} from '@/components/reports/ReportTables'
import { Button, DatePicker, Select } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { ROUTES } from '@/utils/constants'
import { getApiErrorMessage } from '@/utils/errors'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'patients', label: 'Patients & Visits' },
  { id: 'consultations', label: 'Consultations' },
  { id: 'queue', label: 'Queue' },
  { id: 'receptionists', label: 'Receptionists' },
]

const PRESET_OPTIONS = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

function todayISO() {
  return toISODate(new Date())
}

function rangeForPreset(preset) {
  const end = todayISO()
  if (preset === 'last_7_days') return { start: addDays(end, -6), end }
  if (preset === 'last_30_days') return { start: addDays(end, -29), end }
  if (preset === 'last_90_days') return { start: addDays(end, -89), end }
  if (preset === 'this_month') {
    const now = new Date()
    return { start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), end }
  }
  return null
}

function downloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

async function blobErrorMessage(error, fallback) {
  const data = error.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text())
      return parsed.message || fallback
    } catch {
      return fallback
    }
  }
  return getApiErrorMessage(error, fallback)
}

function filenameFromHeader(header, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(header || '')
  return match?.[1] || fallback
}

function Card({ title, subtitle, action, icon, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`flex min-w-0 flex-col rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-3 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  )
}

function VisitsTrendRangeSelect({ value, onChange }) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label="Date range preset"
        value={value}
        onChange={onChange}
        className="appearance-none rounded-lg border border-border bg-card py-1.5 pl-3 pr-8 text-sm text-slate-600 shadow-none transition-colors hover:border-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      >
        {PRESET_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  )
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  )
}

const emptyReport = {
  range: { day_count: 30 },
  kpis: {},
  visits_trend: [],
  consultation_status: {},
  visits: { results: [], pagination: { total_pages: 1, total: 0, has_next: false, has_previous: false } },
  queue: {},
  receptionists: [],
  daily_comparison: [],
}

export function AdminReportsPage() {
  const { showError, showSuccess } = useToast()
  const { inboxRevision } = useNotifications()
  const initialRange = rangeForPreset('last_30_days')
  const [preset, setPreset] = useState('last_30_days')
  const [startDate, setStartDate] = useState(initialRange.start)
  const [endDate, setEndDate] = useState(initialRange.end)
  const [applied, setApplied] = useState(initialRange)
  const [tab, setTab] = useState('overview')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(emptyReport)
  const [bedSummary, setBedSummary] = useState({ total: 0, occupied: 0, available: 0 })
  const [bedsLoading, setBedsLoading] = useState(true)
  const seenInboxRevisionRef = useRef(inboxRevision)

  const table = tab === 'consultations' ? 'consultations' : 'visits'

  const queryParams = useMemo(
    () => ({
      start_date: applied.start,
      end_date: applied.end,
      page,
      page_size: 8,
      table,
    }),
    [applied.end, applied.start, page, table],
  )

  const loadReport = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      setError('')
      try {
        const { data: res } = await reportsService.get(queryParams)
        setReport(res.data)
      } catch (err) {
        const message = getApiErrorMessage(err, 'Failed to load reports.')
        setError(message)
        if (!silent) showError(message)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [queryParams, showError],
  )

  const loadBedSummary = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBedsLoading(true)
    try {
      const { data: res } = await bedService.summary()
      const summary = res?.data?.summary || {}
      setBedSummary({
        total: Number(summary.total) || 0,
        occupied: Number(summary.occupied) || 0,
        available: Number(summary.available) || 0,
      })
    } catch {
      // Keep existing bed counts on refresh failure.
    } finally {
      if (!silent) setBedsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  useEffect(() => {
    void loadBedSummary()
  }, [loadBedSummary])

  useEffect(() => {
    if (seenInboxRevisionRef.current === inboxRevision) return
    seenInboxRevisionRef.current = inboxRevision
    void loadBedSummary({ silent: true })
  }, [inboxRevision, loadBedSummary])

  const handlePreset = (event) => {
    const next = event.target.value || 'last_30_days'
    setPreset(next)
    const range = rangeForPreset(next)
    if (range) {
      setStartDate(range.start)
      setEndDate(range.end)
    }
  }

  const handleChartPreset = (event) => {
    const next = event.target.value || 'last_30_days'
    setPreset(next)
    const range = rangeForPreset(next)
    if (!range) return
    setStartDate(range.start)
    setEndDate(range.end)
    setPage(1)
    setApplied(range)
  }

  const handleStartDate = (value) => {
    setStartDate(value)
    setPreset('custom')
  }

  const handleEndDate = (value) => {
    setEndDate(value)
    setPreset('custom')
  }

  const handleApply = () => {
    if (!startDate || !endDate) {
      showError('Select both a start date and an end date.')
      return
    }
    if (startDate > endDate) {
      showError('Start date must be on or before the end date.')
      return
    }
    if (applied.start === startDate && applied.end === endDate && page === 1) {
      loadReport()
      return
    }
    setPage(1)
    setApplied({ start: startDate, end: endDate })
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const response = await reportsService.exportCsv({
        start_date: applied.start,
        end_date: applied.end,
        table,
      })
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameFromHeader(
        response.headers['content-disposition'],
        `clinic-reports-${applied.start}-to-${applied.end}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showSuccess('Report CSV exported.')
    } catch (err) {
      showError(await blobErrorMessage(err, 'Failed to export CSV.'))
    } finally {
      setExporting(false)
    }
  }

  const handleTab = (nextTab) => {
    setTab(nextTab)
    setPage(1)
  }

  const status = report.consultation_status || {}
  const donutSegments = [
    { key: 'completed', label: 'Completed', value: status.completed || 0 },
    { key: 'waiting', label: 'Waiting', value: (status.waiting || 0) + (status.in_consultation || 0) },
    { key: 'cancelled', label: 'Cancelled', value: status.cancelled || 0 },
  ]
  const detailedSegments = [
    { key: 'completed', label: 'Completed', value: status.completed || 0 },
    { key: 'in_consultation', label: 'In Progress', value: status.in_consultation || 0 },
    { key: 'waiting', label: 'Waiting', value: status.waiting || 0 },
    { key: 'cancelled', label: 'Cancelled', value: status.cancelled || 0 },
  ]
  const visits = report.visits?.results || []
  const pagination = report.visits?.pagination
  const emptyPeriod = !loading && (report.kpis?.total_visits?.value || 0) === 0

  if (error && !report.kpis?.total_visits) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-card p-6 text-center shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Unable to load reports</h2>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <Button className="mt-5" onClick={() => loadReport()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground">Reports</h2>
          <p className="mt-1 text-sm text-muted">Analyze clinic activity and performance.</p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:flex-1 xl:justify-end">
          <div className="w-full min-w-0 sm:w-[10.5rem] sm:flex-none">
            <Select
              aria-label="Date range preset"
              options={PRESET_OPTIONS}
              value={preset}
              placeholder="Select range"
              onChange={handlePreset}
            />
          </div>
          <DatePicker
            compact
            value={startDate}
            onChange={handleStartDate}
            placeholder="From"
            aria-label="Start date"
            className="w-full min-w-0 sm:w-[9.75rem] sm:flex-none"
          />
          <DatePicker
            compact
            value={endDate}
            onChange={handleEndDate}
            placeholder="To"
            aria-label="End date"
            className="w-full min-w-0 sm:w-[9.75rem] sm:flex-none"
          />
          <Button onClick={handleApply} className="w-full whitespace-nowrap sm:w-auto">
            Apply
          </Button>
          <Button
            variant="secondary"
            className="w-full whitespace-nowrap border-primary-600 text-primary-600 hover:bg-primary-50 sm:w-auto"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            ) : (
              downloadIcon()
            )}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      <div className="hide-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-border sm:min-w-0">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTab(item.id)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                tab === item.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !report.visits_trend?.length ? (
        <ReportsSkeleton />
      ) : (
        <>
          {emptyPeriod && tab === 'overview' && (
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
              No clinic activity in this date range. Try a different period.
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-4">
              <ReportKpiRow
                kpis={report.kpis}
                dayCount={report.range?.day_count}
                loading={loading && !report.kpis?.total_visits}
              />
              <BedAvailabilityCard
                total={bedSummary.total}
                occupied={bedSummary.occupied}
                available={bedSummary.available}
                loading={bedsLoading}
                bedsPath={ROUTES.ADMIN_BEDS}
              />
              <div className="grid items-stretch gap-4 lg:grid-cols-3">
                <div className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                        <LuChartColumn className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground">Patient Visits Trend</h3>
                        <p className="mt-0.5 text-sm text-muted">Daily patient visits over time</p>
                      </div>
                    </div>
                    <VisitsTrendRangeSelect value={preset} onChange={handleChartPreset} />
                  </div>
                  <div className="mt-3 min-w-0 flex-1 leading-none">
                    <LineChart data={report.visits_trend} />
                  </div>
                </div>
                <Card
                  title="Consultation Status"
                  subtitle="Distribution of consultation status"
                  icon={<LuChartPie className="h-5 w-5" aria-hidden="true" />}
                  className="h-full"
                  bodyClassName="flex flex-1 flex-col justify-center"
                >
                  <DonutChart segments={donutSegments} total={status.total || 0} />
                </Card>
              </div>
              <div className="grid items-stretch gap-4 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-4 sm:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                        <LuClipboardList className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground">Recent Patient Visits</h3>
                        <p className="mt-0.5 text-sm text-muted">Latest patient visit records</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTab('patients')}
                      className="rounded-lg border border-primary-200 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                    >
                      View All
                    </button>
                  </div>
                  <ReportVisitsTable
                    compact
                    framed={false}
                    visits={visits}
                    pagination={pagination}
                    page={page}
                    loading={loading}
                    emptyLabel="No visits in this period."
                    onPageChange={setPage}
                  />
                </div>
                <QueuePerformanceCard fill queue={report.queue} onViewQueue={() => handleTab('queue')} />
              </div>
              <div className="grid items-stretch gap-4 lg:grid-cols-2">
                <Card
                  title="Top Receptionists"
                  subtitle="Patient registration and visit creation"
                  icon={<LuUser className="h-5 w-5" aria-hidden="true" />}
                  className="h-full"
                >
                  <ReceptionistBars rows={(report.receptionists || []).slice(0, 6)} />
                </Card>
                <Card
                  title="Daily Visit Comparison"
                  subtitle="Compare daily visits with previous period"
                  icon={<LuChartColumn className="h-5 w-5" aria-hidden="true" />}
                  action={<VisitsTrendRangeSelect value={preset} onChange={handleChartPreset} />}
                  className="h-full"
                >
                  <GroupedBarChart data={report.daily_comparison} />
                </Card>
              </div>
            </div>
          )}

          {tab === 'patients' && (
            <div className="space-y-4">
              <ReportKpiRow
                kpis={report.kpis}
                dayCount={report.range?.day_count}
                loading={loading && !report.kpis?.total_visits}
              />
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-4 sm:px-5">
                  <h3 className="text-base font-semibold text-foreground">Patients & Visits</h3>
                  <p className="mt-0.5 text-sm text-muted">Every visit registered in the selected period.</p>
                </div>
                <ReportVisitsTable
                  compact
                  framed={false}
                  visits={visits}
                  pagination={pagination}
                  page={page}
                  loading={loading}
                  emptyLabel="No patient visits in this period."
                  onPageChange={setPage}
                  extraColumns
                />
              </div>
            </div>
          )}

          {tab === 'consultations' && (
            <div className="space-y-4">
              <ReportSimpleKpiRow
                loading={loading && !status.total}
                items={[
                  { label: 'Completed', value: status.completed, valueClassName: 'text-emerald-600' },
                  { label: 'In Progress', value: status.in_consultation, valueClassName: 'text-primary-600' },
                  { label: 'Waiting', value: status.waiting, valueClassName: 'text-amber-600' },
                  { label: 'Cancelled', value: status.cancelled, valueClassName: 'text-red-600' },
                ]}
              />
              <div className="grid items-stretch gap-4 lg:grid-cols-3">
                <Card
                  title="Consultation Mix"
                  subtitle="Distribution by status"
                  icon={<LuChartPie className="h-5 w-5" aria-hidden="true" />}
                  className="h-full"
                  bodyClassName="flex flex-1 flex-col justify-center"
                >
                  <DonutChart layout="stack" segments={detailedSegments} total={status.total || 0} />
                </Card>
                <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-span-2">
                  <div className="border-b border-border px-4 py-4 sm:px-5">
                    <h3 className="text-base font-semibold text-foreground">Consultations</h3>
                    <p className="mt-0.5 text-sm text-muted">Completed and in-progress visits.</p>
                  </div>
                  <ReportVisitsTable
                    compact
                    framed={false}
                    visits={visits}
                    pagination={pagination}
                    page={page}
                    loading={loading}
                    emptyLabel="No consultations in this period."
                    onPageChange={setPage}
                    extraColumns
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'queue' && (
            <div className="space-y-4">
              <ReportSimpleKpiRow
                loading={loading && report.queue?.total_tokens == null}
                items={[
                  { label: 'Total Tokens', value: report.queue?.total_tokens },
                  { label: 'Completed Tokens', value: report.queue?.completed_tokens },
                  { label: 'Cancelled Tokens', value: report.queue?.cancelled_tokens },
                  {
                    label: 'Average Wait',
                    value:
                      report.queue?.average_waiting_minutes == null
                        ? '—'
                        : `${report.queue.average_waiting_minutes} mins`,
                  },
                ]}
              />
              <div className="grid items-stretch gap-4 lg:grid-cols-3">
                <QueuePerformanceCard fill className="lg:col-span-2" queue={report.queue} />
                <Card
                  title="Token Status"
                  subtitle="Queue token distribution"
                  icon={<LuChartPie className="h-5 w-5" aria-hidden="true" />}
                  className="h-full"
                  bodyClassName="flex flex-1 flex-col justify-center"
                >
                  <DonutChart
                    layout="balanced"
                    segments={[
                      { key: 'completed', label: 'Completed', value: report.queue?.completed_tokens || 0 },
                      { key: 'cancelled', label: 'Cancelled', value: report.queue?.cancelled_tokens || 0 },
                      { key: 'waiting', label: 'Waiting', value: report.queue?.waiting_tokens || 0 },
                      {
                        key: 'in_consultation',
                        label: 'In Progress',
                        value: report.queue?.in_consultation_tokens || 0,
                      },
                    ]}
                    total={report.queue?.total_tokens || 0}
                    centerLabel="Tokens"
                  />
                </Card>
              </div>
              <Card
                title="Daily Visit Comparison"
                subtitle="Queue volume this period versus the previous period."
                icon={<LuChartColumn className="h-5 w-5" aria-hidden="true" />}
              >
                <GroupedBarChart data={report.daily_comparison} />
              </Card>
            </div>
          )}

          {tab === 'receptionists' && (
            <div className="grid items-stretch gap-4 lg:grid-cols-2">
              <Card
                title="Top Receptionists"
                subtitle="Patients registered vs visits created."
                icon={<LuUser className="h-5 w-5" aria-hidden="true" />}
                className="h-full"
              >
                <ReceptionistBars rows={report.receptionists || []} />
              </Card>
              <Card
                title="Receptionist Activity"
                subtitle="Detailed receptionist totals"
                icon={<LuClipboardList className="h-5 w-5" aria-hidden="true" />}
                className="h-full"
              >
                <ReceptionistTable rows={report.receptionists || []} />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
