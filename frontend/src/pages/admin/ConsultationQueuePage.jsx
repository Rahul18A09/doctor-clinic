import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doctorConsultationService } from '@/api/doctor'
import { AdmissionStatusBadge, CareTypeBadge } from '@/components/patients/AdmissionBadges'
import { PatientStatusBadge } from '@/components/patients/PatientStatusBadge'
import { Button, CompleteTreatmentDialog, ConfirmDialog, getAppliedSearchFromInput, ListStatus, RefreshButton } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import {
  CONSULTATION_TAB_LABELS,
  CONSULTATION_TABS,
  PATIENT_STATUS,
  ROUTES,
} from '@/utils/constants'
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

const TAB_STATUS_MAP = {
  [CONSULTATION_TABS.WAITING]: 'active',
  [CONSULTATION_TABS.IN_CONSULTATION]: PATIENT_STATUS.IN_CONSULTATION,
  [CONSULTATION_TABS.COMPLETED]: PATIENT_STATUS.COMPLETED,
}

function ViewIconButton({ onClick }) {
  return (
    <button
      type="button"
      aria-label="View"
      onClick={onClick}
      className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-primary-600"
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

function RowActionsMenu({ isOpen, isLoading, onToggle, onClose, actions }) {
  const buttonRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setMenuStyle(null)
      return undefined
    }

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        setMenuStyle(null)
        return
      }
      const menuWidth = 208
      const menuHeight = actions.length * 44 + 8
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8
      )
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < menuHeight + 12 && rect.top > menuHeight + 12
      const top = openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4

      setMenuStyle({
        position: 'fixed',
        top,
        left,
        width: menuWidth,
        zIndex: 50,
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, actions.length])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Actions"
        aria-expanded={isOpen}
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>

      {isOpen &&
        menuStyle &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
            <div
              style={menuStyle}
              className="overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl"
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={action.disabled}
                  onClick={() => {
                    if (action.disabled) return
                    onClose()
                    action.onClick()
                  }}
                  className={`flex w-full px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    action.danger
                      ? 'text-red-600 hover:bg-red-50 disabled:hover:bg-transparent'
                      : 'text-foreground hover:bg-surface disabled:hover:bg-transparent'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  )
}

export function ConsultationQueuePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showSuccess, showError } = useToast()
  const { refresh: refreshNotifications } = useNotifications()

  const activeTab = searchParams.get('tab') || CONSULTATION_TABS.WAITING
  const todayOnly = searchParams.get('today') !== 'false'

  const [patients, setPatients] = useState([])
  const [stats, setStats] = useState({
    waiting: 0,
    in_consultation: 0,
    completed: 0,
    today: 0,
  })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total_pages: 1,
    total: 0,
    has_next: false,
    has_previous: false,
  })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    type: null,
    patient: null,
  })
  const [openMenuId, setOpenMenuId] = useState(null)

  const skipAutoFetchRef = useRef(false)

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data: res } = await doctorConsultationService.getStats()
      setStats(res.data)
    } catch (err) {
      if (!silent) showError(err.response?.data?.message || err.message)
    }
  }, [showError])

  const fetchPatients = useCallback(
    async ({ silent = false, search: searchOverride, page: pageOverride } = {}) => {
      if (!silent) setLoading(true)
      const appliedSearch = searchOverride !== undefined ? searchOverride : search
      const appliedPage = pageOverride !== undefined ? pageOverride : page
      try {
        const status = TAB_STATUS_MAP[activeTab]
        const params = { page: appliedPage, page_size: 10, search: appliedSearch, status }
        if (todayOnly && activeTab === CONSULTATION_TABS.WAITING) {
          params.today = 'true'
        }

        const fetcher =
          activeTab === CONSULTATION_TABS.COMPLETED
            ? doctorConsultationService.listCompleted
            : doctorConsultationService.list

        const { data: res } = await fetcher(params)
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
    [activeTab, page, search, todayOnly, showError]
  )

  const refreshAll = useCallback(
    ({ silent = false } = {}) => {
      fetchStats({ silent })
      fetchPatients({ silent })
    },
    [fetchStats, fetchPatients]
  )

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false
      return
    }
    refreshAll()
  }, [refreshAll])

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
      await Promise.all([
        fetchStats({ silent: true }),
        fetchPatients({ silent: true, search: nextSearch, page: nextPage }),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setPage(1)
    setSearch('')
    setSearchInput('')
  }, [activeTab])

  const setTab = (tab) => {
    setSearchParams({ tab })
  }

  const setWaitingTodayFilter = (onlyToday) => {
    setPage(1)
    setSearchParams(
      onlyToday
        ? { tab: CONSULTATION_TABS.WAITING }
        : { tab: CONSULTATION_TABS.WAITING, today: 'false' }
    )
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleStartConsultation = async (patient) => {
    setActionLoading(patient.id)
    try {
      await doctorConsultationService.start(patient.id)
      await refreshNotifications()
      showSuccess(`Consultation started for ${patient.patient_name}.`)
      refreshAll()
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleContinueConsultation = (patient) => {
    navigate(ROUTES.ADMIN_CONSULTATION.replace(':id', patient.id))
  }

  const handleCompleteFromList = async (patient) => {
    setActionLoading(patient.id)
    try {
      await doctorConsultationService.complete(patient.id)
      await refreshNotifications()
      setConfirmDialog({ open: false, type: null, patient: null })
      showSuccess('Treatment completed successfully.')
      refreshAll()
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelFromList = async (patient) => {
    setActionLoading(patient.id)
    try {
      await doctorConsultationService.cancel(patient.id)
      showSuccess(`${patient.patient_name} returned to waiting queue.`)
      setConfirmDialog({ open: false, type: null, patient: null })
      refreshAll()
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const tabCounts = {
    [CONSULTATION_TABS.WAITING]: stats.waiting + stats.in_consultation,
    [CONSULTATION_TABS.IN_CONSULTATION]: stats.in_consultation,
    [CONSULTATION_TABS.COMPLETED]: stats.completed,
  }

  const emptyMessages = {
    [CONSULTATION_TABS.WAITING]: 'No patients in the queue.',
    [CONSULTATION_TABS.IN_CONSULTATION]: 'No patients currently in progress.',
    [CONSULTATION_TABS.COMPLETED]: 'No completed visits found.',
  }

  const renderActions = (patient) => {
    const isLoading = actionLoading === patient.id
    const isOpen = openMenuId === patient.id
    const closeMenu = () => setOpenMenuId(null)
    const isWaiting = patient.status === PATIENT_STATUS.WAITING
    const isInConsultation = patient.status === PATIENT_STATUS.IN_CONSULTATION
    const isCompleted = patient.status === PATIENT_STATUS.COMPLETED

    if (isCompleted) {
      return <ViewIconButton onClick={() => handleContinueConsultation(patient)} />
    }

    const actions = [
      {
        label: isLoading ? 'Starting...' : 'Start Consultation',
        disabled: !isWaiting || isLoading,
        onClick: () => handleStartConsultation(patient),
      },
      {
        label: 'Complete Treatment',
        disabled: !(isWaiting || isInConsultation) || isLoading,
        onClick: () =>
          setConfirmDialog({ open: true, type: 'complete', patient }),
      },
      {
        label: 'Cancel Consultation',
        disabled: !isInConsultation || isLoading,
        danger: true,
        onClick: () => setConfirmDialog({ open: true, type: 'cancel', patient }),
      },
      {
        label: 'Open Consultation',
        disabled: isWaiting || isLoading,
        onClick: () => handleContinueConsultation(patient),
      },
    ]

    return (
      <RowActionsMenu
        isOpen={isOpen}
        isLoading={isLoading}
        actions={actions}
        onToggle={() => setOpenMenuId(isOpen ? null : patient.id)}
        onClose={closeMenu}
      />
    )
  }

  const showStartedColumn =
    activeTab === CONSULTATION_TABS.IN_CONSULTATION ||
    activeTab === CONSULTATION_TABS.WAITING
  const showCompletedColumn = activeTab === CONSULTATION_TABS.COMPLETED

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Consultations</h2>
        <p className="mt-1 text-sm text-muted">
          Manage waiting, in-progress, and completed consultations.
        </p>
      </div>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto border-b border-border">
        {Object.values(CONSULTATION_TABS).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTab(tab)}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {CONSULTATION_TAB_LABELS[tab]}
            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs">
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {activeTab === CONSULTATION_TABS.WAITING && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWaitingTodayFilter(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !todayOnly
                ? 'bg-primary-600 text-white'
                : 'bg-surface text-muted hover:bg-primary-50 hover:text-primary-600'
            }`}
          >
            All Waiting
          </button>
          <button
            type="button"
            onClick={() => setWaitingTodayFilter(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              todayOnly
                ? 'bg-primary-600 text-white'
                : 'bg-surface text-muted hover:bg-primary-50 hover:text-primary-600'
            }`}
          >
            Today&apos;s Patients
          </button>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex min-w-0 flex-col gap-3 sm:flex-row">
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

      {patients.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ListStatus
            loading={loading}
            error={loadError}
            empty
            emptyLabel={emptyMessages[activeTab]}
            onRetry={() => refreshAll()}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {patients.map((p) => (
              <div
                key={p.id}
                className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm"
                onClick={() => handleContinueConsultation(p)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{p.patient_name}</p>
                    <p className="mt-0.5 font-mono text-sm text-primary-600">
                      {formatTokenForUi(p.token_number)} · Visit #{p.visit_number || 1}
                    </p>
                    {(p.care_type || p.admission_status) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CareTypeBadge careType={p.care_type} />
                        <AdmissionStatusBadge status={p.admission_status} />
                      </div>
                    )}
                    {p.assigned_bed?.label ? (
                      <p className="mt-1 text-xs text-muted">{p.assigned_bed.label}</p>
                    ) : null}
                  </div>
                  <PatientStatusBadge status={p.status} />
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Age / Gender</dt>
                    <dd className="text-foreground">
                      {p.age} / {p.gender}
                    </dd>
                  </div>
                  {p.chief_complaint ? (
                    <div>
                      <dt className="text-muted">Chief complaint</dt>
                      <dd className="mt-0.5 text-foreground">{p.chief_complaint}</dd>
                    </div>
                  ) : null}
                  {showCompletedColumn && p.diagnosis ? (
                    <div>
                      <dt className="text-muted">Diagnosis</dt>
                      <dd className="mt-0.5 text-foreground">{p.diagnosis}</dd>
                    </div>
                  ) : null}
                </dl>
                <div
                  className="mt-3 flex items-center justify-end border-t border-border pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  {renderActions(p)}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
            <div className="table-scroll">
              <table className="w-full min-w-[68rem] text-left text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Token</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Visit</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Patient Name</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Patient Type</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Admission Status</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Age</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Gender</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Chief Complaint</th>
                    {showStartedColumn && (
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Time</th>
                    )}
                    {showCompletedColumn && (
                      <>
                        <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Diagnosis</th>
                        <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Completed At</th>
                      </>
                    )}
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Visit Status</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {patients.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-surface/50"
                      onClick={() => handleContinueConsultation(p)}
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-mono font-semibold text-primary-600 sm:px-6">
                        {formatTokenForUi(p.token_number)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">#{p.visit_number || 1}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-foreground sm:px-6">{p.patient_name}</td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {p.care_type ? <CareTypeBadge careType={p.care_type} /> : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {p.admission_status ? <AdmissionStatusBadge status={p.admission_status} /> : '—'}
                        {p.assigned_bed?.label ? (
                          <p className="mt-1 text-xs text-muted">{p.assigned_bed.label}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{p.age}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{p.gender}</td>
                      <td className="max-w-xs truncate whitespace-nowrap px-4 py-4 text-muted sm:px-6">{p.chief_complaint}</td>
                      {showStartedColumn && (
                        <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">
                          {p.status === PATIENT_STATUS.IN_CONSULTATION
                            ? formatDate(p.consultation_started_at)
                            : formatDate(p.created_at)}
                        </td>
                      )}
                      {showCompletedColumn && (
                        <>
                          <td className="max-w-xs truncate whitespace-nowrap px-4 py-4 text-muted sm:px-6">
                            {p.diagnosis || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">
                            {formatDate(p.consultation_completed_at)}
                          </td>
                        </>
                      )}
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <PatientStatusBadge status={p.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
                        {renderActions(p)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pagination.total_pages > 1 && patients.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:px-6">
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

      <CompleteTreatmentDialog
        open={confirmDialog.open && confirmDialog.type === 'complete'}
        patientName={confirmDialog.patient?.patient_name}
        tokenNumber={formatTokenForUi(confirmDialog.patient?.token_number)}
        loading={actionLoading === confirmDialog.patient?.id}
        onConfirm={() => handleCompleteFromList(confirmDialog.patient)}
        onCancel={() => {
          if (actionLoading !== confirmDialog.patient?.id) {
            setConfirmDialog({ open: false, type: null, patient: null })
          }
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.type === 'cancel'}
        title="Cancel Consultation"
        message={`Cancel consultation for "${confirmDialog.patient?.patient_name}"? The patient will return to the waiting queue. Draft data will be preserved.`}
        confirmLabel="Cancel Consultation"
        loading={actionLoading === confirmDialog.patient?.id}
        onConfirm={() => handleCancelFromList(confirmDialog.patient)}
        onCancel={() => setConfirmDialog({ open: false, type: null, patient: null })}
      />
    </div>
  )
}
