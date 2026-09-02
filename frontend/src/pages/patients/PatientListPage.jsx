import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { patientService } from '@/api/patients'
import { AdmissionStatusBadge, CareTypeBadge } from '@/components/patients/AdmissionBadges'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { ViewIconButton, EditIconButton, DeleteIconButton } from '@/components/patients/ViewIconButton'
import { Button, ConfirmDialog, DatePicker, getAppliedSearchFromInput, ListStatus, RefreshButton, Select } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { PATIENT_FILTERS, PATIENT_STATUS_FILTER_OPTIONS, ROUTES } from '@/utils/constants'
import { formatTokenForUi } from '@/utils/formatToken'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTodayISO() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function canShowEdit(patient, { canEdit, isAdmin }) {
  if (!canEdit) return false
  if (isAdmin) return patient.is_editable_by_admin !== false
  return patient.is_editable_by_receptionist !== false
}

export function PatientListPage({
  basePath,
  canRegister = false,
  canEdit = false,
  canDelete = false,
  isAdmin = false,
  defaultFilter = '',
  rowOpensDetail = false,
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showSuccess, showError } = useToast()

  const [patients, setPatients] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total_pages: 1,
    total: 0,
    has_next: false,
    has_previous: false,
  })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState(defaultFilter)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(defaultFilter === 'today' ? getTodayISO() : '')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })

  const skipAutoFetchRef = useRef(false)

  const fetchPatients = useCallback(
    async ({ silent = false, search: searchOverride, page: pageOverride } = {}) => {
      if (!silent) setLoading(true)
      const appliedSearch = searchOverride !== undefined ? searchOverride : search
      const appliedPage = pageOverride !== undefined ? pageOverride : page
      try {
        const params = { page: appliedPage, page_size: 10, search: appliedSearch }
        if (filter) params.filter = filter
        if (statusFilter) params.status = statusFilter
        if (dateFilter) params.date = dateFilter

        const { data: res } = await patientService.list(params)
        setPatients(res.data.results)
        setPagination(res.data.pagination)
        setLoadError('')
      } catch (err) {
        const message = err.response?.data?.message || err.message
        if (!silent) {
          setLoadError(message)
          showError(message)
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [page, search, filter, statusFilter, dateFilter, showError]
  )

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false
      return
    }
    fetchPatients()
  }, [fetchPatients])

  useEffect(() => {
    const urlFilter = searchParams.get('filter')
    const nextFilter =
      urlFilter !== null && PATIENT_FILTERS.some((f) => f.value === urlFilter)
        ? urlFilter
        : defaultFilter
    if (!PATIENT_FILTERS.some((f) => f.value === nextFilter)) return

    setPage(1)
    setFilter(nextFilter)
    if (nextFilter === 'today') {
      setDateFilter(getTodayISO())
    } else if (nextFilter === 'waiting' || nextFilter === 'completed' || nextFilter === 'admission_required') {
      setStatusFilter('')
    } else {
      setDateFilter('')
    }
  }, [searchParams, defaultFilter])

  const handleRefresh = async () => {
    if (refreshing) return
    const { nextSearch, searchChanged, nextPage } = getAppliedSearchFromInput(
      searchInput,
      search,
      page,
    )
    if (searchChanged) {
      skipAutoFetchRef.current = true
      setSearch(nextSearch)
      setPage(nextPage)
    }
    setRefreshing(true)
    try {
      await fetchPatients({ silent: true, search: nextSearch, page: nextPage })
    } finally {
      setRefreshing(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleFilterChange = (value) => {
    setPage(1)
    setFilter(value)
    if (value === 'today') {
      setDateFilter(getTodayISO())
    } else if (value === '') {
      setDateFilter('')
    }
    if (value === 'waiting' || value === 'completed' || value === 'admission_required') {
      setStatusFilter('')
    }
  }

  const handleDateFilterChange = (value) => {
    setPage(1)
    setDateFilter(value)
    if (value && filter === 'today') {
      setFilter('')
    }
  }

  const handleDelete = async () => {
    const patientId = deleteDialog.id
    if (!patientId) return

    setActionLoading(patientId)
    try {
      await patientService.delete(patientId)

      setPatients((prev) => prev.filter((p) => p.id !== patientId))
      setPagination((prev) => ({
        ...prev,
        total: Math.max(prev.total - 1, 0),
      }))

      setDeleteDialog({ open: false, id: null, name: '' })
      showSuccess('Patient deleted successfully.')

      await fetchPatients({ silent: true })
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Failed to delete patient.')
      await fetchPatients({ silent: true })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelDelete = () => {
    if (actionLoading) return
    setDeleteDialog({ open: false, id: null, name: '' })
  }

  const addPath = canRegister ? `${basePath}/new` : null
  const detailPath = (id) => `${basePath}/${id}`
  const editPath = (id) => `${basePath}/${id}/edit`
  const showListStatus = patients.length === 0

  const renderPatientActions = (p) => (
    <div className="flex items-center gap-1">
      <ViewIconButton
        onClick={(event) => {
          event.stopPropagation()
          navigate(detailPath(p.id))
        }}
      />
      {canShowEdit(p, { canEdit, isAdmin }) && (
        <EditIconButton
          onClick={(event) => {
            event.stopPropagation()
            navigate(editPath(p.id))
          }}
        />
      )}
      {canDelete && (
        <DeleteIconButton
          disabled={actionLoading === p.id}
          onClick={(event) => {
            event.stopPropagation()
            setDeleteDialog({
              open: true,
              id: p.id,
              name: p.patient_name,
            })
          }}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Patients</h2>
          <p className="mt-1 text-sm text-muted">
            {canRegister
              ? `Manage patient registrations (${pagination.total} total)`
              : `View all registered patients (${pagination.total} total)`}
          </p>
        </div>
        {addPath && (
          <Link to={addPath} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Register Patient
            </Button>
          </Link>
        )}
      </div>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto">
        {PATIENT_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary-600 text-white'
                : 'bg-surface text-muted hover:bg-primary-50 hover:text-primary-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <form onSubmit={handleSearch} className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, mobile, or token..."
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
              Search
            </Button>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
          </div>
        </form>
        <Select
          options={PATIENT_STATUS_FILTER_OPTIONS}
          placeholder="All Statuses"
          value={statusFilter}
          onChange={(e) => {
            setPage(1)
            setStatusFilter(e.target.value)
            if (e.target.value) {
              setFilter('')
            }
          }}
          className="w-full min-w-0 lg:w-auto lg:min-w-[11rem]"
        />
        {isAdmin && (
          <DatePicker
            value={dateFilter}
            onChange={handleDateFilterChange}
            placeholder="Select date"
            aria-label="Filter by registration date"
            className="w-full min-w-0 lg:w-auto"
          />
        )}
        {isAdmin && dateFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleDateFilterChange('')}
          >
            Clear Date
          </Button>
        )}
      </div>

      {showListStatus ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ListStatus
            loading={loading && patients.length === 0}
            error={patients.length === 0 ? loadError : ''}
            empty={patients.length === 0}
            emptyLabel="No patients found."
            onRetry={() => fetchPatients()}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {patients.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${
                  rowOpensDetail ? 'cursor-pointer' : ''
                }`}
                onClick={rowOpensDetail ? () => navigate(detailPath(p.id)) : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{p.patient_name}</p>
                    <p className="mt-0.5 font-mono text-sm text-primary-600">
                      {formatTokenForUi(p.token_number)} · Visit #{p.visit_number || 1}
                    </p>
                  </div>
                  <PatientStatusBadge status={p.status} />
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {(p.care_type || p.admission_status) && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <CareTypeBadge careType={p.care_type} />
                      <AdmissionStatusBadge status={p.admission_status} />
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Mobile</dt>
                    <dd className="text-foreground">{p.mobile}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Age / Gender</dt>
                    <dd className="text-foreground">
                      {p.age} / {p.gender}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Registered</dt>
                    <dd className="text-right text-foreground">{formatDate(p.created_at)}</dd>
                  </div>
                </dl>
                <div
                  className="mt-3 flex items-center justify-end border-t border-border pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  {renderPatientActions(p)}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
            <div className="table-scroll">
              <table className="w-full min-w-[72rem] text-left text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Token</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Visit</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Name</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Mobile</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Age/Gender</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Patient Type</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Admission</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Created By</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Registered</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {patients.map((p) => (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-surface/50 ${
                        rowOpensDetail ? 'cursor-pointer' : ''
                      }`}
                      onClick={rowOpensDetail ? () => navigate(detailPath(p.id)) : undefined}
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-mono font-semibold text-primary-600 sm:px-6">
                        {formatTokenForUi(p.token_number)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">#{p.visit_number || 1}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-foreground sm:px-6">{p.patient_name}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{p.mobile}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">
                        {p.age} / {p.gender}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {p.care_type ? <CareTypeBadge careType={p.care_type} /> : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {p.admission_status ? <AdmissionStatusBadge status={p.admission_status} /> : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <PatientStatusBadge status={p.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{p.created_by_name || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{formatDate(p.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {renderPatientActions(p)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
                <p className="text-sm text-muted">
                  Page {page} of {pagination.total_pages}
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!pagination.has_previous || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!pagination.has_next || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:px-6 lg:hidden">
              <p className="text-sm text-muted">
                Page {page} of {pagination.total_pages}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination.has_previous || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!pagination.has_next || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {canDelete && (
        <ConfirmDialog
          open={deleteDialog.open}
          title="Delete Patient"
          message={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          loading={Boolean(actionLoading)}
          onConfirm={handleDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}

export function AdminPatientListPage() {
  return (
    <PatientListPage
      basePath={ROUTES.ADMIN_PATIENTS}
      canRegister
      canEdit
      canDelete
      isAdmin
    />
  )
}

export function ReceptionPatientListPage() {
  return (
    <PatientListPage
      basePath={ROUTES.RECEPTION_PATIENTS}
      canRegister
      canEdit
      defaultFilter="today"
      rowOpensDetail
    />
  )
}
