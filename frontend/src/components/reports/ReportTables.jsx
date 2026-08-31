import { Link } from 'react-router-dom'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { Button } from '@/components/ui'
import { ROUTES } from '@/utils/constants'
import { formatTokenForUi } from '@/utils/formatToken'

function formatReportDate(iso) {
  if (!iso) return '—'
  const value = iso.endsWith('Z') ? iso : `${iso}Z`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function cellPad(compact) {
  return compact ? 'px-3 py-2.5' : 'px-3 py-2.5 sm:px-4'
}

export function ReportPagination({ pagination, page, loading, onPageChange }) {
  if (!pagination || pagination.total === 0) return null

  const pageSize = pagination.page_size || 8
  const total = pagination.total || 0
  const totalPages = pagination.total_pages || 1
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages = []
  const windowSize = 5
  let start = Math.max(1, page - 2)
  let end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)
  for (let number = start; number <= end; number += 1) pages.push(number)

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-3 sm:px-4">
      <p className="text-sm text-muted">
        Showing {from} to {to} of {total} entries
      </p>
      {totalPages > 1 && (
        <div className="hide-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto">
          <Button
            variant="secondary"
            size="sm"
            disabled={!pagination.has_previous || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          {start > 1 && (
            <>
              <PageButton number={1} current={page} disabled={loading} onClick={onPageChange} />
              {start > 2 && <span className="px-1 text-sm text-muted">…</span>}
            </>
          )}
          {pages.map((number) => (
            <PageButton
              key={number}
              number={number}
              current={page}
              disabled={loading}
              onClick={onPageChange}
            />
          ))}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className="px-1 text-sm text-muted">…</span>}
              <PageButton number={totalPages} current={page} disabled={loading} onClick={onPageChange} />
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={!pagination.has_next || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function PageButton({ number, current, disabled, onClick }) {
  const active = number === current
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(number)}
      className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
        active
          ? 'bg-primary-600 text-white'
          : 'border border-border bg-card text-foreground hover:bg-primary-50 hover:text-primary-700'
      }`}
    >
      {number}
    </button>
  )
}

export function ReportVisitsTable({
  visits,
  pagination,
  page,
  loading,
  emptyLabel,
  onPageChange,
  extraColumns = false,
  compact = false,
  framed = true,
}) {
  const pad = cellPad(compact)
  const showStatus = !visits || visits.length === 0

  return (
    <div
      className={
        framed ? 'overflow-hidden rounded-2xl border border-border bg-card shadow-sm' : 'min-w-0'
      }
    >
      {showStatus ? (
        <div className="px-4 py-10 text-center">
          {loading && (!visits || visits.length === 0) ? (
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          ) : (
            <p className="text-sm text-muted">{emptyLabel}</p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3 p-3 lg:hidden">
            {visits.map((visit) => (
              <div key={visit.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={ROUTES.ADMIN_PATIENT_DETAIL.replace(':id', visit.id)}
                      className="block truncate font-medium text-primary-600 hover:underline"
                      title={visit.patient_name}
                    >
                      {visit.patient_name}
                    </Link>
                    <p className="mt-0.5 font-mono text-sm text-foreground">
                      {formatTokenForUi(visit.token_number) || '—'} · Visit #{visit.visit_number || 1}
                    </p>
                  </div>
                  <PatientStatusBadge status={visit.status} />
                </div>
                <p className="mt-2 text-sm text-muted">{formatReportDate(visit.created_at)}</p>
                {extraColumns && (visit.chief_complaint || visit.diagnosis) ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">
                    {visit.chief_complaint || visit.diagnosis}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="table-scroll hidden lg:block">
            <table className={`w-full text-left text-sm ${extraColumns ? 'min-w-[56rem]' : 'min-w-[40rem]'}`}>
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className={`whitespace-nowrap font-medium text-muted ${pad}`}>Date</th>
              <th className={`whitespace-nowrap font-medium text-muted ${pad}`}>Patient</th>
              <th className={`whitespace-nowrap font-medium text-muted ${pad}`}>Token</th>
              <th className={`whitespace-nowrap font-medium text-muted ${pad}`}>Visit</th>
              {extraColumns && (
                <>
                  <th className={`hidden whitespace-nowrap font-medium text-muted xl:table-cell ${pad}`}>
                    Complaint
                  </th>
                  <th className={`hidden whitespace-nowrap font-medium text-muted xl:table-cell ${pad}`}>
                    Diagnosis
                  </th>
                </>
              )}
              <th className={`whitespace-nowrap font-medium text-muted ${pad}`}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visits.map((visit) => (
              <tr key={visit.id} className="hover:bg-surface/70">
                <td className={`whitespace-nowrap text-foreground ${pad}`}>
                  {formatReportDate(visit.created_at)}
                </td>
                <td className={`max-w-[10rem] font-medium text-foreground sm:max-w-[14rem] ${pad}`}>
                  <Link
                    to={ROUTES.ADMIN_PATIENT_DETAIL.replace(':id', visit.id)}
                    className="block truncate text-primary-600 hover:underline"
                    title={visit.patient_name}
                  >
                    {visit.patient_name}
                  </Link>
                </td>
                <td className={`whitespace-nowrap font-medium text-foreground ${pad}`}>
                  {formatTokenForUi(visit.token_number) || '—'}
                </td>
                <td className={`whitespace-nowrap text-foreground ${pad}`}>#{visit.visit_number || 1}</td>
                {extraColumns && (
                  <>
                    <td className={`hidden max-w-[12rem] text-muted xl:table-cell ${pad}`}>
                      <span className="block truncate" title={visit.chief_complaint || ''}>
                        {visit.chief_complaint || '—'}
                      </span>
                    </td>
                    <td className={`hidden max-w-[12rem] text-muted xl:table-cell ${pad}`}>
                      <span className="block truncate" title={visit.diagnosis || ''}>
                        {visit.diagnosis || '—'}
                      </span>
                    </td>
                  </>
                )}
                <td className={`whitespace-nowrap ${pad}`}>
                  <PatientStatusBadge status={visit.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </>
      )}
      <ReportPagination pagination={pagination} page={page} loading={loading} onPageChange={onPageChange} />
    </div>
  )
}

export function QueuePerformanceCard({ queue, onViewQueue, fill = false }) {
  const rows = [
    { label: 'Total Tokens', value: queue?.total_tokens },
    { label: 'Completed Tokens', value: queue?.completed_tokens },
    { label: 'Cancelled Tokens', value: queue?.cancelled_tokens },
    {
      label: 'Average Waiting Time',
      value: queue?.average_waiting_minutes == null ? '—' : `${queue.average_waiting_minutes} mins`,
    },
  ]

  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 ${
        fill ? 'h-full' : ''
      }`}
    >
      <h3 className="text-base font-semibold text-foreground">Queue Performance</h3>
      <dl className={fill ? 'mt-4 flex flex-1 flex-col justify-between gap-3' : 'mt-4 space-y-3'}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="text-sm font-semibold text-foreground">
              {typeof row.value === 'number' ? row.value.toLocaleString('en-IN') : row.value ?? 0}
            </dd>
          </div>
        ))}
      </dl>
      {onViewQueue && (
        <button
          type="button"
          onClick={onViewQueue}
          className="mt-4 self-start text-sm font-medium text-primary-600 hover:underline"
        >
          View Queue Report →
        </button>
      )}
    </div>
  )
}

export function ReceptionistTable({ rows }) {
  if (!rows?.length) {
    return <p className="py-6 text-center text-sm text-muted">No receptionist activity in this period.</p>
  }

  return (
    <>
      <div className="space-y-3 p-3 lg:hidden">
        {rows.map((row) => (
          <div key={row.id || row.full_name} className="rounded-xl border border-border bg-card p-3">
            <p className="font-medium text-foreground">{row.full_name}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Patients registered</dt>
                <dd className="text-foreground">{row.patients_registered}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Visits created</dt>
                <dd className="text-foreground">{row.visits_created}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <div className="table-scroll hidden lg:block">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className="px-3 py-2.5 font-medium text-muted sm:px-4">Receptionist</th>
              <th className="px-3 py-2.5 font-medium text-muted sm:px-4">Patients Registered</th>
              <th className="px-3 py-2.5 font-medium text-muted sm:px-4">Visits Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id || row.full_name}>
                <td className="max-w-[9rem] px-3 py-2.5 font-medium text-foreground sm:max-w-none sm:px-4">
                  <span className="block truncate" title={row.full_name}>
                    {row.full_name}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-foreground sm:px-4">
                  {row.patients_registered}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-foreground sm:px-4">{row.visits_created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
