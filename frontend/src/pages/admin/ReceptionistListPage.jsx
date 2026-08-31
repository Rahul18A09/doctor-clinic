import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { receptionistService } from '@/api/receptionists'
import { EditIconButton, DeleteIconButton } from '@/components/patients/ViewIconButton'
import { Badge, Button, ConfirmDialog, getAppliedSearchFromInput, ListStatus, RefreshButton } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { ROUTES } from '@/utils/constants'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ReceptionistListPage() {
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const { refresh: refreshNotifications } = useNotifications()

  const [receptionists, setReceptionists] = useState([])
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

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [toggleDialog, setToggleDialog] = useState({
    open: false,
    id: null,
    name: '',
    action: null,
  })

  const skipAutoFetchRef = useRef(false)

  const fetchReceptionists = useCallback(
    async ({ silent = false, search: searchOverride, page: pageOverride } = {}) => {
      if (!silent) setLoading(true)
      const appliedSearch = searchOverride !== undefined ? searchOverride : search
      const appliedPage = pageOverride !== undefined ? pageOverride : page
      try {
        const { data: res } = await receptionistService.list({
          page: appliedPage,
          page_size: 10,
          search: appliedSearch,
        })
        setReceptionists(res.data.results)
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
    [page, search, showError]
  )

  useEffect(() => {
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false
      return
    }
    fetchReceptionists()
  }, [fetchReceptionists])

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
      await fetchReceptionists({ silent: true, search: nextSearch, page: nextPage })
    } finally {
      setRefreshing(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleDelete = async () => {
    setActionLoading(deleteDialog.id)
    try {
      await receptionistService.delete(deleteDialog.id)
      showSuccess('Receptionist deleted successfully.')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchReceptionists()
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async () => {
    const { id, action } = toggleDialog
    setActionLoading(id)
    try {
      if (action === 'activate') {
        await receptionistService.activate(id)
        showSuccess('Receptionist activated successfully.')
      } else {
        await receptionistService.deactivate(id)
        showSuccess('Receptionist deactivated successfully.')
      }
      setToggleDialog({ open: false, id: null, name: '', action: null })
      await refreshNotifications()
      fetchReceptionists()
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Receptionists</h2>
          <p className="mt-1 text-sm text-muted">
            Manage clinic reception staff ({pagination.total} total)
          </p>
        </div>
        <Link to={ROUTES.ADMIN_RECEPTIONISTS_ADD} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Receptionist
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex min-w-0 flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, email, or mobile..."
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            Search
          </Button>
          <RefreshButton onClick={handleRefresh} loading={refreshing} />
        </div>
      </form>

      {receptionists.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ListStatus
            loading={loading}
            error={loadError}
            empty
            emptyLabel="No receptionists found."
            onRetry={() => fetchReceptionists()}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {receptionists.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{r.full_name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">{r.email}</p>
                  </div>
                  <Badge variant={r.is_active ? 'success' : 'danger'}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Mobile</dt>
                    <dd className="text-foreground">{r.mobile || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Created</dt>
                    <dd className="text-foreground">{formatDate(r.created_at)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
                  <EditIconButton onClick={() => navigate(`/admin/receptionists/${r.id}/edit`)} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading === r.id}
                    onClick={() =>
                      setToggleDialog({
                        open: true,
                        id: r.id,
                        name: r.full_name,
                        action: r.is_active ? 'deactivate' : 'activate',
                      })
                    }
                  >
                    {r.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <DeleteIconButton
                    disabled={actionLoading === r.id}
                    onClick={() => setDeleteDialog({ open: true, id: r.id, name: r.full_name })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
            <div className="table-scroll">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Name</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Email</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Mobile</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Created</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receptionists.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/50 transition-colors">
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-foreground sm:px-6">{r.full_name}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{r.email}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{r.mobile || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <Badge variant={r.is_active ? 'success' : 'danger'}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{formatDate(r.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-1">
                          <EditIconButton
                            onClick={() => navigate(`/admin/receptionists/${r.id}/edit`)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === r.id}
                            onClick={() =>
                              setToggleDialog({
                                open: true,
                                id: r.id,
                                name: r.full_name,
                                action: r.is_active ? 'deactivate' : 'activate',
                              })
                            }
                          >
                            {r.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <DeleteIconButton
                            disabled={actionLoading === r.id}
                            onClick={() =>
                              setDeleteDialog({ open: true, id: r.id, name: r.full_name })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pagination.total_pages > 1 && receptionists.length > 0 && (
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

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Receptionist"
        message={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={actionLoading === deleteDialog.id}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <ConfirmDialog
        open={toggleDialog.open}
        title={toggleDialog.action === 'activate' ? 'Activate Receptionist' : 'Deactivate Receptionist'}
        message={`Are you sure you want to ${toggleDialog.action} "${toggleDialog.name}"?`}
        confirmLabel={toggleDialog.action === 'activate' ? 'Activate' : 'Deactivate'}
        variant={toggleDialog.action === 'activate' ? 'primary' : 'danger'}
        loading={actionLoading === toggleDialog.id}
        onConfirm={handleToggleStatus}
        onCancel={() => setToggleDialog({ open: false, id: null, name: '', action: null })}
      />
    </div>
  )
}
